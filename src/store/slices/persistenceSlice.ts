import { StateCreator } from 'zustand';
import { PlannerState, PersistenceSlice, TeamHistoryEvent, PlayedChipInfo } from '../types';
import { SquadPick, PlannedGameweek, ChipType } from '@/types/fpl';
import { saveActivePin } from '@/lib/auth';
import { calculateGameweekFinancials } from '@/lib/fpl-rules';
import { recalculateMultiGameweekPlans } from './gameweekPlanSlice';

export const createPersistenceSlice: StateCreator<PlannerState, [], [], PersistenceSlice> = (set, get) => ({
  activePin: null,
  teamSummary: null,
  teamHistoryCurrent: [],
  playedChips: [],

  loadUserPlanByPin: async (pin: string, teamId?: number | null) => {
    set({ isLoading: true, activePin: pin });
    saveActivePin(pin);

    const applyPlanState = (p: any) => {
      const playedChips = p.playedChips || [];
      const plans: Record<number, PlannedGameweek> = { ...(p.gameweekPlans || {}) };
      const allPlansList = Object.values(plans) as PlannedGameweek[];
      const baseSquad = allPlansList.find(gwPlan => gwPlan && gwPlan.squad && gwPlan.squad.length > 0)?.squad || [];

      if (baseSquad.length > 0) {
        for (let g = 1; g <= 38; g++) {
          if (!plans[g] || !plans[g].squad || plans[g].squad.length === 0) {
            plans[g] = {
              gameweek: g,
              squad: [...baseSquad],
              transfersIn: [],
              transfersOut: [],
              chip: 'none',
              calculatedBank: p.initialBank || 0,
              availableTransfers: 1,
              transfersUsed: 0,
              transferCost: 0,
            };
          }
        }
      }

      const { playerMap } = get();
      const normalizePick = (pick: SquadPick): SquadPick => {
        const pl = playerMap.get(pick.element);
        const actualCost = pl ? pl.now_cost : (pick.selling_price || 50);
        return {
          ...pick,
          purchase_price: actualCost,
          selling_price: actualCost,
        };
      };

      const normalizedPlans: Record<number, PlannedGameweek> = {};
      Object.keys(plans).forEach(gwKey => {
        const gw = parseInt(gwKey, 10);
        const plan = plans[gw];
        if (plan) {
          normalizedPlans[gw] = {
            ...plan,
            squad: (plan.squad || []).map(normalizePick),
          };
        }
      });

      const baseImported = (p.baseImportedPicks && p.baseImportedPicks.length > 0 
        ? p.baseImportedPicks 
        : (allPlansList.find(gwPlan => gwPlan && gwPlan.squad && gwPlan.squad.length > 0)?.squad || [])
      ).map(normalizePick);

      set({
        teamSummary: p.teamSummary,
        teamHistoryCurrent: p.teamHistoryCurrent || [],
        playedChips,
        baseImportedPicks: baseImported,
        showAiPredictions: p.showAiPredictions || false,
        cardTheme: p.cardTheme || 'dark',
        startGameweek: 1,
        selectedGameweek: p.selectedGameweek || get().nextGameweekId,
        initialBank: p.initialBank || 0,
        initialFreeTransfers: p.initialFreeTransfers || 1,
        gameweekPlans: normalizedPlans,
        lastSavedTime: p.updatedAt || new Date().toLocaleTimeString(),
        isLoading: false,
      });

      recalculateMultiGameweekPlans(get, set);

      // Save locally as backup
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('fpl_plan_' + pin, JSON.stringify(p));
        }
      } catch {}
    };

    try {
      const res = await fetch(`/api/user-plan?pin=${encodeURIComponent(pin)}${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.exists && data.plan) {
          const p = data.plan;

          // Refresh official entry chips if available
          if (p.teamSummary?.id) {
            try {
              const entryRes = await fetch(`/api/fpl/entry/${p.teamSummary.id}`);
              if (entryRes.ok) {
                const entryData = await entryRes.json();
                if (entryData.history?.chips?.length) {
                  p.playedChips = entryData.history.chips.map((c: any) => ({
                    name: c.name,
                    event: c.event,
                    time: c.time,
                  }));
                }
                if (entryData.history?.current?.length) {
                  p.teamHistoryCurrent = entryData.history.current;
                }
              }
            } catch (fetchErr) {
              console.warn('Could not refresh official chip history:', fetchErr);
            }
          }

          applyPlanState(p);
          return { exists: true, teamLoaded: true };
        }
      }
      
      // Fallback to local storage if server has no record (e.g. serverless cold start)
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('fpl_plan_' + pin);
        if (cached) {
          const p = JSON.parse(cached);
          if (p && p.teamSummary) {
            applyPlanState(p);
            get().saveCurrentPlanToServer();
            return { exists: true, teamLoaded: true };
          }
        }
      }

      set({ isLoading: false });
      return { exists: false, teamLoaded: false };
    } catch (e) {
      console.error('Error loading user plan from server, trying local cache:', e);
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('fpl_plan_' + pin);
          if (cached) {
            const p = JSON.parse(cached);
            if (p && p.teamSummary) {
              applyPlanState(p);
              get().saveCurrentPlanToServer();
              return { exists: true, teamLoaded: true };
            }
          }
        }
      } catch {}
      set({ isLoading: false });
      return { exists: false, teamLoaded: false };
    }
  },

  saveCurrentPlanToServer: async () => {
    const { activePin, teamSummary, teamHistoryCurrent, playedChips, baseImportedPicks, showAiPredictions, cardTheme, selectedGameweek, initialBank, initialFreeTransfers, gameweekPlans } = get();
    if (!activePin || !teamSummary) return;

    set({ isSaving: true });
    try {
      const planPayload = {
        pin: activePin,
        teamSummary,
        teamHistoryCurrent,
        playedChips,
        baseImportedPicks,
        showAiPredictions,
        cardTheme,
        startGameweek: 1,
        selectedGameweek,
        initialBank,
        initialFreeTransfers,
        gameweekPlans,
      };

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('fpl_plan_' + activePin, JSON.stringify(planPayload));
        }
      } catch {}

      const res = await fetch('/api/user-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload),
      });

      if (res.ok) {
        set({ isSaving: false, lastSavedTime: new Date().toLocaleTimeString() });
      } else {
        set({ isSaving: false });
      }
    } catch (err) {
      console.error('Error saving plan to server:', err);
      set({ isSaving: false });
    }
  },

  importTeam: async (teamId: number) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/fpl/entry/${teamId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Team not found');
      }

      const data = await res.json();
      const nextGw = get().nextGameweekId;
      const initialBank = data.entry_history?.bank || 0;
      const initialFT = data.initialFreeTransfers || 1;

      const playedChips: PlayedChipInfo[] = (data.history?.chips || []).map((c: any) => ({
        name: c.name,
        event: c.event,
        time: c.time,
      }));

      const teamHistoryCurrent: TeamHistoryEvent[] = data.history?.current || [];

      const initialSquad: SquadPick[] = (data.picks || []).map((p: any) => ({
        element: p.element,
        position: p.position,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
        multiplier: p.multiplier,
        purchase_price: p.purchase_price || get().playerMap.get(p.element)?.now_cost || 50,
        selling_price: p.selling_price || get().playerMap.get(p.element)?.now_cost || 50,
      }));

      const plans: Record<number, PlannedGameweek> = {};
      let rollingBank = initialBank;
      let rollingFT = initialFT;
      const rollingSquad = [...initialSquad];

      for (let gw = 1; gw <= 38; gw++) {
        const gwChip: ChipType = (data.active_chip && gw === nextGw) ? data.active_chip : 'none';

        const fin = calculateGameweekFinancials({
          currentBank: rollingBank,
          availableFreeTransfers: rollingFT,
          transfersCount: 0,
          chip: gwChip,
        });

        plans[gw] = {
          gameweek: gw,
          squad: [...rollingSquad],
          transfersIn: [],
          transfersOut: [],
          chip: gwChip,
          calculatedBank: fin.effectiveBank,
          availableTransfers: fin.availableTransfers,
          transfersUsed: 0,
          transferCost: 0,
        };

        if (gw >= nextGw) {
          rollingFT = fin.nextGameweekFT;
        }
      }

      set({
        teamSummary: data.entry,
        baseImportedPicks: initialSquad,
        teamHistoryCurrent,
        playedChips,
        initialBank,
        initialFreeTransfers: initialFT,
        startGameweek: 1,
        selectedGameweek: nextGw,
        gameweekPlans: plans,
        isLoading: false,
      });

      get().saveCurrentPlanToServer();
      return true;
    } catch (err: any) {
      set({ error: err.message || 'Could not import team', isLoading: false });
      return false;
    }
  },

  loadDemoTeam: () => {
    const { players, nextGameweekId } = get();
    if (!players.length) return;

    const gks = players.filter(p => p.element_type === 1).slice(0, 2);
    const defs = players.filter(p => p.element_type === 2).slice(0, 5);
    const mids = players.filter(p => p.element_type === 3).slice(0, 5);
    const fwds = players.filter(p => p.element_type === 4).slice(0, 3);

    const squadElements = [
      gks[0], defs[0], defs[1], defs[2], mids[0], mids[1], mids[2], mids[3], mids[4], fwds[0], fwds[1],
      gks[1], defs[3], defs[4], fwds[2]
    ];

    const picks: SquadPick[] = squadElements.map((p, idx) => ({
      element: p.id,
      position: idx + 1,
      is_captain: idx === 9,
      is_vice_captain: idx === 4,
      multiplier: idx === 9 ? 2 : 1,
      purchase_price: p.now_cost,
      selling_price: p.now_cost,
    }));

    const initialBank = 15;
    const plans: Record<number, PlannedGameweek> = {};
    let rollingFT = 2;

    for (let gw = 1; gw <= 38; gw++) {
      const fin = calculateGameweekFinancials({
        currentBank: initialBank,
        availableFreeTransfers: rollingFT,
        transfersCount: 0,
        chip: 'none',
      });

      plans[gw] = {
        gameweek: gw,
        squad: [...picks],
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        calculatedBank: fin.effectiveBank,
        availableTransfers: fin.availableTransfers,
        transfersUsed: 0,
        transferCost: 0,
      };

      rollingFT = fin.nextGameweekFT;
    }

    set({
      teamSummary: {
        id: 999999,
        name: 'Demo FC',
        player_first_name: 'FPL',
        player_last_name: 'Manager',
        summary_overall_points: 1250,
        summary_overall_rank: 45200,
        current_event: nextGameweekId,
      },
      teamHistoryCurrent: [
        { event: 1, points: 79, total_points: 79, rank: 120623, points_on_bench: 0, bank: 0, value: 1000 },
        { event: 2, points: 0, total_points: 79, rank: 120623, points_on_bench: 0, bank: 0, value: 1002 }
      ],
      playedChips: [{ name: 'bboost', event: 1 }],
      initialBank,
      initialFreeTransfers: 2,
      startGameweek: 1,
      selectedGameweek: nextGameweekId,
      gameweekPlans: plans,
      isLoading: false,
    });

    get().saveCurrentPlanToServer();
  },
});

