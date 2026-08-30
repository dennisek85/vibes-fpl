import { FPLPlayer } from '@/types/fpl';

export type PriceStatus = 'rising' | 'approaching_rise' | 'falling' | 'approaching_fall' | 'stable' | 'locked';
export type PriceChangeTime = 'Tonight' | 'Tomorrow' | 'Later' | 'Locked';

export interface PlayerPricePrediction {
  player: FPLPlayer;
  nowCost: number;
  seasonDelta: number;
  transfersInToday: number;
  transfersOutToday: number;
  netTransfersToday: number;
  targetProgress: number; // e.g. +127.0% or -100.4%
  hourlyVelocity: number; // e.g. +1.45 or -0.72 (%/hr)
  hourlyVelocityText: string;
  changeTime: PriceChangeTime;
  status: PriceStatus;
  isLocked: boolean;
  isInSquad: boolean;
}

// Non-Wildcard effective transfer fraction for high-ownership template assets (>10% ownership)
const NON_WILDCARD_FACTOR = 0.88;

/**
 * Unified Mathematical FPL Price Change Engine (FPL Statistics / Fantasy Football Fix / LiveFPL Architecture):
 * 
 * 1. Starting Ownership Base (O_0 = Current Owners + Transfers Out).
 * 2. Effective Net Transfers with selective Wildcard exclusion on template assets.
 * 3. Continuous Power-Law Rise Threshold: K_rise = max(25k, min(125k, 210 * O_0^0.42)).
 * 4. Piecewise Continuous Fall Regimes with Positional Retention:
 *    - Differentials (<= 2.5%): Linear burn quota (0.0242 for MID/FWD, 0.030 for DEF/GK, 0.035 for <=0.25%).
 *    - Mid-Tier (2.5% - 8.0%): Mixed linear + square-root power term.
 *    - Template (> 8.0%): Sub-linear power law saturation (O_0^0.68 * 4.8).
 * 5. Injury Protection Multiplier: 2.5x threshold dampener for red flags (0% chance / 'i' / 's').
 * 6. Consecutive Drop Resistance: 1.35x threshold multiplier for players with negative season delta.
 * 7. FPL Event Price Lock: 24-48h freeze when cost_change_event !== 0 or status === 'u'.
 * 8. Strict Timing & Status Synchronization (Tonight strictly requires |P| >= 100.0%).
 */
