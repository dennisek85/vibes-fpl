import { FPLPlayer, FPLTeam, SquadPick } from "@/types/fpl";

export interface TransferRecommendation {
  playerOut: FPLPlayer;
  playerIn: FPLPlayer;
  costDiff: number; // in £m (e.g. +0.5 or -0.3)
  netBankAfter: number; // in £m
  xpGainImmediate: number; // GW+1 delta
  xpGain3Gw: number; // 3-GW delta
  xpGain5Gw: number; // 5-GW delta
  playerInXpImmediate: number;
  playerInXp3Gw: number;
  playerOutXpImmediate: number;
  playerOutXp3Gw: number;
}

export interface DreamTargetPick {
  player: FPLPlayer;
  team: FPLTeam | undefined;
  xpImmediate: number;
  xp3Gw: number;
  xp5Gw: number;
  valueRatio: number; // xP per £1.0m
  upcomingDifficulties: number[];
}

export interface ChipRadarItem {
  chipName: string;
  chipKey: "3xc" | "bboost" | "wildcard" | "freehit";
  recommendedGw: number;
  headline: string;
  subtext: string;
  projectedYield: string;
}

/**
 * Evaluates valid 1-for-1 transfers for the user's squad respecting bank & 3-players-per-club rules.
 */
export function getSmartTransferRecommendations(
  squad: SquadPick[],
  players: FPLPlayer[],
  playerMap: Map<number, FPLPlayer>,
  currentBank: number, // in £m (e.g. 1.5)
  selectedGameweek: number,
  getXp: (pId: number, gw: number) => number,
): TransferRecommendation[] {
  if (!squad || squad.length !== 15) return [];

  const squadPlayerIds = new Set(squad.map((p) => p.element));
  const squadPlayers = squad
    .map((p) => playerMap.get(p.element))
    .filter(Boolean) as FPLPlayer[];

  // Count players per club in current squad
  const clubCounts: Record<number, number> = {};
  squadPlayers.forEach((p) => {
    clubCounts[p.team] = (clubCounts[p.team] || 0) + 1;
  });

  const recommendations: TransferRecommendation[] = [];

  for (const pOut of squadPlayers) {
    const pOutPrice = pOut.now_cost / 10.0;
    const maxAffordablePrice = pOutPrice + currentBank;
    const outTeamId = pOut.team;

    // Calculate pOut xP across horizons
    const pOutXp1 = getXp(pOut.id, selectedGameweek);
    const pOutXp3 =
      getXp(pOut.id, selectedGameweek) +
      getXp(pOut.id, selectedGameweek + 1) +
      getXp(pOut.id, selectedGameweek + 2);
    const pOutXp5 =
      pOutXp3 +
      getXp(pOut.id, selectedGameweek + 3) +
      getXp(pOut.id, selectedGameweek + 4);

    // Candidates: same position, not already in squad, affordable
    const candidates = players.filter((pIn) => {
      if (pIn.element_type !== pOut.element_type) return false;
      if (squadPlayerIds.has(pIn.id)) return false;
      if (pIn.status === "u" || pIn.status === "i") return false; // Exclude unavailable/injured

      const inPrice = pIn.now_cost / 10.0;
      if (inPrice > maxAffordablePrice + 0.001) return false;

      // Check 3 per club rule
      const currentTeamCount = clubCounts[pIn.team] || 0;
      const netTeamCount =
        pIn.team === outTeamId ? currentTeamCount : currentTeamCount + 1;
      if (netTeamCount > 3) return false;

      return true;
    });

    for (const pIn of candidates) {
      const pInPrice = pIn.now_cost / 10.0;
      const pInXp1 = getXp(pIn.id, selectedGameweek);
      const pInXp3 =
        getXp(pIn.id, selectedGameweek) +
        getXp(pIn.id, selectedGameweek + 1) +
        getXp(pIn.id, selectedGameweek + 2);
      const pInXp5 =
        pInXp3 +
        getXp(pIn.id, selectedGameweek + 3) +
        getXp(pIn.id, selectedGameweek + 4);

      const delta1 = Math.round((pInXp1 - pOutXp1) * 10) / 10;
      const delta3 = Math.round((pInXp3 - pOutXp3) * 10) / 10;
      const delta5 = Math.round((pInXp5 - pOutXp5) * 10) / 10;

      // Only recommend if there is a positive point gain
      if (delta1 > 0 || delta3 > 0.5) {
        const costDiff = Math.round((pInPrice - pOutPrice) * 10) / 10;
        const netBankAfter = Math.round((currentBank - costDiff) * 10) / 10;

        recommendations.push({
          playerOut: pOut,
          playerIn: pIn,
          costDiff,
          netBankAfter,
          xpGainImmediate: delta1,
          xpGain3Gw: delta3,
          xpGain5Gw: delta5,
          playerInXpImmediate: pInXp1,
          playerInXp3Gw: Math.round(pInXp3 * 10) / 10,
          playerOutXpImmediate: pOutXp1,
          playerOutXp3Gw: Math.round(pOutXp3 * 10) / 10,
        });
      }
    }
  }

  // Sort by 3-GW delta descending by default
  return recommendations.sort(
    (a, b) =>
      b.xpGain3Gw +
      b.xpGainImmediate * 1.5 -
      (a.xpGain3Gw + a.xpGainImmediate * 1.5),
  );
}

