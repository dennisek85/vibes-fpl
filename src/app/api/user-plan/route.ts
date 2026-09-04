import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;
try {
  if (
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ) {
    redisClient = Redis.fromEnv();
  }
} catch (e) {
  console.warn("Redis client initialization note (falling back to memory):", e);
}

declare global {
  var __userPlansMemoryCache: Record<string, any> | undefined;
}

if (!globalThis.__userPlansMemoryCache) {
  globalThis.__userPlansMemoryCache = {};
}

function getStorageFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "user_plans.json");
  }
  const localDataDir = path.join(process.cwd(), ".data");
  return path.join(localDataDir, "user_plans.json");
}

function readLocalUserPlans(): Record<string, any> {
  const filePath = getStorageFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      globalThis.__userPlansMemoryCache = {
        ...globalThis.__userPlansMemoryCache,
        ...parsed,
      };
      return globalThis.__userPlansMemoryCache!;
    }
  } catch (err) {
    console.warn("Local read warning:", err);
  }
  return globalThis.__userPlansMemoryCache || {};
}

function writeLocalUserPlans(plans: Record<string, any>) {
  globalThis.__userPlansMemoryCache = plans;
  const filePath = getStorageFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(plans, null, 2), "utf-8");
  } catch (err) {
    console.warn("Local write warning:", err);
  }
}



export async function GET(_req: NextRequest) {
  // GET is no longer used for loading plans (PINs now sent via POST body).
  // Kept as a no-op to avoid 404s from any stale cached requests.
  return NextResponse.json({ exists: false, message: "Use POST to load plans" }, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── LOAD action: called by loadUserPlanByPin with hashed PIN ──────────────
    if (body.action === "load") {
      const { pinHash, teamId } = body;

      if (!pinHash || String(pinHash).length < 10) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }

      const hashKey = teamId
        ? `fpl_user_hash_${String(teamId).trim()}_${pinHash}`
        : `fpl_hash_${pinHash}`;

      // 1. Try Redis with new hashed key; fall back to legacy plaintext key (one-time migration)
      if (redisClient) {
        try {
          const redisPlan = await redisClient.get(hashKey);
          if (redisPlan) {
            const parsed =
              typeof redisPlan === "string" ? JSON.parse(redisPlan) : redisPlan;
            return NextResponse.json({ exists: true, plan: parsed });
          }

          // ── One-time migration: scan for old plaintext-keyed plan by teamId ──
          if (teamId) {
            const legacyPattern = `fpl_user_${String(teamId).trim()}_*`;
            try {
              const legacyKeys: string[] = await redisClient.keys(legacyPattern);
              const oldKey = legacyKeys.find((k) => !k.startsWith("fpl_user_hash_"));
              if (oldKey) {
                const legacyPlan = await redisClient.get(oldKey);
                if (legacyPlan) {
                  const parsed =
                    typeof legacyPlan === "string" ? JSON.parse(legacyPlan) : legacyPlan;
                  await redisClient.set(hashKey, JSON.stringify(parsed)).catch(() => {});
                  await redisClient.del(oldKey).catch(() => {});
                  return NextResponse.json({ exists: true, plan: parsed });
                }
              }
            } catch (scanErr) {
              console.warn("Legacy Redis key migration scan failed:", scanErr);
            }
          }
        } catch (redisErr) {
          console.warn("Redis read failed, trying local fallback:", redisErr);
        }
      }

      // 2. Fallback to local file storage with hashed key
      const allPlans = readLocalUserPlans();
      if (allPlans[hashKey]) {
        return NextResponse.json({ exists: true, plan: allPlans[hashKey] });
      }

      // ── One-time migration for local file storage ─────────────────────────────
      if (teamId) {
        const legacyKeyPrefix = `fpl_user_${String(teamId).trim()}_`;
        const legacyKey = Object.keys(allPlans).find(
          (k) => k.startsWith(legacyKeyPrefix) && !k.startsWith("fpl_user_hash_")
        );
        if (legacyKey && allPlans[legacyKey]) {
          const migratedPlan = allPlans[legacyKey];
          allPlans[hashKey] = migratedPlan;
          delete allPlans[legacyKey];
          writeLocalUserPlans(allPlans);
          return NextResponse.json({ exists: true, plan: migratedPlan });
        }
      }

      return NextResponse.json({ exists: false, message: "New workspace" }, { status: 200 });
    }

    const {
      pinHash,
      teamSummary,
      teamHistoryCurrent,
      playedChips,
      baseImportedPicks,
      showAiPredictions,
      startGameweek,
      selectedGameweek,
      initialBank,
      initialFreeTransfers,
      gameweekPlans,
    } = body;

    if (!pinHash || String(pinHash).length < 10) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const teamId = teamSummary?.id || null;
    const hashKey = teamId
      ? `fpl_user_hash_${String(teamId).trim()}_${pinHash}`
      : `fpl_hash_${pinHash}`;

    const planData = {
      teamId,
      updatedAt: new Date().toISOString(),
      teamSummary,
      teamHistoryCurrent: teamHistoryCurrent || [],
      playedChips: playedChips || [],
      baseImportedPicks: baseImportedPicks || [],
      showAiPredictions: !!showAiPredictions,
      startGameweek: startGameweek || 1,
      selectedGameweek: selectedGameweek || 3,
      initialBank: initialBank || 0,
      initialFreeTransfers: initialFreeTransfers || 1,
      gameweekPlans: gameweekPlans || {},
    };

    if (redisClient) {
      try {
        await redisClient.set(hashKey, JSON.stringify(planData));
      } catch (redisErr) {
        console.warn("Redis write failed:", redisErr);
      }
    }

    const allPlans = readLocalUserPlans();
    allPlans[hashKey] = planData;
    writeLocalUserPlans(allPlans);

    return NextResponse.json({ success: true, updatedAt: planData.updatedAt });
  } catch (error: any) {
    console.error("Error saving user plan:", error);
    return NextResponse.json(
      { error: "Failed to persist plan", details: error?.message },
      { status: 500 }
    );
  }
}
