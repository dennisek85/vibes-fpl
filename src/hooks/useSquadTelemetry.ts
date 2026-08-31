import { useMemo } from 'react';
import { usePlannerStore } from '@/store/usePlannerStore';
import { useSquadRating } from './useSquadRating';
import { SquadRatingResult } from '@/utils/aiSquadRating';
import { ChipType } from '@/types/fpl';

export interface SquadTelemetryResult {
  totalProjectedXp: number;
  gameweekActualPoints: number | null;
  totalSeasonPoints: number | null;
  squadFormSum: number;
  squadValue: number;
  bank: number;
  availableFT: number;
  currentTransfers: number;
  hits: number;
  currentChip: ChipType;
  squadRating: SquadRatingResult | null;
}

/**
 * Single Source of Truth for Gameweek Squad Telemetry:
 * Calculates total projected xP, form sum, financial totals, and squad ratings in one place.
 */
export function useSquadTelemetry(): SquadTelemetryResult {
  const selectedGameweek = usePlannerStore(state => state.selectedGameweek);
  const currentPlan = usePlannerStore(state => state.gameweekPlans[selectedGameweek]);
  const playerMap = usePlannerStore(state => state.playerMap);
  const getPlayerGameweekXp = usePlannerStore(state => state.getPlayerGameweekXp);
  const getPlayerGameweekActualPoints = usePlannerStore(state => state.getPlayerGameweekActualPoints);
  const isGameweekLocked = usePlannerStore(state => state.isGameweekLocked);
  const teamHistoryCurrent = usePlannerStore(state => state.teamHistoryCurrent);
  const teamSummary = usePlannerStore(state => state.teamSummary);
  const squadRating = useSquadRating();

  const currentChip = currentPlan?.chip || 'none';
  const bank = currentPlan?.calculatedBank || 0;
  const availableFT = currentPlan?.availableTransfers || 1;
  const currentTransfers = currentPlan?.transfersUsed || 0;
  const hits = currentPlan?.transferCost || 0;
  const isLocked = isGameweekLocked(selectedGameweek);

  // 1. Calculate dynamic live score from starting XI players + captaincy multipliers
  let livePointsSum = 0;
  let hasLivePlayerPoints = false;
  if (currentPlan?.squad) {
    const isTripleCaptain = currentChip === '3xc';
    const isBenchBoost = currentChip === 'bboost';

    currentPlan.squad.forEach(pick => {
      const isStarting = pick.position <= 11;
      const rawPoints = getPlayerGameweekActualPoints(pick.element, selectedGameweek);
      if (rawPoints !== null) {
        hasLivePlayerPoints = true;
        const mult = isStarting ? (pick.is_captain ? (isTripleCaptain ? 3 : 2) : 1) : (isBenchBoost ? 1 : 0);
        livePointsSum += rawPoints * mult;
      }
    });
  }

  // 2. Check official history table as fallback
  const gwHistory = teamHistoryCurrent.find(h => h.event === selectedGameweek);
  const historyPoints = gwHistory ? gwHistory.points : null;

  // Use live player sum if available; otherwise use official history or entry summary
  const gameweekActualPoints = hasLivePlayerPoints
    ? Math.max(0, livePointsSum - hits)
    : historyPoints !== null
    ? historyPoints
    : (isLocked && selectedGameweek === teamSummary?.current_event && teamSummary?.summary_overall_points)
    ? teamSummary.summary_overall_points
    : null;

  const totalSeasonPoints = teamSummary?.summary_overall_points ?? null;

  const { totalProjectedXp, squadFormSum, squadValue } = useMemo(() => {
    let xpSum = 0;
    let formSum = 0;
    let valSum = 0;

    if (!currentPlan?.squad || currentPlan.squad.length === 0) {
      return { totalProjectedXp: 0, squadFormSum: 0, squadValue: 0 };
    }

    const isBenchBoost = currentChip === 'bboost';
    const isTripleCaptain = currentChip === '3xc';

    currentPlan.squad.forEach(pick => {
      const isStarting = pick.position <= 11;
      const pl = playerMap.get(pick.element);
      const xp = getPlayerGameweekXp(pick.element, selectedGameweek);

      if (pl) {
        valSum += pl.now_cost;
      }

      if (isStarting) {
        let mult = 1;
        if (pick.is_captain) {
          mult = isTripleCaptain ? 3 : 2;
        }
        xpSum += xp * mult;
        if (pl) formSum += parseFloat(pl.form) || 0;
      } else if (isBenchBoost) {
        // Full bench boost: all 4 subs count 100%
        xpSum += xp;
      } else {
        // Auto-sub expected value (contingency if starter rests)
        const subWeight = pick.position === 12 ? 0.03 : pick.position === 13 ? 0.12 : pick.position === 14 ? 0.06 : 0.02;
        xpSum += xp * subWeight;
      }
    });

    const netXp = Math.round((xpSum - hits) * 10) / 10;

    return {
      totalProjectedXp: netXp,
      squadFormSum: Math.round(formSum * 10) / 10,
      squadValue: valSum
    };
  }, [currentPlan?.squad, currentChip, hits, selectedGameweek, playerMap, getPlayerGameweekXp]);

  return {
    totalProjectedXp,
    gameweekActualPoints,
    totalSeasonPoints,
    squadFormSum,
    squadValue,
    bank,
    availableFT,
    currentTransfers,
    hits,
    currentChip,
    squadRating
  };
}
