import { StateCreator } from "zustand";
import { PlannerState, AiOptimizerSlice } from "../types";
import { SquadPick, PlayerFixtureItem } from "@/types/fpl";
import { optimizeLineup, autoOrderBench } from "@/utils/aiOptimizer";
import { calculatePlayerOddsXp } from "@/utils/aiOddsEngine";
import { recalculateMultiGameweekPlans } from "./gameweekPlanSlice";

// Module-level calculation cache for O(1) instant xP lookups across the UI
const xpCalculationCache = new Map<string, number>();

export function invalidateXpCache(): void {
  xpCalculationCache.clear();
}

export const createAiOptimizerSlice: StateCreator<
  PlannerState,
  [],
  [],
  AiOptimizerSlice
> = (set, get) => ({
  getPlayerHorizonXp: (playerId, count) => {
    const fixtures = get().getPlayerUpcomingFixtures(playerId, count);
    if (!fixtures || fixtures.length === 0) {
      const p = get().playerMap.get(playerId);
      const base = p ? parseFloat(p.form) || 3.0 : 3.0;
      return Math.round(base * count * 10) / 10;
    }
    const total = fixtures.reduce((sum, f) => sum + (f.xP || 3.0), 0);
    return Math.round(total * 10) / 10;
  },

  autoOptimizeStartingXI: () => {
    get().optimizeSquadLineup();
  },

  optimizeSquadLineup: (targetGw?: number) => {
    const {
      selectedGameweek,
      gameweekPlans,
      playerMap,
      getPlayerGameweekXp,
      isGameweekLocked,
    } = get();
    const gw = targetGw ?? selectedGameweek;
    if (isGameweekLocked(gw)) return null;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan || !currentPlan.squad || currentPlan.squad.length !== 15)
      return null;

    const result = optimizeLineup(
      currentPlan.squad,
      playerMap,
      gw,
      getPlayerGameweekXp,
    );
    if (!result) return null;

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = {
      ...currentPlan,
      squad: result.optimizedSquad,
    };

    set({ gameweekPlans: updatedPlans, selectedSlotForSwap: null });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
    return result;
  },

  autoOrderBenchLineup: (targetGw?: number) => {
    const {
      selectedGameweek,
      gameweekPlans,
      playerMap,
      getPlayerGameweekXp,
      isGameweekLocked,
    } = get();
    const gw = targetGw ?? selectedGameweek;
    if (isGameweekLocked(gw)) return false;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan || !currentPlan.squad || currentPlan.squad.length !== 15)
      return false;

    const newSquad = autoOrderBench(
      currentPlan.squad,
      playerMap,
      gw,
      getPlayerGameweekXp,
    );
    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = {
      ...currentPlan,
      squad: newSquad,
    };

    set({ gameweekPlans: updatedPlans, selectedSlotForSwap: null });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
    return true;
  },

  applyOptimalSquad: (newSquad: SquadPick[], targetGw?: number) => {
    const { selectedGameweek, gameweekPlans, isGameweekLocked } = get();
    const gw = targetGw ?? selectedGameweek;
    if (isGameweekLocked(gw)) return;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan) return;

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = {
      ...currentPlan,
      squad: newSquad,
    };

    set({ gameweekPlans: updatedPlans, selectedSlotForSwap: null });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  getPlayerUpcomingFixtures: (
    playerId: number,
    count?: number,
  ): PlayerFixtureItem[] => {
    const {
      playerMap,
      teamMap,
      fixtures,
      selectedGameweek,
      fixtureHorizon,
      aiProjectionsMap,
    } = get();
    const limit = count !== undefined ? count : fixtureHorizon;
    const player = playerMap.get(playerId);
    if (!player || !fixtures.length) return [];

    const playerTeamId = player.team;
    const upcoming: PlayerFixtureItem[] = [];

    const baseForm =
      parseFloat(player.form) ||
      (player.total_points > 0 ? player.total_points / 2 : 3.5);
    const epBase = parseFloat(
      player.ep_next || player.ep_this || `${baseForm}`,
    );

    for (
      let gw = selectedGameweek;
      gw <= Math.min(38, selectedGameweek + 10);
      gw++
    ) {
      const gwFixtures = fixtures.filter(
        (f) =>
          f.event === gw &&
          (f.team_h === playerTeamId || f.team_a === playerTeamId),
      );
      for (const fix of gwFixtures) {
        const isHome = fix.team_h === playerTeamId;
        const oppTeamId = isHome ? fix.team_a : fix.team_h;
        const oppTeam = teamMap.get(oppTeamId);
        const difficulty = isHome
          ? fix.team_h_difficulty
          : fix.team_a_difficulty;
        const oppShort = (oppTeam?.short_name || "TBD")
          .toUpperCase()
          .slice(0, 3);

        const openFplKey = `${playerId}_${gw}`;
        let xP = aiProjectionsMap.get(openFplKey);

        if (xP === undefined) {
          const playerTeam = teamMap.get(playerTeamId);
          xP = calculatePlayerOddsXp(
            player,
            isHome,
            playerTeam,
            oppTeam,
            epBase,
            gw,
          );
        }

        upcoming.push({
          event: gw,
          opponentTeamId: oppTeamId,
          opponentShortName: oppShort,
          isHome,
          difficulty: difficulty || 3,
          xP,
        });

        if (upcoming.length >= limit) return upcoming;
      }
    }

    return upcoming;
  },

  getPlayerGameweekXp: (playerId: number, gameweek: number): number => {
    const { aiProjectionsMap, playerMap, teamMap, fixtures } = get();
    const p = playerMap.get(playerId);
    if (!p) return 0.0;

    // Check O(1) calculation cache
    const cacheKey = `${playerId}_${gameweek}_${p.now_cost}_${p.chance_of_playing_next_round}_${p.status}`;
    const cached = xpCalculationCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // 1. Direct from Canonical Projections Map (if synced from backend)
    const canonicalXp = aiProjectionsMap.get(`${playerId}_${gameweek}`);
    if (canonicalXp !== undefined) {
      xpCalculationCache.set(cacheKey, canonicalXp);
      return canonicalXp;
    }

    // 2. Direct from Player Upcoming Fixtures (aggregating multi-fixture DGW matches)
    const upcoming = get().getPlayerUpcomingFixtures(playerId, 10);
    const matches = upcoming.filter((f) => f.event === gameweek);
    if (matches.length > 0 && matches.every((m) => m.xP !== undefined)) {
      const dgwSum = matches.reduce((sum, m) => sum + (m.xP || 0), 0);
      const roundedDgw = Math.round(dgwSum * 10) / 10;
      xpCalculationCache.set(cacheKey, roundedDgw);
      return roundedDgw;
    }

    // 3. Fallback: calculate directly via canonical aiOddsEngine across ALL fixtures in this gameweek
    const playerTeam = teamMap.get(p.team);
    const gwFixes = fixtures.filter(
      (f) =>
        f.event === gameweek && (f.team_h === p.team || f.team_a === p.team),
    );

    // If player's team has NO fixtures in this gameweek (Blank Gameweek / BGW), xP is strictly 0.0
    if (gwFixes.length === 0) {
      xpCalculationCache.set(cacheKey, 0.0);
      return 0.0;
    }

    if (playerTeam) {
      let totalMatchXp = 0;
      for (const fix of gwFixes) {
        const isHome = fix.team_h === p.team;
        const oppTeam = teamMap.get(isHome ? fix.team_a : fix.team_h);
        totalMatchXp += calculatePlayerOddsXp(
          p,
          isHome,
          playerTeam,
          oppTeam,
          undefined,
          gameweek,
        );
      }
      const finalVal = Math.round(totalMatchXp * 10) / 10;
      xpCalculationCache.set(cacheKey, finalVal);
      return finalVal;
    }

    const fallback = 0.0;
    xpCalculationCache.set(cacheKey, fallback);
    return fallback;
  },

  getPlayerGameweekActualPoints: (
    playerId: number,
    gameweek: number,
  ): number | null => {
    const gwPoints = get().liveEventPoints[gameweek];
    if (gwPoints && gwPoints[playerId] !== undefined) {
      return gwPoints[playerId];
    }
    return null;
  },
});
