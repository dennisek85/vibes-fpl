import { FPLPlayer } from '@/types/fpl';
import { getMarketFixtureOdds, getMarketAnytimeGoalscorerProb } from '@/lib/oddsTracker';
import { getPlayerSetPieceProfile } from '@/lib/setPieces';
import { getPlayerFormMomentum } from '@/lib/formTracker';
import { getAdaptiveModelParameters } from './aiAdaptiveTuner';

export interface MatchExpectancy {
  homeTeamId: number;
  awayTeamId: number;
  homeImpliedGoals: number;
  awayImpliedGoals: number;
  homeCleanSheetProb: number; // 0.0 to 1.0 (e.g. 0.52 = 52%)
  awayCleanSheetProb: number; // 0.0 to 1.0
  isMarketOdds: boolean;
}

const LEAGUE_AVG_GOALS_PER_MATCH = 1.38;

// Primary Premier League penalty takers registry
const PRIMARY_PENALTY_TAKERS = new Set([
  'haaland',
  'salah',
  'palmer',
  'saka',
  'isak',
  'fernandes',
  'mbeumo',
  'wood',
  'solanke',
  'cunha',
  'mateta',
  'armstrong',
  'delap',
  'schade',
  'paquetá',
  'kudus',
  'bowen',
  'vardy',
  'watkins',
  'son',
  'toney'
]);

export function isDesignatedPenaltyTaker(player: FPLPlayer): boolean {
  if (!player) return false;
  const name = (player.web_name || player.second_name || '').toLowerCase().trim();
  return PRIMARY_PENALTY_TAKERS.has(name);
}

/**
 * Normalizes team strength reliably from official FPL team objects.
 * Handles both 1-5 scale (current season) and 1000-1380 scale.
 */
function parseTeamStrength(team: any, isHome: boolean): number {
  if (!team) return 1.0;
  const raw = isHome ? (team.strength_overall_home || team.strength) : (team.strength_overall_away || team.strength);
  const num = typeof raw === 'number' ? raw : parseFloat(`${raw || 3}`);
  if (num > 100) return num / 1150.0;
  // On 1-5 scale, 3.0 represents average strength (1.0 factor)
  return Math.max(1.0, Math.min(5.0, num)) / 3.0;
}

/**
 * Calculates Implied Team Goals & Clean Sheet Probabilities for any fixture:
 * 1. Checks live bookmaker exchange odds from match_odds.json (highest accuracy signal).
 * 2. Fallback: Poisson-derived Implied Team Goals & Clean Sheet Probability from relative attack/defense strengths.
 */
export function calculateMatchExpectancy(
  homeTeam: any,
  awayTeam: any,
  gameweek?: number
): MatchExpectancy {
  if (!homeTeam || !awayTeam) {
    return {
      homeTeamId: 0,
      awayTeamId: 0,
      homeImpliedGoals: 1.45,
      awayImpliedGoals: 1.15,
      homeCleanSheetProb: 0.32,
      awayCleanSheetProb: 0.23,
      isMarketOdds: false,
    };
  }

  // 1. Try to load live bookmaker market odds if gameweek is provided
  if (gameweek) {
    const marketOdds = getMarketFixtureOdds(homeTeam.id, awayTeam.id, gameweek);
    if (marketOdds) {
      const isHomeFirst = marketOdds.homeTeamId === homeTeam.id;
      return {
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        homeImpliedGoals: isHomeFirst ? marketOdds.homeGoals : marketOdds.awayGoals,
        awayImpliedGoals: isHomeFirst ? marketOdds.awayGoals : marketOdds.homeGoals,
        homeCleanSheetProb: isHomeFirst ? marketOdds.homeCleanSheet : marketOdds.awayCleanSheet,
        awayCleanSheetProb: isHomeFirst ? marketOdds.awayCleanSheet : marketOdds.homeCleanSheet,
        isMarketOdds: true,
      };
    }
  }

  // 2. Fallback to Poisson Mathematical Simulation
  const homeStr = parseTeamStrength(homeTeam, true);
  const awayStr = parseTeamStrength(awayTeam, false);

  // Implied Goals with Home Advantage (~+15% home attack, -12% away attack)
  const homeImplied = Math.max(0.6, Math.min(2.8, LEAGUE_AVG_GOALS_PER_MATCH * (homeStr / awayStr) * 1.15));
  const awayImplied = Math.max(0.4, Math.min(2.4, LEAGUE_AVG_GOALS_PER_MATCH * (awayStr / homeStr) * 0.88));

  // Poisson Clean Sheet Probabilities: P(0) = e^(-λ)
  const homeCleanSheetProb = Math.max(0.06, Math.min(0.60, Math.exp(-awayImplied)));
  const awayCleanSheetProb = Math.max(0.05, Math.min(0.50, Math.exp(-homeImplied)));

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeImpliedGoals: Math.round(homeImplied * 100) / 100,
    awayImpliedGoals: Math.round(awayImplied * 100) / 100,
    homeCleanSheetProb: Math.round(homeCleanSheetProb * 1000) / 1000,
    awayCleanSheetProb: Math.round(awayCleanSheetProb * 1000) / 1000,
    isMarketOdds: false,
  };
}

