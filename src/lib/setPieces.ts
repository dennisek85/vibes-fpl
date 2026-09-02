import setPieceData from "@/data/set_piece_takers.json";
import { FPLPlayer } from "@/types/fpl";

export interface PlayerSetPieceProfile {
  isPrimaryPenalty: boolean;
  isSecondaryPenalty: boolean;
  isPrimaryCorner: boolean;
  isPrimaryDirectFk: boolean;
  isPrimaryIndirectFk: boolean;
  roles: string[];
  addedXg: number;
  addedXa: number;
}

function cleanStr(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesTaker(
  taker: string,
  webName: string,
  secondName: string,
  firstName: string,
): boolean {
  const t = cleanStr(taker);
  const w = cleanStr(webName);
  const s = cleanStr(secondName);
  const f = cleanStr(firstName);
  if (!t || (!w && !s)) return false;

  // Exact match on web name, second name, or full name
  if (t === w || t === s || `${f} ${s}`.trim() === t || `${w} ${s}`.trim() === t) {
    return true;
  }

  // Token word-boundary check for names with at least 4 characters to avoid false positives (e.g. 'lee')
  const tokens = [w, s, f].filter((tok) => tok.length >= 4);
  return tokens.some((tok) => t === tok || t.split(" ").includes(tok));
}

export function getPlayerSetPieceProfile(
  player: FPLPlayer,
  teamShortName?: string,
): PlayerSetPieceProfile {
  const result: PlayerSetPieceProfile = {
    isPrimaryPenalty: false,
    isSecondaryPenalty: false,
    isPrimaryCorner: false,
    isPrimaryDirectFk: false,
    isPrimaryIndirectFk: false,
    roles: [],
    addedXg: 0,
    addedXa: 0,
  };

  if (!player) return result;

  // Goalkeepers do not take outfield corners or direct free kicks
  const isGK = player.element_type === 1;

  const webName = player.web_name || "";
  const secondName = player.second_name || "";
  const firstName = player.first_name || "";

  // Search strictly within the player's team if available
  const teamsMap = setPieceData.teams as Record<
    string,
    {
      penalties: string[];
      corners: string[];
      directFreeKicks: string[];
      indirectFreeKicks: string[];
    }
  >;
  const relevantTeams =
    teamShortName && teamsMap[teamShortName.toUpperCase()]
      ? [teamsMap[teamShortName.toUpperCase()]]
      : [];

  if (relevantTeams.length === 0) {
    return result;
  }

  for (const teamSet of relevantTeams) {
    // 1. Penalties (Team averages ~0.14 pens/match * 78% conversion = ~0.11 xG total)
    if (teamSet.penalties && teamSet.penalties.length > 0) {
      if (matchesTaker(teamSet.penalties[0], webName, secondName, firstName)) {
        result.isPrimaryPenalty = true;
        result.roles.push("PEN 1st");
        result.addedXg += 0.11; // Primary penalty taker
      } else if (
        teamSet.penalties
          .slice(1)
          .some((p) => matchesTaker(p, webName, secondName, firstName))
      ) {
        result.isSecondaryPenalty = true;
        result.roles.push("PEN 2nd");
        // Secondary taker only steps up if primary is off pitch (~10% conditional equity)
        result.addedXg += 0.01;
      }
    }

    if (isGK) continue; // Goalkeepers do not take corners or free-kicks

    // 2. Corners (Total team corner expectancy ~0.13-0.15 xA per match)
    if (teamSet.corners && teamSet.corners.length > 0) {
      if (matchesTaker(teamSet.corners[0], webName, secondName, firstName)) {
        result.isPrimaryCorner = true;
        result.roles.push("CORNER");
        result.addedXa += 0.09; // Primary corner crosser (~65% volume share)
      } else if (
        teamSet.corners.length > 1 &&
        matchesTaker(teamSet.corners[1], webName, secondName, firstName)
      ) {
        result.isPrimaryCorner = true;
        result.roles.push("CORNER 2nd");
        result.addedXa += 0.04; // Secondary corner crosser (~30% volume share)
      }
    }

    // 3. Direct Free-Kicks (Shooting ~0.06 team xG/match)
    if (teamSet.directFreeKicks && teamSet.directFreeKicks.length > 0) {
      if (matchesTaker(teamSet.directFreeKicks[0], webName, secondName, firstName)) {
        result.isPrimaryDirectFk = true;
        result.roles.push("DIRECT FK");
        result.addedXg += 0.04;
      } else if (
        teamSet.directFreeKicks.length > 1 &&
        matchesTaker(teamSet.directFreeKicks[1], webName, secondName, firstName)
      ) {
        result.roles.push("DIRECT FK 2nd");
        result.addedXg += 0.02;
      }
    }

    // 4. Indirect Free-Kicks (Crossing ~0.06 team xA/match)
    if (teamSet.indirectFreeKicks && teamSet.indirectFreeKicks.length > 0) {
      if (matchesTaker(teamSet.indirectFreeKicks[0], webName, secondName, firstName)) {
        result.isPrimaryIndirectFk = true;
        result.roles.push("INDIRECT FK");
        result.addedXa += 0.04;
      } else if (
        teamSet.indirectFreeKicks.length > 1 &&
        matchesTaker(teamSet.indirectFreeKicks[1], webName, secondName, firstName)
      ) {
        result.roles.push("INDIRECT FK 2nd");
        result.addedXa += 0.02;
      }
    }
  }

  return result;
}
