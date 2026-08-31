import { StateCreator } from 'zustand';
import { PlannerState, AiOptimizerSlice } from '../types';
import { SquadPick, PlayerFixtureItem } from '@/types/fpl';
import { optimizeLineup, autoOrderBench } from '@/utils/aiOptimizer';
import { calculatePlayerOddsXp } from '@/utils/aiOddsEngine';
import { recalculateMultiGameweekPlans } from './gameweekPlanSlice';

// Module-level calculation cache for O(1) instant xP lookups across the UI
const xpCalculationCache = new Map<string, number>();

export const createAiOptimizerSlice: StateCreator<PlannerState, [], [], AiOptimizerSlice> = (set, get) => ({
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
    const { selectedGameweek, gameweekPlans, playerMap, getPlayerGameweekXp, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan || !currentPlan.squad || currentPlan.squad.length !== 15) return;

    // Separate by positions
    const gks = currentPlan.squad.filter(p => playerMap.get(p.element)?.element_type === 1);
    const defs = currentPlan.squad.filter(p => playerMap.get(p.element)?.element_type === 2);
    const mids = currentPlan.squad.filter(p => playerMap.get(p.element)?.element_type === 3);
    const fwds = currentPlan.squad.filter(p => playerMap.get(p.element)?.element_type === 4);

    const sortByXp = (a: any, b: any) => getPlayerGameweekXp(b.element, selectedGameweek) - getPlayerGameweekXp(a.element, selectedGameweek);
    gks.sort(sortByXp);
    defs.sort(sortByXp);
    mids.sort(sortByXp);
    fwds.sort(sortByXp);

    const formations = [
      [3, 5, 2], [3, 4, 3], [4, 4, 2], [4, 3, 3], [4, 5, 1], [5, 3, 2], [5, 4, 1], [5, 2, 3]
    ];

    let bestScore = -1;
    let bestStartingOutfield: any[] = [];
    let bestBenchOutfield: any[] = [];

    for (const [dCount, mCount, fCount] of formations) {
      if (defs.length < dCount || mids.length < mCount || fwds.length < fCount) continue;

      const selDefs = defs.slice(0, dCount);
      const selMids = mids.slice(0, mCount);
      const selFwds = fwds.slice(0, fCount);

      const outfield = [...selDefs, ...selMids, ...selFwds];
      const totalXp = outfield.reduce((sum, p) => sum + getPlayerGameweekXp(p.element, selectedGameweek), 0);

      if (totalXp > bestScore) {
        bestScore = totalXp;
        bestStartingOutfield = outfield;
        bestBenchOutfield = [
          ...defs.slice(dCount),
          ...mids.slice(mCount),
          ...fwds.slice(fCount)
        ].sort(sortByXp);
      }
    }

    const startingXI = [gks[0], ...bestStartingOutfield];
    const bench = [gks[1], ...bestBenchOutfield];

    const startingSorted = [...startingXI].sort(sortByXp);
    const capId = startingSorted[0]?.element;
    const viceId = startingSorted[1]?.element;

    const newSquad = [
      ...startingXI.map((p, idx) => ({
        ...p,
        position: idx + 1,
        is_captain: p.element === capId,
        is_vice_captain: p.element === viceId,
        multiplier: p.element === capId ? (currentPlan.chip === '3xc' ? 3 : 2) : 1
      })),
      ...bench.map((p, idx) => ({
        ...p,
        position: 12 + idx,
        is_captain: false,
        is_vice_captain: false,
        multiplier: 0
      }))
    ];

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = {
      ...currentPlan,
      squad: newSquad
    };

    set({ gameweekPlans: updatedPlans, selectedSlotForSwap: null });
    get().saveCurrentPlanToServer();
  },

  optimizeSquadLineup: (targetGw?: number) => {
    const { selectedGameweek, gameweekPlans, playerMap, getPlayerGameweekXp, isGameweekLocked } = get();
    const gw = targetGw ?? selectedGameweek;
    if (isGameweekLocked(gw)) return null;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan || !currentPlan.squad || currentPlan.squad.length !== 15) return null;

    const result = optimizeLineup(currentPlan.squad, playerMap, gw, getPlayerGameweekXp);
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
    const { selectedGameweek, gameweekPlans, playerMap, getPlayerGameweekXp, isGameweekLocked } = get();
    const gw = targetGw ?? selectedGameweek;
    if (isGameweekLocked(gw)) return false;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan || !currentPlan.squad || currentPlan.squad.length !== 15) return false;

    const newSquad = autoOrderBench(currentPlan.squad, playerMap, gw, getPlayerGameweekXp);
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

  getPlayerUpcomingFixtures: (playerId: number, count?: number): PlayerFixtureItem[] => {
    const { playerMap, teamMap, fixtures, selectedGameweek, fixtureHorizon, aiProjectionsMap } = get();
    const limit = count !== undefined ? count : fixtureHorizon;
    const player = playerMap.get(playerId);
    if (!player || !fixtures.length) return [];

    const playerTeamId = player.team;
    const upcoming: PlayerFixtureItem[] = [];

    const baseForm = parseFloat(player.form) || (player.total_points > 0 ? player.total_points / 2 : 3.5);
    const epBase = parseFloat(player.ep_next || player.ep_this || `${baseForm}`);

    for (let gw = selectedGameweek; gw <= Math.min(38, selectedGameweek + 10); gw++) {
      const gwFixtures = fixtures.filter(f => f.event === gw && (f.team_h === playerTeamId || f.team_a === playerTeamId));
      for (const fix of gwFixtures) {
        const isHome = fix.team_h === playerTeamId;
        const oppTeamId = isHome ? fix.team_a : fix.team_h;
        const oppTeam = teamMap.get(oppTeamId);
        const difficulty = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;
        const oppShort = (oppTeam?.short_name || 'TBD').toUpperCase().slice(0, 3);

        const openFplKey = `${playerId}_${gw}`;
        let xP = aiProjectionsMap.get(openFplKey);

        if (xP === undefined) {
          const playerTeam = teamMap.get(playerTeamId);
          xP = calculatePlayerOddsXp(player, isHome, playerTeam, oppTeam, epBase);
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
    const { aiProjectionsMap, playerMap, nextGameweekId } = get();
    const p = playerMap.get(playerId);
    const currentNextGw = nextGameweekId || 3;

    // Check O(1) calculation cache
    const cacheKey = `${playerId}_${gameweek}_${p?.now_cost}_${p?.chance_of_playing_next_round}_${p?.status}_${currentNextGw}`;
    const cached = xpCalculationCache.get(cacheKey);
    if (cached !== undefined) return cached;

    // 1. Availability probability factor with progressive injury recovery horizon
    let availabilityFactor = 1.0;
    if (p) {
      const isImmediateGw = gameweek <= currentNextGw;
      const isNextPlusOne = gameweek === currentNextGw + 1;

      if (p.status === 'i' || p.status === 's' || p.status === 'u') {
        const isLongTerm = p.news && (p.news.includes('surgery') || p.news.includes('months') || p.news.includes('ACL') || p.news.includes('fracture'));
        if (isImmediateGw) {
          availabilityFactor = 0.0;
        } else if (isNextPlusOne) {
          availabilityFactor = isLongTerm ? 0.0 : 0.40;
        } else {
          availabilityFactor = isLongTerm ? 0.0 : 0.85;
        }
      } else if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round !== undefined) {
        if (isImmediateGw) {
          availabilityFactor = p.chance_of_playing_next_round / 100.0;
        } else if (isNextPlusOne) {
          availabilityFactor = Math.min(1.0, (p.chance_of_playing_next_round / 100.0) + 0.35);
        } else {
          availabilityFactor = 1.0;
        }
      } else if (p.status === 'd') {
        availabilityFactor = isImmediateGw ? 0.5 : isNextPlusOne ? 0.85 : 1.0;
      }
    }

    if (availabilityFactor === 0) {
      xpCalculationCache.set(cacheKey, 0.0);
      return 0.0;
    }

    // 2. Base Expected Points from Machine Learning model or Form
    let rawXp = 3.0;
    const openFplDirect = aiProjectionsMap.get(`${playerId}_${gameweek}`);
    if (openFplDirect !== undefined) {
      rawXp = openFplDirect;
    } else {
      const fixtures = get().getPlayerUpcomingFixtures(playerId, 10);
      const match = fixtures.find(f => f.event === gameweek);
      if (match && match.xP !== undefined) {
        rawXp = match.xP;
      } else if (p) {
        rawXp = parseFloat(p.form) || 3.0;
      }
    }

    // 3. Expected Minutes Damping (accounts for historical minutes per appearance)
    let minutesFactor = 1.0;
    if (p && p.minutes && p.starts) {
      const minsPerStart = p.starts > 0 ? (p.minutes / p.starts) : 90;
      if (minsPerStart < 60) {
        minutesFactor = Math.max(0.4, minsPerStart / 90.0);
      }
    }

    // 4. Set-Piece & Goalkeeper Save Floor Buffers
    let setPieceBonus = 0;
    let gkSaveFloor = 0;
    if (p) {
      if (p.element_type === 1) {
        gkSaveFloor = 2.8;
      }
      const ict = parseFloat(p.ict_index || '0');
      if (ict > 20) {
        setPieceBonus = Math.min(0.8, ict * 0.015);
      }
    }

    const calculated = (rawXp + setPieceBonus) * availabilityFactor * minutesFactor;
    const finalResult = Math.max(p?.element_type === 1 ? gkSaveFloor * availabilityFactor : 0.0, Math.round(calculated * 10) / 10);
    xpCalculationCache.set(cacheKey, finalResult);
    return finalResult;
  },

  getPlayerGameweekActualPoints: (playerId: number, gameweek: number): number | null => {
    const gwPoints = get().liveEventPoints[gameweek];
    if (gwPoints && gwPoints[playerId] !== undefined) {
      return gwPoints[playerId];
    }
    return null;
  }
});