/**
 * Returns player team goal involvement share (xG share, xA share) & card penalty by price tier.
 * Calibrated against historical Opta & Premier League team goal distribution models.
 */
function getPlayerInvolvementShare(pos: number, cost: number): { xgShare: number; xaShare: number; cardPen: number } {
  const price = cost / 10.0;

  if (pos === 4) { // Forwards
    if (price >= 13.0) return { xgShare: 0.38, xaShare: 0.08, cardPen: 0.08 }; // Haaland
    if (price >= 8.5) return { xgShare: 0.28, xaShare: 0.12, cardPen: 0.10 };  // Isak, Watkins, Solanke
    if (price >= 6.5) return { xgShare: 0.22, xaShare: 0.08, cardPen: 0.12 };  // Wood, Mateta, Welbeck
    return { xgShare: 0.15, xaShare: 0.06, cardPen: 0.12 };                    // Budget forwards
  }

  if (pos === 3) { // Midfielders
    if (price >= 10.0) return { xgShare: 0.22, xaShare: 0.18, cardPen: 0.08 }; // Salah, Palmer, Saka, Son, Foden
    if (price >= 7.5) return { xgShare: 0.16, xaShare: 0.14, cardPen: 0.12 };  // Fernandes, Diaz, Eze, Gordon, Mbeumo
    if (price >= 6.0) return { xgShare: 0.12, xaShare: 0.10, cardPen: 0.15 };  // Mitoma, Bailey, Rogers, Semenyo
    return { xgShare: 0.05, xaShare: 0.06, cardPen: 0.22 };                    // Defensive / Budget midfielders
  }

  if (pos === 2) { // Defenders
    if (price >= 6.0) return { xgShare: 0.04, xaShare: 0.10, cardPen: 0.12 };  // Trent, Gvardiol, Gabriel, Saliba
    if (price >= 5.0) return { xgShare: 0.03, xaShare: 0.05, cardPen: 0.15 };  // Starting top-6 defenders
    return { xgShare: 0.02, xaShare: 0.03, cardPen: 0.18 };                    // Budget defenders
  }

  // Goalkeepers
  return { xgShare: 0.0, xaShare: 0.0, cardPen: 0.04 };
}

/**
 * Calculates bottom-up statistical Expected Points (xP) using industry benchmark solver methodology:
 * 1. Live Bookmaker Clean Sheet & Goalscorer Odds (when available)
 * 2. 60-Minute FPL Appearance Step Function: P(>=60m)*2 + P(1-59m)*1
 * 3. Team Implied Goal Share Allocation (xG / xA) with Bayesian blending
 * 4. Disciplinary Deductions (Yellow/Red Card Expectancy)
 * 5. BPS Statistical Regression
 */
