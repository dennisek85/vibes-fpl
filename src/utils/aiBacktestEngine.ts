import {
  FPLPlayer,
  FPLEvent,
  PlannedGameweek,
  SquadPick,
  EntrySummary,
} from "@/types/fpl";
import { TeamHistoryEvent } from "@/store/types";

export interface GameweekDriftPoint {
  gw: number;
  actualPoints: number;
  actualCumulative: number;
  aiPoints: number;
  aiCumulative: number;
  alpha: number;
}

export interface CaptaincyComparison {
  gw: number;
  userCaptain: {
    player: FPLPlayer;
    actualPoints: number;
    doubledPoints: number;
  } | null;
  aiCaptain: {
    player: FPLPlayer;
    actualPoints: number;
    doubledPoints: number;
    projectedXp: number;
  } | null;
  delta: number;
}

export interface TransferSwingItem {
  gw: number;
  userTransfer: {
    playerOut: FPLPlayer;
    playerIn: FPLPlayer;
    netPoints: number;
  } | null;
  aiTransfer: {
    playerOut: FPLPlayer;
    playerIn: FPLPlayer;
    netPoints: number;
  } | null;
  swing: number;
}

export interface AttributionBreakdown {
  cleanSheets: { points: number; label: string; percentage: number };
  goals: { points: number; count: number; label: string; percentage: number };
  assists: { points: number; count: number; label: string; percentage: number };
  bonus: { points: number; label: string; percentage: number };
  teamValueGain: { million: number; label: string };
}

export interface BacktestResult {
  totalActualPoints: number;
  totalAiPoints: number;
  netAlpha: number;
  estimatedRank: number;
  actualRank: number;
  driftTrajectory: GameweekDriftPoint[];
  captaincyComparisons: CaptaincyComparison[];
  totalCaptaincyDelta: number;
  transferSwings: TransferSwingItem[];
  totalTransferSwing: number;
  attribution: AttributionBreakdown;
}

/**
 * Single Source of Truth for Backtesting & Historical ML Attribution
 */
