import bundledOddsData from "@/data/match_odds.json";

export interface FixtureMarketOdds {
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  homeCleanSheet: number;
  awayCleanSheet: number;
  homeGoals: number;
  awayGoals: number;
}

export interface MatchOddsDataset {
  lastUpdated: string;
  season: string;
  fixtures: Record<string, FixtureMarketOdds[]>;
  anytimeGoalscorers: Record<string, number>;
}

let runtimeOddsData: MatchOddsDataset | null = null;

export function setCustomMatchOddsData(data: MatchOddsDataset) {
  if (data && data.fixtures) {
    runtimeOddsData = data;
  }
}

export function readMatchOddsData(): MatchOddsDataset {
  return runtimeOddsData || (bundledOddsData as MatchOddsDataset);
}

/**
 * Looks up live market odds for a specific fixture and gameweek.
 * Returns null if no live bookmaker odds are available (triggering Poisson fallback).
 */
export function getMarketFixtureOdds(
  homeTeamId: number,
  awayTeamId: number,
  gameweek: number,
): FixtureMarketOdds | null {
  const data = readMatchOddsData();
  const gwKey = `gw${gameweek}`;
  const gwFixtures = data.fixtures?.[gwKey];

  if (!gwFixtures || !Array.isArray(gwFixtures)) {
    return null;
  }

  const match = gwFixtures.find(
    (f) =>
      (f.homeTeamId === homeTeamId && f.awayTeamId === awayTeamId) ||
      (f.homeTeamId === awayTeamId && f.awayTeamId === homeTeamId),
  );

  return match || null;
}

/**
 * Looks up anytime goalscorer probability for a specific player name.
 * Verifies team context to prevent cross-club collisions (e.g. Cole Palmer CHE vs Palmer IPS).
 */
export function getMarketAnytimeGoalscorerProb(
  playerName: string,
  teamShortName?: string,
): number | null {
  if (!playerName) return null;
  const data = readMatchOddsData();
  const normalized = playerName.toLowerCase().trim();

  // Disambiguation for players sharing last names
  if (
    normalized === "palmer" &&
    teamShortName &&
    teamShortName.toUpperCase() !== "CHE"
  ) {
    return null;
  }
  if (
    normalized === "johnson" &&
    teamShortName &&
    teamShortName.toUpperCase() !== "TOT"
  ) {
    return null;
  }
  if (
    normalized === "fernandes" &&
    teamShortName &&
    teamShortName.toUpperCase() !== "MUN"
  ) {
    return null;
  }
  if (
    normalized === "williams" &&
    teamShortName &&
    teamShortName.toUpperCase() !== "NFO"
  ) {
    return null;
  }

  if (
    data.anytimeGoalscorers &&
    data.anytimeGoalscorers[normalized] !== undefined
  ) {
    return data.anytimeGoalscorers[normalized];
  }

  return null;
}
