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

// Build unique storage key: fpl_user_{teamId}_{pin} or fpl_pin_{pin}
function buildStorageKey(pin: string, teamId?: number | string | null): string {
  const cleanPin = String(pin).trim();
  if (teamId && String(teamId).trim()) {
    return `fpl_user_${String(teamId).trim()}_${cleanPin}`;
  }
  return `fpl_pin_${cleanPin}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get("pin");
  const teamId = searchParams.get("teamId");

  if (!pin || pin.trim().length < 4) {
    return NextResponse.json(
      { error: "PIN must be at least 4 digits" },
      { status: 400 },
    );
  }

  const cleanPin = pin.trim();
  const storageKey = buildStorageKey(cleanPin, teamId);

  // 1. Try Upstash Redis first
  if (redisClient) {
    try {
      let redisPlan = await redisClient.get(storageKey);

      // Fallback: If not found with teamId_pin, check legacy pin key
      if (!redisPlan && teamId) {
        redisPlan = await redisClient.get(`fpl_pin_${cleanPin}`);
      }

      if (redisPlan) {
        const parsed =
          typeof redisPlan === "string" ? JSON.parse(redisPlan) : redisPlan;
        return NextResponse.json({ exists: true, plan: parsed });
      } else {
        return NextResponse.json(
          { exists: false, message: "New workspace" },
          { status: 200 },
        );
      }
    } catch (redisErr) {
      console.warn("Redis read failed, trying local fallback:", redisErr);
    }
  }

  // 2. Fallback to local memory / temp storage
  const allPlans = readLocalUserPlans();
  const userPlan = allPlans[storageKey] || allPlans[cleanPin];

  if (!userPlan) {
    return NextResponse.json(
      { exists: false, message: "New workspace" },
      { status: 200 },
    );
  }

  return NextResponse.json({ exists: true, plan: userPlan });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pin,
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

    if (!pin || String(pin).trim().length < 4) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });
    }

    const cleanPin = String(pin).trim();
    const teamId = teamSummary?.id || null;
    const storageKey = buildStorageKey(cleanPin, teamId);

    const planData = {
      pin: cleanPin,
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

    // 1. Save to Upstash Redis if available
    if (redisClient) {
      try {
        await redisClient.set(storageKey, JSON.stringify(planData));
      } catch (redisErr) {
        console.warn("Redis write failed:", redisErr);
      }
    }

    // 2. Save to local storage cache
    const allPlans = readLocalUserPlans();
    allPlans[storageKey] = planData;
    allPlans[cleanPin] = planData; // Also keep pin mapping
    writeLocalUserPlans(allPlans);

    return NextResponse.json({ success: true, updatedAt: planData.updatedAt });
  } catch (error: any) {
    console.error("Error saving user plan:", error);
    return NextResponse.json(
      { error: "Failed to persist plan", details: error?.message },
      { status: 500 },
    );
  }
}
