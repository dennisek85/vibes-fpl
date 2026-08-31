import { FPLPlayer, SquadPick } from '@/types/fpl';
import { LEGAL_FORMATIONS } from '@/utils/aiOptimizer';

export interface OptimalSquadResult {
  squad: SquadPick[];
  totalCost: number; // in tenths, e.g. 1000 = £100.0m
  remainingBank: number; // in tenths
  totalProjectedPoints: number; // Average per GW
  cumulativePoints: number; // Total points across horizon (e.g. 195.4 pts over 3 GWs)
  horizon: number;
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
  _playerMap: Map<number, FPLPlayer>,
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

  // Calculate horizon xP (Average per GW across horizon)
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
    captain: Candidate; 
    viceCaptain: Candidate; 
    formation: string 
  } | null => {
    const gksChosen = chosen.filter(c => c.pos === 1).sort((a, b) => b.xp - a.xp);
    const defsChosen = chosen.filter(c => c.pos === 2).sort((a, b) => b.xp - a.xp);
    const midsChosen = chosen.filter(c => c.pos === 3).sort((a, b) => b.xp - a.xp);
    const fwdsChosen = chosen.filter(c => c.pos === 4).sort((a, b) => b.xp - a.xp);

    if (gksChosen.length !== 2 || defsChosen.length !== 5 || midsChosen.length !== 5 || fwdsChosen.length !== 3) {
      return null;
    }

    const startingGk = gksChosen[0];
    const benchGk = gksChosen[1];

    let bestFormScore = -Infinity;
    let bestFormStarters: Candidate[] = [];
    let bestFormBenchOutfield: Candidate[] = [];
    let bestFormationStr = '3-5-2';

    for (const form of LEGAL_FORMATIONS) {
      const formDefs = defsChosen.slice(0, form.def);
      const benchDefs = defsChosen.slice(form.def);

      const formMids = midsChosen.slice(0, form.mid);
      const benchMids = midsChosen.slice(form.mid);

      const formFwds = fwdsChosen.slice(0, form.fwd);
      const benchFwds = fwdsChosen.slice(form.fwd);

      const starters = [startingGk, ...formDefs, ...formMids, ...formFwds];
      const sortedStarters = [...starters].sort((a, b) => b.xp - a.xp);
      const cap = sortedStarters[0];

      const score = starters.reduce((s, p) => s + p.xp, 0) + cap.xp;

      if (score > bestFormScore) {
        bestFormScore = score;
        bestFormStarters = starters;
        bestFormBenchOutfield = [...benchDefs, ...benchMids, ...benchFwds].sort((a, b) => b.xp - a.xp);
        bestFormationStr = `${form.def}-${form.mid}-${form.fwd}`;
      }
    }

    const sortedBestStarters = [...bestFormStarters].sort((a, b) => b.xp - a.xp);

    return {
      totalScore: Math.round(bestFormScore * 10) / 10,
      starters: bestFormStarters,
      bench: [benchGk, ...bestFormBenchOutfield],
      captain: sortedBestStarters[0],
      viceCaptain: sortedBestStarters[1],
      formation: bestFormationStr
    };
  };

  // Club Limit Validator (max 3 players from any single club)
  const isClubLimitValid = (players: Candidate[]): boolean => {
    const clubCounts = new Map<number, number>();
    for (const p of players) {
      const count = (clubCounts.get(p.team) || 0) + 1;
      if (count > 3) return false;
      clubCounts.set(p.team, count);
    }
    return true;
  };

  // Multi-pass greedy knapsack optimizer
  let bestSquadCandidates: Candidate[] | null = null;
  let bestSquadEval: ReturnType<typeof evaluate15> = null;
  let bestTotalCost = 0;

  // Pass 1: Premium Skeleton Selection + Cheapest Viable Enablers
  const sortedGks = [...candidateGks].sort((a, b) => b.xp - a.xp);
  const sortedDefs = [...candidateDefs].sort((a, b) => b.xp - a.xp);
  const sortedMids = [...candidateMids].sort((a, b) => b.xp - a.xp);
  const sortedFwds = [...candidateFwds].sort((a, b) => b.xp - a.xp);

  const premiumGks = sortedGks.slice(0, 4);
  const enablerGks = [...candidateGks].sort((a, b) => a.cost - b.cost).slice(0, 4);

  const premiumMids = sortedMids.slice(0, 8);
  const premiumFwds = sortedFwds.slice(0, 6);
  const premiumDefs = sortedDefs.slice(0, 8);

  for (let topMidCount = 4; topMidCount <= 5; topMidCount++) {
    for (let topFwdCount = 2; topFwdCount <= 3; topFwdCount++) {
      for (let topDefCount = 3; topDefCount <= 4; topDefCount++) {
        const testMids = [...premiumMids.slice(0, topMidCount)];
        const cheapMids = [...candidateMids].sort((a, b) => a.cost - b.cost).filter(m => !testMids.some(tm => tm.id === m.id));
        testMids.push(...cheapMids.slice(0, 5 - topMidCount));

        const testFwds = [...premiumFwds.slice(0, topFwdCount)];
        const cheapFwds = [...candidateFwds].sort((a, b) => a.cost - b.cost).filter(f => !testFwds.some(tf => tf.id === f.id));
        testFwds.push(...cheapFwds.slice(0, 3 - topFwdCount));

        const testDefs = [...premiumDefs.slice(0, topDefCount)];
        const cheapDefs = [...candidateDefs].sort((a, b) => a.cost - b.cost).filter(d => !testDefs.some(td => td.id === d.id));
        testDefs.push(...cheapDefs.slice(0, 5 - topDefCount));

        const testGks = [premiumGks[0], enablerGks.find(g => g.id !== premiumGks[0]?.id) || enablerGks[0]].filter(Boolean);

        const current15 = [...testGks, ...testDefs, ...testMids, ...testFwds];
        if (current15.length !== 15) continue;
        if (!isClubLimitValid(current15)) continue;

        const cost = current15.reduce((sum, p) => sum + p.cost, 0);
        if (cost > totalBudget) continue;

        const evalResult = evaluate15(current15);
        if (!evalResult) continue;

        if (!bestSquadEval || evalResult.totalScore > bestSquadEval.totalScore) {
          bestSquadEval = evalResult;
          bestSquadCandidates = current15;
          bestTotalCost = cost;
        }
      }
    }
  }

  // Pass 2: Local Search / 1-for-1 Upgrade Iteration
  if (bestSquadCandidates && bestSquadEval) {
    let currentPool = [...bestSquadCandidates];
    let improved = true;
    let iterations = 0;

    while (improved && iterations < 25) {
      improved = false;
      iterations++;

      const remainingBudget = totalBudget - bestTotalCost;

      for (let i = 0; i < currentPool.length; i++) {
        const outPlayer = currentPool[i];
        const samePosCandidates = candidates.filter(c => c.pos === outPlayer.pos && c.id !== outPlayer.id && !currentPool.some(p => p.id === c.id));

        for (const inPlayer of samePosCandidates) {
          const costDelta = inPlayer.cost - outPlayer.cost;
          if (costDelta > remainingBudget) continue;

          const testNewPool = [...currentPool];
          testNewPool[i] = inPlayer;

          if (!isClubLimitValid(testNewPool)) continue;

          const testEval = evaluate15(testNewPool);
          if (!testEval) continue;

          if (testEval.totalScore > bestSquadEval.totalScore) {
            bestSquadEval = testEval;
            bestSquadCandidates = testNewPool;
            bestTotalCost += costDelta;
            currentPool = testNewPool;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
  }

  // Fallback if knapsack didn't trigger
  if (!bestSquadCandidates || !bestSquadEval) {
    const default15 = [
      ...candidateGks.slice(0, 2),
      ...candidateDefs.slice(0, 5),
      ...candidateMids.slice(0, 5),
      ...candidateFwds.slice(0, 3)
    ];
    bestSquadEval = evaluate15(default15);
    bestSquadCandidates = default15;
    bestTotalCost = default15.reduce((s, p) => s + p.cost, 0);
  }

  if (!bestSquadEval || !bestSquadCandidates) return null;

  // Build the final ordered picks (Positions 1 to 15)
  const finalSquadPicks: SquadPick[] = [];
  const startersGk = bestSquadEval.starters.filter(p => p.pos === 1);
  const startersDef = bestSquadEval.starters.filter(p => p.pos === 2);
  const startersMid = bestSquadEval.starters.filter(p => p.pos === 3);
  const startersFwd = bestSquadEval.starters.filter(p => p.pos === 4);

  const orderedStarters = [...startersGk, ...startersDef, ...startersMid, ...startersFwd];
  const orderedBench = [...bestSquadEval.bench];

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

  // Calculate comparative gain against current squad
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
    cumulativePoints: Math.round(bestSquadEval.totalScore * (horizon || 1) * 10) / 10,
    horizon: horizon || 1,
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
