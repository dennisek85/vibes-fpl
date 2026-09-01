import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import bundledOdds from "@/data/match_odds.json";
import bundledPrices from "@/data/price_snapshots.json";
import bundledMomentum from "@/data/player_form_momentum.json";
import bundledEo from "@/data/top10k_ownership.json";

// In-memory cache to prevent excessive Redis hits
let cache: {
  timestamp: number;
  data: any;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
    console.warn("Telemetry Redis init warning:", err);
  }
  return null;
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const redis = getRedisClient();
  let matchOdds = bundledOdds;
  let priceSnapshots = bundledPrices;
  let formMomentum = bundledMomentum;
  let top10kOwnership = bundledEo;
  let source = "bundled";

  if (redis) {
    try {
      const [redisOdds, redisPrices, redisMomentum, redisEo] =
        await Promise.all([
          redis.get("fpl:match_odds"),
          redis.get("fpl:price_snapshots"),
          redis.get("fpl:form_momentum"),
          redis.get("fpl:top10k_eo"),
        ]);

      if (redisOdds) {
        matchOdds =
          typeof redisOdds === "string" ? JSON.parse(redisOdds) : redisOdds;
        source = "redis";
      }
      if (redisPrices) {
        priceSnapshots =
          typeof redisPrices === "string"
            ? JSON.parse(redisPrices)
            : redisPrices;
        source = "redis";
      }
      if (redisMomentum) {
        formMomentum =
          typeof redisMomentum === "string"
            ? JSON.parse(redisMomentum)
            : redisMomentum;
        source = "redis";
      }
      if (redisEo) {
        top10kOwnership =
          typeof redisEo === "string" ? JSON.parse(redisEo) : redisEo;
        source = "redis";
      }
    } catch (err) {
      console.warn(
        "Failed to load telemetry from Redis, falling back to static bundles:",
        err,
      );
    }
  }

  const responsePayload = {
    source,
    lastFetched: new Date().toISOString(),
    matchOdds,
    priceSnapshots,
    formMomentum,
    top10kOwnership,
  };

  cache = {
    timestamp: now,
    data: responsePayload,
  };

  return NextResponse.json(responsePayload);
}