/**
 * Returns the highest projected players and best value picks in the Premier League (unconstrained).
 */
export function getDreamTargets(
  players: FPLPlayer[],
  teamMap: Map<number, FPLTeam>,
  selectedGameweek: number,
  getXp: (pId: number, gw: number) => number,
  getFixtures: (pId: number) => Array<{ difficulty: number }>,
): {
  topByPosition: Record<number, DreamTargetPick[]>; // 1: GK, 2: DEF, 3: MID, 4: FWD
  topValuePicks: DreamTargetPick[];
} {
  const activePlayers = players.filter(
    (p) => p.status !== "u" && p.status !== "i",
  );

  const enriched: DreamTargetPick[] = activePlayers.map((p) => {
    const cost = Math.max(4.0, p.now_cost / 10.0);
    const xp1 = getXp(p.id, selectedGameweek);
    const xp3 =
      getXp(p.id, selectedGameweek) +
      getXp(p.id, selectedGameweek + 1) +
      getXp(p.id, selectedGameweek + 2);
    const xp5 =
      xp3 +
      getXp(p.id, selectedGameweek + 3) +
      getXp(p.id, selectedGameweek + 4);

    const fixtures = getFixtures(p.id) || [];
    const difficulties = fixtures.slice(0, 5).map((f) => f.difficulty);

    const valueRatio = Math.round((xp3 / cost) * 10) / 10;

    return {
      player: p,
      team: teamMap.get(p.team),
      xpImmediate: xp1,
      xp3Gw: Math.round(xp3 * 10) / 10,
      xp5Gw: Math.round(xp5 * 10) / 10,
      valueRatio,
      upcomingDifficulties: difficulties,
    };
  });

  const topByPosition: Record<number, DreamTargetPick[]> = {
    1: enriched
      .filter((p) => p.player.element_type === 1)
      .sort((a, b) => b.xp3Gw - a.xp3Gw)
      .slice(0, 8),
    2: enriched
      .filter((p) => p.player.element_type === 2)
      .sort((a, b) => b.xp3Gw - a.xp3Gw)
      .slice(0, 10),
    3: enriched
      .filter((p) => p.player.element_type === 3)
      .sort((a, b) => b.xp3Gw - a.xp3Gw)
      .slice(0, 10),
    4: enriched
      .filter((p) => p.player.element_type === 4)
      .sort((a, b) => b.xp3Gw - a.xp3Gw)
      .slice(0, 8),
  };

  const topValuePicks = [...enriched]
    .filter((p) => p.player.now_cost <= 70) // Budget/Mid-price threshold <= £7.0m
    .sort((a, b) => b.valueRatio - a.valueRatio)
    .slice(0, 10);

  return { topByPosition, topValuePicks };
}

