import { create } from 'zustand';
import { 
  FPLPlayer, 
  FPLTeam, 
  FPLEvent, 
  FPLFixture, 
  SquadPick, 
  ChipType, 
  PlannedGameweek, 
  EntrySummary, 
  PlayerFixtureItem 
} from '@/types/fpl';
import { calculateGameweekFinancials, canSwapSquadSlots, validateClubLimit } from '@/lib/fpl-rules';
import { saveActivePin, getActivePin } from '@/lib/auth';
import { optimizeLineup, autoOrderBench, OptimizationResult } from '@/utils/aiOptimizer';
import { calculatePlayerOddsXp } from '@/utils/aiOddsEngine';

export interface PlayedChipInfo {
  name: string;
  event: number;
  time?: string;
}

export interface TeamHistoryEvent {
  event: number;
  points: number;
  total_points: number;
  rank: number;
  points_on_bench: number;
  bank: number;
  value: number;
}

interface PlannerState {
  isLoading: boolean;
  isSaving: boolean;
  lastSavedTime: string | null;
  error: string | null;
  players: FPLPlayer[];
  teams: FPLTeam[];
  events: FPLEvent[];
  fixtures: FPLFixture[];
  playerMap: Map<number, FPLPlayer>;
  teamMap: Map<number, FPLTeam>;
  aiProjectionsMap: Map<string, number>;
  liveEventPoints: Record<number, Record<number, number>>; // gw -> { elementId: points }
  nextGameweekId: number;

  fixtureHorizon: 1 | 3 | 5;
  cardTheme: 'classic' | 'dark';
  setCardTheme: (theme: 'classic' | 'dark') => void;
currentView: 'pitch' | 'matrix';
  setCurrentView: (view: 'pitch' | 'matrix') => void;

  matrixSearch: string;
  matrixPosition: number | null;
  matrixTeamId: number | null;
  matrixMinPrice: number;
  matrixMaxPrice: number;
  matrixHorizon: 1 | 3 | 5;
  matrixPer90: boolean;
  matrixSortBy: string;
  matrixSortDirection: 'asc' | 'desc';
  matrixViewTab: 'stats' | 'price_radar';
  matrixPriceFilter: 'all' | 'rising' | 'approaching' | 'falling' | 'squad';
  setMatrixSearch: (query: string) => void;
  setMatrixPosition: (pos: number | null) => void;
  setMatrixTeamId: (teamId: number | null) => void;
  setMatrixPriceRange: (min: number, max: number) => void;
  setMatrixHorizon: (h: 1 | 3 | 5) => void;
  setMatrixPer90: (val: boolean) => void;
  setMatrixSort: (column: string) => void;
  setMatrixViewTab: (tab: 'stats' | 'price_radar') => void;
  setMatrixPriceFilter: (filter: 'all' | 'rising' | 'approaching' | 'falling' | 'squad') => void;
  getPlayerHorizonXp: (playerId: number, count: number) => number;
  showAiPredictions: boolean;
  toggleAiPredictions: () => void;
  autoOptimizeStartingXI: () => void;
  autoOrderBenchLineup: (targetGw?: number) => boolean;

  activePin: string | null;
  teamSummary: EntrySummary | null;
  teamHistoryCurrent: TeamHistoryEvent[];
  playedChips: PlayedChipInfo[];
  initialBank: number;
  initialFreeTransfers: number;
  baseImportedPicks: SquadPick[];
  startGameweek: number;
  selectedGameweek: number;

  gameweekPlans: Record<number, PlannedGameweek>;

  selectedPlayerForTransfer: number | null;
  selectedSlotForSwap: number | null;
  isMarketOpen: boolean;
  isScoutModalOpen: boolean;
  selectedPlayerForDetail: number | null;
  openPlayerDetail: (playerId: number) => void;
  closePlayerDetail: () => void;
  scoutPlayerOut: FPLPlayer | null;
  scoutPlayerIn: FPLPlayer | null;
  scoutGain: number;
  scoutInitialTab: 'transfers' | 'targets' | 'hits' | 'chips' | 'optimal_squad' | null;
  openScoutModal: (pOut?: FPLPlayer | null, pIn?: FPLPlayer | null, gain?: number, initialTab?: 'transfers' | 'targets' | 'hits' | 'chips' | 'optimal_squad') => void;
  closeScoutModal: () => void;
  executeDirectTransfer: (playerOutId: number, playerInId: number) => boolean;

