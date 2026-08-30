#!/usr/bin/env node
/**
 * Automated FPL Price Changes & Time-Series Snapshot Tracker
 * Runs via GitHub Actions or locally in Node.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FPL_BOOTSTRAP_URL = 'https://fantasy.premierleague.com/api/bootstrap-static/';
const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'price_snapshots.json');
const LOCAL_DATA_FILE = path.join(__dirname, '..', '.data', 'price_snapshots.json');

function getTodayUkDateString() {
  const now = new Date();
  const ukHour = (now.getUTCHours() + 1) % 24;
  if (ukHour < 2) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Price-Tracker/2.0',
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

function loadExistingSnapshots() {
  for (const f of [OUTPUT_FILE, LOCAL_DATA_FILE]) {
    if (fs.existsSync(f)) {
      try {
        const raw = fs.readFileSync(f, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        console.warn(`Note: Could not read ${f}:`, e.message);
      }
    }
  }

  return {
    lastUpdated: new Date().toISOString(),
    lastPriceChangeDate: getTodayUkDateString(),
    baselines: {},
    hourlyHistory: {},
    observedThresholds: {}
  };
}

async function main() {
  console.log('Fetching live FPL bootstrap telemetry...');
  const bootstrap = await fetchJson(FPL_BOOTSTRAP_URL);
  const elements = bootstrap.elements || [];
  if (!elements.length) {
    console.error('Error: No elements found in FPL bootstrap.');
    process.exit(1);
  }

  const snapshotData = loadExistingSnapshots();
  const currentUkDay = getTodayUkDateString();
  const nowMs = Date.now();

  const isNewDay = snapshotData.lastPriceChangeDate !== currentUkDay;
  if (isNewDay) {
    console.log(`🌅 New Trading Day Detected: ${currentUkDay} (Previous: ${snapshotData.lastPriceChangeDate})`);
    snapshotData.lastPriceChangeDate = currentUkDay;
  }

  if (!snapshotData.baselines) snapshotData.baselines = {};
  if (!snapshotData.hourlyHistory) snapshotData.hourlyHistory = {};
  if (!snapshotData.observedThresholds) snapshotData.observedThresholds = {};

  const changesDetected = [];

  for (const p of elements) {
    const pId = String(p.id);
    const currentCost = p.now_cost || 50;
    const currentIn = p.transfers_in_event || 0;
    const currentOut = p.transfers_out_event || 0;

    let baseline = snapshotData.baselines[pId];

    if (baseline) {
      const prevCost = baseline.cost || currentCost;
      if (currentCost !== prevCost) {
        const netAtChange = (currentIn - (baseline.transfersIn || 0)) - (currentOut - (baseline.transfersOut || 0));
        const changeType = currentCost > prevCost ? 'rise' : 'fall';
        const obsKey = `${changeType}_${pId}_${currentUkDay}`;
        snapshotData.observedThresholds[obsKey] = Math.abs(netAtChange);

        const deltaSign = currentCost > prevCost ? '+' : '-';
        const diff = Math.abs(currentCost - prevCost) / 10.0;
        console.log(`⚡ Price Change Detected: ${p.web_name} (${deltaSign}£${diff.toFixed(1)}m) | Recorded Trigger Net: ${netAtChange}`);
        changesDetected.push(`${p.web_name} (${deltaSign}£${diff.toFixed(1)}m)`);

        baseline = {
          cost: currentCost,
          transfersIn: currentIn,
          transfersOut: currentOut,
          timestamp: nowMs,
          lastCostChangeDate: currentUkDay
        };
        snapshotData.baselines[pId] = baseline;
      }
    } else {
      baseline = {
        cost: currentCost,
        transfersIn: currentIn,
        transfersOut: currentOut,
        timestamp: nowMs
      };
      snapshotData.baselines[pId] = baseline;
    }

    const inToday = Math.max(0, currentIn - (baseline.transfersIn || 0));
    const outToday = Math.max(0, currentOut - (baseline.transfersOut || 0));
    const netToday = inToday - outToday;

    if (!snapshotData.hourlyHistory[pId]) {
      snapshotData.hourlyHistory[pId] = [];
    }
    const history = snapshotData.hourlyHistory[pId];
    const lastPt = history[history.length - 1];

    if (!lastPt || (nowMs - lastPt.time > 40 * 60 * 1000)) {
      history.push({
        time: nowMs,
        transfersIn: currentIn,
        transfersOut: currentOut,
        net: netToday
      });
      if (history.length > 36) {
        snapshotData.hourlyHistory[pId] = history.slice(-36);
      }
    }
  }

  snapshotData.lastUpdated = new Date().toISOString();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(snapshotData, null, 2), 'utf-8');

  const localDir = path.dirname(LOCAL_DATA_FILE);
  if (fs.existsSync(localDir)) {
    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(snapshotData, null, 2), 'utf-8');
  }

  console.log(`✅ Successfully updated price snapshots for ${elements.length} players.`);
  if (changesDetected.length) {
    console.log(`Logged changes: ${changesDetected.join(', ')}`);
  }
}

main().catch(err => {
  console.error('Fatal error in price tracking:', err);
  process.exit(1);
});
