import { FPLPlayer } from "@/types/fpl";

export type PriceStatus =
  | "rising"
  | "approaching_rise"
  | "falling"
  | "approaching_fall"
  | "stable"
  | "locked";
export type PriceChangeTime = "Tonight" | "Tomorrow" | "Later" | "Locked";

export interface PlayerPricePrediction {
  player: FPLPlayer;
  nowCost: number;
  seasonDelta: number;
  transfersInToday: number;
  transfersOutToday: number;
  netTransfersToday: number;
  targetProgress: number; // e.g. +107.6% or -105.2%
  projectedTonightProgress: number; // e.g. +126.8% or -114.3%
  hourlyVelocity: number; // e.g. +1.50 or -0.80 (%/hr)
  hourlyVelocityText: string;
  changeTime: PriceChangeTime;
  status: PriceStatus;
  isLocked: boolean;
  isInSquad: boolean;
}

// Non-Wildcard effective transfer fraction for high-ownership template assets (>10% ownership)
const NON_WILDCARD_FACTOR = 0.88;

/**
 * Universal Price Prediction Engine:
 * 1. Consumes official FPL server fields (price_change_percent, price_change_projections).
 * 2. Strictly marks Tonight ONLY when projected_percent crosses 100.0% for offset: 0 (matches official FPL & Pro Trackers 1:1).
 * 3. Marks Tomorrow for offset: 1 or targetProgress >= 75%.
 * 4. Fallback to mathematical continuous power-law model if offline.
 */
