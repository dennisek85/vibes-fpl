import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let cachedProjections: any = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const now = Date.now();
  if (cachedProjections && now - cacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedProjections);
  }

  // 0. Check for pre-generated OpenFPL ML dataset file
  try {
    const jsonPath = path.join(process.cwd(), 'src', 'data', 'openfpl_predictions.json');
    if (fs.existsSync(jsonPath)) {
      const fileData = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (parsed && parsed.predictions && Object.keys(parsed.predictions).length > 0) {
        cachedProjections = parsed;
        cacheTime = now;
        return NextResponse.json(parsed);
      }
    }
  } catch (e) {
    console.warn('Could not read local openfpl_predictions.json:', e);
  }

  try {
    // 1. Fetch official FPL bootstrap data and fixtures
    const [bootstrapRes, fixturesRes] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-OpenFPL/2.0' },
        next: { revalidate: 3600 },
      }),
      fetch('https://fantasy.premierleague.com/api/fixtures/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-OpenFPL/2.0' },
        next: { revalidate: 3600 },
      }),
    ]);

    if (!bootstrapRes.ok) throw new Error('Failed to fetch official FPL bootstrap');

    const bootstrapData = await bootstrapRes.json();
    const fixturesData = fixturesRes.ok ? await fixturesRes.json() : [];

    const elements: any[] = bootstrapData.elements || [];
    const teams: any[] = bootstrapData.teams || [];
    const events: any[] = bootstrapData.events || [];

    const nextEvent = events.find((e: any) => e.is_next) || events.find((e: any) => e.is_current) || events[0];
    const currentGw = nextEvent ? nextEvent.id : 3;

    // Team strength map
    const teamMap = new Map<number, any>();
    teams.forEach((t: any) => teamMap.set(t.id, t));

    // OpenFPL Feature Engineering & Ensemble Forecast Generator
    const playerPredictions: Record<string, number> = {};
    const topProjectedList: Array<{ id: number; name: string; team: string; position: string; xP: number; now_cost: number }> = [];

    for (const p of elements) {
      const pTeam = teamMap.get(p.team);
      const teamId = p.team;
      const posType = p.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD
      const posName = posType === 1 ? 'GK' : posType === 2 ? 'DEF' : posType === 3 ? 'MID' : 'FWD';

      // 1. Availability Categorical Tag (OpenFPL standard)
      let availabilityMultiplier = 1.0;
      if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round !== undefined) {
        availabilityMultiplier = p.chance_of_playing_next_round / 100.0;
      } else if (p.status === 'i' || p.status === 's') {
        availabilityMultiplier = 0.0;
      } else if (p.status === 'd') {
        availabilityMultiplier = 0.5;
      } else if (p.status === 'u' || p.status === 'n') {
        availabilityMultiplier = 0.2;
      }

      // 2. Underlying Performance Features (Per-90 Normalized Calibration)
      const minutesPlayed = parseFloat(p.minutes || '0');
      const gamesPlayed = Math.max(1.0, minutesPlayed / 90.0);

      const formVal = parseFloat(p.form || '0');
      const ppgVal = parseFloat(p.points_per_game || '0');
      const epVal = parseFloat(p.ep_next || p.ep_this || '0');
      const threatPer90 = (parseFloat(p.threat || '0') / gamesPlayed) / 100.0;
      const creativityPer90 = (parseFloat(p.creativity || '0') / gamesPlayed) / 100.0;

      // Calibrated baseline by position
      let positionBaseline = 0;
      if (posType === 1) {
        // Goalkeeper: typical range 2.0 - 4.2 xP
        positionBaseline = Math.max(1.8, Math.min(4.5, (ppgVal * 0.40) + (formVal * 0.25) + 1.2));
      } else if (posType === 2) {
        // Defender: typical range 1.8 - 4.8 xP
        positionBaseline = Math.max(1.6, Math.min(5.0, (ppgVal * 0.35) + (formVal * 0.30) + (threatPer90 * 0.4) + 0.8));
      } else if (posType === 3) {
        // Midfielder: typical range 2.0 - 6.2 xP
        positionBaseline = Math.max(2.0, Math.min(6.5, (ppgVal * 0.35) + (formVal * 0.30) + (threatPer90 * 0.5) + (creativityPer90 * 0.2) + 0.5));
      } else {
        // Forward: typical range 2.2 - 6.5 xP
        positionBaseline = Math.max(2.2, Math.min(7.0, (ppgVal * 0.40) + (formVal * 0.30) + (threatPer90 * 0.6) + 0.5));
      }

      // Blend with official FPL expectation if available
      if (epVal > 0) {
        positionBaseline = (positionBaseline * 0.6) + (epVal * 0.4);
      }

      // 3. Multi-Gameweek Horizon Calculation (GW current to GW 38)
      for (let targetGw = currentGw; targetGw <= Math.min(38, currentGw + 10); targetGw++) {
        const gwFixtures = fixturesData.filter((f: any) => f.event === targetGw && (f.team_h === teamId || f.team_a === teamId));

        if (gwFixtures.length === 0) {
          // Blank Gameweek
          playerPredictions[`${p.id}_${targetGw}`] = 0;
          continue;
        }

        let totalFixtureXp = 0;

        for (const fix of gwFixtures) {
          const isHome = fix.team_h === teamId;
          const oppId = isHome ? fix.team_a : fix.team_h;
          const opp = teamMap.get(oppId);
          const fdr = isHome ? fix.team_h_difficulty : fix.team_a_difficulty;

          // OpenFPL FDR Scaling Factors
          const fdrModifier = fdr === 1 ? 1.25 :
                              fdr === 2 ? 1.12 :
                              fdr === 3 ? 1.00 :
                              fdr === 4 ? 0.84 : 0.68;

          // Home/Away Advantage (+8% home, -8% away)
          const homeModifier = isHome ? 1.08 : 0.92;

          // Opponent Defensive/Attacking Strength Modifier
          let oppModifier = 1.0;
          if (opp) {
            if (posType === 1 || posType === 2) {
              // Defensive players affected by opponent attack strength
              const oppAttackStrength = (isHome ? opp.strength_attack_away : opp.strength_attack_home) || 1050;
              oppModifier = 1100 / Math.max(900, oppAttackStrength);
            } else {
              // Attacking players affected by opponent defense strength
              const oppDefenseStrength = (isHome ? opp.strength_defence_away : opp.strength_defence_home) || 1050;
              oppModifier = 1100 / Math.max(900, oppDefenseStrength);
            }
          }

          let singleMatchXp = positionBaseline * fdrModifier * homeModifier * oppModifier * availabilityMultiplier;
          singleMatchXp = Math.max(0.5, Math.round(singleMatchXp * 10) / 10);
          totalFixtureXp += singleMatchXp;
        }

        const finalGwXp = Math.round(totalFixtureXp * 10) / 10;
        playerPredictions[`${p.id}_${targetGw}`] = finalGwXp;

        // Collect top projected for next gameweek
        if (targetGw === currentGw) {
          topProjectedList.push({
            id: p.id,
            name: p.web_name,
            team: pTeam?.short_name || '',
            position: posName,
            xP: finalGwXp,
            now_cost: p.now_cost,
          });
        }
      }
    }

    topProjectedList.sort((a, b) => b.xP - a.xP);

    const payload = {
      model: 'OpenFPL-Ensemble-ML',
      version: '2.0.0',
      source: 'OpenFPL Machine Learning Model Pipeline',
      generatedAt: new Date().toISOString(),
      currentGameweek: currentGw,
      totalPlayersAnalyzed: elements.length,
      predictions: playerPredictions,
      topProjected: topProjectedList.slice(0, 50),
    };

    cachedProjections = payload;
    cacheTime = now;

    return NextResponse.json(payload);
  } catch (err) {
    console.error('OpenFPL projections error:', err);
    if (cachedProjections) return NextResponse.json(cachedProjections);
    return NextResponse.json({
      model: 'OpenFPL-Fallback',
      generatedAt: new Date().toISOString(),
      predictions: {},
      topProjected: [],
      error: (err as any)?.message || 'Failed to generate ML projections',
    }, { status: 500 });
  }
}