import { FPLPlayer } from '@/types/fpl';

export interface MatchExpectancy {
  homeTeamId: number;
  awayTeamId: number;
  homeImpliedGoals: number;
  awayImpliedGoals: number;
  homeCleanSheetProb: number; // 0.0 to 1.0 (e.g. 0.52 = 52%)
  awayCleanSheetProb: number; // 0.0 to 1.0
}

const LEAGUE_AVG_GOALS_PER_MATCH = 1.38;

/**
 * Calculates Poisson-derived Implied Team Goals & Clean Sheet Probabilities for any fixture:
 * - Implied Team Goals (λ) from relative attack/defense strengths + home venue boost.
 * - Poisson Clean Sheet Probability: P(CS = 0 conceded) = e^(-λ_opponent)
 */
export function calculateMatchExpectancy(
  homeTeam: any,
  awayTeam: any
): MatchExpectancy {
  if (!homeTeam || !awayTeam) {
    return {
      homeTeamId: 0,
      awayTeamId: 0,
      homeImpliedGoals: 1.5,
      awayImpliedGoals: 1.2,
      homeCleanSheetProb: 0.30,
      awayCleanSheetProb: 0.22,
    };
  }

  // Official FPL team attack/defense strength (typical scale 1000 - 1380)
  const homeAttack = (homeTeam.strength_attack_home || homeTeam.strength_overall_home || 1150) / 1150;
  const homeDefense = (homeTeam.strength_defence_home || homeTeam.strength_overall_home || 1150) / 1150;

  const awayAttack = (awayTeam.strength_attack_away || awayTeam.strength_overall_away || 1150) / 1150;
  const awayDefense = (awayTeam.strength_defence_away || awayTeam.strength_overall_away || 1150) / 1150;

  // Implied Goals with Home Advantage (~+18% home attack, -15% away attack)
  const homeImplied = Math.max(0.4, Math.min(3.6, LEAGUE_AVG_GOALS_PER_MATCH * homeAttack * (1.0 / awayDefense) * 1.18));
  const awayImplied = Math.max(0.3, Math.min(3.2, LEAGUE_AVG_GOALS_PER_MATCH * awayAttack * (1.0 / homeDefense) * 0.85));

  // Poisson Clean Sheet Probabilities: P(0) = e^(-λ)
  const homeCleanSheetProb = Math.max(0.05, Math.min(0.65, Math.exp(-awayImplied)));
  const awayCleanSheetProb = Math.max(0.04, Math.min(0.55, Math.exp(-homeImplied)));

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeImpliedGoals: Math.round(homeImplied * 100) / 100,
    awayImpliedGoals: Math.round(awayImplied * 100) / 100,
    homeCleanSheetProb: Math.round(homeCleanSheetProb * 1000) / 1000,
    awayCleanSheetProb: Math.round(awayCleanSheetProb * 1000) / 1000,
  };
}

/**
 * Calculates BPS (Bonus Point System) Statistical Regression:
 * - Defenders/GKs earn bonus points in low-scoring clean sheets.
 * - Talisman attackers earn 2-3 bonus points when scoring in match wins.
 */
export function calculateBpsBonusExpectancy(
  player: FPLPlayer,
  cleanSheetProb: number,
  impliedGoalsScored: number
): number {
  if (!player) return 0.2;

  const pos = player.element_type;
  const rawBps = player.bps || 0;
  const minutes = player.minutes || 90;
  const bpsPer90 = minutes > 0 ? (rawBps / (minutes / 90.0)) : 18.0;

  if (pos === 1) {
    // Goalkeeper: BPS bonus when keeping clean sheets and making saves
    return Math.min(0.85, cleanSheetProb * 0.70 + (bpsPer90 > 22 ? 0.25 : 0.05));
  }

  if (pos === 2) {
    // Defender: CBI & high passing accuracy bonus in clean sheet matches
    const passingCbiBonus = bpsPer90 > 24 ? 0.45 : bpsPer90 > 20 ? 0.30 : 0.15;
    return Math.min(0.95, (cleanSheetProb * 0.65) + passingCbiBonus);
  }

  if (pos === 3 || pos === 4) {
    // Attackers: Match-winning goal bonus probability
    const xg = parseFloat(player.expected_goals || '0');
    const threatRate = parseFloat(player.threat || '0');
    const attackWeight = (impliedGoalsScored / LEAGUE_AVG_GOALS_PER_MATCH);
    const talismanFactor = (threatRate > 35 || xg > 2.0 || bpsPer90 > 22) ? 0.55 : 0.20;
    return Math.min(1.2, talismanFactor * attackWeight);
  }

  return 0.2;
}

