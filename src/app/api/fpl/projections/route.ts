import { NextResponse } from 'next/server';
import { calculatePlayerOddsXp } from '@/utils/aiOddsEngine';

let cachedProjections: any = null;
let cacheTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes live cache

export async function GET() {
  const now = Date.now();
  if (cachedProjections && now - cacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedProjections);
  }

  try {
    // 1. Fetch live official FPL bootstrap data and fixtures
    const [bootstrapRes, fixturesRes] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-OpenFPL/2.0' },
        next: { revalidate: 900 },
      }),
      fetch('https://fantasy.premierleague.com/api/fixtures/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-OpenFPL/2.0' },
        next: { revalidate: 900 },
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

    // Dynamic Live ML & Odds-Integrated Forecast Generator
    const playerPredictions: Record<string, number> = {};
    const topProjectedList: Array<{ id: number; name: string; team: string; position: string; xP: number; now_cost: number }> = [];

    for (const p of elements) {
      const pTeam = teamMap.get(p.team);
      const teamId = p.team;
      const posType = p.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD
      const posName = posType === 1 ? 'GK' : posType === 2 ? 'DEF' : posType === 3 ? 'MID' : 'FWD';

      // 1. Availability probability from official FPL injury/fitness telemetry
      let availabilityMultiplier = 1.0;
      if (p.status === 'i' || p.status === 's' || p.status === 'u') {
        availabilityMultiplier = 0.0;
      } else if (p.chance_of_playing_next_round !== null && p.chance_of_playing_next_round !== undefined) {
        availabilityMultiplier = p.chance_of_playing_next_round / 100.0;
      } else if (p.status === 'd') {
        availabilityMultiplier = 0.5;
      }

      // 2. Underlying Performance Base Features
      const minutesPlayed = parseFloat(p.minutes || '0');
      const gamesPlayed = Math.max(1.0, minutesPlayed / 90.0);
      const formVal = parseFloat(p.form || '0');
      const ppgVal = parseFloat(p.points_per_game || '0');
      const epVal = parseFloat(p.ep_next || p.ep_this || '0');
      const threatPer90 = (parseFloat(p.threat || '0') / gamesPlayed) / 100.0;
      const creativityPer90 = (parseFloat(p.creativity || '0') / gamesPlayed) / 100.0;

      // Minutes per start damping
      let minutesDamping = 1.0;
      const starts = p.starts || (minutesPlayed > 0 ? 1 : 0);
      if (starts > 0) {
        const minsPerStart = minutesPlayed / starts;
        if (minsPerStart < 60) {
          minutesDamping = Math.max(0.4, minsPerStart / 90.0);
        }
      }

      // Position baseline points
      let positionBaseline = 0;
      if (posType === 1) {
        positionBaseline = Math.max(2.0, (ppgVal * 0.35) + (formVal * 0.25) + 1.2);
      } else if (posType === 2) {
        positionBaseline = Math.max(1.8, (ppgVal * 0.30) + (formVal * 0.25) + (threatPer90 * 0.4) + 0.8);
      } else if (posType === 3) {
        positionBaseline = Math.max(2.2, (ppgVal * 0.35) + (formVal * 0.30) + (threatPer90 * 0.5) + (creativityPer90 * 0.2) + 0.5);
      } else {
        positionBaseline = Math.max(2.5, (ppgVal * 0.40) + (formVal * 0.30) + (threatPer90 * 0.6) + 0.5);
      }

      if (epVal > 0) {
        positionBaseline = (positionBaseline * 0.55) + (epVal * 0.45);
      }

      // 3. Multi-Gameweek Fixture Calculation with Exact Match Expectancy & Poisson Clean Sheet
      for (let targetGw = currentGw; targetGw <= Math.min(38, currentGw + 10); targetGw++) {
        const gwFixtures = fixturesData.filter((f: any) => f.event === targetGw && (f.team_h === teamId || f.team_a === teamId));

        if (gwFixtures.length === 0) {
          playerPredictions[`${p.id}_${targetGw}`] = 0;
          continue;
        }

        let totalFixtureXp = 0;

        for (const fix of gwFixtures) {
          const isHome = fix.team_h === teamId;
          const oppId = isHome ? fix.team_a : fix.team_h;
          const oppTeam = teamMap.get(oppId);

          const calculatedMatchXp = calculatePlayerOddsXp(p, isHome, pTeam, oppTeam, positionBaseline);
          const finalMatchXp = Math.max(0.0, Math.round(calculatedMatchXp * availabilityMultiplier * minutesDamping * 10) / 10);
          totalFixtureXp += finalMatchXp;
        }

        const finalGwXp = Math.round(totalFixtureXp * 10) / 10;
        playerPredictions[`${p.id}_${targetGw}`] = finalGwXp;

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
      model: 'OpenFPL-LiveOdds-ML',
      version: '3.0.0',
      source: 'Live Official FPL Telemetry & Poisson Implied Match Odds',
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
    console.error('Projections route error:', err);
    if (cachedProjections) return NextResponse.json(cachedProjections);
    return NextResponse.json({
      model: 'OpenFPL-Fallback',
      generatedAt: new Date().toISOString(),
      predictions: {},
      topProjected: [],
    });
  }
}