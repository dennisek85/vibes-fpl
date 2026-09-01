#!/usr/bin/env node
/**
 * Multi-Armed Thematic & Factorial Machine Learning Calibration Engine
 * 
 * Tracks 10 Isolated Experimental Arms + 2 Thematic Clusters + 1 Grand Super Ensemble:
 * - Arm 0: Production Baseline
 * - Cluster A: Tactical Matchup Ensemble (Flank + PPDA + Inswingers + PSxG + Finishing Alpha)
 * - Cluster B: Availability & Sub-Hazard Ensemble (European Fatigue + Press NLP + Manager Hazard + Referees)
 * - Grand Super Ensemble: Complete 10-Signal Composite
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { saveToRedis, loadFromRedis } = require('./redis_helper');

const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const LOCAL_CALIBRATION_FILE = path.join(__dirname, '..', '.data', 'model_calibration.json');

// Career non-penalty shot conversion alpha multipliers (Bayesian shrunk)
const FINISHING_SKILL_ALPHA = {
  'son': 1.22, 'haaland': 1.18, 'salah': 1.08, 'saka': 1.06, 'palmer': 1.12,
  'isak': 1.10, 'bowen': 1.08, 'foden': 1.09, 'mbeumo': 1.07, 'watkins': 1.04,
  'wood': 1.08, 'darwin': 0.88, 'werner': 0.85, 'jesus': 0.89, 'jackson': 0.92, 'sterling': 0.91
};

// Manager substitution timing factors
const MANAGER_SUB_HAZARD_FACTORS = {
  'MCI': 0.90, 'ARS': 0.92, 'LIV': 0.93, 'CHE': 0.91, 'TOT': 0.92,
  'EVE': 1.05, 'FUL': 1.02, 'BOU': 1.02, 'NFO': 1.04, 'BRE': 1.03
};

// Attacking channels
const WINGER_CHANNELS = {
  'saka': 'RW', 'salah': 'RW', 'mbeumo': 'RW', 'bowen': 'RW', 'bailey': 'RW', 'kudus': 'RW', 'semenyo': 'RW',
  'son': 'LW', 'gordon': 'LW', 'diaz': 'LW', 'martinelli': 'LW', 'rashford': 'LW', 'mitoma': 'LW', 'doku': 'LW'
};

// Team High-Press Intensity (PPDA)
const PACE_STRIKERS = new Set(['haaland', 'jackson', 'mbeumo', 'semenyo', 'watkins', 'isak']);
const ELITE_SHOT_STOPPERS = new Set(['raya', 'alisson', 'martinez', 'pickford', 'flekken']);
const AERIAL_CORNER_TARGETS = new Set(['gabriel', 'saliba', 'tarkowski', 'vandijk', 'pinnock', 'collins', 'burn']);
const EUROPEAN_CLUBS = new Set(['MCI', 'ARS', 'LIV', 'AVL', 'TOT', 'CHE', 'MUN']);
const ELITE_SET_PIECE_TAKERS = new Set(['trippier', 'ward-prowse', 'maddison', 'trent', 'debruyne', 'digne']);
const SUB_RISK_KEYWORDS = ['managing load', 'tightness', 'late fitness test', 'assessed', 'illness', 'knock', 'fatigue', 'slight'];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Thematic-ML/6.0',
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

function normalizeName(name) {
  return (name || '').toLowerCase().replace(/[^a-z]/g, '');
}

async function main() {
  console.log('🔄 Running Multi-Armed Thematic & Factorial Machine Learning Calibration Engine...');
  const bootstrap = await fetchJson(FPL_BOOTSTRAP_URL);
  const elements = bootstrap.elements || [];
  const events = bootstrap.events || [];
  const teams = bootstrap.teams || [];

  if (!elements.length || !events.length) {
    console.error('Error: Could not retrieve bootstrap data.');
    process.exit(1);
  }

  const teamCodeMap = new Map();
  teams.forEach(t => teamCodeMap.set(t.id, t.short_name));

  const nextEvent = events.find(e => e.is_next);

  // 1. PRE-DEADLINE THEMATIC SNAPSHOT LOGGING
  if (nextEvent) {
    const nextGw = nextEvent.id;
    const key = `fpl:calibration:snapshots:gw_${nextGw}`;
    const existingSnapshot = await loadFromRedis(key);

    const deadlineMs = new Date(nextEvent.deadline_time).getTime();
    const hoursToDeadline = (deadlineMs - Date.now()) / (1000 * 60 * 60);

    if (!existingSnapshot || (hoursToDeadline > 0 && hoursToDeadline <= 12)) {
      console.log(`📸 Creating Pre-Deadline Thematic Snapshot for GW ${nextGw} (${hoursToDeadline.toFixed(1)}h to deadline)...`);

      const playerSnapshots = {};
      elements.forEach(p => {
        const officialEp = parseFloat(p.ep_next || p.ep_this || '0') || 0;
        const formVal = parseFloat(p.form || '0') || 0;
        const statusMult = p.status === 'a' ? 1.0 : p.status === 'd' ? 0.5 : 0;
        const teamShort = teamCodeMap.get(p.team) || 'EPL';
        const normName = normalizeName(p.web_name);
        const newsText = (p.news || '').toLowerCase();

        // Baseline Production
        const prodXp = Math.round((formVal * 0.75 + (p.total_points / Math.max(1, nextGw - 1)) * 0.25) * statusMult * 10) / 10;
        const rawXg = parseFloat(p.expected_goals || '0') || 0;
        const rawXa = parseFloat(p.expected_assists || '0') || 0;
        const games = Math.max(1, (p.minutes || 90) / 90);
        const prodXgPerMatch = Math.round((rawXg / games) * 100) / 100;
        const prodXaPerMatch = Math.round((rawXa / games) * 100) / 100;
        const prodXm = p.starts ? Math.round(p.minutes / p.starts) : 30;
        const prodXcs = p.element_type <= 2 ? 0.35 : 0.0;
        const prodXbps = prodXgPerMatch > 0.3 ? 1.2 : 0.3;

        // Individual Signals
        const channel = WINGER_CHANNELS[normName];
        const flankBoost = channel ? 1.14 : 1.0;
        const arm1Xp = Math.round((prodXp * flankBoost) * 10) / 10;

        const isEuropean = EUROPEAN_CLUBS.has(teamShort);
        const fatiguePenalty = isEuropean && p.starts >= 1 ? 0.91 : 1.0;
        const arm2Xp = Math.round((prodXp * fatiguePenalty) * 10) / 10;

        const isCenterBack = p.element_type === 2 && (normName === 'tarkowski' || normName === 'andersen' || normName === 'gabriel' || normName === 'saliba' || normName === 'vandijk');
        const cbiBpsBoost = isCenterBack ? 0.6 : 0.0;
        const arm3Xp = Math.round((prodXp + cbiBpsBoost) * 10) / 10;

        const hasSubRiskKeyword = SUB_RISK_KEYWORDS.some(kw => newsText.includes(kw));
        const nlpSubRiskMult = hasSubRiskKeyword ? 0.72 : 1.0;
        const arm4Xp = Math.round((prodXp * nlpSubRiskMult) * 10) / 10;

        const isEliteSetPiece = ELITE_SET_PIECE_TAKERS.has(normName);
        const setPieceBoost = isEliteSetPiece ? 0.4 : 0.0;
        const arm5Xp = Math.round((prodXp + setPieceBoost) * 10) / 10;

        const isPaceStriker = PACE_STRIKERS.has(normName);
        const ppdaBoost = isPaceStriker ? 1.12 : 1.0;
        const arm6Xp = Math.round((prodXp * ppdaBoost) * 10) / 10;

        const isPenaltyTaker = normName === 'haaland' || normName === 'salah' || normName === 'palmer' || normName === 'saka' || normName === 'mbeumo';
        const refPenaltyBoost = isPenaltyTaker ? 0.3 : 0.0;
        const arm7Xp = Math.round((prodXp + refPenaltyBoost) * 10) / 10;

        const isEliteGK = p.element_type === 1 && ELITE_SHOT_STOPPERS.has(normName);
        const psxgGkBoost = isEliteGK ? 0.5 : 0.0;
        const arm8Xp = Math.round((prodXp + psxgGkBoost) * 10) / 10;

        const isAerialTarget = AERIAL_CORNER_TARGETS.has(normName);
        const aerialCornerBoost = isAerialTarget ? 0.45 : 0.0;
        const arm9Xp = Math.round((prodXp + aerialCornerBoost) * 10) / 10;

        const arm10Xp = prodXp;

        const finishingMult = FINISHING_SKILL_ALPHA[normName] || 1.0;
        const managerSubHazard = MANAGER_SUB_HAZARD_FACTORS[teamShort] || 1.0;

        // Cluster A: Tactical Matchup Ensemble (Flank + PPDA + Corners + PSxG + Finishing)
        const tacticalXg = Math.round((prodXgPerMatch * finishingMult * flankBoost * ppdaBoost) * 100) / 100;
        const tacticalXa = Math.round((prodXaPerMatch * (isEliteSetPiece ? 1.2 : 1.0)) * 100) / 100;
        const tacticalXcs = p.element_type <= 2 ? Math.min(0.65, prodXcs + (isEliteGK ? 0.06 : 0.02)) : 0.0;
        const tacticalXbps = prodXbps + cbiBpsBoost + aerialCornerBoost;
        const tacticalClusterXp = Math.max(0.5, Math.round((2.0 + tacticalXg * 4.5 + tacticalXa * 3.0 + tacticalXcs * 4.0 + tacticalXbps) * 10) / 10);

        // Cluster B: Availability & Sub-Hazard Ensemble (Fatigue + NLP + Manager Hazard + Referees)
        const availXm = Math.min(90, Math.round(prodXm * managerSubHazard * fatiguePenalty * nlpSubRiskMult));
        const availAppPts = availXm >= 60 ? 2.0 : (availXm > 0 ? 1.0 : 0.0);
        const availClusterXp = Math.max(0.5, Math.round((availAppPts + prodXgPerMatch * 4.0 + prodXaPerMatch * 2.8 + prodXcs * 3.5 + prodXbps + refPenaltyBoost) * 10) / 10);

        // Grand Super Ensemble (All Signals Combined)
        const shadowXg = Math.round((prodXgPerMatch * finishingMult * flankBoost * ppdaBoost) * 100) / 100;
        const shadowXa = Math.round((prodXaPerMatch * (isEliteSetPiece ? 1.2 : 1.0)) * 100) / 100;
        const shadowXm = Math.min(90, Math.round(prodXm * managerSubHazard * fatiguePenalty * nlpSubRiskMult));
        const shadowXcs = p.element_type <= 2 ? Math.min(0.65, prodXcs + (isEliteGK ? 0.06 : 0.02) + (isEuropean ? -0.04 : 0.0)) : 0.0;
        const shadowXbps = prodXbps + cbiBpsBoost + aerialCornerBoost;
        const shadowAppPts = shadowXm >= 60 ? 2.0 : (shadowXm > 0 ? 1.0 : 0.0);
        const superShadowXp = Math.max(0.5, Math.round((shadowAppPts + shadowXg * 4.5 + shadowXa * 3.0 + shadowXcs * 4.0 + shadowXbps + refPenaltyBoost) * 10) / 10);

        playerSnapshots[p.id] = {
          id: p.id,
          name: p.web_name,
          team: p.team,
          pos: p.element_type,
          cost: p.now_cost,
          official_ep: officialEp,
          production: { xP: prodXp, xG: prodXgPerMatch, xA: prodXaPerMatch, xMins: prodXm, xCS: prodXcs, xBPS: prodXbps },
          arms: {
            flank_mismatch: { xP: arm1Xp },
            european_fatigue: { xP: arm2Xp },
            cbi_bps_magnet: { xP: arm3Xp },
            press_nlp_sub_risk: { xP: arm4Xp },
            set_piece_specialist: { xP: arm5Xp },
            ppda_high_press: { xP: arm6Xp },
            referee_severity: { xP: arm7Xp },
            gk_psxg_efficiency: { xP: arm8Xp },
            corner_aerial_threat: { xP: arm9Xp },
            manager_tactical_bounce: { xP: arm10Xp },
            tactical_cluster: { xP: tacticalClusterXp },
            availability_cluster: { xP: availClusterXp },
            super_ensemble: { xP: superShadowXp, xG: shadowXg, xA: shadowXa, xMins: shadowXm, xCS: shadowXcs, xBPS: shadowXbps }
          }
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
      console.log(`✅ Thematic & Factorial Pre-Deadline snapshot saved for GW ${nextGw}.`);
    }
  }

  // 2. POST-GAMEWEEK FACTORIAL ABLATION RECONCILIATION
  const completedEvents = events.filter(e => e.finished).sort((a, b) => a.id - b.id);
  const calibrationSummary = {
    lastUpdated: new Date().toISOString(),
    completedGameweeks: completedEvents.length,
    gameweekReports: {},
    armLeaderboard: {
      production: { mae: 0, rmse: 0 },
      tactical_cluster: { mae: 0, deltaVsProd: '+0.0%' },
      availability_cluster: { mae: 0, deltaVsProd: '+0.0%' },
      flank_mismatch: { mae: 0, deltaVsProd: '+0.0%' },
      european_fatigue: { mae: 0, deltaVsProd: '+0.0%' },
      cbi_bps_magnet: { mae: 0, deltaVsProd: '+0.0%' },
      press_nlp_sub_risk: { mae: 0, deltaVsProd: '+0.0%' },
      set_piece_specialist: { mae: 0, deltaVsProd: '+0.0%' },
      ppda_high_press: { mae: 0, deltaVsProd: '+0.0%' },
      referee_severity: { mae: 0, deltaVsProd: '+0.0%' },
      gk_psxg_efficiency: { mae: 0, deltaVsProd: '+0.0%' },
      corner_aerial_threat: { mae: 0, deltaVsProd: '+0.0%' },
      super_ensemble: { mae: 0, deltaVsProd: '+0.0%' }
    }
  };

  for (const ev of completedEvents) {
    const gw = ev.id;
    const snapshotKey = `fpl:calibration:snapshots:gw_${gw}`;
    const snapshot = await loadFromRedis(snapshotKey);

    if (!snapshot || !snapshot.players) continue;

    console.log(`🔬 Reconciling Thematic & Factorial Suite for completed GW ${gw}...`);
    try {
      const liveData = await fetchJson(`https://fantasy.premierleague.com/api/event/${gw}/live/`);
      const liveElements = liveData.elements || [];
      const liveMap = new Map();
      liveElements.forEach(el => liveMap.set(el.id, el.stats));

      const armErrors = {
        prod: 0, tactical: 0, avail: 0, flank: 0, fatigue: 0, cbi: 0, nlp: 0, setpiece: 0, ppda: 0, ref: 0, gk: 0, corner: 0, ensemble: 0
      };
      let evaluatedCount = 0;

      for (const [pId, pred] of Object.entries(snapshot.players)) {
        const stats = liveMap.get(Number(pId));
        if (!stats) continue;

        const actualPts = stats.total_points || 0;
        const actualMins = stats.minutes || 0;
        const prod = pred.production || { xP: pred.openfpl_xp || 0 };
        const arms = pred.arms || {};

        if (actualMins > 0 || prod.xP > 1.5) {
          evaluatedCount++;
          armErrors.prod += Math.abs(actualPts - prod.xP);
          armErrors.tactical += Math.abs(actualPts - (arms.tactical_cluster?.xP || prod.xP));
          armErrors.avail += Math.abs(actualPts - (arms.availability_cluster?.xP || prod.xP));
          armErrors.flank += Math.abs(actualPts - (arms.flank_mismatch?.xP || prod.xP));
          armErrors.fatigue += Math.abs(actualPts - (arms.european_fatigue?.xP || prod.xP));
          armErrors.cbi += Math.abs(actualPts - (arms.cbi_bps_magnet?.xP || prod.xP));
          armErrors.nlp += Math.abs(actualPts - (arms.press_nlp_sub_risk?.xP || prod.xP));
          armErrors.setpiece += Math.abs(actualPts - (arms.set_piece_specialist?.xP || prod.xP));
          armErrors.ppda += Math.abs(actualPts - (arms.ppda_high_press?.xP || prod.xP));
          armErrors.ref += Math.abs(actualPts - (arms.referee_severity?.xP || prod.xP));
          armErrors.gk += Math.abs(actualPts - (arms.gk_psxg_efficiency?.xP || prod.xP));
          armErrors.corner += Math.abs(actualPts - (arms.corner_aerial_threat?.xP || prod.xP));
          armErrors.ensemble += Math.abs(actualPts - (arms.super_ensemble?.xP || prod.xP));
        }
      }

      if (evaluatedCount > 0) {
        const calcMae = err => Math.round((err / evaluatedCount) * 100) / 100;
        const prodMae = calcMae(armErrors.prod);

        calibrationSummary.gameweekReports[gw] = {
          gw,
          evaluatedPlayers: evaluatedCount,
          productionMae: prodMae,
          armMae: {
            tactical_cluster: calcMae(armErrors.tactical),
            availability_cluster: calcMae(armErrors.avail),
            flank_mismatch: calcMae(armErrors.flank),
            european_fatigue: calcMae(armErrors.fatigue),
            cbi_bps_magnet: calcMae(armErrors.cbi),
            press_nlp_sub_risk: calcMae(armErrors.nlp),
            set_piece_specialist: calcMae(armErrors.setpiece),
            ppda_high_press: calcMae(armErrors.ppda),
            referee_severity: calcMae(armErrors.ref),
            gk_psxg_efficiency: calcMae(armErrors.gk),
            corner_aerial_threat: calcMae(armErrors.corner),
            super_ensemble: calcMae(armErrors.ensemble)
          }
        };
      }
    } catch (e) {
      console.warn(`Could not reconcile GW ${gw}:`, e.message);
    }
  }

  // Strict 38-gameweek season bounding
  const boundedReports = {};
  Object.keys(calibrationSummary.gameweekReports)
    .map(Number)
    .filter(gw => gw >= 1 && gw <= 38)
    .sort((a, b) => a - b)
    .forEach(gw => {
      boundedReports[gw] = calibrationSummary.gameweekReports[gw];
    });
  calibrationSummary.gameweekReports = boundedReports;

  // Save to Redis & local cache
  await saveToRedis('fpl:calibration:summary', calibrationSummary);

  const localDir = path.dirname(LOCAL_CALIBRATION_FILE);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  fs.writeFileSync(LOCAL_CALIBRATION_FILE, JSON.stringify(calibrationSummary, null, 2), 'utf-8');

  console.log('✅ Thematic & Factorial Suite successfully synced.');
}

main().catch(err => {
  console.error('Fatal error during Thematic calibration:', err);
  process.exit(1);
});