export function calculatePlayerOddsXp(
  player: FPLPlayer,
  isHome: boolean,
  playerTeam: any,
  oppTeam: any,
  baseXp?: number,
  gameweek?: number
): number {
  if (!player || !playerTeam || !oppTeam) return baseXp || 3.5;

  const pos = player.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD
  const cost = player.now_cost || 50;

  const expectancy = calculateMatchExpectancy(
    isHome ? playerTeam : oppTeam,
    isHome ? oppTeam : playerTeam,
    gameweek
  );

  const impliedGoalsScored = isHome ? expectancy.homeImpliedGoals : expectancy.awayImpliedGoals;
  const impliedGoalsConceded = isHome ? expectancy.awayImpliedGoals : expectancy.homeImpliedGoals;
  const cleanSheetProb = isHome ? expectancy.homeCleanSheetProb : expectancy.awayCleanSheetProb;

  // 1. Pro FPL 60-Minute Appearance Step Function
  const minutesPlayed = typeof player.minutes === 'number' ? player.minutes : parseFloat(`${player.minutes || 0}`) || 0;
  const starts = player.starts || (minutesPlayed > 0 ? 1 : 0);
  
  let p60Mins = 0.92;  // Probability of playing 60+ minutes
  let pSub = 0.06;     // Probability of playing 1-59 minutes
  let expectedMins = 85.0;

  if (starts > 0) {
    const minsPerStart = minutesPlayed / starts;
    expectedMins = Math.max(25.0, Math.min(90.0, minsPerStart));
    if (minsPerStart >= 75) {
      p60Mins = 0.94;
      pSub = 0.04;
    } else if (minsPerStart >= 60) {
      p60Mins = 0.75;
      pSub = 0.20;
    } else {
      p60Mins = 0.35;
      pSub = 0.55;
    }
  } else if (minutesPlayed > 0) {
    // Regular impact substitute
    expectedMins = 30.0;
    p60Mins = 0.15;
    pSub = 0.75;
  } else {
    // Unproven / 0 mins
    if (pos === 1) {
      // Backup / unproven GK gets 0 mins
      expectedMins = 0.0;
      p60Mins = 0.0;
      pSub = 0.0;
    } else {
      expectedMins = 20.0;
      p60Mins = 0.10;
      pSub = 0.40;
    }
  }

  // FPL Points: 60+ mins = 2 pts, 1-59 mins = 1 pt, 0 mins = 0 pts
  const appearancePts = (p60Mins * 2.0) + (pSub * 1.0);

  const params = getAdaptiveModelParameters(gameweek || 1);

  // 2. Underlying Rate Metrics & Goal Share Allocation
  const shares = getPlayerInvolvementShare(pos, cost);
  const sampleConfidence = minutesPlayed / (minutesPlayed + params.bayesianHalfLifeMinutes);
  const gamesPlayed = Math.max(1.0, minutesPlayed / 90.0);

  const rawXG = typeof player.expected_goals === 'number' ? player.expected_goals : parseFloat(`${player.expected_goals || 0}`) || 0;
  const rawXA = typeof player.expected_assists === 'number' ? player.expected_assists : parseFloat(`${player.expected_assists || 0}`) || 0;

  // Individual goal share blended with price-tier prior
  const rawXgShare = rawXG > 0 ? (rawXG / gamesPlayed) / LEAGUE_AVG_GOALS_PER_MATCH : shares.xgShare;
  const rawXaShare = rawXA > 0 ? (rawXA / gamesPlayed) / LEAGUE_AVG_GOALS_PER_MATCH : shares.xaShare;

  const playerXgShare = Math.min(0.42, (sampleConfidence * rawXgShare) + ((1.0 - sampleConfidence) * shares.xgShare));
  const playerXaShare = Math.min(0.25, (sampleConfidence * rawXaShare) + ((1.0 - sampleConfidence) * shares.xaShare));

  // 3. Rolling Form Momentum Factor (Short-term velocity over last 3 & 5 matches)
  const momentum = getPlayerFormMomentum(player.id);
  const momentumMult = momentum ? momentum.momentumMultiplier : 1.0;
  const effectiveXgShare = Math.min(0.45, playerXgShare * momentumMult);
  const effectiveXaShare = Math.min(0.30, playerXaShare * momentumMult);

  // 4. Set-Piece & Penalty Hierarchy Duty (Corners, Penalties, Direct/Indirect Free-Kicks)
  const minsScale = expectedMins / 90.0;
  const setPieces = getPlayerSetPieceProfile(player, playerTeam?.short_name);
  const teamAttackScale = impliedGoalsScored / LEAGUE_AVG_GOALS_PER_MATCH;
  const setPieceXG = (setPieces.addedXg * teamAttackScale * minsScale);
  const setPieceXA = (setPieces.addedXa * teamAttackScale * minsScale);

  // 5. Fixture-Adjusted Match xG and xA
  let matchXG = Math.max(0.0, (impliedGoalsScored * effectiveXgShare * minsScale) + setPieceXG);
  let matchXA = Math.max(0.0, (impliedGoalsScored * effectiveXaShare * minsScale) + setPieceXA);

  // 6. Market Anytime Goalscorer Odds Integration (When Available for Outfield Players)
  const marketGoalProb = (pos >= 2) ? getMarketAnytimeGoalscorerProb(player.web_name, playerTeam?.short_name) : null;
  if (marketGoalProb !== null && marketGoalProb > 0) {
    // Bookmaker anytime goalscorer probability converted to expected goals λ = -ln(1 - P)
    const impliedMarketXg = -Math.log(Math.max(0.01, 1.0 - marketGoalProb)) * minsScale;
    // Blend adaptive market odds + statistical model
    matchXG = (impliedMarketXg * params.oddsWeight) + (matchXG * params.modelXgWeight);
  }

  // 6. Disciplinary Deductions (Yellow/Red Card Expectancy)
  const expectedCardPenalty = shares.cardPen;

  // 7. Position-Specific Scoring Breakdown
  let goalPts = 0;
  let assistPts = matchXA * 3.0;
  let cleanSheetPts = 0;
  let goalsConcededPts = 0;
  let savePts = 0;
  let bpsExpected = 0;

  if (pos === 1) { // GK
    goalPts = matchXG * 10.0; // Rare GK goal
    // Defenders/GK retain 90% of CS prob even with late substitutions
    cleanSheetPts = cleanSheetProb * p60Mins * 4.0;
    goalsConcededPts = -Math.max(0.0, (impliedGoalsConceded - 1.0) / 2.0) * 0.65;
    savePts = Math.min(2.5, Math.max(0.6, impliedGoalsConceded * 0.9));
    bpsExpected = cleanSheetProb >= 0.40 ? 0.65 : 0.20;
  } else if (pos === 2) { // DEF
    goalPts = matchXG * 6.0;
    cleanSheetPts = cleanSheetProb * p60Mins * 4.0;
    goalsConcededPts = -Math.max(0.0, (impliedGoalsConceded - 1.0) / 2.0) * 0.65;
    bpsExpected = cleanSheetProb >= 0.40 ? 0.85 : (matchXG + matchXA > 0.2 ? 0.45 : 0.15);
  } else if (pos === 3) { // MID
    goalPts = matchXG * 5.0;
    cleanSheetPts = cleanSheetProb * p60Mins * 1.0;
    bpsExpected = matchXG >= 0.35 ? 1.45 : matchXG >= 0.20 ? 0.75 : 0.25;
  } else if (pos === 4) { // FWD
    goalPts = matchXG * 4.0;
    cleanSheetPts = 0.0;
    bpsExpected = matchXG >= 0.45 ? 1.85 : matchXG >= 0.25 ? 0.95 : 0.30;
  }

  // 8. Total Expected Points (xP) Sum
  const totalXp = appearancePts + goalPts + assistPts + cleanSheetPts + goalsConcededPts + savePts + bpsExpected - expectedCardPenalty;

  return Math.max(0.5, Math.round(totalXp * 10) / 10);
}
