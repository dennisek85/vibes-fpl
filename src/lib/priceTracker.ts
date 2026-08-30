import fs from 'fs';
import path from 'path';
import os from 'os';
import { FPLPlayer } from '@/types/fpl';

export interface PlayerPriceBaseline {
  cost: number;
  transfersIn: number;
  transfersOut: number;
  timestamp: number;
  lastCostChangeDate?: string;
}

export interface PlayerHourlyPoint {
  time: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
}

export interface PriceSnapshotData {
  lastUpdated: string;
  lastPriceChangeDate: string;
  baselines: Record<number, PlayerPriceBaseline>;
  hourlyHistory: Record<number, PlayerHourlyPoint[]>;
  observedThresholds: Record<string, number>; // e.g. "rise_411_gw3": 85400
}

declare global {
  var __priceSnapshotMemoryCache: PriceSnapshotData | undefined;
}

function getStorageFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'price_snapshots.json');
  }
  const localDataDir = path.join(process.cwd(), '.data');
  return path.join(localDataDir, 'price_snapshots.json');
}

function getTodayUkDateString(): string {
  // FPL price changes occur at ~01:30 AM UK time
  // If it's before 01:30 AM, it belongs to yesterday's trading day
  const now = new Date();
  const ukHour = (now.getUTCHours() + 1) % 24; // UTC+1 during BST (approx)
  if (ukHour < 2) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

export function readPriceSnapshotData(): PriceSnapshotData {
  if (globalThis.__priceSnapshotMemoryCache) {
    return globalThis.__priceSnapshotMemoryCache;
  }

  const filePath = getStorageFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      globalThis.__priceSnapshotMemoryCache = parsed;
      return parsed;
    }
  } catch (e) {
    console.warn('Error reading price snapshots file:', e);
  }

  const initial: PriceSnapshotData = {
    lastUpdated: new Date().toISOString(),
    lastPriceChangeDate: getTodayUkDateString(),
    baselines: {},
    hourlyHistory: {},
    observedThresholds: {},
  };
  globalThis.__priceSnapshotMemoryCache = initial;
  return initial;
}

export function savePriceSnapshotData(data: PriceSnapshotData): void {
  globalThis.__priceSnapshotMemoryCache = data;
  const filePath = getStorageFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Error writing price snapshots file:', e);
  }
}

/**
 * Ingests live FPL elements telemetry:
 * 1. Checks if any price changes occurred (cost !== baseline.cost).
 * 2. If a price changed or daily 01:30 AM cycle rolled over -> saves new baseline.
 * 3. Logs hourly transfer velocity data points.
 * 4. Returns calibrated daily deltas and hourly velocity for every player.
 */
export function updateAndGetPriceTelemetry(elements: FPLPlayer[]): {
  dailyDeltas: Record<number, { netToday: number; inToday: number; outToday: number; hourlyVelocity: number; isPriceLocked: boolean }>;
  observedThresholds: Record<string, number>;
} {
  const snapshotData = readPriceSnapshotData();
  const currentUkDay = getTodayUkDateString();
  const nowMs = Date.now();

  const isNewDay = snapshotData.lastPriceChangeDate !== currentUkDay;
  if (isNewDay) {
    snapshotData.lastPriceChangeDate = currentUkDay;
  }

  const dailyDeltas: Record<number, { netToday: number; inToday: number; outToday: number; hourlyVelocity: number; isPriceLocked: boolean }> = {};

  for (const p of elements) {
    const id = p.id;
    const currentCost = p.now_cost;
    const currentIn = (p as any).transfers_in_event || 0;
    const currentOut = (p as any).transfers_out_event || 0;

    let baseline = snapshotData.baselines[id];

    // Check if player changed price since last recorded baseline
    const hasPriceChanged = baseline && baseline.cost !== currentCost;
    if (hasPriceChanged) {
      // Log the observed threshold trigger
      const deltaBeforeChange = (currentIn - baseline.transfersIn) - (currentOut - baseline.transfersOut);
      const key = `${currentCost > baseline.cost ? 'rise' : 'fall'}_${id}_${currentUkDay}`;
      snapshotData.observedThresholds[key] = Math.abs(deltaBeforeChange);

      // Reset baseline to current transfer counter
      baseline = {
        cost: currentCost,
        transfersIn: currentIn,
        transfersOut: currentOut,
        timestamp: nowMs,
        lastCostChangeDate: currentUkDay,
      };
      snapshotData.baselines[id] = baseline;
    } else if (!baseline || isNewDay) {
      // Initialize or rollover baseline
      if (!baseline) {
        baseline = {
          cost: currentCost,
          transfersIn: currentIn,
          transfersOut: currentOut,
          timestamp: nowMs,
        };
        snapshotData.baselines[id] = baseline;
      }
    }

    // Calculate true net delta today
    const inToday = Math.max(0, currentIn - baseline.transfersIn);
    const outToday = Math.max(0, currentOut - baseline.transfersOut);
    const netToday = inToday - outToday;

    // Maintain recent hourly history (last 24 hours)
    if (!snapshotData.hourlyHistory[id]) {
      snapshotData.hourlyHistory[id] = [];
    }
    const history = snapshotData.hourlyHistory[id];

    // Append point if at least 45 minutes since last point
    const lastPoint = history[history.length - 1];
    if (!lastPoint || nowMs - lastPoint.time > 45 * 60 * 1000) {
      history.push({
        time: nowMs,
        transfersIn: currentIn,
        transfersOut: currentOut,
        net: inToday - outToday,
      });
      // Keep only last 24 points
      if (history.length > 24) {
        history.shift();
      }
    }

    // Compute true time-series hourly velocity from history points
    let hourlyVelocity = 0;
    if (history.length >= 2) {
      const oldestPoint = history[0];
      const hoursDiff = Math.max(0.5, (nowMs - oldestPoint.time) / (1000 * 60 * 60));
      const deltaTransfers = (inToday - outToday) - oldestPoint.net;
      hourlyVelocity = Math.round((deltaTransfers / hoursDiff) * 10) / 10;
    } else {
      // Fallback: estimate based on hours since baseline
      const hoursSinceBaseline = Math.max(1.0, (nowMs - baseline.timestamp) / (1000 * 60 * 60));
      hourlyVelocity = Math.round((netToday / hoursSinceBaseline) * 10) / 10;
    }

    // FPL Price Lock: players who changed price today are frozen for 24-48h
    const isPriceLocked = baseline.lastCostChangeDate === currentUkDay || p.status === 'u';

    dailyDeltas[id] = {
      netToday,
      inToday,
      outToday,
      hourlyVelocity,
      isPriceLocked: !!isPriceLocked,
    };
  }

  snapshotData.lastUpdated = new Date().toISOString();
  savePriceSnapshotData(snapshotData);

  return {
    dailyDeltas,
    observedThresholds: snapshotData.observedThresholds,
  };
}