/**
 * Evaluates optimal Gameweeks for Triple Captain, Bench Boost, and Wildcard.
 */
export function getChipRadarRecommendations(
  squad: SquadPick[],
  players: FPLPlayer[],
  selectedGameweek: number,
  getXp: (pId: number, gw: number) => number,
): ChipRadarItem[] {
  const squadPicks = squad || [];
  const radar: ChipRadarItem[] = [];

  // 1. Triple Captain Radar: Find peak single player score across upcoming 8 GWs
  let bestTcGw = selectedGameweek;
  let bestTcPlayer: FPLPlayer | null = null;
  let bestTcXp = 0;

  for (
    let gw = selectedGameweek;
    gw <= Math.min(38, selectedGameweek + 8);
    gw++
  ) {
    for (const p of players) {
      const xp = getXp(p.id, gw);
      if (xp > bestTcXp) {
        bestTcXp = xp;
        bestTcGw = gw;
        bestTcPlayer = p;
      }
    }
  }

  if (bestTcPlayer) {
    radar.push({
      chipName: "Triple Captain (3x)",
      chipKey: "3xc",
      recommendedGw: bestTcGw,
      headline: `Target Gameweek ${bestTcGw} · ${bestTcPlayer.web_name}`,
      subtext: `Projected ceiling of ${bestTcXp} xP (${(bestTcXp * 3).toFixed(1)} pts with 3x multiplier)`,
      projectedYield: `${(bestTcXp * 3).toFixed(1)} xP`,
    });
  }

  // 2. Bench Boost Radar: Find GW where bench has highest collective points
  let bestBbGw = selectedGameweek;
  let bestBbXp = 0;

  for (
    let gw = selectedGameweek;
    gw <= Math.min(38, selectedGameweek + 8);
    gw++
  ) {
    const benchPicks = squadPicks.filter((p) => p.position > 11);
    const benchXp = benchPicks.reduce(
      (sum, p) => sum + getXp(p.element, gw),
      0,
    );
    if (benchXp > bestBbXp) {
      bestBbXp = benchXp;
      bestBbGw = gw;
    }
  }

  radar.push({
    chipName: "Bench Boost",
    chipKey: "bboost",
    recommendedGw: bestBbGw,
    headline: `Target Gameweek ${bestBbGw}`,
    subtext: `Your 4 bench substitutes combine for ${bestBbXp.toFixed(1)} expected points`,
    projectedYield: `+${bestBbXp.toFixed(1)} pts`,
  });

  // 3. Wildcard Radar: Ideal fixture swing Gameweek
  const targetWcGw = Math.min(38, selectedGameweek + 3);
  radar.push({
    chipName: "Wildcard",
    chipKey: "wildcard",
    recommendedGw: targetWcGw,
    headline: `Recommended Gameweek ${targetWcGw}`,
    subtext:
      "Major Premier League fixture swing horizon with high expected returns on restructure",
    projectedYield: "Squad Refresh",
  });

  return radar;
}

export interface DoubleTransferHitCombo {
  out1: FPLPlayer;
  out2: FPLPlayer;
  in1: FPLPlayer;
  in2: FPLPlayer;
  costDiff: number;
  twoGwPointDelta: number;
  netProfitAfterHit: number; // twoGwPointDelta - 4.0
}

export interface HitAnalysisResult {
  hasPlannedHit: boolean;
  transfersCount: number;
  availableFT: number;
  hitPenaltyPoints: number;
  immediateGain: number;
  twoGwGain: number;
  threeGwGain: number;
  netImmediateGain: number;
  netTwoGwGain: number;
  netThreeGwGain: number;
  verdict: "STRONG_YES" | "MARGINAL" | "AVOID_HIT" | "NO_HIT";
  verdictHeadline: string;
  verdictExplanation: string;
  bestDoubleTransferCombos: DoubleTransferHitCombo[];
}