export function calculateAiSeasonBacktest(
  teamSummary: EntrySummary | null,
  teamHistoryCurrent: TeamHistoryEvent[],
  gameweekPlans: Record<number, PlannedGameweek>,
  playerMap: Map<number, FPLPlayer>,
  players: FPLPlayer[],
  events: FPLEvent[],
  getPlayerGameweekXp: (elementId: number, gw: number) => number,
  liveEventPoints: Record<number, Record<number, number>>,
): BacktestResult {
  const completedEvents = events
    .filter((e) => e.finished || e.is_current)
    .sort((a, b) => a.id - b.id);

  let actualCum = 0;
  let aiCum = 0;
  const driftTrajectory: GameweekDriftPoint[] = [];
  const captaincyComparisons: CaptaincyComparison[] = [];
  let totalCaptaincyDelta = 0;
  const transferSwings: TransferSwingItem[] = [];
  let totalTransferSwing = 0;

  // Stat attribution accumulators
  let csPoints = 0;
  let goalPoints = 0;
  let goalCount = 0;
  let assistPoints = 0;
  let assistCount = 0;
  let bonusPoints = 0;

  const getPlayerMatchPoints = (player: FPLPlayer, gw: number): number => {
    if (liveEventPoints[gw]?.[player.id] !== undefined) {
      return liveEventPoints[gw][player.id];
    }
    return 0;
  };

  for (const ev of completedEvents) {
    const gw = ev.id;
    const plan = gameweekPlans[gw];
    const history = teamHistoryCurrent.find((h) => h.event === gw);

    // 1. Calculate Actual Points for this Gameweek
    let actualGwPts = 0;
    if (history) {
      actualGwPts = history.points;
    } else if (plan?.squad && plan.squad.length > 0) {
      plan.squad.forEach((pick: SquadPick) => {
        if (pick.position <= 11) {
          const pl = playerMap.get(pick.element);
          const raw = pl ? getPlayerMatchPoints(pl, gw) : 0;
          const mult = pick.is_captain ? 2 : 1;
          actualGwPts += raw * mult;
        }
      });
      actualGwPts = Math.max(0, actualGwPts - (plan.transferCost || 0));
    }

    actualCum += actualGwPts;

    // 2. Determine User Captain
    const userCapPick = plan?.squad?.find((p: SquadPick) => p.is_captain);
    const userCapPlayer = userCapPick
      ? playerMap.get(userCapPick.element) || null
      : null;
    const userCapRawPts = userCapPlayer
      ? getPlayerMatchPoints(userCapPlayer, gw)
      : 0;

    // 3. Determine AI Top Captain for this GW
    let aiCapPlayer: FPLPlayer | null = null;
    let aiCapXp = -1;

    const candidatePool =
      plan?.squad && plan.squad.length > 0
        ? (plan.squad
            .map((p: SquadPick) => playerMap.get(p.element))
            .filter(Boolean) as FPLPlayer[])
        : players;

    candidatePool.forEach((p: FPLPlayer) => {
      const xp = getPlayerGameweekXp(p.id, gw);
      if (xp > aiCapXp) {
        aiCapXp = xp;
        aiCapPlayer = p;
      }
    });

    const aiCapRawPts = aiCapPlayer
      ? getPlayerMatchPoints(aiCapPlayer as FPLPlayer, gw)
      : 0;
    // Net captaincy delta: 1x additional multiplier moving from user captain to AI captain
    const capDelta = aiCapRawPts - userCapRawPts;
    totalCaptaincyDelta += capDelta;

    if (userCapPlayer || aiCapPlayer) {
      captaincyComparisons.push({
        gw,
        userCaptain: userCapPlayer
          ? {
              player: userCapPlayer,
              actualPoints: userCapRawPts,
              doubledPoints: userCapRawPts * 2,
            }
          : null,
        aiCaptain: aiCapPlayer
          ? {
              player: aiCapPlayer,
              actualPoints: aiCapRawPts,
              doubledPoints: aiCapRawPts * 2,
              projectedXp: Math.round(aiCapXp * 10) / 10,
            }
          : null,
        delta: capDelta,
      });
    }

    // 4. Calculate Transfer Swings across all planned transfers
    let gwTransferSwing = 0;
    if (plan && plan.transfersIn.length > 0 && plan.transfersOut.length > 0) {
      const numTransfers = Math.min(
        plan.transfersIn.length,
        plan.transfersOut.length,
      );
      for (let i = 0; i < numTransfers; i++) {
        const pIn = playerMap.get(plan.transfersIn[i]);
        const pOut = playerMap.get(plan.transfersOut[i]);

        if (pIn && pOut) {
          const inPts = getPlayerMatchPoints(pIn, gw);
          const outPts = getPlayerMatchPoints(pOut, gw);
          const userNet = inPts - outPts;

          // Simulate AI #1 Transfer candidate (highest xP replacement in same position within budget)
          const posPlayers = players.filter(
            (p) => p.element_type === pOut.element_type && p.id !== pOut.id,
          );
          let bestAiIn = pIn;
          let bestAiXp = getPlayerGameweekXp(pIn.id, gw);

          posPlayers.forEach((cand: FPLPlayer) => {
            const candXp = getPlayerGameweekXp(cand.id, gw);
            if (
              candXp > bestAiXp &&
              cand.now_cost <= pOut.now_cost + (plan.calculatedBank || 0)
            ) {
              bestAiXp = candXp;
              bestAiIn = cand;
            }
          });

          const aiInPts = getPlayerMatchPoints(bestAiIn, gw);
          const aiNet = aiInPts - outPts;
          const swing = aiNet - userNet;
          gwTransferSwing += swing;
          totalTransferSwing += swing;

          transferSwings.push({
            gw,
            userTransfer: { playerOut: pOut, playerIn: pIn, netPoints: userNet },
            aiTransfer: { playerOut: pOut, playerIn: bestAiIn, netPoints: aiNet },
            swing,
          });
        }
      }
    }

    // 5. Simulate AI Co-Pilot Gameweek Score (Symmetric: preserves true upside & downside)
    const aiGwScore = Math.max(
      0,
      actualGwPts + capDelta + gwTransferSwing,
    );
    aiCum += aiGwScore;

    driftTrajectory.push({
      gw,
      actualPoints: actualGwPts,
      actualCumulative: actualCum,
      aiPoints: aiGwScore,
      aiCumulative: aiCum,
      alpha: aiCum - actualCum,
    });
  }

  // 6. Stat Attribution from actual starting XI across completed Gameweeks (Single Source of Truth)
  // Track how many gameweeks each player actually started for the user to weight attribution proportionally
  const starterAppearances = new Map<number, number>();
  completedEvents.forEach((ev) => {
    const plan = gameweekPlans[ev.id];
    if (plan?.squad && plan.squad.length > 0) {
      plan.squad.forEach((pick: SquadPick) => {
        if (pick.position <= 11) {
          starterAppearances.set(
            pick.element,
            (starterAppearances.get(pick.element) || 0) + 1,
          );
        }
      });
    }
  });

  const totalGwCount = completedEvents.length || 1;
  starterAppearances.forEach((startsCount, elementId) => {
    const p = playerMap.get(elementId);
    if (!p) return;

    const isDef = p.element_type === 1 || p.element_type === 2;
    const isMid = p.element_type === 3;
    const ptsPerGoal = isDef ? 6 : isMid ? 5 : 4;

    // Weight career totals by fraction of active matches player actually started for this user
    const playerEstimatedGames = Math.max(1, Math.ceil((p.minutes || 0) / 90) || totalGwCount);
    const startShare = Math.min(1.0, startsCount / playerEstimatedGames);

    if (isDef && p.clean_sheets > 0) {
      csPoints += Math.round(p.clean_sheets * 4 * startShare);
    }
    if (p.goals_scored > 0) {
      const gPts = Math.round(p.goals_scored * ptsPerGoal * startShare);
      goalPoints += gPts;
      goalCount += Math.round(p.goals_scored * startShare);
    }
    if (p.assists > 0) {
      const aPts = Math.round(p.assists * 3 * startShare);
      assistPoints += aPts;
      assistCount += Math.round(p.assists * startShare);
    }
    bonusPoints += Math.round((p.bonus || 0) * startShare);
  });

  const netAlpha = aiCum - actualCum;
  const actualRank = teamSummary?.summary_overall_rank || 450000;

  // Non-linear density-aware rank estimation curve (higher elasticity in mid-table, flatter in top 10k)
  const rankSensitivity = actualRank > 100000 ? 0.014 : actualRank > 10000 ? 0.008 : 0.003;
  const rankShiftFactor = Math.max(-0.85, Math.min(0.85, netAlpha * rankSensitivity));
  const estimatedRank = Math.max(
    1,
    Math.round(actualRank * (1 - rankShiftFactor)),
  );

  // Calculate dynamic team value gain
  const rawTeamValue = teamSummary?.last_deadline_value
    ? teamSummary.last_deadline_value / 10
    : 100.0;
  const rawBank = teamSummary?.last_deadline_bank
    ? teamSummary.last_deadline_bank / 10
    : 0.0;
  const totalValue = rawTeamValue + rawBank;
  const dynamicTeamValueGain = Math.max(
    0,
    Number((totalValue - 100.0).toFixed(1)),
  );

  // Calculate percentage splits for the 4 pillars
  const totalAttributed = Math.max(
    1,
    csPoints + goalPoints + assistPoints + bonusPoints,
  );

  const attribution: AttributionBreakdown = {
    cleanSheets: {
      points: csPoints,
      label: "Clean Sheet Equity",
      percentage: Math.min(100, Math.round((csPoints / totalAttributed) * 100)),
    },
    goals: {
      points: goalPoints,
      count: goalCount,
      label: "Goal Threat Conversion",
      percentage: Math.min(
        100,
        Math.round((goalPoints / totalAttributed) * 100),
      ),
    },
    assists: {
      points: assistPoints,
      count: assistCount,
      label: "Creativity & Assist Return",
      percentage: Math.min(
        100,
        Math.round((assistPoints / totalAttributed) * 100),
      ),
    },
    bonus: {
      points: bonusPoints,
      label: "BPS Magnetism",
      percentage: Math.min(
        100,
        Math.round((bonusPoints / totalAttributed) * 100),
      ),
    },
    teamValueGain: {
      million: dynamicTeamValueGain,
      label: "Price Radar Team Value",
    },
  };

  return {
    totalActualPoints: actualCum,
    totalAiPoints: aiCum,
    netAlpha,
    estimatedRank,
    actualRank,
    driftTrajectory,
    captaincyComparisons,
    totalCaptaincyDelta,
    transferSwings,
    totalTransferSwing,
    attribution,
  };
}