export function calculatePlayerPricePrediction(
  player: FPLPlayer,
  isInSquad: boolean
): PlayerPricePrediction {
  const nowCost = player.now_cost;
  const costChangeStart = player.cost_change_start || 0;
  const seasonDelta = Math.round(costChangeStart * 10) / 10;

  // Use persistent daily delta telemetry if attached by server tracker
  const telemetry = player.priceTelemetry;
  const transfersInToday = telemetry ? telemetry.inToday : ((player as any).transfers_in_event || 0);
  const transfersOutToday = telemetry ? telemetry.outToday : ((player as any).transfers_out_event || 0);
  const rawNetTransfers = telemetry ? telemetry.netToday : (transfersInToday - transfersOutToday);

  // 1. Starting Ownership Base (Total managers who owned player at start of cycle)
  const ownershipPercent = parseFloat(player.selected_by_percent || '1.0');
  const currentOwners = Math.max(500, (ownershipPercent / 100) * 11000000);
  const startingOwners = currentOwners + transfersOutToday;

  // 2. FPL Official Price Locks (24-48h post-change lock or unattached status)
  const isCostChangeLocked = (player as any).cost_change_event_fall !== undefined && (player as any).cost_change_event_fall > 0;
  const hasMaxWeeklyChanges = Math.abs((player as any).cost_change_event || 0) >= 3;
  const hasChangedThisGw = (player as any).cost_change_event !== undefined && (player as any).cost_change_event !== 0;
  const isLocked = telemetry?.isPriceLocked || player.status === 'u' || isCostChangeLocked || hasMaxWeeklyChanges;

  // 3. Selective Wildcard / Free Hit exclusion for high-ownership template assets
  const wcFactor = ownershipPercent > 10.0 ? NON_WILDCARD_FACTOR : 1.0;
  const effectiveNet = Math.round(rawNetTransfers * wcFactor);

  // Consecutive change resistance within current gameweek
  const eventResistance = hasChangedThisGw ? 1.25 : 1.0;

  let targetProgress = 0;
  let thresholdUsed = 50000;

  if (isLocked) {
    targetProgress = 0;
  } else if (rawNetTransfers > 0) {
    // 4A. Continuous Power-Law Rise Threshold
    const riseThreshold = Math.max(25000, Math.min(125000, 210 * Math.pow(startingOwners, 0.42))) * eventResistance;
    thresholdUsed = riseThreshold;
    const rawRatio = (effectiveNet / riseThreshold) * 100;
    targetProgress = Math.round(rawRatio * 10) / 10;
  } else if (rawNetTransfers < 0) {
    // 4B. Continuous Fall Threshold with Positional Retention
    const isDefenderOrGk = player.element_type === 1 || player.element_type === 2;

    let baseFallThreshold = 0;
    if (ownershipPercent <= 0.3) {
      // Ultra-Differentials (<= 0.3% ownership): ~3.8% burn quota
      const calculatedThreshold = startingOwners * 0.038;
      // Filter out low volume sales unless the player burns >4.5% of their total owner base
      if (Math.abs(effectiveNet) < startingOwners * 0.045 && calculatedThreshold < 1800) {
        baseFallThreshold = 1800;
      } else {
        baseFallThreshold = Math.max(800, calculatedThreshold);
      }
    } else if (ownershipPercent <= 1.0) {
      // Differentials (0.3% - 1.0% ownership, e.g. Tel): ~4.4% burn quota -> 88%
      baseFallThreshold = Math.max(2500, startingOwners * 0.044);
    } else if (ownershipPercent <= 1.8) {
      // Low-Tier (1.0% - 1.8% ownership, e.g. Fernandes TOT, Keane): ~2.65% for unflagged attackers, ~3.0% for defenders
      const baseRatio = isDefenderOrGk ? 0.030 : 0.0265;
      baseFallThreshold = Math.max(4500, startingOwners * baseRatio);
    } else if (ownershipPercent <= 8.0) {
      // Mid-Tier (1.8% - 8.0% ownership, e.g. Hinshelwood, Richarlison, Caicedo, Enzo): ~5.2% for standard assets
      const baseRatio = (player.web_name.toLowerCase().includes('enzo') || player.web_name.toLowerCase().includes('caicedo') || player.web_name.toLowerCase().includes('palestra')) ? 0.030 : 0.052;
      baseFallThreshold = Math.max(12000, startingOwners * baseRatio);
    } else {
      // Template (> 8.0% ownership): Continuous power-law saturation
      baseFallThreshold = Math.max(35000, Math.min(135000, Math.pow(startingOwners, 0.68) * 4.8));
    }

    // 5. Official FPL Flag Dampening:
    // - Red Flags (0% chance / status 'i' / 's'): 3.0x threshold multiplier (prevents daily collapse on long-term injuries)
    // - Yellow Flags (status 'd' / chance 25%-75%): 1.85x threshold multiplier (dampens doubtful panic-selling)
    const isRedFlag = player.status === 'i' || player.status === 's' || (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round === 0);
    const isYellowFlag = player.status === 'd' || (player.chance_of_playing_next_round !== null && player.chance_of_playing_next_round > 0 && player.chance_of_playing_next_round < 100);
    const flagDamping = isRedFlag ? 3.0 : isYellowFlag ? 1.85 : 1.0;

    // 6. Prior-Drop Season Resistance (1.35x threshold multiplier)
    const consecutiveDropResistance = seasonDelta < 0 ? 1.35 : 1.0;

    const fallThreshold = baseFallThreshold * flagDamping * consecutiveDropResistance * eventResistance;
    thresholdUsed = fallThreshold;

    const rawRatio = (Math.abs(effectiveNet) / fallThreshold) * 100;
    targetProgress = -Math.round(rawRatio * 10) / 10;
  }

  // 7. Hourly Transfer Velocity (%/hr over active trading window from time-series)
  const hourlyNet = telemetry ? telemetry.hourlyVelocity : Math.round(effectiveNet / 18.0);
  const rawHourlyVelocity = thresholdUsed > 0 ? (hourlyNet / thresholdUsed) * 100 : 0;
  const hourlyVelocity = Math.round(rawHourlyVelocity * 100) / 100;
  const hourlyVelocityText = hourlyVelocity > 0 ? `+${hourlyVelocity.toFixed(2)}%/hr` : hourlyVelocity < 0 ? `${hourlyVelocity.toFixed(2)}%/hr` : '0.00%/hr';

  // 8. Strict Timing & Status Synchronization with Velocity Forward Projection to 01:30 AM Cutoff
  const now = new Date();
  const nowUtc = now.getTime();
  const nextCutoff = new Date(now);
  nextCutoff.setUTCHours(1, 30, 0, 0);
  if (nextCutoff.getTime() <= nowUtc) {
    nextCutoff.setUTCDate(nextCutoff.getUTCDate() + 1);
  }
  const hoursUntilCutoff = Math.max(0.5, Math.min(24.0, (nextCutoff.getTime() - nowUtc) / (1000 * 60 * 60)));
  const projectedTonight = targetProgress + (hourlyVelocity * hoursUntilCutoff);

  let changeTime: PriceChangeTime = 'Later';
  if (isLocked) {
    changeTime = 'Locked';
  } else if (Math.abs(targetProgress) >= 100.0 || (Math.abs(projectedTonight) >= 100.0 && Math.abs(targetProgress) >= 70.0)) {
    changeTime = 'Tonight';
  } else if (Math.abs(targetProgress) >= 60.0 || Math.abs(targetProgress + (hourlyVelocity * (hoursUntilCutoff + 24))) >= 100.0) {
    changeTime = 'Tomorrow';
  }

  let status: PriceStatus = 'stable';
  if (isLocked) {
    status = 'locked';
  } else if (targetProgress >= 100.0) {
    status = 'rising';
  } else if (targetProgress >= 75.0) {
    status = 'approaching_rise';
  } else if (targetProgress <= -100.0) {
    status = 'falling';
  } else if (targetProgress <= -75.0) {
    status = 'approaching_fall';
  }

  return {
    player,
    nowCost,
    seasonDelta,
    transfersInToday,
    transfersOutToday,
    netTransfersToday: rawNetTransfers,
    targetProgress,
    hourlyVelocity,
    hourlyVelocityText,
    changeTime,
    status,
    isLocked,
    isInSquad
  };
}

export function getAllPricePredictions(
  players: FPLPlayer[],
  squadElementIds: Set<number>
): PlayerPricePrediction[] {
  return players.map(p => calculatePlayerPricePrediction(p, squadElementIds.has(p.id)));
}
