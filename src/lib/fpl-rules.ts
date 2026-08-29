import { FPLPlayer, SquadPick, ChipType } from '@/types/fpl';
import { MAX_SAVED_FREE_TRANSFERS, HIT_COST_POINTS } from './fpl-constants';

/**
 * Calculates selling price under standard FPL 50% profit rules
 */
export function calculateSellingPrice(nowCost: number, purchasePrice: number): number {
  if (nowCost <= purchasePrice) {
    return nowCost;
  }
  const profit = nowCost - purchasePrice;
  return purchasePrice + Math.floor(profit / 2);
}

/**
 * Validates starting XI formation (11 players)
 */
export function validateFormation(
  startingPicks: SquadPick[],
  playerMap: Map<number, FPLPlayer>
): { isValid: boolean; gkCount: number; defCount: number; midCount: number; fwdCount: number; error?: string } {
  let gkCount = 0;
  let defCount = 0;
  let midCount = 0;
  let fwdCount = 0;

  for (const pick of startingPicks) {
    const player = playerMap.get(pick.element);
    if (!player) continue;
    if (player.element_type === 1) gkCount++;
    else if (player.element_type === 2) defCount++;
    else if (player.element_type === 3) midCount++;
    else if (player.element_type === 4) fwdCount++;
  }

  if (gkCount !== 1) {
    return { isValid: false, gkCount, defCount, midCount, fwdCount, error: 'Must have exactly 1 Goalkeeper on pitch.' };
  }
  if (defCount < 3 || defCount > 5) {
    return { isValid: false, gkCount, defCount, midCount, fwdCount, error: `Must have 3-5 Defenders on pitch (currently ${defCount}).` };
  }
  if (midCount < 2 || midCount > 5) {
    return { isValid: false, gkCount, defCount, midCount, fwdCount, error: `Must have 2-5 Midfielders on pitch (currently ${midCount}).` };
  }
  if (fwdCount < 1 || fwdCount > 3) {
    return { isValid: false, gkCount, defCount, midCount, fwdCount, error: `Must have 1-3 Forwards on pitch (currently ${fwdCount}).` };
  }
  if (startingPicks.length !== 11) {
    return { isValid: false, gkCount, defCount, midCount, fwdCount, error: `Starting XI must have exactly 11 players.` };
  }

  return { isValid: true, gkCount, defCount, midCount, fwdCount };
}

/**
 * Checks if substituting two squad slots results in a valid formation
 */
export function canSwapSquadSlots(
  posA: number, // 1-15
  posB: number, // 1-15
  squad: SquadPick[],
  playerMap: Map<number, FPLPlayer>
): { canSwap: boolean; reason?: string } {
  if (posA === posB) return { canSwap: true };

  const isPitchA = posA <= 11;
  const isPitchB = posB <= 11;

  // Both on pitch or both on bench: always legal re-arrangement
  if ((isPitchA && isPitchB) || (!isPitchA && !isPitchB)) {
    return { canSwap: true };
  }

  // One on pitch, one on bench: test the hypothetical formation
  const newSquad = squad.map(p => {
    if (p.position === posA) return { ...p, position: posB };
    if (p.position === posB) return { ...p, position: posA };
    return p;
  });

  const hypotheticalPitch = newSquad.filter(p => p.position <= 11);
  const validation = validateFormation(hypotheticalPitch, playerMap);

  if (!validation.isValid) {
    return { canSwap: false, reason: validation.error };
  }

  return { canSwap: true };
}

/**
 * Checks max 3 players per Premier League team rule
 */
export function validateClubLimit(
  squad: SquadPick[],
  playerMap: Map<number, FPLPlayer>
): { isValid: boolean; violations: Array<{ teamId: number; count: number }> } {
  const teamCounts = new Map<number, number>();

  for (const pick of squad) {
    const player = playerMap.get(pick.element);
    if (!player) continue;
    teamCounts.set(player.team, (teamCounts.get(player.team) || 0) + 1);
  }

  const violations: Array<{ teamId: number; count: number }> = [];
  teamCounts.forEach((count, teamId) => {
    if (count > 3) {
      violations.push({ teamId, count });
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Calculates Gameweek budget, Free Transfers, and Hit Costs under 2026/27 rules
 */
export function calculateGameweekFinancials(params: {
  currentBank: number; // in tenths
  availableFreeTransfers: number; // calculated or overridden for this GW
  transfersCount: number;
  chip: ChipType;
  bankOverride?: number | null;
  ftOverride?: number | null;
}): {
  effectiveBank: number;
  availableTransfers: number;
  transfersUsed: number;
  hitPoints: number;
  nextGameweekFT: number;
} {
  const { currentBank, transfersCount, chip, bankOverride, ftOverride } = params;

  const availableTransfers = ftOverride !== null && ftOverride !== undefined 
    ? ftOverride 
    : params.availableFreeTransfers;

  const effectiveBank = bankOverride !== null && bankOverride !== undefined
    ? bankOverride
    : currentBank;

  let hitPoints = 0;
  let nextGameweekFT = 1;

  if (chip === 'wildcard' || chip === 'freehit') {
    // Under 2026/27 rules, unlimited free transfers during chip, banked transfers preserved
    hitPoints = 0;
    nextGameweekFT = Math.min(MAX_SAVED_FREE_TRANSFERS, availableTransfers + 1);
  } else {
    const extraTransfers = Math.max(0, transfersCount - availableTransfers);
    hitPoints = extraTransfers * HIT_COST_POINTS;

    if (transfersCount <= availableTransfers) {
      const remaining = availableTransfers - transfersCount;
      nextGameweekFT = Math.min(MAX_SAVED_FREE_TRANSFERS, remaining + 1);
    } else {
      nextGameweekFT = 1; // used all FTs + hits, starts next week with 1
    }
  }

  return {
    effectiveBank,
    availableTransfers,
    transfersUsed: transfersCount,
    hitPoints,
    nextGameweekFT,
  };
}

/**
 * Formats tenths of millions to decimal string (e.g. 105 -> "£10.5m" or "10.5")
 */
export function formatMoney(tenths: number, showSymbol = true): string {
  const value = (tenths / 10).toFixed(1);
  return showSymbol ? `£${value}m` : value;
}
