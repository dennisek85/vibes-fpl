import { NextResponse } from "next/server";
import { calculatePlayerOddsXp } from "@/utils/aiOddsEngine";
import { Redis } from "@upstash/redis";
import { setCustomMatchOddsData } from "@/lib/oddsTracker";
import { setCustomFormMomentumData } from "@/lib/formTracker";

let cachedProjections: any = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds live cache

function getRedisClient(): Redis | null {
  try {
    if (
      (process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    ) {
      return Redis.fromEnv();
    }
  } catch (err) {
    console.warn("Projections Redis init warning:", err);
  }
  return null;
}

export async function GET() {
  const now = Date.now();
  if (cachedProjections && now - cacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedProjections);
  }

  try {
    // 0. Hydrate live telemetry from Redis if available
    const redis = getRedisClient();
    if (redis) {
      try {
        const [redisOdds, redisMomentum] = await Promise.all([
          redis.get("fpl:match_odds"),
          redis.get("fpl:form_momentum"),
        ]);
        if (redisOdds) {
          const parsedOdds =
            typeof redisOdds === "string" ? JSON.parse(redisOdds) : redisOdds;
          setCustomMatchOddsData(parsedOdds);
        }
        if (redisMomentum) {
          const parsedMomentum =
            typeof redisMomentum === "string"
              ? JSON.parse(redisMomentum)
              : redisMomentum;
          setCustomFormMomentumData(parsedMomentum);
        }
      } catch (err) {
        console.warn("Projections route Redis telemetry warning:", err);
      }
    }

    // 1. Fetch live official FPL bootstrap data and fixtures
    const [bootstrapRes, fixturesRes] = await Promise.all([
      fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-OpenFPL/2.0",
        },
        cache: "no-store",
      }),
      fetch("https://fantasy.premierleague.com/api/fixtures/", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-OpenFPL/2.0",
        },
        next: { revalidate: 900 },
      }),
    ]);

    if (!bootstrapRes.ok)
      throw new Error("Failed to fetch official FPL bootstrap");

    const bootstrapData = await bootstrapRes.json();
    const fixturesData = fixturesRes.ok ? await fixturesRes.json() : [];

    const elements: any[] = bootstrapData.elements || [];
    const teams: any[] = bootstrapData.teams || [];
    const events: any[] = bootstrapData.events || [];

    const nextEvent =
      events.find((e: any) => e.is_next) ||
      events.find((e: any) => e.is_current) ||
      events[0];
    const currentGw = nextEvent ? nextEvent.id : 3;

    // Team strength map
    const teamMap = new Map<number, any>();
    teams.forEach((t: any) => teamMap.set(t.id, t));

    // Dynamic Live ML & Odds-Integrated Forecast Generator (Bottom-Up xG/xA Model)
    const playerPredictions: Record<string, number> = {};
    const topProjectedList: Array<{
      id: number;
      name: string;
      team: string;
      position: string;
      xP: number;
      now_cost: number;
    }> = [];

    for (const p of elements) {
      const pTeam = teamMap.get(p.team);
      const teamId = p.team;
      const posType = p.element_type; // 1=GK, 2=DEF, 3=MID, 4=FWD
      const posName =
        posType === 1
          ? "GK"
          : posType === 2
            ? "DEF"
            : posType === 3
              ? "MID"
              : "FWD";

      // 1. Multi-Gameweek Fixture Calculation with Exact Match Expectancy & Poisson Clean Sheet
      for (
        let targetGw = currentGw;
        targetGw <= Math.min(38, currentGw + 10);
        targetGw++
      ) {
        const gwFixtures = fixturesData.filter(
          (f: any) =>
            f.event === targetGw &&
            (f.team_h === teamId || f.team_a === teamId),
        );

        if (gwFixtures.length === 0) {
          playerPredictions[`${p.id}_${targetGw}`] = 0;
          continue;
        }

        let totalFixtureXp = 0;

        for (const fix of gwFixtures) {
          const isHome = fix.team_h === teamId;
          const oppId = isHome ? fix.team_a : fix.team_h;
          const oppTeam = teamMap.get(oppId);

          const calculatedMatchXp = calculatePlayerOddsXp(
            p,
            isHome,
            pTeam,
            oppTeam,
            undefined,
            targetGw,
          );
          totalFixtureXp += calculatedMatchXp;
        }

        const finalGwXp = Math.round(totalFixtureXp * 10) / 10;
        playerPredictions[`${p.id}_${targetGw}`] = finalGwXp;

        if (targetGw === currentGw) {
          topProjectedList.push({
            id: p.id,
            name: p.web_name,
            team: pTeam?.short_name || "",
            position: posName,
            xP: finalGwXp,
            now_cost: p.now_cost,
          });
        }
      }
    }

    topProjectedList.sort((a, b) => b.xP - a.xP);

    const payload = {
      model: "OpenFPL-Benchmark-xG-xP",
      version: "3.1.0",
      source:
        "Live Official FPL Telemetry & Calibrated Bottom-Up xG/xA Expectancy",
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
    console.error("Projections route error:", err);
    if (cachedProjections) return NextResponse.json(cachedProjections);
    return NextResponse.json({
      model: "OpenFPL-Fallback",
      generatedAt: new Date().toISOString(),
      predictions: {},
      topProjected: [],
    });
  }
}
