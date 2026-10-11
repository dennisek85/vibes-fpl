import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  generateGameweekAuditReport,
  calculateSeasonAccuracySummary,
  GameweekAuditReport,
} from "@/utils/aiCalibrationEngine";
import { calculatePlayerOddsXp } from "@/utils/aiOddsEngine";
import { FPLPlayer, FPLEvent, FPLFixture, FPLTeam } from "@/types/fpl";
import {
  getCachedBootstrapData,
  getCachedFixturesData,
} from "@/lib/fplServerCache";

let cache: {
  timestamp: number;
  data: any;
} | null = null;

const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

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
    console.warn("Accuracy route Redis init warning:", err);
  }
  return null;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const redis = getRedisClient();

    // 1. Re-use server-side cached bootstrap-static and fixtures
    const [bootstrapData, fixturesData] = await Promise.all([
      getCachedBootstrapData(),
      getCachedFixturesData().catch(() => []),
    ]);

    if (!bootstrapData?.elements) {
      return NextResponse.json({ error: "Failed to fetch FPL bootstrap data" }, { status: 502 });
    }

    const fixtures: FPLFixture[] = Array.isArray(fixturesData) ? fixturesData : [];

    const elements: FPLPlayer[] = bootstrapData.elements || [];
    const events: FPLEvent[] = bootstrapData.events || [];
    const teams: FPLTeam[] = bootstrapData.teams || [];

    const teamMap = new Map<number, FPLTeam>(teams.map((t) => [t.id, t]));
    const playerMap = new Map<number, FPLPlayer>(elements.map((p) => [p.id, p]));

    const finishedEvents = events.filter((e) => e.finished);
    const finishedGwIds = finishedEvents.map((e) => e.id);

    // 2. Fetch live event points for completed GWs
    const livePointsMap: Record<number, Record<number, number>> = {};
    await Promise.all(
      finishedGwIds.map(async (gwId) => {
        try {
          const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${gwId}/live/`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner/1.0" },
            next: { revalidate: 300 },
          });
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const gwPoints: Record<number, number> = {};
            if (Array.isArray(liveData.elements)) {
              for (const el of liveData.elements) {
                gwPoints[el.id] = el.stats?.total_points || 0;
              }
            }
            livePointsMap[gwId] = gwPoints;
          }
        } catch (err) {
          console.warn(`Accuracy route live points warning for GW${gwId}:`, err);
        }
      })
    );

    // 3. Helper to compute real xP across past gameweeks
    const getPlayerXp = (playerId: number, gw: number): number => {
      const p = playerMap.get(playerId);
      if (!p) return 2.0;

      const playerTeam = teamMap.get(p.team);
      const gwFixes = fixtures.filter(
        (f) => f.event === gw && (f.team_h === p.team || f.team_a === p.team)
      );
      if (gwFixes.length === 0) return 0.0;

      if (playerTeam) {
        let totalMatchXp = 0;
        for (const fix of gwFixes) {
          const isHome = fix.team_h === p.team;
          const oppTeam = teamMap.get(isHome ? fix.team_a : fix.team_h);
          totalMatchXp += calculatePlayerOddsXp(
            p,
            isHome,
            playerTeam,
            oppTeam,
            undefined,
            gw,
            {},
            finishedEvents.length
          );
        }
        return Math.round(totalMatchXp * 10) / 10;
      }
      return 2.5;
    };

    // 4. Generate audit reports and season summary
    const auditReports: GameweekAuditReport[] = finishedGwIds
      .map((gwId) =>
        generateGameweekAuditReport(
          gwId,
          elements,
          events,
          livePointsMap[gwId] || {},
          getPlayerXp,
          teamMap
        )
      )
      .sort((a, b) => b.gw - a.gw);

    const seasonSummary = calculateSeasonAccuracySummary(auditReports);

    const result = {
      seasonSummary,
      gameweeks: auditReports.map((r) => ({
        gw: r.gw,
        finalizedAt: r.finalizedAt,
        accuracy: r.accuracy,
        benchmark: r.benchmark,
        outliers: r.outliers,
      })),
      timestamp: new Date().toISOString(),
    };

    cache = { timestamp: now, data: result };

    // 5. Optionally cache into Redis if available
    if (redis) {
      try {
        await redis.set("fpl:accuracy_summary", JSON.stringify(result), { ex: 300 });
      } catch (err) {
        console.warn("Failed to persist accuracy summary to Redis:", err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Accuracy route error:", error);
    return NextResponse.json({ error: "Failed to calculate accuracy benchmarks" }, { status: 500 });
  }
}

/**
 * POST /api/fpl/accuracy - Snapshots predictions at pre-deadline lock
 */
export async function POST(req: NextRequest) {
  try {
    const redis = getRedisClient();
    if (!redis) {
      return NextResponse.json({ error: "Redis not configured for immutable snapshots" }, { status: 501 });
    }

    const body = await req.json().catch(() => ({}));
    const { gw, predictions } = body;

    if (!gw || !predictions || typeof predictions !== "object") {
      return NextResponse.json({ error: "Missing gw or predictions object" }, { status: 400 });
    }

    const snapshotKey = `fpl:snapshot:gw${gw}`;
    await redis.set(
      snapshotKey,
      JSON.stringify({
        gw,
        lockedAt: new Date().toISOString(),
        predictions,
      })
    );

    return NextResponse.json({ success: true, snapshotKey, gw });
  } catch (err: any) {
    console.error("Failed to snapshot deadline predictions:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