/**
 * Calculates player fixture equity based on exact Implied Team Goals, Poisson Clean Sheet Odds, & BPS Regression.
 */
export function calculatePlayerOddsXp(
  player: FPLPlayer,
  isHome: boolean,
  playerTeam: any,
  oppTeam: any,
  baseXp: number
): number {
  if (!player || !playerTeam || !oppTeam) return baseXp;

  const expectancy = calculateMatchExpectancy(
    isHome ? playerTeam : oppTeam,
    isHome ? oppTeam : playerTeam
  );

  const impliedGoalsScored = isHome ? expectancy.homeImpliedGoals : expectancy.awayImpliedGoals;
  const impliedGoalsConceded = isHome ? expectancy.awayImpliedGoals : expectancy.homeImpliedGoals;
  const cleanSheetProb = isHome ? expectancy.homeCleanSheetProb : expectancy.awayCleanSheetProb;

  // BPS Bonus Expectancy from regression
  const xBps = calculateBpsBonusExpectancy(player, cleanSheetProb, impliedGoalsScored);

  const pos = player.element_type;

  if (pos === 1) {
    // Goalkeeper: 2 pts appearance + Save points buffer + (4 * P(CS)) + BPS Bonus
    const expectedSavesPts = Math.min(2.5, impliedGoalsConceded * 0.7);
    const csEquity = cleanSheetProb * 4.0;
    const goalsConcededPenalty = Math.max(0, (impliedGoalsConceded - 1) * 0.5);
    const gkScore = 2.0 + expectedSavesPts + csEquity + xBps - goalsConcededPenalty;
    return Math.max(2.5, Math.round((baseXp * 0.40 + gkScore * 0.60) * 10) / 10);
  }

  if (pos === 2) {
    // Defender: 2 pts appearance + attacking threat + (4 * P(CS)) + BPS Bonus - goals conceded penalty
    const xg = parseFloat(player.expected_goals || '0');
    const xa = parseFloat(player.expected_assists || '0');
    const attackEquity = (xg * 6.0 + xa * 3.0) * (impliedGoalsScored / LEAGUE_AVG_GOALS_PER_MATCH);
    const csEquity = cleanSheetProb * 4.0;
    const goalsConcededPenalty = Math.max(0, (impliedGoalsConceded - 1) * 0.5);
    const defScore = 2.0 + attackEquity + csEquity + xBps - goalsConcededPenalty;
    return Math.max(1.5, Math.round((baseXp * 0.35 + defScore * 0.65) * 10) / 10);
  }

  if (pos === 3) {
    // Midfielder: 2 pts appearance + (xGI * 5.0 * (Implied Goals / Avg)) + (1 * P(CS)) + BPS Bonus
    const attackRatio = Math.max(0.5, impliedGoalsScored / LEAGUE_AVG_GOALS_PER_MATCH);
    const midCsEquity = cleanSheetProb * 1.0;
    const midScore = (baseXp - 0.5) * attackRatio + midCsEquity + xBps;
    return Math.max(1.8, Math.round(midScore * 10) / 10);
  }

  if (pos === 4) {
    // Forward: 2 pts appearance + (xGI * 4.0 * (Implied Goals / Avg)) + BPS Bonus
    const attackRatio = Math.max(0.5, impliedGoalsScored / LEAGUE_AVG_GOALS_PER_MATCH);
    const fwdScore = baseXp * attackRatio + xBps;
    return Math.max(2.0, Math.round(fwdScore * 10) / 10);
  }

  return baseXp;
}
