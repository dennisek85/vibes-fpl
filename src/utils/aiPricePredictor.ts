import { FPLPlayer } from '@/types/fpl';

export type PriceStatus = 'rising' | 'approaching_rise' | 'falling' | 'approaching_fall' | 'stable' | 'locked';

export interface PlayerPricePrediction {
  player: FPLPlayer;
  nowCost: number;
  seasonDelta: number;
  transfersInToday: number;
  transfersOutToday: number;
  netTransfersToday: number;
  targetProgress: number; // e.g. +104.2% or -101.5%
  status: PriceStatus;
  isLocked: boolean;
  isInSquad: boolean;
}

/**
 * Calculates FPL Transfer Velocity & Overnight Price Change Predictions (FPL Statistics Algorithm):
 * - Target 100%: Expected to RISE (+£0.1m) tonight at 01:30 AM GMT
 * - Target -100%: Expected to FALL (-£0.1m) tonight at 01:30 AM GMT
 */
export function calculatePlayerPricePrediction(
  player: FPLPlayer,
  isInSquad: boolean
): PlayerPricePrediction {
  const nowCost = player.now_cost;
  const costChangeStart = player.cost_change_start || 0;
  const seasonDelta = Math.round(costChangeStart * 10) / 10;

  const transfersInToday = (player as any).transfers_in_event || 0;
  const transfersOutToday = (player as any).transfers_out_event || 0;
  const netTransfersToday = transfersInToday - transfersOutToday;

  // Ownership base in approx total manager count (~11,000,000 FPL managers)
  const ownershipPercent = parseFloat(player.selected_by_percent || '1.0');
  const approxOwners = Math.max(10000, (ownershipPercent / 100) * 11000000);

  // Price lock condition (e.g. newly transferred or return from red flag)
  const isLocked = player.status === 'u' || (player as any).cost_change_event_fall !== undefined && (player as any).cost_change_event_fall > 0;

  // Dynamic FPL transfer quota threshold
  // For price rise: requires net transfers roughly proportional to sqrt/log of ownership and active manager delta
  let targetProgress = 0;

  if (isLocked) {
    targetProgress = 0;
  } else if (netTransfersToday > 0) {
    // Dynamic rise threshold (typically 40,000 to 120,000 net transfers depending on player base)
    const riseThreshold = Math.max(25000, Math.min(130000, Math.sqrt(approxOwners) * 85));
    const rawRatio = (netTransfersToday / riseThreshold) * 100;
    targetProgress = Math.min(125, Math.round(rawRatio * 10) / 10);
  } else if (netTransfersToday < 0) {
    // Dynamic fall threshold
    const fallThreshold = Math.max(20000, Math.min(120000, Math.sqrt(approxOwners) * 80));
    const rawRatio = (Math.abs(netTransfersToday) / fallThreshold) * 100;
    targetProgress = -Math.min(125, Math.round(rawRatio * 10) / 10);
  }

  // If FPL already changed price this round, adjust progress baseline
  if ((player as any).cost_change_event && (player as any).cost_change_event > 0) {
    // Already rose once this gameweek
    targetProgress = Math.max(-100, Math.min(120, targetProgress - 50));
  }

  let status: PriceStatus = 'stable';
  if (isLocked) {
    status = 'locked';
  } else if (targetProgress >= 100) {
    status = 'rising';
  } else if (targetProgress >= 80) {
    status = 'approaching_rise';
  } else if (targetProgress <= -100) {
    status = 'falling';
  } else if (targetProgress <= -80) {
    status = 'approaching_fall';
  }

  return {
    player,
    nowCost,
    seasonDelta,
    transfersInToday,
    transfersOutToday,
    netTransfersToday,
    targetProgress,
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