export function calculatePlayerPricePrediction(
  player: FPLPlayer,
  isInSquad: boolean,
): PlayerPricePrediction {
  const nowCost = player.now_cost;
  const costChangeStart = player.cost_change_start || 0;
  const seasonDelta = Math.round(costChangeStart * 10) / 10;

  const transfersInToday = (player as any).transfers_in_event || 0;
  const transfersOutToday = (player as any).transfers_out_event || 0;
  const rawNetTransfers = transfersInToday - transfersOutToday;

  // 1. Official Price Lock Status (24-48h post-change lock or unattached status)
  const isCostChangeLocked =
    (player as any).cost_change_event_fall !== undefined &&
    (player as any).cost_change_event_fall > 0;
  const hasMaxWeeklyChanges =
    Math.abs((player as any).cost_change_event || 0) >= 3;
  const isOfficialLocked =
    player.price_change_locked_until !== null &&
    player.price_change_locked_until !== undefined;
  const isLocked =
    isOfficialLocked ||
    player.status === "u" ||
    isCostChangeLocked ||
    hasMaxWeeklyChanges;

  let targetProgress = 0;
  let projectedTonightProgress = 0;
  let hourlyVelocity = 0;
  let hourlyVelocityText = "0.00%/hr";
  let isProjectedTonight = false;
  let isProjectedTomorrow = false;

  // 2. Use Official Server Metrics If Available (matches FPL & Pro Trackers 1:1)
  if (
    player.price_change_percent !== undefined &&
    player.price_change_percent !== null
  ) {
    const parsedPercent =
      typeof player.price_change_percent === "string"
        ? parseFloat(player.price_change_percent)
        : (player.price_change_percent as number);

    targetProgress = Math.round(parsedPercent * 10) / 10;
    projectedTonightProgress = targetProgress;

    const rawHourly =
      player.price_change_hourly_rate !== undefined
        ? player.price_change_hourly_rate
        : 0;
    if (typeof rawHourly === "number" && rawHourly !== 0) {
      if (Math.abs(rawHourly) > 50) {
        // Absolute transfers/hr -> converted to %/hr based on implied threshold
        const impliedThreshold =
          targetProgress !== 0
            ? Math.abs(rawNetTransfers / (targetProgress / 100))
            : 50000;
        hourlyVelocity =
          Math.round((rawHourly / impliedThreshold) * 10000) / 100;
      } else {
        hourlyVelocity = Math.round(rawHourly * 100) / 100;
      }
    } else {
      hourlyVelocity =
        targetProgress > 0 ? 1.5 : targetProgress < 0 ? -1.0 : 0.0;
    }

    hourlyVelocityText =
      hourlyVelocity > 0
        ? `+${hourlyVelocity.toFixed(2)}%/hr`
        : hourlyVelocity < 0
          ? `${hourlyVelocity.toFixed(2)}%/hr`
          : "0.00%/hr";

    // Strict Official FPL Day-Offset Projections:
    const projections = player.price_change_projections;
    if (Array.isArray(projections) && projections.length > 0) {
      const tonightProj = projections.find((p) => p.offset === 0);
      const tomorrowProj = projections.find((p) => p.offset === 1);

      if (tonightProj) {
        const val = parseFloat(tonightProj.projected_percent || "0");
        projectedTonightProgress = Math.round(val * 10) / 10;
        if (Math.abs(val) >= 100.0) {
          isProjectedTonight = true;
        }
      }
      if (tomorrowProj) {
        const val = parseFloat(tomorrowProj.projected_percent || "0");
        if (Math.abs(val) >= 100.0) {
          isProjectedTomorrow = true;
        }
      }
    }

    // Direct 100% threshold check
    if (Math.abs(targetProgress) >= 100.0) {
      isProjectedTonight = true;
    }
  } else {
    // 3. Fallback Mathematical Continuous Power-Law Model (Offline)
    const ownershipPercent = parseFloat(player.selected_by_percent || "1.0");
    const currentOwners = Math.max(500, (ownershipPercent / 100) * 11000000);
    const startingOwners = currentOwners + transfersOutToday;

    const wcFactor = ownershipPercent > 10.0 ? NON_WILDCARD_FACTOR : 1.0;
    const effectiveNet = Math.round(rawNetTransfers * wcFactor);
    const hasChangedThisGw =
      (player as any).cost_change_event !== undefined &&
      (player as any).cost_change_event !== 0;
    const eventResistance = hasChangedThisGw ? 1.25 : 1.0;

    let thresholdUsed = 50000;

    if (isLocked) {
      targetProgress = 0;
    } else if (rawNetTransfers > 0) {
      const riseThreshold =
        Math.max(
          18000,
          Math.min(125000, 210 * Math.pow(startingOwners, 0.42)),
        ) * eventResistance;
      thresholdUsed = riseThreshold;
      targetProgress =
        Math.round((effectiveNet / riseThreshold) * 100 * 10) / 10;
    } else if (rawNetTransfers < 0) {
      const isDefenderOrGk =
        player.element_type === 1 || player.element_type === 2;
      let baseFallThreshold = Math.max(2500, startingOwners * 0.044);
      if (ownershipPercent <= 0.3) {
        baseFallThreshold = Math.max(800, startingOwners * 0.038);
      } else if (ownershipPercent <= 1.8) {
        baseFallThreshold = Math.max(
          4500,
          startingOwners * (isDefenderOrGk ? 0.03 : 0.0265),
        );
      } else if (ownershipPercent <= 8.0) {
        baseFallThreshold = Math.max(12000, startingOwners * 0.052);
      } else {
        baseFallThreshold = Math.max(
          35000,
          Math.min(135000, Math.pow(startingOwners, 0.68) * 4.8),
        );
      }

      const isRedFlag =
        player.status === "i" ||
        player.status === "s" ||
        (player.chance_of_playing_next_round !== null &&
          player.chance_of_playing_next_round === 0);
      const isYellowFlag =
        player.status === "d" ||
        (player.chance_of_playing_next_round !== null &&
          player.chance_of_playing_next_round > 0 &&
          player.chance_of_playing_next_round < 100);
      const flagDamping = isRedFlag ? 3.0 : isYellowFlag ? 1.85 : 1.0;
      const consecutiveDropResistance = seasonDelta < 0 ? 1.35 : 1.0;

      const fallThreshold =
        baseFallThreshold *
        flagDamping *
        consecutiveDropResistance *
        eventResistance;
      thresholdUsed = fallThreshold;
      targetProgress =
        -Math.round((Math.abs(effectiveNet) / fallThreshold) * 100 * 10) / 10;
    }

    projectedTonightProgress = targetProgress;

    // Dynamically calculate elapsed hours since the daily 01:30 UTC price change window
    const nowUtc = new Date();
    const priceChangeEpoch = new Date(nowUtc);
    priceChangeEpoch.setUTCHours(1, 30, 0, 0);
    let msSinceChange = nowUtc.getTime() - priceChangeEpoch.getTime();
    if (msSinceChange < 0) {
      msSinceChange += 24 * 3600 * 1000;
    }
    const elapsedHours = Math.max(
      3.0,
      Math.min(23.5, msSinceChange / (3600 * 1000)),
    );
    const hourlyNet = Math.round(effectiveNet / elapsedHours);
    const rawHourlyVelocity =
      thresholdUsed > 0 ? (hourlyNet / thresholdUsed) * 100 : 0;
    hourlyVelocity = Math.round(rawHourlyVelocity * 100) / 100;
    hourlyVelocityText =
      hourlyVelocity > 0
        ? `+${hourlyVelocity.toFixed(2)}%/hr`
        : hourlyVelocity < 0
          ? `${hourlyVelocity.toFixed(2)}%/hr`
          : "0.00%/hr";

    if (Math.abs(targetProgress) >= 100.0) {
      isProjectedTonight = true;
    } else if (Math.abs(targetProgress) >= 75.0) {
      isProjectedTomorrow = true;
    }
  }

  // 4. Timing Determination (Tonight vs Tomorrow vs Later)
  let changeTime: PriceChangeTime = "Later";
  if (isLocked) {
    changeTime = "Locked";
  } else if (isProjectedTonight) {
    changeTime = "Tonight";
  } else if (isProjectedTomorrow || Math.abs(targetProgress) >= 80.0) {
    changeTime = "Tomorrow";
  }

  // 5. Status Classification (Guarantees strict hierarchical ordering)
  let status: PriceStatus = "stable";
  if (isLocked) {
    status = "locked";
  } else if (isProjectedTonight && targetProgress > 0) {
    status = "rising";
  } else if (isProjectedTonight && targetProgress < 0) {
    status = "falling";
  } else if (targetProgress >= 75.0) {
    status = "approaching_rise";
  } else if (targetProgress <= -75.0) {
    status = "approaching_fall";
  }

  return {
    player,
    nowCost,
    seasonDelta,
    transfersInToday,
    transfersOutToday,
    netTransfersToday: rawNetTransfers,
    targetProgress,
    projectedTonightProgress,
    hourlyVelocity,
    hourlyVelocityText,
    changeTime,
    status,
    isLocked,
    isInSquad,
  };
}

export function getAllPricePredictions(
  players: FPLPlayer[],
  squadElementIds?: Set<number>,
): PlayerPricePrediction[] {
  if (!players || !players.length) return [];
  const sIds = squadElementIds || new Set<number>();
  return players.map((p) => calculatePlayerPricePrediction(p, sIds.has(p.id)));
}
