import { SquadPick, FPLPlayer } from '@/types/fpl';

export interface OptimizationResult {
  optimizedSquad: SquadPick[];
  formation: string;
  captainName: string;
  viceCaptainName: string;
  captainXp: number;
  totalProjectedPoints: number;
  startersCount: {
    def: number;
    mid: number;
    fwd: number;
  };
}

const LEGAL_FORMATIONS = [
  { def: 3, mid: 5, fwd: 2 },
  { def: 3, mid: 4, fwd: 3 },
  { def: 4, mid: 4, fwd: 2 },
  { def: 4, mid: 3, fwd: 3 },
  { def: 4, mid: 5, fwd: 1 },
  { def: 5, mid: 3, fwd: 2 },
  { def: 5, mid: 4, fwd: 1 },
  { def: 5, mid: 2, fwd: 3 },
];

export function optimizeLineup(
  squad: SquadPick[],
  playerMap: Map<number, FPLPlayer>,
  gameweek: number,
  getXp: (playerId: number, gw: number) => number
): OptimizationResult | null {
  if (!squad || squad.length !== 15) return null;

  // Enrich squad items with player metadata and gameweek xP
  interface EnrichedPick {
    pick: SquadPick;
    player: FPLPlayer;
    xp: number;
    type: number; // 1 = GK, 2 = DEF, 3 = MID, 4 = FWD
  }

  const enriched: EnrichedPick[] = [];

  for (const pick of squad) {
    const player = playerMap.get(pick.element);
    if (!player) return null;
    const xp = getXp(player.id, gameweek);
    enriched.push({
      pick: { ...pick },
      player,
      xp,
      type: player.element_type
    });
  }

  const gks = enriched.filter(p => p.type === 1).sort((a, b) => b.xp - a.xp);
  const defs = enriched.filter(p => p.type === 2).sort((a, b) => b.xp - a.xp);
  const mids = enriched.filter(p => p.type === 3).sort((a, b) => b.xp - a.xp);
  const fwds = enriched.filter(p => p.type === 4).sort((a, b) => b.xp - a.xp);

  if (gks.length !== 2 || defs.length !== 5 || mids.length !== 5 || fwds.length !== 3) {
    return null; // Invalid squad structure
  }

  const startingGk = gks[0];
  const benchGk = gks[1];

  let bestFormation = LEGAL_FORMATIONS[0];
  let bestScore = -Infinity;
  let bestStarters: EnrichedPick[] = [];
  let bestBenchOutfield: EnrichedPick[] = [];

  for (const form of LEGAL_FORMATIONS) {
    const selectedDefs = defs.slice(0, form.def);
    const benchDefs = defs.slice(form.def);

    const selectedMids = mids.slice(0, form.mid);
    const benchMids = mids.slice(form.mid);

    const selectedFwds = fwds.slice(0, form.fwd);
    const benchFwds = fwds.slice(form.fwd);

    const starters = [startingGk, ...selectedDefs, ...selectedMids, ...selectedFwds];
    
    // Sort starters descending by xP to identify Captain & Vice-Captain
    const sortedStartersByXp = [...starters].sort((a, b) => b.xp - a.xp);
    const cap = sortedStartersByXp[0];

    // Total points = sum of all starters + 1x bonus for captain (since captain gets 2x)
    const baseSum = starters.reduce((acc, p) => acc + p.xp, 0);
    const totalWithCap = baseSum + cap.xp;

    if (totalWithCap > bestScore) {
      bestScore = totalWithCap;
      bestFormation = form;
      bestStarters = starters;
      // All remaining outfielders sorted by xP descending for bench priority
      bestBenchOutfield = [...benchDefs, ...benchMids, ...benchFwds].sort((a, b) => b.xp - a.xp);
    }
  }

  // Identify Captain (#1 starter) and Vice-Captain (#2 starter)
  const sortedStarters = [...bestStarters].sort((a, b) => b.xp - a.xp);
  const captainPick = sortedStarters[0];
  const viceCaptainPick = sortedStarters[1];

  // Build the final 15 picks array strictly partitioned by FPL positions:
  // 1: GK
  // 2 .. (1 + def): DEF
  // (2 + def) .. (1 + def + mid): MID
  // (2 + def + mid) .. 11: FWD
  // 12: Bench GK
  // 13: Bench 1
  // 14: Bench 2
  // 15: Bench 3
  const starterDefs = bestStarters.filter(p => p.type === 2);
  const starterMids = bestStarters.filter(p => p.type === 3);
  const starterFwds = bestStarters.filter(p => p.type === 4);

  const orderedStartingPicks = [startingGk, ...starterDefs, ...starterMids, ...starterFwds];
  const orderedBenchPicks = [benchGk, ...bestBenchOutfield];

  const finalSquadPicks: SquadPick[] = [];

  // Starters (Positions 1 to 11)
  orderedStartingPicks.forEach((p, idx) => {
    const isCap = p.player.id === captainPick.player.id;
    const isVc = p.player.id === viceCaptainPick.player.id;

    finalSquadPicks.push({
      ...p.pick,
      element: p.player.id,
      position: idx + 1,
      is_captain: isCap,
      is_vice_captain: isVc,
      multiplier: isCap ? 2 : 1
    });
  });

  // Bench (Positions 12 to 15)
  orderedBenchPicks.forEach((p, idx) => {
    finalSquadPicks.push({
      ...p.pick,
      element: p.player.id,
      position: 12 + idx,
      is_captain: false,
      is_vice_captain: false,
      multiplier: 0
    });
  });

  return {
    optimizedSquad: finalSquadPicks,
    formation: `${bestFormation.def}-${bestFormation.mid}-${bestFormation.fwd}`,
    captainName: captainPick.player.web_name,
    viceCaptainName: viceCaptainPick.player.web_name,
    captainXp: captainPick.xp,
    totalProjectedPoints: Number(bestScore.toFixed(1)),
    startersCount: {
      def: bestFormation.def,
      mid: bestFormation.mid,
      fwd: bestFormation.fwd
    }
  };
}