  marketSearch: string;
  marketPosition: number | null;
  marketTeamId: number | null;
  marketMaxPrice: number;
  marketMinPrice: number;
  marketAffordableOnly: boolean;
  marketSortBy: 'now_cost' | 'total_points' | 'form' | 'selected_by_percent' | 'fdr';
  marketSortOrder: 'asc' | 'desc';

  setFixtureHorizon: (count: 1 | 3 | 5) => void;
  initFPLData: () => Promise<void>;
  loadUserPlanByPin: (pin: string, teamId?: number | null) => Promise<{ exists: boolean; teamLoaded: boolean }>;
  saveCurrentPlanToServer: () => Promise<void>;
  importTeam: (teamId: number) => Promise<boolean>;
  loadDemoTeam: () => void;
  selectGameweek: (gw: number) => void;
  fetchLivePointsForGameweek: (gw: number) => Promise<void>;
  
  selectSlotForSwap: (slot: number) => void;
  setCaptain: (elementId: number) => void;
  setViceCaptain: (elementId: number) => void;
  optimizeSquadLineup: (gw?: number) => OptimizationResult | null;
  applyOptimalSquad: (newSquad: SquadPick[], targetGw?: number) => void;

  openTransferDrawer: (playerOutId?: number | null) => void;
  closeTransferDrawer: () => void;
  executeTransfer: (playerIn: FPLPlayer, explicitPlayerOutId?: number | null) => boolean;
  revertTransfer: (playerInId: number) => void;
  resetCurrentGameweek: () => void;
  resetAllFutureGameweeks: () => void;
  
  setChip: (chip: ChipType) => void;
  setBankOverride: (gw: number, bankTenths: number | null) => void;
  setFreeTransfersOverride: (gw: number, count: number | null) => void;

  setMarketSearch: (query: string) => void;
  setMarketPosition: (pos: number | null) => void;
  setMarketTeamId: (teamId: number | null) => void;
  setMarketPriceRange: (min: number, max: number) => void;
  setMarketAffordableOnly: (val: boolean) => void;
  setMarketSort: (sortBy: PlannerState['marketSortBy']) => void;

  getPlayerUpcomingFixtures: (playerId: number, count?: number) => PlayerFixtureItem[];
  getPlayerGameweekXp: (playerId: number, gameweek: number) => number;
  getPlayerGameweekActualPoints: (playerId: number, gameweek: number) => number | null;
  isGameweekLocked: (gameweek?: number) => boolean;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  isLoading: false,
  isSaving: false,
  lastSavedTime: null,
  error: null,
  players: [],
  teams: [],
  events: [],
  fixtures: [],
  playerMap: new Map(),
  teamMap: new Map(),
  aiProjectionsMap: new Map(),
  liveEventPoints: {},
  nextGameweekId: 3,

  fixtureHorizon: 3,
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
  showAiPredictions: false,

  activePin: null,
  teamSummary: null,
  teamHistoryCurrent: [],
  playedChips: [],
  initialBank: 0,
  initialFreeTransfers: 1,
  baseImportedPicks: [],
  startGameweek: 1,
  selectedGameweek: 3,
  gameweekPlans: {},

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
  openScoutModal: (pOut, pIn, gain, initialTab) => set({ isScoutModalOpen: true, scoutPlayerOut: pOut || null, scoutPlayerIn: pIn || null, scoutGain: gain || 0, scoutInitialTab: initialTab || null }),
  closeScoutModal: () => set({ isScoutModalOpen: false, scoutPlayerOut: null, scoutPlayerIn: null, scoutInitialTab: null }),

  marketSearch: '',
  marketPosition: null,
  marketTeamId: null,
  marketMinPrice: 35,
  marketMaxPrice: 155,
  marketAffordableOnly: false,
  marketSortBy: 'now_cost',
  marketSortOrder: 'desc',

