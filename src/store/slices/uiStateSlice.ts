import { StateCreator } from 'zustand';
import { PlannerState, UiStateSlice } from '../types';
import { canSwapSquadSlots } from '@/lib/fpl-rules';
import { recalculateMultiGameweekPlans } from './gameweekPlanSlice';

export const createUiStateSlice: StateCreator<PlannerState, [], [], UiStateSlice> = (set, get) => ({
  fixtureHorizon: 3,
  cardTheme: (typeof window !== 'undefined' && localStorage.getItem('fpl_card_theme') as any) || 'dark',
  setCardTheme: (theme: 'classic' | 'dark') => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('fpl_card_theme', theme); } catch {}
    }
    set({ cardTheme: theme });
    get().saveCurrentPlanToServer();
  },
  currentView: 'pitch',
  setCurrentView: (view) => set({ currentView: view }),

  matrixSearch: '',
  matrixPosition: null,
  matrixTeamId: null,
  matrixMinPrice: 35,
  matrixMaxPrice: 155,
  matrixHorizon: 3,
  matrixPer90: false,
  matrixSortBy: 'xP',
  matrixSortDirection: 'desc',
  matrixViewTab: 'stats',
  matrixPriceFilter: 'all',

  setMatrixSearch: (query) => set({ matrixSearch: query }),
  setMatrixPosition: (pos) => set({ matrixPosition: pos }),
  setMatrixTeamId: (teamId) => set({ matrixTeamId: teamId }),
  setMatrixPriceRange: (min, max) => set({ matrixMinPrice: min, matrixMaxPrice: max }),
  setMatrixHorizon: (h) => set({ matrixHorizon: h }),
  setMatrixPer90: (val) => set({ matrixPer90: val }),
  setMatrixViewTab: (tab) => set({ matrixViewTab: tab }),
  setMatrixPriceFilter: (filter) => set({ matrixPriceFilter: filter }),
  setMatrixSort: (col) => {
    const current = get().matrixSortBy;
    const currentDir = get().matrixSortDirection;
    if (current === col) {
      set({ matrixSortDirection: currentDir === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ matrixSortBy: col, matrixSortDirection: 'desc' });
    }
  },

  showAiPredictions: false,
  toggleAiPredictions: () => {
    const next = !get().showAiPredictions;
    set({ showAiPredictions: next });
    get().saveCurrentPlanToServer();
  },

  selectedPlayerForTransfer: null,
  selectedSlotForSwap: null,
  isMarketOpen: false,
  isScoutModalOpen: false,
  selectedPlayerForDetail: null,
  openPlayerDetail: (id) => set({ selectedPlayerForDetail: id }),
  closePlayerDetail: () => set({ selectedPlayerForDetail: null }),
  scoutPlayerOut: null,
  scoutPlayerIn: null,
  scoutGain: 0,
  scoutInitialTab: null,
  openScoutModal: (pOut, pIn, gain, initialTab) => set({ 
    isScoutModalOpen: true, 
    scoutPlayerOut: pOut || null, 
    scoutPlayerIn: pIn || null, 
    scoutGain: gain || 0, 
    scoutInitialTab: initialTab || null 
  }),
  closeScoutModal: () => set({ 
    isScoutModalOpen: false, 
    scoutPlayerOut: null, 
    scoutPlayerIn: null, 
    scoutInitialTab: null 
  }),

  marketSearch: '',
  marketPosition: null,
  marketTeamId: null,
  marketMinPrice: 35,
  marketMaxPrice: 155,
  marketAffordableOnly: false,
  marketSortBy: 'now_cost',
  marketSortOrder: 'desc',

  setFixtureHorizon: (count: 1 | 3 | 5) => set({ fixtureHorizon: count }),

  openTransferDrawer: (playerOutId?: number | null) => {
    const { playerMap, isGameweekLocked, selectedGameweek } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const playerOut = playerOutId ? playerMap.get(playerOutId) : null;
    set({
      selectedPlayerForTransfer: playerOutId || null,
      isMarketOpen: true,
      marketPosition: playerOut ? playerOut.element_type : null,
      marketSearch: '',
    });
  },

  closeTransferDrawer: () => {
    set({ isMarketOpen: false, selectedPlayerForTransfer: null });
  },

  selectSlotForSwap: (slot: number) => {
    const { selectedSlotForSwap, selectedGameweek, gameweekPlans, playerMap, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    if (selectedSlotForSwap === null) {
      set({ selectedSlotForSwap: slot });
      return;
    }

    if (selectedSlotForSwap === slot) {
      set({ selectedSlotForSwap: null });
      return;
    }

    const validation = canSwapSquadSlots(selectedSlotForSwap, slot, currentPlan.squad, playerMap);
    if (!validation.canSwap) {
      alert(validation.reason || 'Invalid substitution! Check formation constraints.');
      set({ selectedSlotForSwap: null });
      return;
    }

    const pickA = currentPlan.squad.find(p => p.position === selectedSlotForSwap);
    const pickB = currentPlan.squad.find(p => p.position === slot);
    if (!pickA || !pickB) return;

    const isStarterA = selectedSlotForSwap <= 11;
    const isStarterB = slot <= 11;
    const isTripleCaptain = currentPlan.chip === '3xc';

    const newSquad = currentPlan.squad.map(p => {
      if (p.position === selectedSlotForSwap) {
        // Player A moves to slot B
        const goingToBench = isStarterA && !isStarterB;
        return {
          ...p,
          position: slot,
          is_captain: goingToBench ? false : p.is_captain,
          is_vice_captain: goingToBench ? false : p.is_vice_captain,
          multiplier: goingToBench ? 0 : p.multiplier
        };
      }
      if (p.position === slot) {
        // Player B moves to slot A
        const comingOnFromBench = !isStarterB && isStarterA;
        const inheritsCaptain = comingOnFromBench && pickA.is_captain;
        const inheritsVice = comingOnFromBench && pickA.is_vice_captain;
        const goingToBench = isStarterB && !isStarterA;

        return {
          ...p,
          position: selectedSlotForSwap,
          is_captain: inheritsCaptain ? true : goingToBench ? false : p.is_captain,
          is_vice_captain: inheritsVice ? true : goingToBench ? false : p.is_vice_captain,
          multiplier: inheritsCaptain ? (isTripleCaptain ? 3 : 2) : goingToBench ? 0 : p.multiplier
        };
      }
      return p;
    });

    // Handle reciprocal when Player A is coming on from bench (selectedSlotForSwap > 11 && slot <= 11)
    if (!isStarterA && isStarterB) {
      const inheritsCaptain = pickB.is_captain;
      const inheritsVice = pickB.is_vice_captain;
      newSquad.forEach(p => {
        if (p.element === pickA.element) {
          if (inheritsCaptain) {
            p.is_captain = true;
            p.multiplier = isTripleCaptain ? 3 : 2;
          } else if (inheritsVice) {
            p.is_vice_captain = true;
            p.multiplier = 1;
          }
        }
      });
    }

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = {
      ...currentPlan,
      squad: newSquad,
    };

    set({ gameweekPlans: updatedPlans, selectedSlotForSwap: null });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  setMarketSearch: (query: string) => set({ marketSearch: query }),
  setMarketPosition: (pos: number | null) => set({ marketPosition: pos }),
  setMarketTeamId: (teamId: number | null) => set({ marketTeamId: teamId }),
  setMarketPriceRange: (min: number, max: number) => set({ marketMinPrice: min, marketMaxPrice: max }),
  setMarketAffordableOnly: (val: boolean) => set({ marketAffordableOnly: val }),
  setMarketSort: (sortBy) => {
    const currentSort = get().marketSortBy;
    const currentOrder = get().marketSortOrder;
    if (currentSort === sortBy) {
      set({ marketSortOrder: currentOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ marketSortBy: sortBy, marketSortOrder: 'desc' });
    }
  },
});
