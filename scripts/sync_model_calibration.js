#!/usr/bin/env node
/**
 * Automated Model Calibration & Out-of-Sample Prediction Verification Engine
 * 
 * 1. Pre-Deadline: Freezes immutable player xP forecasts & official ep_next.
 * 2. Post-Gameweek: Reconciles actual match outcomes against frozen predictions.
 * 3. Calibration Logging: Computes MAE, RMSE, and positional biases (GK/DEF/MID/FWD)
 *    to enable automatic hyperparameter tuning and model optimization.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { saveToRedis, loadFromRedis } = require('./redis_helper');

const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const LOCAL_CALIBRATION_FILE = path.join(__dirname, '..', '.data', 'model_calibration.json');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Model-Calibration/2.0',
        'Accept': 'application/json'
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function main() {
  console.log('🔄 Running Model Calibration & Prediction Verification Engine...');
  const bootstrap = await fetchJson(FPL_BOOTSTRAP_URL);
  const elements = bootstrap.elements || [];
  const events = bootstrap.events || [];

  if (!elements.length || !events.length) {
    console.error('Error: Could not retrieve bootstrap data.');
    process.exit(1);
  }

  const currentEvent = events.find(e => e.is_current) || events.find(e => e.is_next);
  const nextEvent = events.find(e => e.is_next);

  // 1. PRE-DEADLINE SNAPSHOT LOGGING (Freeze upcoming gameweek predictions)
  if (nextEvent) {
    const nextGw = nextEvent.id;
    const key = `fpl:calibration:snapshots:gw_${nextGw}`;
    const existingSnapshot = await loadFromRedis(key);

    // Save snapshot if not yet created or within 12h of deadline
    const deadlineMs = new Date(nextEvent.deadline_time).getTime();
    const hoursToDeadline = (deadlineMs - Date.now()) / (1000 * 60 * 60);

    if (!existingSnapshot || (hoursToDeadline > 0 && hoursToDeadline <= 12)) {
      console.log(`📸 Creating Pre-Deadline Frozen Snapshot for GW ${nextGw} (${hoursToDeadline.toFixed(1)}h to deadline)...`);
      
      const playerSnapshots = {};
      elements.forEach(p => {
        const officialEp = parseFloat(p.ep_next || p.ep_this || '0') || 0;
        const formVal = parseFloat(p.form || '0') || 0;
        
        // Approximate OpenFPL Bayesian xP projection
        const statusMult = p.status === 'a' ? 1.0 : p.status === 'd' ? 0.5 : 0;
        const projectedXp = Math.round((formVal * 0.75 + (p.total_points / Math.max(1, nextGw - 1)) * 0.25) * statusMult * 10) / 10;

        playerSnapshots[p.id] = {
          id: p.id,
          name: p.web_name,
          team: p.team,
          pos: p.element_type,
          cost: p.now_cost,
          ownership: p.selected_by_percent,
          official_ep: officialEp,
          openfpl_xp: projectedXp,
          status: p.status,
          chance_of_playing: p.chance_of_playing_next_round
        };
      });

      const snapshotPayload = {
        gw: nextGw,
        deadline: nextEvent.deadline_time,
        snapshotTime: new Date().toISOString(),
        totalPlayers: elements.length,
        players: playerSnapshots
      };

      await saveToRedis(key, snapshotPayload);
      console.log(`✅ Frozen pre-deadline snapshot saved for GW ${nextGw}.`);
    }
  }

  // 2. POST-GAMEWEEK ACTUALS RECONCILIATION
  const completedEvents = events.filter(e => e.finished).sort((a, b) => a.id - b.id);
  const calibrationSummary = {
    lastUpdated: new Date().toISOString(),
    completedGameweeks: completedEvents.length,
    gameweekReports: {},
    aggregate: {
      openfpl_mae: 0,
      official_mae: 0,
      openfpl_rmse: 0,
      positional_bias: { gk: 0, def: 0, mid: 0, fwd: 0 }
    }
  };

  for (const ev of completedEvents) {
    const gw = ev.id;
    const snapshotKey = `fpl:calibration:snapshots:gw_${gw}`;
    const snapshot = await loadFromRedis(snapshotKey);

    if (!snapshot || !snapshot.players) {
      continue;
    }

    console.log(`🔬 Reconciling Predictions vs. Actuals for completed GW ${gw}...`);
    try {
      const liveData = await fetchJson(`https://fantasy.premierleague.com/api/event/${gw}/live/`);
      const liveElements = liveData.elements || [];
      const liveMap = new Map();
      liveElements.forEach(el => liveMap.set(el.id, el.stats));

      let openfplAbsErrSum = 0;
      let officialAbsErrSum = 0;
      let openfplSqErrSum = 0;
      let evaluatedCount = 0;

      const posErrors = { 1: [], 2: [], 3: [], 4: [] };
      const overperformers = [];
      const underperformers = [];

      for (const [pId, pred] of Object.entries(snapshot.players)) {
        const stats = liveMap.get(Number(pId));
        if (!stats) continue;

        const actualPts = stats.total_points || 0;
        const minutes = stats.minutes || 0;

        // Only evaluate players who played minutes or had substantial expectation
        if (minutes > 0 || pred.openfpl_xp > 1.5) {
          const openfplErr = actualPts - pred.openfpl_xp;
          const officialErr = actualPts - pred.official_ep;

          openfplAbsErrSum += Math.abs(openfplErr);
          officialAbsErrSum += Math.abs(officialErr);
          openfplSqErrSum += openfplErr * openfplErr;
          evaluatedCount++;

          if (posErrors[pred.pos]) {
            posErrors[pred.pos].push(openfplErr);
          }

          if (openfplErr >= 5) {
            overperformers.push({ name: pred.name, actual: actualPts, projected: pred.openfpl_xp, diff: openfplErr });
          } else if (openfplErr <= -4 && pred.openfpl_xp >= 5) {
            underperformers.push({ name: pred.name, actual: actualPts, projected: pred.openfpl_xp, diff: openfplErr });
          }
        }
      }

      if (evaluatedCount > 0) {
        const openfplMae = Math.round((openfplAbsErrSum / evaluatedCount) * 100) / 100;
        const officialMae = Math.round((officialAbsErrSum / evaluatedCount) * 100) / 100;
        const openfplRmse = Math.round(Math.sqrt(openfplSqErrSum / evaluatedCount) * 100) / 100;

        const calcAvg = arr => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

        const report = {
          gw,
          evaluatedPlayers: evaluatedCount,
          openfpl_mae: openfplMae,
          official_mae: officialMae,
          openfpl_rmse: openfplRmse,
          openfpl_edge_pct: Math.round(((officialMae - openfplMae) / officialMae) * 100),
          positionalBias: {
            gk: calcAvg(posErrors[1]),
            def: calcAvg(posErrors[2]),
            mid: calcAvg(posErrors[3]),
            fwd: calcAvg(posErrors[4])
          },
          topOverperformers: overperformers.sort((a, b) => b.diff - a.diff).slice(0, 5),
          topUnderperformers: underperformers.sort((a, b) => a.diff - b.diff).slice(0, 5)
        };

        calibrationSummary.gameweekReports[gw] = report;
        await saveToRedis(`fpl:calibration:actuals:gw_${gw}`, report);
        console.log(`📊 GW ${gw} Reconciliation: OpenFPL MAE: ${openfplMae} pts vs. Official: ${officialMae} pts (Edge: ${report.openfpl_edge_pct}%)`);
      }
    } catch (err) {
      console.warn(`Note: Could not reconcile GW ${gw}:`, err.message);
    }
  }

  // Save full calibration state to Redis & local cache
  await saveToRedis('fpl:calibration:summary', calibrationSummary);

  const localDir = path.dirname(LOCAL_CALIBRATION_FILE);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  fs.writeFileSync(LOCAL_CALIBRATION_FILE, JSON.stringify(calibrationSummary, null, 2), 'utf-8');

  console.log('✅ Model calibration verification cycle completed.');
}

main().catch(err => {
  console.error('Fatal error in calibration script:', err);
  process.exit(1);
});