  cardTheme: (typeof window !== 'undefined' && localStorage.getItem('fpl_card_theme') as any) || 'dark',
  setCardTheme: (theme: 'classic' | 'dark') => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('fpl_card_theme', theme); } catch {}
    }
    set({ cardTheme: theme });
    get().saveCurrentPlanToServer();
  },
  setFixtureHorizon: (count: 1 | 3 | 5) => set({ fixtureHorizon: count }),
  toggleAiPredictions: () => {
    const next = !get().showAiPredictions;
    set({ showAiPredictions: next });
    get().saveCurrentPlanToServer();
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

    // Sort by projected points descending
    const sortByXp = (a: any, b: any) => getPlayerGameweekXp(b.element, selectedGameweek) - getPlayerGameweekXp(a.element, selectedGameweek);
    gks.sort(sortByXp);
    defs.sort(sortByXp);
    mids.sort(sortByXp);
    fwds.sort(sortByXp);

    // Valid formation possibilities (def, mid, fwd) that total 10 outfielders
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

    // Pick top XP player in starting XI as Captain, second as Vice
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

  isGameweekLocked: (gameweek?: number) => {
    const gw = gameweek !== undefined ? gameweek : get().selectedGameweek;
    return gw < get().nextGameweekId;
  },

  fetchLivePointsForGameweek: async (gw: number) => {
    if (get().liveEventPoints[gw]) return;
    try {
      const res = await fetch(`/api/fpl/event/${gw}/live`);
      if (res.ok) {
        const data = await res.json();
        const updated = { ...get().liveEventPoints, [gw]: data };
        set({ liveEventPoints: updated });
      }
    } catch (e) {
      console.warn(`Error fetching live points for GW ${gw}:`, e);
    }
  },

  initFPLData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [bootstrapRes, fixturesRes, projectionsRes] = await Promise.all([
        fetch('/api/fpl/bootstrap'),
        fetch('/api/fpl/fixtures'),
        fetch('/api/fpl/projections').catch(() => null),
      ]);

      if (!bootstrapRes.ok) throw new Error('Failed to load FPL core data');
      const bootstrapData = await bootstrapRes.json();
      const fixturesData = fixturesRes.ok ? await fixturesRes.json() : [];

      const aiProjectionsMap = new Map<string, number>();
      if (projectionsRes && projectionsRes.ok) {
        try {
          const projData = await projectionsRes.json();
          if (projData.predictions && typeof projData.predictions === 'object') {
            for (const [key, val] of Object.entries(projData.predictions)) {
              aiProjectionsMap.set(key, Number(val));
            }
          }
        } catch (e) {
          console.warn('OpenFPL projections parsing warning:', e);
        }
      }

      const playerMap = new Map<number, FPLPlayer>();
      for (const p of bootstrapData.elements || []) {
        playerMap.set(p.id, p);
      }

      const teamMap = new Map<number, FPLTeam>();
      for (const t of bootstrapData.teams || []) {
        teamMap.set(t.id, t);
      }

      const events: FPLEvent[] = bootstrapData.events || [];
      const nextEvent = events.find(e => e.is_next) || events.find(e => e.is_current) || events[0];
      const nextGwId = nextEvent ? nextEvent.id : 3;

      set({
        players: bootstrapData.elements || [],
        teams: bootstrapData.teams || [],
        events,
        fixtures: fixturesData || [],
        playerMap,
        teamMap,
        aiProjectionsMap,
        nextGameweekId: nextGwId,
        startGameweek: 1,
        selectedGameweek: nextGwId,
      });

      // Fetch live points for past GWs
      for (let g = 1; g < nextGwId; g++) {
        get().fetchLivePointsForGameweek(g);
      }

      const savedPin = getActivePin();
      if (savedPin) {
        await get().loadUserPlanByPin(savedPin);
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      console.error('initFPLData error:', err);
      set({ error: err.message || 'Failed to initialize FPL data', isLoading: false });
    }
  },

  loadUserPlanByPin: async (pin: string, teamId?: number | null) => {
    set({ isLoading: true, activePin: pin });
    saveActivePin(pin);

    const applyPlanState = (p: any) => {
      let playedChips = p.playedChips || [];
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

      // Pre-fetch live points for past gameweeks
      for (let g = 1; g < get().nextGameweekId; g++) {
        get().fetchLivePointsForGameweek(g);
      }
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
      let rollingSquad = [...initialSquad];

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

      for (let g = 1; g < nextGw; g++) {
        get().fetchLivePointsForGameweek(g);
      }

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

  selectGameweek: (gw: number) => {
    const { gameweekPlans, nextGameweekId } = get();
    if (gw < nextGameweekId) {
      get().fetchLivePointsForGameweek(gw);
    }

    if (!gameweekPlans[gw] || !gameweekPlans[gw].squad || gameweekPlans[gw].squad.length === 0) {
      const allPlansList = Object.values(gameweekPlans) as PlannedGameweek[];
      const baseSquad = allPlansList.find(p => p && p.squad && p.squad.length > 0)?.squad || [];
      const updatedPlans = { ...gameweekPlans };
      updatedPlans[gw] = {
        gameweek: gw,
        squad: [...baseSquad],
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        calculatedBank: 0,
        availableTransfers: 1,
        transfersUsed: 0,
        transferCost: 0,
      };
      set({ gameweekPlans: updatedPlans, selectedGameweek: gw, selectedSlotForSwap: null, selectedPlayerForTransfer: null, isMarketOpen: false });
    } else {
      set({ selectedGameweek: gw, selectedSlotForSwap: null, selectedPlayerForTransfer: null, isMarketOpen: false });
    }
    get().saveCurrentPlanToServer();
  },

  selectSlotForSwap: (slot: number) => {
    const { selectedSlotForSwap, selectedGameweek, gameweekPlans, playerMap, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return; // Locked past gameweek

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

  setCaptain: (elementId: number) => {
    const { selectedGameweek, gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    const targetPick = currentPlan.squad.find(p => p.element === elementId);
    if (!targetPick) return;

    // Check if target player was already vice-captain
    const wasTargetViceCaptain = targetPick.is_vice_captain;
    const isTripleCaptain = currentPlan.chip === '3xc';

    const newSquad = currentPlan.squad.map(p => {
      if (p.element === elementId) {
        return { 
          ...p, 
          is_captain: true, 
          is_vice_captain: false, 
          multiplier: isTripleCaptain ? 3 : 2 
        };
      }
      if (p.is_captain) {
        // If target was vice-captain, previous captain automatically becomes vice-captain (roles swapped!)
        return { 
          ...p, 
          is_captain: false, 
          is_vice_captain: wasTargetViceCaptain ? true : p.is_vice_captain, 
          multiplier: 1 
        };
      }
      return p;
    });

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = { ...currentPlan, squad: newSquad };
    set({ gameweekPlans: updatedPlans });
    get().saveCurrentPlanToServer();
  },

  setViceCaptain: (elementId: number) => {
    const { selectedGameweek, gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    const targetPick = currentPlan.squad.find(p => p.element === elementId);
    if (!targetPick) return;

    // Check if target player was already captain
    const wasTargetCaptain = targetPick.is_captain;
    const isTripleCaptain = currentPlan.chip === '3xc';

    const newSquad = currentPlan.squad.map(p => {
      if (p.element === elementId) {
        return { 
          ...p, 
          is_vice_captain: true, 
          is_captain: false, 
          multiplier: 1 
        };
      }
      if (p.is_vice_captain) {
        // If target was captain, previous vice-captain automatically becomes captain (roles swapped!)
        return { 
          ...p, 
          is_vice_captain: false, 
          is_captain: wasTargetCaptain ? true : p.is_captain, 
          multiplier: wasTargetCaptain ? (isTripleCaptain ? 3 : 2) : p.multiplier 
        };
      }
      return p;
    });

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = { ...currentPlan, squad: newSquad };
    set({ gameweekPlans: updatedPlans });
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

  executeTransfer: (playerIn: FPLPlayer, explicitPlayerOutId?: number | null) => {
    const { selectedPlayerForTransfer, selectedGameweek, gameweekPlans, playerMap, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return false;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return false;

    const isAlreadyIn = currentPlan.squad.some(p => p.element === playerIn.id);
    if (isAlreadyIn) {
      alert(`${playerIn.web_name} is already in your squad!`);
      return false;
    }

    const targetOutId = explicitPlayerOutId ?? selectedPlayerForTransfer;
    let outPick = targetOutId 
      ? currentPlan.squad.find(p => p.element === targetOutId) 
      : null;

    // If no player was preselected, find the most valuable squad player in that position
    if (!outPick) {
      const matchingPicks = currentPlan.squad.filter(p => playerMap.get(p.element)?.element_type === playerIn.element_type);
      if (matchingPicks.length === 0) {
        alert(`No players found in your squad matching ${playerIn.web_name}'s position.`);
        return false;
      }
      outPick = matchingPicks.sort((a, b) => {
        const pA = playerMap.get(a.element);
        const pB = playerMap.get(b.element);
        const costA = a.selling_price || pA?.now_cost || 0;
        const costB = b.selling_price || pB?.now_cost || 0;
        return costB - costA; // Highest sell price first
      })[0];
    }

    const playerOut = playerMap.get(outPick.element);
    if (!playerOut) return false;

    if (playerOut.element_type !== playerIn.element_type) {
      alert(`Cannot replace ${playerOut.web_name} with ${playerIn.web_name}. Positions must match.`);
      return false;
    }

    const sellPrice = playerOut.now_cost;
    const buyPrice = playerIn.now_cost;
    const priceDiff = sellPrice - buyPrice;

    if (currentPlan.calculatedBank + priceDiff < 0) {
      const deficit = ((buyPrice - sellPrice - currentPlan.calculatedBank) / 10).toFixed(1);
      alert(`Transfer unaffordable! Requires £${deficit}m more in the bank.`);
      return false;
    }

    const newPick: SquadPick = {
      element: playerIn.id,
      position: outPick.position,
      is_captain: outPick.is_captain,
      is_vice_captain: outPick.is_vice_captain,
      multiplier: outPick.multiplier,
      purchase_price: buyPrice,
      selling_price: buyPrice,
    };

    const newSquad = currentPlan.squad.map(p => p.element === playerOut.id ? newPick : p);

    const clubValidation = validateClubLimit(newSquad, playerMap);
    if (!clubValidation.isValid) {
      const offendingTeam = get().teamMap.get(clubValidation.violations[0].teamId);
      alert(`Club limit exceeded! You cannot have more than 3 players from ${offendingTeam?.name || 'the same club'}.`);
      return false;
    }

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[selectedGameweek] = {
      ...currentPlan,
      squad: newSquad,
    };

    set({
      gameweekPlans: updatedPlans,
      isMarketOpen: false,
      selectedPlayerForTransfer: null,
    });

    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
    return true;
  },

  executeDirectTransfer: (playerOutId: number, playerInId: number) => {
    const { playerMap, executeTransfer } = get();
    const playerIn = playerMap.get(playerInId);
    if (!playerIn) return false;
    return executeTransfer(playerIn, playerOutId);
  },

  revertTransfer: (playerInId: number) => {
    get().resetCurrentGameweek();
  },

  resetCurrentGameweek: () => {
    const { selectedGameweek, gameweekPlans, nextGameweekId, baseImportedPicks, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    let targetSquad: SquadPick[] = [];
    if (selectedGameweek === nextGameweekId) {
      // Revert directly to State 0 (Original imported squad from API)
      targetSquad = baseImportedPicks.length > 0 
        ? baseImportedPicks.map(p => ({ ...p })) 
        : (gameweekPlans[nextGameweekId]?.squad || []);
    } else {
      const prevGw = selectedGameweek - 1;
      targetSquad = gameweekPlans[prevGw]?.squad ? gameweekPlans[prevGw].squad.map(p => ({ ...p })) : baseImportedPicks;
    }

    const updatedPlans = { ...gameweekPlans };
    if (updatedPlans[selectedGameweek]) {
      updatedPlans[selectedGameweek] = {
        ...updatedPlans[selectedGameweek],
        squad: targetSquad,
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        bankOverride: null,
        freeTransfersOverride: null,
      };
    }

    set({ gameweekPlans: updatedPlans, isMarketOpen: false, selectedPlayerForTransfer: null });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  resetAllFutureGameweeks: () => {
    const { nextGameweekId, gameweekPlans, baseImportedPicks, initialBank, initialFreeTransfers } = get();
    
    const baseSquad = baseImportedPicks.length > 0 
      ? baseImportedPicks.map(p => ({ ...p })) 
      : (gameweekPlans[nextGameweekId]?.squad || []);

    const updatedPlans: Record<number, PlannedGameweek> = {};

    for (let g = 1; g < nextGameweekId; g++) {
      if (gameweekPlans[g]) {
        updatedPlans[g] = gameweekPlans[g];
      }
    }

    let rollingBank = initialBank;
    let rollingFT = initialFreeTransfers;

    for (let gw = nextGameweekId; gw <= 38; gw++) {
      const fin = calculateGameweekFinancials({
        currentBank: rollingBank,
        availableFreeTransfers: rollingFT,
        transfersCount: 0,
        chip: 'none',
      });

      updatedPlans[gw] = {
        gameweek: gw,
        squad: baseSquad.map(p => ({ ...p })),
        transfersIn: [],
        transfersOut: [],
        chip: 'none',
        calculatedBank: fin.effectiveBank,
        availableTransfers: fin.availableTransfers,
        transfersUsed: 0,
        transferCost: 0,
      };

      rollingBank = fin.effectiveBank;
      rollingFT = fin.nextGameweekFT;
    }

    set({
      gameweekPlans: updatedPlans,
      isMarketOpen: false,
      selectedPlayerForTransfer: null,
    });

    get().saveCurrentPlanToServer();
  },

  setChip: (chip: ChipType) => {
    const { selectedGameweek, gameweekPlans, playedChips, isGameweekLocked } = get();
    if (isGameweekLocked(selectedGameweek)) return;

    const currentPlan = gameweekPlans[selectedGameweek];
    if (!currentPlan) return;

    if (chip !== 'none') {
      const alreadyPlayedOfficial = playedChips.find(c => c.name === chip);
      if (alreadyPlayedOfficial && alreadyPlayedOfficial.event !== selectedGameweek) {
        alert(`The ${chip.toUpperCase()} chip was already played in Gameweek ${alreadyPlayedOfficial.event}!`);
        return;
      }
    }

    const updatedPlans = { ...gameweekPlans };
    if (chip !== 'none') {
      Object.keys(updatedPlans).forEach(gwKey => {
        const gw = parseInt(gwKey, 10);
        if (gw !== selectedGameweek && updatedPlans[gw].chip === chip) {
          updatedPlans[gw] = { ...updatedPlans[gw], chip: 'none' };
        }
      });
    }

    updatedPlans[selectedGameweek] = { ...currentPlan, chip };
    set({ gameweekPlans: updatedPlans });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  setBankOverride: (gw: number, bankTenths: number | null) => {
    const { gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(gw)) return;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan) return;

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = { ...currentPlan, bankOverride: bankTenths };
    set({ gameweekPlans: updatedPlans });
    recalculateMultiGameweekPlans(get, set);
    get().saveCurrentPlanToServer();
  },

  setFreeTransfersOverride: (gw: number, count: number | null) => {
    const { gameweekPlans, isGameweekLocked } = get();
    if (isGameweekLocked(gw)) return;

    const currentPlan = gameweekPlans[gw];
    if (!currentPlan) return;

    const updatedPlans = { ...gameweekPlans };
    updatedPlans[gw] = { ...currentPlan, freeTransfersOverride: count };
    set({ gameweekPlans: updatedPlans });
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
          // Future GW+2 onwards
          availabilityFactor = isLongTerm ? 0.0 : 0.85;
        }
      } else if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round !== undefined) {
        if (isImmediateGw) {
          availabilityFactor = p.chance_of_playing_next_round / 100.0;
        } else if (isNextPlusOne) {
          availabilityFactor = Math.min(1.0, (p.chance_of_playing_next_round / 100.0) + 0.35); // 50% -> 85%, 75% -> 100%
        } else {
          availabilityFactor = 1.0; // Minor knocks fully recovered in future rounds
        }
      } else if (p.status === 'd') {
        availabilityFactor = isImmediateGw ? 0.5 : isNextPlusOne ? 0.85 : 1.0;
      }
    }

    if (availabilityFactor === 0) return 0.0;

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
      // Goalkeeper save floor in tough fixtures
      if (p.element_type === 1) {
        gkSaveFloor = 2.8;
      }
      // Threat & Creativity set-piece bonus for elite creators/finishers
      const ict = parseFloat(p.ict_index || '0');
      if (ict > 20) {
        setPieceBonus = Math.min(0.8, ict * 0.015);
      }
    }

    const calculated = (rawXp + setPieceBonus) * availabilityFactor * minutesFactor;
    return Math.max(p?.element_type === 1 ? gkSaveFloor * availabilityFactor : 0.0, Math.round(calculated * 10) / 10);
  },

  getPlayerGameweekActualPoints: (playerId: number, gameweek: number): number | null => {
    const gwPoints = get().liveEventPoints[gameweek];
    if (gwPoints && gwPoints[playerId] !== undefined) {
      return gwPoints[playerId];
    }
    return null;
  }
}));

function recalculateMultiGameweekPlans(
  get: () => PlannerState,
  set: (state: Partial<PlannerState>) => void
) {
  const { initialBank, initialFreeTransfers, gameweekPlans, playerMap, baseImportedPicks } = get();
  const maxGw = 38;

  // 1. Calculate Base Total Team Value: Sum of costs of base imported squad + initial bank
  let baseSquadCost = 0;
  if (baseImportedPicks.length > 0) {
    baseImportedPicks.forEach(p => {
      const pl = playerMap.get(p.element);
      baseSquadCost += pl ? pl.now_cost : (p.selling_price || 50);
    });
  } else {
    const firstSquad = (Object.values(gameweekPlans) as PlannedGameweek[]).find(p => p?.squad?.length > 0)?.squad || [];
    firstSquad.forEach(p => {
      const pl = playerMap.get(p.element);
      baseSquadCost += pl ? pl.now_cost : (p.selling_price || 50);
    });
  }
  const totalTeamValue = baseSquadCost + initialBank;

  let rollingFT = initialFreeTransfers;
  const allPlansList = Object.values(gameweekPlans) as PlannedGameweek[];
  let rollingSquad: SquadPick[] = allPlansList.find(p => p && p.squad && p.squad.length > 0)?.squad || baseImportedPicks;

  const newPlans: Record<number, PlannedGameweek> = {};

  for (let gw = 1; gw <= maxGw; gw++) {
    const existing = gameweekPlans[gw];
    const squad = existing ? existing.squad : [...rollingSquad];
    const chip = existing ? existing.chip : 'none';
    const bankOverride = existing?.bankOverride;
    const ftOverride = existing?.freeTransfersOverride;

    // Calculate current squad cost
    let currentSquadCost = 0;
    squad.forEach(pick => {
      const pl = playerMap.get(pick.element);
      currentSquadCost += pl ? pl.now_cost : (pick.selling_price || 50);
    });

    // Invariant: Bank is Total Team Value - Current Squad Cost
    const currentBank = Math.max(0, totalTeamValue - currentSquadCost);

    // Calculate transfers relative to previous gameweek squad (or base squad)
    const prevSquadIds = new Set(rollingSquad.map(p => p.element));
    const currSquadIds = new Set(squad.map(p => p.element));
    
    const derivedTransfersIn = squad.filter(p => !prevSquadIds.has(p.element)).map(p => p.element);
    const derivedTransfersOut = rollingSquad.filter(p => !currSquadIds.has(p.element)).map(p => p.element);
    const transfersCount = derivedTransfersIn.length;

    const financials = calculateGameweekFinancials({
      currentBank,
      availableFreeTransfers: rollingFT,
      transfersCount,
      chip,
      bankOverride,
      ftOverride,
    });

    newPlans[gw] = {
      gameweek: gw,
      squad,
      transfersIn: derivedTransfersIn,
      transfersOut: derivedTransfersOut,
      chip,
      bankOverride,
      freeTransfersOverride: ftOverride,
      calculatedBank: financials.effectiveBank,
      availableTransfers: financials.availableTransfers,
      transfersUsed: financials.transfersUsed,
      transferCost: financials.hitPoints,
    };

    rollingFT = financials.nextGameweekFT;
    rollingSquad = [...squad];
  }

  set({ gameweekPlans: newPlans });
}