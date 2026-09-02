import { FPLPlayer } from "@/types/fpl";
import {
  getMarketFixtureOdds,
  getMarketAnytimeGoalscorerProb,
} from "@/lib/oddsTracker";
import { getPlayerSetPieceProfile } from "@/lib/setPieces";
import { getPlayerFormMomentum } from "@/lib/formTracker";
import { evaluatePlayerRotationRisk } from "./aiLineupRiskEngine";
import { getAdaptiveModelParameters } from "./aiAdaptiveTuner";

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
  "haaland",
  "salah",
  "palmer",
  "saka",
  "isak",
  "fernandes",
  "mbeumo",
  "wood",
  "solanke",
  "cunha",
  "mateta",
  "armstrong",
  "delap",
  "schade",
  "paquetá",
  "kudus",
  "bowen",
  "vardy",
  "watkins",
  "son",
  "toney",
]);

export function isDesignatedPenaltyTaker(player: FPLPlayer): boolean {
  if (!player) return false;
  const name = (player.web_name || player.second_name || "")
    .toLowerCase()
    .trim();
  return PRIMARY_PENALTY_TAKERS.has(name);
}

/**
 * Normalizes granular team attack & defense ratings from official FPL team objects.
 */
function parseAttackStrength(team: any, isHome: boolean): number {
  if (!team) return 1.0;
  const raw = isHome
    ? team.strength_attack_home || team.strength_overall_home || team.strength
    : team.strength_attack_away || team.strength_overall_away || team.strength;
  const num = typeof raw === "number" ? raw : parseFloat(`${raw || 3}`);
  if (num > 100) return num / 1150.0;
  return Math.max(1.0, Math.min(5.0, num)) / 3.0;
}

function parseDefenceStrength(team: any, isHome: boolean): number {
  if (!team) return 1.0;
  const raw = isHome
    ? team.strength_defence_home || team.strength_overall_home || team.strength
    : team.strength_defence_away || team.strength_overall_away || team.strength;
  const num = typeof raw === "number" ? raw : parseFloat(`${raw || 3}`);
  if (num > 100) return num / 1150.0;
  return Math.max(1.0, Math.min(5.0, num)) / 3.0;
}

/**
 * Calculates Implied Team Goals & Clean Sheet Probabilities for any fixture:
 * 1. Checks live bookmaker exchange odds from match_odds.json (highest accuracy signal).
 * 2. Fallback: Pure Poisson mathematical formulation P(0) = e^(-λ) from relative attack/defense strengths.
 */
