import { useMemo } from "react";
import { usePlannerStore } from "@/store/usePlannerStore";
import { calculateSquadRating, SquadRatingResult } from "@/utils/aiSquadRating";

/**
 * Single Source of Truth for Squad Power Rating:
 * Computes and shares the unified squad rating across Header, Left Strategy Panel,
 * Mobile Strategy Dock, and Mobile Menu Drawer without duplicate or desynchronized calculations.
 */
export function useSquadRating(): SquadRatingResult | null {
  const selectedGameweek = usePlannerStore((state) => state.selectedGameweek);
  const activePlan = usePlannerStore(
    (state) => state.gameweekPlans[selectedGameweek],
  );
  const players = usePlannerStore((state) => state.players);
  const playerMap = usePlannerStore((state) => state.playerMap);
  const getPlayerGameweekXp = usePlannerStore(
    (state) => state.getPlayerGameweekXp,
  );
  const fixtureHorizon = usePlannerStore((state) => state.fixtureHorizon);
  const showAiPredictions = usePlannerStore((state) => state.showAiPredictions);

  return useMemo(() => {
    if (
      !showAiPredictions ||
      !activePlan?.squad ||
      activePlan.squad.length === 0 ||
      !players.length
    ) {
      return null;
    }

    const currentVal = activePlan.squad.reduce(
      (s, p) => s + (playerMap.get(p.element)?.now_cost || 0),
      0,
    );
    const budget = currentVal + (activePlan.calculatedBank || 0);

    return calculateSquadRating(
      activePlan.squad,
      players,
      playerMap,
      selectedGameweek,
      getPlayerGameweekXp,
      fixtureHorizon,
      budget,
      activePlan.availableTransfers || 1,
    );
  }, [
    showAiPredictions,
    activePlan?.squad,
    activePlan?.calculatedBank,
    activePlan?.availableTransfers,
    players,
    playerMap,
    selectedGameweek,
    getPlayerGameweekXp,
    fixtureHorizon,
  ]);
}
