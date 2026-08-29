import { FPLPlayer, SquadPick } from '@/types/fpl';
import { LEGAL_FORMATIONS } from '@/utils/aiOptimizer';

export interface OptimalSquadResult {
  squad: SquadPick[];
  totalCost: number; // in tenths, e.g. 1000 = £100.0m
  remainingBank: number; // in tenths
  totalProjectedPoints: number;
  captain: FPLPlayer;
  viceCaptain: FPLPlayer;
  formation: string;
  starters: { player: FPLPlayer; xp: number; isCaptain: boolean; isViceCaptain: boolean }[];
  bench: { player: FPLPlayer; xp: number }[];
  xpGain: number;
  transfersCount: number;
}

/**
 * Solves for the highest-xP valid 15-man FPL squad within the given budget.
 * Standard FPL Constraints:
 * - Exactly 2 GK, 5 DEF, 5 MID, 3 FWD
 * - Max 3 players per Premier League team
 * - Sum of player costs <= totalBudget
 * - Optimal Starting 11 + Captain selected for maximum gameweek xP
 */
export function solveOptimalSquad(
  allPlayers: FPLPlayer[],
  playerMap: Map<number, FPLPlayer>,
  totalBudget: number, // in tenths, e.g. 1005 = £100.5m
  gameweek: number,
  getXp: (playerId: number, gw: number) => number,
  currentSquad: SquadPick[] = [],
  horizon: number = 1
): OptimalSquadResult | null {
  if (!allPlayers || allPlayers.length === 0) return null;

  // 1. Filter active/available candidate players and enrich with xP
  interface Candidate {
    player: FPLPlayer;
    id: number;
    pos: number; // 1 = GK, 2 = DEF, 3 = MID, 4 = FWD
    cost: number;
    team: number;
    xp: number;
  }

  // Calculate horizon xP
  const getHorizonXp = (pId: number): number => {
    if (horizon === 1) return getXp(pId, gameweek);
    let sum = 0;
    for (let g = gameweek; g < gameweek + horizon; g++) {
      if (g <= 38) sum += getXp(pId, g);
    }
    return Math.round((sum / horizon) * 10) / 10;
  };

  const candidates: Candidate[] = [];

  for (const p of allPlayers) {
    // Avoid red-flagged / unavailable players
    if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round < 50) continue;
    if (p.status === 'i' || p.status === 's') continue;

    const xp = getHorizonXp(p.id);
    candidates.push({
      player: p,
      id: p.id,
      pos: p.element_type,
      cost: p.now_cost,
      team: p.team,
      xp
    });
  }

  const gks = candidates.filter(c => c.pos === 1);
  const defs = candidates.filter(c => c.pos === 2);
  const mids = candidates.filter(c => c.pos === 3);
  const fwds = candidates.filter(c => c.pos === 4);

  // Group candidates into:
  // Top tier (high xP) & Enabler tier (lowest cost with decent xP)
  const filterTopCandidates = (list: Candidate[], topCount: number, enablerCount: number): Candidate[] => {
    const byXp = [...list].sort((a, b) => b.xp - a.xp).slice(0, topCount);
    const byCost = [...list].sort((a, b) => a.cost - b.cost || b.xp - a.xp).slice(0, enablerCount);
    const map = new Map<number, Candidate>();
    byXp.forEach(c => map.set(c.id, c));
    byCost.forEach(c => map.set(c.id, c));
    return Array.from(map.values());
  };

  const candidateGks = filterTopCandidates(gks, 10, 6);
  const candidateDefs = filterTopCandidates(defs, 20, 10);
  const candidateMids = filterTopCandidates(mids, 24, 10);
  const candidateFwds = filterTopCandidates(fwds, 16, 6);

  // Quick evaluation of a 15-man squad selection
  const evaluate15 = (chosen: Candidate[]): { 
    totalScore: number; 
    starters: Candidate[]; 
    bench: Candidate[]; 
    formation: string;
    captain: Candidate;
    viceCaptain: Candidate;
  } => {
    const selGks = chosen.filter(c => c.pos === 1).sort((a, b) => b.xp - a.xp);
    const selDefs = chosen.filter(c => c.pos === 2).sort((a, b) => b.xp - a.xp);
    const selMids = chosen.filter(c => c.pos === 3).sort((a, b) => b.xp - a.xp);
    const selFwds = chosen.filter(c => c.pos === 4).sort((a, b) => b.xp - a.xp);

    const startingGk = selGks[0];
    const benchGk = selGks[1];

    let bestScore = -Infinity;
    let bestFormationStr = '3-5-2';
    let bestStarters: Candidate[] = [];
    let bestBenchOutfield: Candidate[] = [];
    let bestCap = startingGk;
    let bestVc = startingGk;

    for (const form of LEGAL_FORMATIONS) {
      const sDefs = selDefs.slice(0, form.def);
      const bDefs = selDefs.slice(form.def);

      const sMids = selMids.slice(0, form.mid);
      const bMids = selMids.slice(form.mid);

      const sFwds = selFwds.slice(0, form.fwd);
      const bFwds = selFwds.slice(form.fwd);

      const starters = [startingGk, ...sDefs, ...sMids, ...sFwds];
      const sortedByXp = [...starters].sort((a, b) => b.xp - a.xp);
      const cap = sortedByXp[0];
      const vc = sortedByXp[1] || cap;

      const sumXp = starters.reduce((acc, p) => acc + p.xp, 0);
      const score = sumXp + cap.xp; // captain 2x bonus

      if (score > bestScore) {
        bestScore = score;
        bestFormationStr = `${form.def}-${form.mid}-${form.fwd}`;
        bestStarters = starters;
        bestBenchOutfield = [...bDefs, ...bMids, ...bFwds].sort((a, b) => b.xp - a.xp);
        bestCap = cap;
        bestVc = vc;
      }
    }

    return {
      totalScore: Math.round(bestScore * 10) / 10,
      starters: bestStarters,
      bench: [benchGk, ...bestBenchOutfield],
      formation: bestFormationStr,
      captain: bestCap,
      viceCaptain: bestVc
    };
  };

  // Helper to check team constraint
  const isValidTeamConstraint = (picks: Candidate[]): boolean => {
    const teamCounts: Record<number, number> = {};
    for (const p of picks) {
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
      if (teamCounts[p.team] > 3) return false;
    }
    return true;
  };

  // Start with a greedy high-value baseline selection
  const sortByPpv = (arr: Candidate[]) => [...arr].sort((a, b) => (b.xp / (b.cost || 40)) - (a.xp / (a.cost || 40)));

  // Generate diverse initial seeds (greedy by xP, greedy by points per value, and balanced)
  let bestSquadCandidates: Candidate[] | null = null;
  let bestSquadEval: ReturnType<typeof evaluate15> | null = null;
  let bestTotalCost = 0;

  // Smart beam search / stochastic local search across combinations
  const iterations = 800;

  for (let i = 0; i < iterations; i++) {
    const teamCounts: Record<number, number> = {};
    const selected: Candidate[] = [];
    let currentCost = 0;

    const pickRandomWeighted = (pool: Candidate[], needed: number) => {
      const available = pool.filter(c => (teamCounts[c.team] || 0) < 3 && !selected.some(s => s.id === c.id));
      // Sort by xP with slight noise for diversity
      available.sort((a, b) => {
        const noiseA = (Math.random() - 0.5) * 1.5;
        const noiseB = (Math.random() - 0.5) * 1.5;
        return (b.xp + noiseB) - (a.xp + noiseA);
      });

      for (const cand of available) {
        if (selected.filter(s => s.pos === cand.pos).length >= needed) break;
        if ((teamCounts[cand.team] || 0) < 3) {
          selected.push(cand);
          teamCounts[cand.team] = (teamCounts[cand.team] || 0) + 1;
          currentCost += cand.cost;
        }
      }
    };

    pickRandomWeighted(candidateGks, 2);
    pickRandomWeighted(candidateDefs, 5);
    pickRandomWeighted(candidateMids, 5);
    pickRandomWeighted(candidateFwds, 3);

    if (selected.length !== 15) continue;
    if (!isValidTeamConstraint(selected)) continue;

    // If over budget, attempt greedy downgrades to cheapest valid enablers
    if (currentCost > totalBudget) {
      let repairAttempts = 15;
      while (currentCost > totalBudget && repairAttempts > 0) {
        repairAttempts--;
        // Find highest cost player on bench or lowest ppv to swap for enabler
        const sortedCost = [...selected].sort((a, b) => b.cost - a.cost);
        let swapped = false;
        for (const outPlayer of sortedCost) {
          const enablers = (
            outPlayer.pos === 1 ? candidateGks :
            outPlayer.pos === 2 ? candidateDefs :
            outPlayer.pos === 3 ? candidateMids : candidateFwds
          ).filter(e => e.cost < outPlayer.cost && !selected.some(s => s.id === e.id) && (teamCounts[e.team] || 0) < 3);

          if (enablers.length > 0) {
            const bestEnabler = enablers.sort((a, b) => a.cost - b.cost || b.xp - a.xp)[0];
            const idx = selected.findIndex(s => s.id === outPlayer.id);
            if (idx !== -1) {
              selected.splice(idx, 1);
              teamCounts[outPlayer.team]--;
              selected.push(bestEnabler);
              teamCounts[bestEnabler.team] = (teamCounts[bestEnabler.team] || 0) + 1;
              currentCost = currentCost - outPlayer.cost + bestEnabler.cost;
              swapped = true;
              break;
            }
          }
        }
        if (!swapped) break;
      }
    }

    if (currentCost <= totalBudget && selected.length === 15 && isValidTeamConstraint(selected)) {
      // If remaining budget, try greedy upgrade
      let remaining = totalBudget - currentCost;
      if (remaining >= 5) {
        for (let sIdx = 0; sIdx < selected.length; sIdx++) {
          const currentP = selected[sIdx];
          const pool = (
            currentP.pos === 1 ? candidateGks :
            currentP.pos === 2 ? candidateDefs :
            currentP.pos === 3 ? candidateMids : candidateFwds
          ).filter(u => u.cost > currentP.cost && (u.cost - currentP.cost) <= remaining && !selected.some(s => s.id === u.id) && ((teamCounts[u.team] || 0) < 3 || u.team === currentP.team));

          if (pool.length > 0) {
            const bestUpgrade = pool.sort((a, b) => b.xp - a.xp)[0];
            if (bestUpgrade.xp > currentP.xp) {
              teamCounts[currentP.team]--;
              teamCounts[bestUpgrade.team] = (teamCounts[bestUpgrade.team] || 0) + 1;
              remaining -= (bestUpgrade.cost - currentP.cost);
              currentCost += (bestUpgrade.cost - currentP.cost);
              selected[sIdx] = bestUpgrade;
            }
          }
        }
      }

      const evaluation = evaluate15(selected);
      if (!bestSquadEval || evaluation.totalScore > bestSquadEval.totalScore) {
        bestSquadCandidates = [...selected];
        bestSquadEval = evaluation;
        bestTotalCost = currentCost;
      }
    }
  }

  if (!bestSquadCandidates || !bestSquadEval) return null;

  // Build the final SquadPick array matching FPL standard positions
  const starterDefs = bestSquadEval.starters.filter(p => p.pos === 2);
  const starterMids = bestSquadEval.starters.filter(p => p.pos === 3);
  const starterFwds = bestSquadEval.starters.filter(p => p.pos === 4);
  const startingGk = bestSquadEval.starters.find(p => p.pos === 1)!;

  const orderedStarters = [startingGk, ...starterDefs, ...starterMids, ...starterFwds];
  const orderedBench = bestSquadEval.bench;

  const finalSquadPicks: SquadPick[] = [];

  orderedStarters.forEach((cand, idx) => {
    const isCap = cand.id === bestSquadEval!.captain.id;
    const isVc = cand.id === bestSquadEval!.viceCaptain.id;
    finalSquadPicks.push({
      element: cand.id,
      position: idx + 1,
      is_captain: isCap,
      is_vice_captain: isVc,
      multiplier: isCap ? 2 : 1,
      purchase_price: cand.cost,
      selling_price: cand.cost
    });
  });

  orderedBench.forEach((cand, idx) => {
    finalSquadPicks.push({
      element: cand.id,
      position: 12 + idx,
      is_captain: false,
      is_vice_captain: false,
      multiplier: 0,
      purchase_price: cand.cost,
      selling_price: cand.cost
    });
  });

  // Calculate comparison with current squad
  let currentSquadXp = 0;
  let transfersCount = 0;

  if (currentSquad && currentSquad.length === 15) {
    const currentStarters = currentSquad.filter(p => p.position <= 11);
    currentStarters.forEach(p => {
      const xp = getHorizonXp(p.element);
      currentSquadXp += xp * (p.is_captain ? 2 : 1);
    });
    currentSquadXp = Math.round(currentSquadXp * 10) / 10;

    const currentIds = new Set(currentSquad.map(s => s.element));
    bestSquadCandidates.forEach(cand => {
      if (!currentIds.has(cand.id)) {
        transfersCount++;
      }
    });
  }

  const xpGain = Math.round((bestSquadEval.totalScore - currentSquadXp) * 10) / 10;

  return {
    squad: finalSquadPicks,
    totalCost: bestTotalCost,
    remainingBank: Math.max(0, totalBudget - bestTotalCost),
    totalProjectedPoints: bestSquadEval.totalScore,
    captain: bestSquadEval.captain.player,
    viceCaptain: bestSquadEval.viceCaptain.player,
    formation: bestSquadEval.formation,
    starters: orderedStarters.map(s => ({
      player: s.player,
      xp: s.xp,
      isCaptain: s.id === bestSquadEval!.captain.id,
      isViceCaptain: s.id === bestSquadEval!.viceCaptain.id
    })),
    bench: orderedBench.map(b => ({
      player: b.player,
      xp: b.xp
    })),
    xpGain,
    transfersCount
  };
}