export function calculateMatchExpectancy(
  homeTeam: any,
  awayTeam: any,
  gameweek?: number,
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
        homeImpliedGoals: isHomeFirst
          ? marketOdds.homeGoals
          : marketOdds.awayGoals,
        awayImpliedGoals: isHomeFirst
          ? marketOdds.awayGoals
          : marketOdds.homeGoals,
        homeCleanSheetProb: isHomeFirst
          ? marketOdds.homeCleanSheet
          : marketOdds.awayCleanSheet,
        awayCleanSheetProb: isHomeFirst
          ? marketOdds.awayCleanSheet
          : marketOdds.homeCleanSheet,
        isMarketOdds: true,
      };
    }
  }

  // 2. Fallback to Poisson Mathematical Simulation
  const params = getAdaptiveModelParameters(gameweek || 1);
  const homeAdv = params.homeAdvantageMultiplier || 1.15;
  const awayAdv = Math.max(0.8, 2.0 - homeAdv - 0.03); // Empirical away pitch ratio

  const homeAtt = parseAttackStrength(homeTeam, true);
  const awayDef = parseDefenceStrength(awayTeam, false);
  const awayAtt = parseAttackStrength(awayTeam, false);
  const homeDef = parseDefenceStrength(homeTeam, true);

  // Implied Goals with Empirical Pitch Advantage
  const homeImplied = Math.max(
    0.5,
    Math.min(3.4, LEAGUE_AVG_GOALS_PER_MATCH * (homeAtt / awayDef) * homeAdv),
  );
  const awayImplied = Math.max(
    0.4,
    Math.min(2.8, LEAGUE_AVG_GOALS_PER_MATCH * (awayAtt / homeDef) * awayAdv),
  );

  // Pure Poisson Clean Sheet Probabilities: P(0) = e^(-λ_conceded)
  const homeCleanSheetProb = Math.max(
    0.05,
    Math.min(0.65, Math.exp(-awayImplied)),
  );
  const awayCleanSheetProb = Math.max(
    0.04,
    Math.min(0.55, Math.exp(-homeImplied)),
  );

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
function getPlayerInvolvementShare(
  pos: number,
  cost: number,
): { xgShare: number; xaShare: number; cardPen: number } {
  const price = cost / 10.0;

  if (pos === 4) {
    // Forwards (Open-play non-penalty share)
    if (price >= 13.0) return { xgShare: 0.42, xaShare: 0.08, cardPen: 0.08 }; // Super-premium: Haaland
    if (price >= 8.5) return { xgShare: 0.28, xaShare: 0.12, cardPen: 0.1 }; // Isak, Watkins, Solanke
    if (price >= 6.5) return { xgShare: 0.22, xaShare: 0.08, cardPen: 0.12 }; // Wood, Mateta, Welbeck
    if (price >= 5.5) return { xgShare: 0.2, xaShare: 0.06, cardPen: 0.1 }; // Starting #9 focal strikers (Calvert-Lewin, Muniz, Armstrong, Strand Larsen)
    return { xgShare: 0.12, xaShare: 0.05, cardPen: 0.12 }; // Budget bench forwards (£4.5m-£5.0m enablers)
  }

  if (pos === 3) {
    // Midfielders (Open-play non-penalty baseline; penalties & set-pieces added separately)
    if (price >= 12.0) return { xgShare: 0.22, xaShare: 0.2, cardPen: 0.06 }; // Inside forwards (Salah)
    if (price >= 9.5) return { xgShare: 0.18, xaShare: 0.2, cardPen: 0.08 }; // Wide playmakers (Palmer, Saka)
    if (price >= 8.0) return { xgShare: 0.12, xaShare: 0.22, cardPen: 0.14 }; // Central creators (Bruno Fernandes, Foden, Odegaard)
    if (price >= 6.5) return { xgShare: 0.1, xaShare: 0.14, cardPen: 0.12 }; // Mid-tier creators (Mitoma, Gordon, Eze)
    if (price >= 5.5) return { xgShare: 0.08, xaShare: 0.12, cardPen: 0.12 }; // Starting attacking wingers / inverted forwards (Ndiaye, Minteh, Rogers)
    return { xgShare: 0.04, xaShare: 0.06, cardPen: 0.16 }; // True defensive / bench midfielders (£4.5m-£5.0m DMs)
  }

  if (pos === 2) {
    // Defenders
    if (price >= 6.0) return { xgShare: 0.03, xaShare: 0.08, cardPen: 0.12 }; // Attacking fullbacks (Trent, Gvardiol)
    if (price >= 5.0) return { xgShare: 0.02, xaShare: 0.04, cardPen: 0.15 }; // Starting top-6 defenders
    return { xgShare: 0.01, xaShare: 0.02, cardPen: 0.18 }; // Budget defenders
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
/**
 * Calculates expected FPL goals conceded penalty points for GK and DEF.
 * FPL Rule: -1 point for every 2 goals conceded (at 2, 4, 6, 8 goals).
 * Under Poisson distribution with mean λ: E[Deduction] = Σ_{k=1}^4 P(X >= 2k)
 */
function calculateExpectedGoalsConcededPenalty(lambdaConceded: number): number {
  if (lambdaConceded <= 0) return 0;
  const expNegLambda = Math.exp(-lambdaConceded);
  let term = expNegLambda; // j = 0
  let cdf = term;
  let penalty = 0;

  for (let j = 1; j <= 8; j++) {
    term = (term * lambdaConceded) / j;
    cdf += term;
    if (j === 1 || j === 3 || j === 5 || j === 7) {
      // P(X >= j + 1) = 1 - CDF(j)
      penalty += Math.max(0, 1.0 - cdf);
    }
  }

  return penalty;
}

export function calculatePlayerOddsXp(
  player: FPLPlayer,
  isHome: boolean,
  playerTeam: any,
  oppTeam: any,
  baseXp?: number,
  gameweek?: number,
): number {
  if (!player || !playerTeam || !oppTeam) return baseXp || 3.5;

  const pos = player.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD
  const cost = player.now_cost || 50;

  const expectancy = calculateMatchExpectancy(
    isHome ? playerTeam : oppTeam,
    isHome ? oppTeam : playerTeam,
    gameweek,
  );

  const impliedGoalsScored = isHome
    ? expectancy.homeImpliedGoals
    : expectancy.awayImpliedGoals;
  const impliedGoalsConceded = isHome
    ? expectancy.awayImpliedGoals
    : expectancy.homeImpliedGoals;
  const cleanSheetProb = isHome
    ? expectancy.homeCleanSheetProb
    : expectancy.awayCleanSheetProb;

  // 1. Pro FPL 60-Minute Appearance Step Function
  const minutesPlayed =
    typeof player.minutes === "number"
      ? player.minutes
      : parseFloat(`${player.minutes || 0}`) || 0;
  const starts =
    typeof player.starts === "number"
      ? player.starts
      : parseInt(`${player.starts || 0}`, 10) || 0;

  let p60Mins = 0.92; // Probability of playing 60+ minutes
  let pSub = 0.06; // Probability of playing 1-59 minutes
  let expectedMins = 85.0;

  if (starts > 0) {
    const minsPerStart = minutesPlayed / starts;
    expectedMins = Math.max(25.0, Math.min(90.0, minsPerStart));
    if (minsPerStart >= 75) {
      p60Mins = 0.94;
      pSub = 0.04;
    } else if (minsPerStart >= 60) {
      p60Mins = 0.75;
      pSub = 0.2;
    } else {
      p60Mins = 0.35;
      pSub = 0.55;
    }
  } else if (minutesPlayed > 0) {
    // Regular impact substitute (0 starts)
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
      p60Mins = 0.1;
      pSub = 0.4;
    }
  }

  // Lineup & Rotation Risk Integration (Single Source of Truth)
  const rotationRisk = evaluatePlayerRotationRisk(
    player,
    playerTeam?.short_name,
  );
  if (rotationRisk.startProbability < 90 || rotationRisk.isSubRisk) {
    p60Mins = Math.min(p60Mins, rotationRisk.startProbability / 100);
    pSub = rotationRisk.isSubRisk ? Math.max(pSub, 0.4) : pSub;
    expectedMins = Math.min(expectedMins, rotationRisk.expectedMinutes);
  }

  // FPL Points: 60+ mins = 2 pts, 1-59 mins = 1 pt, 0 mins = 0 pts
  const appearancePts = p60Mins * 2.0 + pSub * 1.0;

  const params = getAdaptiveModelParameters(gameweek || 1);

  // 2. Underlying Rate Metrics & Goal Share Allocation
  const shares = getPlayerInvolvementShare(pos, cost);
  const sampleConfidence =
    minutesPlayed / (minutesPlayed + params.bayesianHalfLifeMinutes);
  const gamesPlayed = Math.max(1.0, minutesPlayed / 90.0);

  const rawXG =
    typeof player.expected_goals === "number"
      ? player.expected_goals
      : parseFloat(`${player.expected_goals || 0}`) || 0;
  const rawXA =
    typeof player.expected_assists === "number"
      ? player.expected_assists
      : parseFloat(`${player.expected_assists || 0}`) || 0;

  // Set-Piece & Penalty Hierarchy Duty (Corners, Penalties, Direct/Indirect Free-Kicks)
  const minsScale = expectedMins / 90.0;
  const setPieces = getPlayerSetPieceProfile(player, playerTeam?.short_name);
  const teamAttackScale = impliedGoalsScored / LEAGUE_AVG_GOALS_PER_MATCH;
  const setPieceXG = setPieces.addedXg * teamAttackScale * minsScale;
  const setPieceXA = setPieces.addedXa * teamAttackScale * minsScale;

  // Deduct historical set-piece contribution to isolate pure open-play involvement
  // (FPL API expected_goals/assists already include historical penalties, free kicks, and corners)
  const historicalSetPieceXG = setPieces.addedXg * gamesPlayed;
  const historicalSetPieceXA = setPieces.addedXa * gamesPlayed;
  const openPlayRawXG = Math.max(0.0, rawXG - historicalSetPieceXG);
  const openPlayRawXA = Math.max(0.0, rawXA - historicalSetPieceXA);

  // Individual open-play goal share blended with price-tier prior
  const rawXgShare =
    openPlayRawXG > 0
      ? openPlayRawXG / gamesPlayed / LEAGUE_AVG_GOALS_PER_MATCH
      : shares.xgShare;
  const rawXaShare =
    openPlayRawXA > 0
      ? openPlayRawXA / gamesPlayed / LEAGUE_AVG_GOALS_PER_MATCH
      : shares.xaShare;

  const playerXgShare = Math.min(
    pos === 4 ? 0.6 : 0.45,
    sampleConfidence * rawXgShare + (1.0 - sampleConfidence) * shares.xgShare,
  );
  const playerXaShare = Math.min(
    0.3,
    sampleConfidence * rawXaShare + (1.0 - sampleConfidence) * shares.xaShare,
  );

  // 3. Rolling Form Momentum Factor (Short-term velocity over last 3 & 5 matches)
  const momentum = getPlayerFormMomentum(player.id);
  const momentumMult = momentum ? momentum.momentumMultiplier : 1.0;
  const effectiveXgShare = Math.min(
    pos === 4 ? 0.65 : 0.48,
    playerXgShare * momentumMult,
  );
  const effectiveXaShare = Math.min(0.32, playerXaShare * momentumMult);

  // 4. Fixture-Adjusted Model xG and xA (Open Play + Single Set-Piece Allocation)
  const modelMatchXG = Math.max(
    0.0,
    impliedGoalsScored * effectiveXgShare * minsScale + setPieceXG,
  );
  const matchXA = Math.max(
    0.0,
    impliedGoalsScored * effectiveXaShare * minsScale + setPieceXA,
  );

  // 5. Market Anytime Goalscorer Odds Integration (When Available for Outfield Players)
  // Bookmaker anytime goalscorer odds reflect total goal expectancy (open play + penalties + free kicks).
  const marketGoalProb =
    pos >= 2
      ? getMarketAnytimeGoalscorerProb(player.web_name, playerTeam?.short_name)
      : null;
  let matchXG = modelMatchXG;
  if (marketGoalProb !== null && marketGoalProb > 0) {
    const impliedMarketXg =
      -Math.log(Math.max(0.01, 1.0 - marketGoalProb)) * minsScale;
    matchXG =
      impliedMarketXg * params.oddsWeight + modelMatchXG * params.modelXgWeight;
  }

  // 6. Disciplinary Deductions (Yellow/Red Card Expectancy scaled by playing probability)
  const expectedCardPenalty = shares.cardPen * (p60Mins + pSub);

  // 7. Position-Specific Scoring Breakdown
  let goalPts = 0;
  let assistPts = matchXA * 3.0;
  let cleanSheetPts = 0;
  let goalsConcededPts = 0;
  let savePts = 0;
  let bpsExpected = 0;

  // Expected FPL goals conceded penalty under full Poisson series, scaled by minutes on pitch
  const expectedConcededPenalty =
    calculateExpectedGoalsConcededPenalty(impliedGoalsConceded) * p60Mins;

  if (pos === 1) {
    // GK
    goalPts = matchXG * 6.0; // Official FPL GK Goal = 6 pts
    cleanSheetPts = cleanSheetProb * p60Mins * 4.0;
    goalsConcededPts = -expectedConcededPenalty;
    savePts = Math.min(1.4, Math.max(0.4, 0.5 + impliedGoalsConceded * 0.25));
    bpsExpected = cleanSheetProb >= 0.4 ? 0.65 : savePts >= 1.0 ? 0.25 : 0.1;
  } else if (pos === 2) {
    // DEF
    goalPts = matchXG * 6.0;
    cleanSheetPts = cleanSheetProb * p60Mins * 4.0;
    goalsConcededPts = -expectedConcededPenalty;
    bpsExpected =
      cleanSheetProb >= 0.4
        ? 0.6 + Math.min(1.2, matchXG * 4.0 + matchXA * 2.0)
        : Math.min(0.8, matchXG * 4.0 + matchXA * 2.0);
  } else if (pos === 3) {
    // MID
    goalPts = matchXG * 5.0;
    cleanSheetPts = cleanSheetProb * p60Mins * 1.0;
    bpsExpected = Math.min(
      2.4,
      Math.max(
        0.15,
        matchXG * 2.6 + matchXA * 1.4 + (cleanSheetProb >= 0.45 ? 0.3 : 0.0),
      ),
    );
  } else if (pos === 4) {
    // FWD
    goalPts = matchXG * 4.0;
    cleanSheetPts = 0.0;
    bpsExpected = Math.min(2.6, Math.max(0.2, matchXG * 2.2 + matchXA * 0.8));
  }

  // 8. Total Expected Points (xP) Sum
  const totalXp =
    appearancePts +
    goalPts +
    assistPts +
    cleanSheetPts +
    goalsConcededPts +
    savePts +
    bpsExpected -
    expectedCardPenalty;

  return Math.max(0.5, Math.round(totalXp * 10) / 10);
}
