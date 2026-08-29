export type PositionType = 1 | 2 | 3 | 4; // 1: GK, 2: DEF, 3: MID, 4: FWD
export type PositionName = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface FPLPlayer {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  element_type: PositionType;
  team: number;
  team_code: number;
  now_cost: number; // in tenths, e.g. 55 = 5.5m
  selected_by_percent: string;
  total_points: number;
  form: string;
  ep_this: string | null;
  ep_next: string | null;
  status: 'a' | 'd' | 'i' | 's' | 'u';
  news: string;
  chance_of_playing_next_round: number | null;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded?: string;
  expected_goals_per_90?: number;
  expected_assists_per_90?: number;
  expected_goal_involvements_per_90?: number;
  expected_goals_conceded_per_90?: number;
  minutes?: number;
  starts?: number;
  threat?: string;
  creativity?: string;
  influence?: string;
  ict_index?: string;
  bps?: number;
  goals_conceded?: number;
  photo?: string;
  transfers_in_event?: number;
  transfers_out_event?: number;
  transfers_in?: number;
  transfers_out?: number;
  cost_change_event?: number;
  cost_change_start?: number;
}

export interface FPLTeam {
  id: number;
  name: string;
  short_name: string;
  code: number;
  strength: number;
  pulse_id: number;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface FPLEvent {
  id: number;
  name: string;
  deadline_time: string;
  is_current: boolean;
  is_next: boolean;
  is_previous: boolean;
  finished: boolean;
  data_checked: boolean;
}

export interface FPLFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  started: boolean;
  finished: boolean;
  kickoff_time: string;
  team_h_score?: number | null;
  team_a_score?: number | null;
}

export interface PlayerFixtureItem {
  event: number;
  opponentTeamId: number;
  opponentShortName: string;
  isHome: boolean;
  difficulty: number; // 1 to 5
  xP?: number; // AI projected expected points for this fixture
}

export interface SquadPick {
  element: number; // Player ID
  position: number; // 1-15
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;
  purchase_price: number;
  selling_price: number;
}

export interface EntryPicksResponse {
  picks: SquadPick[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
    points_on_bench: number;
  };
  active_chip: 'wildcard' | 'freehit' | 'bboost' | '3xc' | null;
}

export interface EntryHistoryResponse {
  current: Array<{
    event: number;
    points: number;
    total_points: number;
    rank: number;
    overall_rank: number;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
  }>;
  chips: Array<{
    name: 'wildcard' | 'freehit' | 'bboost' | '3xc';
    time: string;
    event: number;
  }>;
}

export interface EntrySummary {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  current_event: number;
}

export type ChipType = 'none' | 'wildcard' | 'freehit' | 'bboost' | '3xc';

export interface PlannedGameweek {
  gameweek: number;
  squad: SquadPick[];
  transfersIn: number[];
  transfersOut: number[];
  chip: ChipType;
  bankOverride?: number | null;
  freeTransfersOverride?: number | null;
  calculatedBank: number;
  availableTransfers: number;
  transfersUsed: number;
  transferCost: number;
}

export interface SavedPlan {
  id: string;
  teamId: number;
  teamName: string;
  managerName: string;
  savedAt: string;
  startGameweek: number;
  gameweekPlans: Record<number, PlannedGameweek>;
}