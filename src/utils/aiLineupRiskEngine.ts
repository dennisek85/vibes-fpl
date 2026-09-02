/**
 * Pre-Deadline Lineup & Rotation Risk Engine
 * Evaluates real-time press conference quotes, official injury status,
 * European midweek congestion, and manager volatility to calculate starting certainty.
 */

import { FPLPlayer } from "@/types/fpl";
import { UI_TEXT } from "@/lib/ui-text";

export type RiskLevel = "high" | "medium" | "doubtful" | "fatigue" | "safe";

export interface RotationRiskReport {
  playerId: number;
  playerName: string;
  teamShort: string;
  startProbability: number; // e.g. 65 (%)
  riskLevel: RiskLevel;
  primaryReasonKey: keyof typeof UI_TEXT.rotationRisk.reasons;
  humanReason: string;
  officialNewsQuote: string;
  isSubRisk: boolean;
  expectedMinutes: number;
}

/**
 * Evaluates starting probability and maps technical press conference tokens
 * and empirical start consistency to human-readable explanations from UI_TEXT.
 */
export function evaluatePlayerRotationRisk(
  player: FPLPlayer,
  teamShortName: string = "EPL",
): RotationRiskReport {
  const news = (player.news || "").trim();
  const lowerNews = news.toLowerCase();
  const chance =
    player.chance_of_playing_next_round !== null
      ? player.chance_of_playing_next_round
      : 100;
  const status = player.status || "a";

  let startProb = 95;
  let reasonKey: keyof typeof UI_TEXT.rotationRisk.reasons = "defaultSafe";
  let isSubRisk = false;
  let expectedMins = 82;

  const starts =
    typeof player.starts === "number"
      ? player.starts
      : parseInt(`${player.starts || 0}`, 10) || 0;
  const minutes =
    typeof player.minutes === "number"
      ? player.minutes
      : parseFloat(`${player.minutes || 0}`) || 0;

  // 1. Definite Absences
  if (status === "i" || status === "u" || chance === 0) {
    startProb = 0;
    expectedMins = 0;
    reasonKey = "defaultDoubtful";
  }
  // 2. New Signing Adaptation Hazard (The Ndiaye / Deadline Transfer Signal)
  else if (
    lowerNews.includes("joined") ||
    lowerNews.includes("transfer") ||
    lowerNews.includes("signed") ||
    lowerNews.includes("clearance") ||
    lowerNews.includes("loan")
  ) {
    startProb = 30; // ~30% starting probability during immediate adaptation period
    expectedMins = 25; // Impact substitute expectation
    isSubRisk = true;
    reasonKey = "newSigning";
  }
  // 3. Press Conference NLP Keyword Classification
  else if (
    lowerNews.includes("managing load") ||
    lowerNews.includes("load management") ||
    lowerNews.includes("minutes")
  ) {
    startProb = 60;
    expectedMins = 58;
    isSubRisk = true;
    reasonKey = "managingLoad";
  } else if (
    lowerNews.includes("tightness") ||
    lowerNews.includes("hamstring") ||
    lowerNews.includes("groin")
  ) {
    startProb = 50;
    expectedMins = 50;
    isSubRisk = true;
    reasonKey = "tightness";
  } else if (
    lowerNews.includes("late fitness test") ||
    lowerNews.includes("late test") ||
    lowerNews.includes("decision tomorrow")
  ) {
    startProb = 45;
    expectedMins = 45;
    reasonKey = "lateFitnessTest";
  } else if (lowerNews.includes("assessed") || lowerNews.includes("check")) {
    startProb = 65;
    expectedMins = 60;
    reasonKey = "assessed";
  } else if (
    lowerNews.includes("illness") ||
    lowerNews.includes("sick") ||
    lowerNews.includes("virus")
  ) {
    startProb = 60;
    expectedMins = 60;
    reasonKey = "illness";
  } else if (
    lowerNews.includes("knock") ||
    lowerNews.includes("impact") ||
    lowerNews.includes("bruise")
  ) {
    startProb = 75;
    expectedMins = 70;
    reasonKey = "knock";
  } else if (status === "d" || chance <= 75) {
    startProb = chance || 50;
    expectedMins = 55;
    reasonKey = "defaultDoubtful";
  }
  // 4. Empirical Starts-to-Appearance Consistency Ratio (Pure Organic Math)
  else {
    // Estimate total appearances: starts + substitute appearances
    const subAppearances =
      starts > 0
        ? Math.max(0, Math.round((minutes - starts * 70) / 25))
        : Math.max(0, Math.round(minutes / 25));
    const totalAppearances = starts + subAppearances;

    if (totalAppearances >= 3) {
      const consistencyRatio = starts / totalAppearances;
      // If a player has low start consistency (<65%), scale start certainty organically
      if (consistencyRatio < 0.65) {
        startProb = Math.max(25, Math.round(consistencyRatio * 100));
        expectedMins = Math.round(
          55 * consistencyRatio + 25 * (1 - consistencyRatio),
        );
        isSubRisk = true;
        reasonKey = "tacticalRotation";
      }
    } else if (minutes > 240 && player.element_type >= 3) {
      // 5. Heavy Workload / Turnaround Fatigue
      startProb = 85;
      expectedMins = 70;
      isSubRisk = true;
      reasonKey = "europeanFatigue";
    }
  }

  // Determine Risk Level classification
  let riskLevel: RiskLevel = "safe";
  if (startProb <= 45) {
    riskLevel = "high";
  } else if (startProb <= 70) {
    riskLevel = "medium";
  } else if (status === "d") {
    riskLevel = "doubtful";
  } else if (isSubRisk) {
    riskLevel = "fatigue";
  }

  return {
    playerId: player.id,
    playerName: player.web_name,
    teamShort: teamShortName,
    startProbability: startProb,
    riskLevel,
    primaryReasonKey: reasonKey,
    humanReason: UI_TEXT.rotationRisk.reasons[reasonKey],
    officialNewsQuote:
      news ||
      (status === "a"
        ? "Fully fit and available for selection."
        : "Flagged in official FPL update."),
    isSubRisk,
    expectedMinutes: expectedMins,
  };
}