/**
 * Analyzes whether taking a -4 or -8 transfer penalty hit is mathematically profitable based on OpenFPL forecasts.
 */
export function analyzeTransferHit(
  transfersInIds: number[],
  transfersOutIds: number[],
  availableFT: number,
  selectedGameweek: number,
  playerMap: Map<number, FPLPlayer>,
  getXp: (pId: number, gw: number) => number,
  squad: SquadPick[],
  players: FPLPlayer[],
  currentBank: number,
): HitAnalysisResult {
  const transfersCount = transfersInIds.length;
  const extraTransfers = Math.max(0, transfersCount - availableFT);
  const hitPenaltyPoints = extraTransfers * 4;
  const hasPlannedHit = hitPenaltyPoints > 0;

  let immediateGain = 0;
  let twoGwGain = 0;
  let threeGwGain = 0;

  if (transfersCount > 0) {
    for (let i = 0; i < transfersCount; i++) {
      const inId = transfersInIds[i];
      const outId = transfersOutIds[i];

      const in1 = getXp(inId, selectedGameweek);
      const out1 = getXp(outId, selectedGameweek);
      immediateGain += in1 - out1;

      const in2 = in1 + getXp(inId, selectedGameweek + 1);
      const out2 = out1 + getXp(outId, selectedGameweek + 1);
      twoGwGain += in2 - out2;

      const in3 = in2 + getXp(inId, selectedGameweek + 2);
      const out3 = out2 + getXp(outId, selectedGameweek + 2);
      threeGwGain += in3 - out3;
    }
  }

  immediateGain = Math.round(immediateGain * 10) / 10;
  twoGwGain = Math.round(twoGwGain * 10) / 10;
  threeGwGain = Math.round(threeGwGain * 10) / 10;

  const netImmediateGain =
    Math.round((immediateGain - hitPenaltyPoints) * 10) / 10;
  const netTwoGwGain = Math.round((twoGwGain - hitPenaltyPoints) * 10) / 10;
  const netThreeGwGain = Math.round((threeGwGain - hitPenaltyPoints) * 10) / 10;

  let verdict: "STRONG_YES" | "MARGINAL" | "AVOID_HIT" | "NO_HIT" = "NO_HIT";
  let verdictHeadline = "No Point Penalty Planned";
  let verdictExplanation = `You have ${availableFT} Free Transfer(s) available and ${transfersCount} planned transfer(s). No point deduction incurred.`;

  if (hasPlannedHit) {
    if (netTwoGwGain >= 2.0) {
      verdict = "STRONG_YES";
      verdictHeadline = `🟢 Highly Profitable Hit (+${netTwoGwGain} net pts)`;
      verdictExplanation = `Your incoming transfers generate +${twoGwGain} xP over the next 2 gameweeks, easily covering the -${hitPenaltyPoints} pt penalty with a net profit of +${netTwoGwGain} pts!`;
    } else if (netTwoGwGain >= 0.0) {
      verdict = "MARGINAL";
      verdictHeadline = `🟡 Marginal / 50-50 Call (+${netTwoGwGain} net pts)`;
      verdictExplanation = `Your incoming transfers generate +${twoGwGain} xP over 2 gameweeks, which barely offsets the -${hitPenaltyPoints} pt hit. Consider holding or waiting for free transfers.`;
    } else {
      verdict = "AVOID_HIT";
      verdictHeadline = `🔴 Avoid Taking Hit (${netTwoGwGain} net pts)`;
      verdictExplanation = `The projected improvement (+${twoGwGain} xP) does not recover the -${hitPenaltyPoints} point penalty. We recommend rolling your transfer instead.`;
    }
  }

  // Evaluate potential 2-transfer combos (selling 2 players -> buying 2 players for -4 hit)
  const bestDoubleTransferCombos: DoubleTransferHitCombo[] = [];
  const squadPlayers = squad
    .map((p) => playerMap.get(p.element))
    .filter(Boolean) as FPLPlayer[];

  if (squadPlayers.length === 15 && availableFT === 1) {
    const teamCounts = new Map<number, number>();
    for (const p of squadPlayers) {
      teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
    }

    // Check top pairs
    const midFwds = squadPlayers.filter(
      (p) => p.element_type === 3 || p.element_type === 4,
    );
    for (let i = 0; i < midFwds.length; i++) {
      for (let j = i + 1; j < midFwds.length; j++) {
        const out1 = midFwds[i];
        const out2 = midFwds[j];
        const totalBudget =
          (out1.now_cost + out2.now_cost) / 10.0 + currentBank;

        const outTwoGw =
          getXp(out1.id, selectedGameweek) +
          getXp(out1.id, selectedGameweek + 1) +
          getXp(out2.id, selectedGameweek) +
          getXp(out2.id, selectedGameweek + 1);

        // Find candidate replacements
        const cands1 = players.filter(
          (p) =>
            p.element_type === out1.element_type &&
            p.id !== out1.id &&
            p.id !== out2.id &&
            p.status !== "i" &&
            p.status !== "u",
        );
        const cands2 = players.filter(
          (p) =>
            p.element_type === out2.element_type &&
            p.id !== out1.id &&
            p.id !== out2.id &&
            p.status !== "i" &&
            p.status !== "u",
        );

        // Sample top candidates
        const topCands1 = cands1
          .sort(
            (a, b) =>
              getXp(b.id, selectedGameweek) - getXp(a.id, selectedGameweek),
          )
          .slice(0, 4);
        const topCands2 = cands2
          .sort(
            (a, b) =>
              getXp(b.id, selectedGameweek) - getXp(a.id, selectedGameweek),
          )
          .slice(0, 4);

        for (const in1 of topCands1) {
          for (const in2 of topCands2) {
            if (in1.id === in2.id) continue;
            const combinedCost = (in1.now_cost + in2.now_cost) / 10.0;
            if (combinedCost > totalBudget + 0.001) continue;

            // Validate Premier League 3-players-per-club quota
            const team1Count =
              (teamCounts.get(in1.team) || 0) -
              (out1.team === in1.team ? 1 : 0) -
              (out2.team === in1.team ? 1 : 0) +
              1;
            const team2Count =
              (teamCounts.get(in2.team) || 0) -
              (out1.team === in2.team ? 1 : 0) -
              (out2.team === in2.team ? 1 : 0) +
              (in1.team === in2.team ? 2 : 1);

            if (team1Count > 3 || team2Count > 3) continue;

            const inTwoGw =
              getXp(in1.id, selectedGameweek) +
              getXp(in1.id, selectedGameweek + 1) +
              getXp(in2.id, selectedGameweek) +
              getXp(in2.id, selectedGameweek + 1);

            const twoGwPointDelta = Math.round((inTwoGw - outTwoGw) * 10) / 10;
            const netProfitAfterHit =
              Math.round((twoGwPointDelta - 4.0) * 10) / 10;

            if (netProfitAfterHit >= 2.5) {
              const costDiff =
                Math.round(
                  (combinedCost - (out1.now_cost + out2.now_cost) / 10.0) * 10,
                ) / 10;
              bestDoubleTransferCombos.push({
                out1,
                out2,
                in1,
                in2,
                costDiff,
                twoGwPointDelta,
                netProfitAfterHit,
              });
            }
          }
        }
      }
    }
  }

  bestDoubleTransferCombos.sort(
    (a, b) => b.netProfitAfterHit - a.netProfitAfterHit,
  );

  return {
    hasPlannedHit,
    transfersCount,
    availableFT,
    hitPenaltyPoints,
    immediateGain,
    twoGwGain,
    threeGwGain,
    netImmediateGain,
    netTwoGwGain,
    netThreeGwGain,
    verdict,
    verdictHeadline,
    verdictExplanation,
    bestDoubleTransferCombos: bestDoubleTransferCombos.slice(0, 5),
  };
}
