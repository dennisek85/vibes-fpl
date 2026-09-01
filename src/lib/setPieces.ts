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

function normalizePlayerName(player: FPLPlayer): string {
  if (!player) return "";
  const web = (player.web_name || "").toLowerCase().trim();
  const second = (player.second_name || "").toLowerCase().trim();
  const first = (player.first_name || "").toLowerCase().trim();
  return `${web} ${second} ${first}`;
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

  const normalized = normalizePlayerName(player);
  const webName = (player.web_name || "").toLowerCase().trim();

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
    // 1. Penalties
    if (teamSet.penalties && teamSet.penalties.length > 0) {
      if (
        teamSet.penalties[0].includes(webName) ||
        normalized.includes(teamSet.penalties[0])
      ) {
        result.isPrimaryPenalty = true;
        result.roles.push("PEN 1st");
        result.addedXg += 0.11; // Empirical 0.14 pens/match * 78% conversion
      } else if (
        teamSet.penalties
          .slice(1)
          .some((p) => p.includes(webName) || normalized.includes(p))
      ) {
        result.isSecondaryPenalty = true;
        result.roles.push("PEN 2nd");
        result.addedXg += 0.03;
      }
    }

    if (isGK) continue; // Goalkeepers do not take corners or free-kicks

    // 2. Corners (Primary Crossers)
    if (teamSet.corners && teamSet.corners.length > 0) {
      if (
        teamSet.corners
          .slice(0, 2)
          .some((c) => c.includes(webName) || normalized.includes(c))
      ) {
        result.isPrimaryCorner = true;
        result.roles.push("CORNER");
        result.addedXa += 0.14; // ~+0.42 Expected Points from corner assists
      }
    }

    // 3. Direct Free-Kicks (Shooting)
    if (teamSet.directFreeKicks && teamSet.directFreeKicks.length > 0) {
      if (
        teamSet.directFreeKicks
          .slice(0, 2)
          .some((f) => f.includes(webName) || normalized.includes(f))
      ) {
        result.isPrimaryDirectFk = true;
        result.roles.push("DIRECT FK");
        result.addedXg += 0.06;
      }
    }

    // 4. Indirect Free-Kicks (Crossing)
    if (teamSet.indirectFreeKicks && teamSet.indirectFreeKicks.length > 0) {
      if (
        teamSet.indirectFreeKicks
          .slice(0, 2)
          .some((f) => f.includes(webName) || normalized.includes(f))
      ) {
        result.isPrimaryIndirectFk = true;
        result.addedXa += 0.06;
      }
    }
  }

  return result;
}
