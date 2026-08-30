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
import { OptimizationResult } from '@/utils/aiOptimizer';

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

export interface CoreDataSlice {
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

  initFPLData: () => Promise<void>;
  fetchLivePointsForGameweek: (gw: number) => Promise<void>;
  isGameweekLocked: (gameweek?: number) => boolean;
}

export interface UiStateSlice {
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
  showAiPredictions: boolean;
  toggleAiPredictions: () => void;

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

  marketSearch: string;
  marketPosition: number | null;
  marketTeamId: number | null;
  marketMaxPrice: number;
  marketMinPrice: number;
  marketAffordableOnly: boolean;
  marketSortBy: 'now_cost' | 'total_points' | 'form' | 'selected_by_percent' | 'fdr';
  marketSortOrder: 'asc' | 'desc';

  setFixtureHorizon: (count: 1 | 3 | 5) => void;
  openTransferDrawer: (playerOutId?: number | null) => void;
  closeTransferDrawer: () => void;
  selectSlotForSwap: (slot: number) => void;

  setMarketSearch: (query: string) => void;
  setMarketPosition: (pos: number | null) => void;
  setMarketTeamId: (teamId: number | null) => void;
  setMarketPriceRange: (min: number, max: number) => void;
  setMarketAffordableOnly: (val: boolean) => void;
  setMarketSort: (sortBy: UiStateSlice['marketSortBy']) => void;
}

export interface GameweekPlanSlice {
  startGameweek: number;
  selectedGameweek: number;
  gameweekPlans: Record<number, PlannedGameweek>;
  baseImportedPicks: SquadPick[];
  initialBank: number;
  initialFreeTransfers: number;

  selectGameweek: (gw: number) => void;
  executeTransfer: (playerIn: FPLPlayer, explicitPlayerOutId?: number | null) => boolean;
  executeDirectTransfer: (playerOutId: number, playerInId: number) => boolean;
  revertTransfer: (playerInId: number) => void;
  resetCurrentGameweek: () => void;
  resetAllFutureGameweeks: () => void;
  setCaptain: (elementId: number) => void;
  setViceCaptain: (elementId: number) => void;
  setChip: (chip: ChipType) => void;
  setBankOverride: (gw: number, bankTenths: number | null) => void;
  setFreeTransfersOverride: (gw: number, count: number | null) => void;
}

export interface PersistenceSlice {
  activePin: string | null;
  teamSummary: EntrySummary | null;
  teamHistoryCurrent: TeamHistoryEvent[];
  playedChips: PlayedChipInfo[];

  loadUserPlanByPin: (pin: string, teamId?: number | null) => Promise<{ exists: boolean; teamLoaded: boolean }>;
  saveCurrentPlanToServer: () => Promise<void>;
  importTeam: (teamId: number) => Promise<boolean>;
  loadDemoTeam: () => void;
}

export interface AiOptimizerSlice {
  autoOptimizeStartingXI: () => void;
  autoOrderBenchLineup: (targetGw?: number) => boolean;
  optimizeSquadLineup: (gw?: number) => OptimizationResult | null;
  applyOptimalSquad: (newSquad: SquadPick[], targetGw?: number) => void;
  getPlayerHorizonXp: (playerId: number, count: number) => number;
  getPlayerUpcomingFixtures: (playerId: number, count?: number) => PlayerFixtureItem[];
  getPlayerGameweekXp: (playerId: number, gameweek: number) => number;
  getPlayerGameweekActualPoints: (playerId: number, gameweek: number) => number | null;
}

export type PlannerState = CoreDataSlice & UiStateSlice & GameweekPlanSlice & PersistenceSlice & AiOptimizerSlice;

