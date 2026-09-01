import hyperparameters from "@/data/model_hyperparameters.json";

export interface AdaptiveModelParameters {
  bayesianHalfLifeMinutes: number;
  oddsWeight: number;
  modelXgWeight: number;
  homeAdvantageMultiplier: number;
  setPieceWeights: {
    penaltyXg: number;
    cornerXa: number;
    directFreeKickXg: number;
  };
  bpsCoefficients: typeof hyperparameters.parameters.bps_coefficients;
  appearanceProbabilities: typeof hyperparameters.parameters.appearance_probabilities;
  phase: "cold_start" | "transition" | "mature";
}

/**
 * Single Source of Truth for In-Season Adaptive Model Parameters
 * Dynamically adjusts weights between sharp bookmaker odds and underlying Understat xG
 * based on the number of completed gameweeks.
 */
export function getAdaptiveModelParameters(
  gameweek: number,
): AdaptiveModelParameters {
  const base = hyperparameters.parameters;

  // 1. Cold-Start Phase (GW 1-4): Prioritize sharp market odds over small sample noise
  if (gameweek <= 4) {
    return {
      bayesianHalfLifeMinutes: base.bayesian_half_life_minutes,
      oddsWeight: 0.72,
      modelXgWeight: 0.28,
      homeAdvantageMultiplier: base.home_advantage_multiplier,
      setPieceWeights: {
        penaltyXg: base.set_piece_weights.penalty_xg,
        cornerXa: base.set_piece_weights.corner_xa,
        directFreeKickXg: base.set_piece_weights.direct_free_kick_xg,
      },
      bpsCoefficients: base.bps_coefficients,
      appearanceProbabilities: base.appearance_probabilities,
      phase: "cold_start",
    };
  }

  // 2. Transition Phase (GW 5-12): Sample size grows; ramp up underlying xG/xA
  if (gameweek <= 12) {
    return {
      bayesianHalfLifeMinutes: Math.round(
        base.bayesian_half_life_minutes * 0.9,
      ),
      oddsWeight: 0.52,
      modelXgWeight: 0.48,
      homeAdvantageMultiplier: base.home_advantage_multiplier,
      setPieceWeights: {
        penaltyXg: base.set_piece_weights.penalty_xg,
        cornerXa: base.set_piece_weights.corner_xa,
        directFreeKickXg: base.set_piece_weights.direct_free_kick_xg,
      },
      bpsCoefficients: base.bps_coefficients,
      appearanceProbabilities: base.appearance_probabilities,
      phase: "transition",
    };
  }

  // 3. Mature Phase (GW 13-38): Tactical underlying numbers dominate
  return {
    bayesianHalfLifeMinutes: Math.round(base.bayesian_half_life_minutes * 0.75),
    oddsWeight: 0.38,
    modelXgWeight: 0.62,
    homeAdvantageMultiplier: base.home_advantage_multiplier,
    setPieceWeights: {
      penaltyXg: base.set_piece_weights.penalty_xg,
      cornerXa: base.set_piece_weights.corner_xa,
      directFreeKickXg: base.set_piece_weights.direct_free_kick_xg,
    },
    bpsCoefficients: base.bps_coefficients,
    appearanceProbabilities: base.appearance_probabilities,
    phase: "mature",
  };
}
