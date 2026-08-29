import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Global in-memory cache for serverless environments
declare global {
  var __userPlansMemoryCache: Record<string, any> | undefined;
}

if (!globalThis.__userPlansMemoryCache) {
  globalThis.__userPlansMemoryCache = {};
}

function getStorageFilePath(): string {
  // If in Vercel or read-only lambda, write to /tmp
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'user_plans.json');
  }
  const localDataDir = path.join(process.cwd(), '.data');
  return path.join(localDataDir, 'user_plans.json');
}

function readUserPlans(): Record<string, any> {
  const filePath = getStorageFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      globalThis.__userPlansMemoryCache = { ...globalThis.__userPlansMemoryCache, ...parsed };
      return globalThis.__userPlansMemoryCache!;
    }
  } catch (err) {
    console.warn('Filesystem read warning, using memory cache:', err);
  }
  return globalThis.__userPlansMemoryCache || {};
}

function writeUserPlans(plans: Record<string, any>) {
  globalThis.__userPlansMemoryCache = plans;
  const filePath = getStorageFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(plans, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Filesystem write warning (in-memory cached):', err);
  }
}

// Optional Upstash / Vercel KV cloud persistence if configured
async function saveToKvIfConfigured(pin: string, data: any) {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return;

  try {
    await fetch(`${kvUrl}/set/fpl_pin_${pin}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.warn('KV save warning:', e);
  }
}

async function getFromKvIfConfigured(pin: string): Promise<any | null> {
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!kvUrl || !kvToken) return null;

  try {
    const res = await fetch(`${kvUrl}/get/fpl_pin_${pin}`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    }
  } catch (e) {
    console.warn('KV get warning:', e);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get('pin');

  if (!pin || pin.trim().length < 4) {
    return NextResponse.json({ error: 'PIN must be at least 4 digits' }, { status: 400 });
  }

  const cleanPin = pin.trim();

  // 1. Try Cloud KV if configured
  const kvPlan = await getFromKvIfConfigured(cleanPin);
  if (kvPlan) {
    return NextResponse.json({ exists: true, plan: kvPlan });
  }

  // 2. Read from memory / temp storage
  const allPlans = readUserPlans();
  const userPlan = allPlans[cleanPin];

  if (!userPlan) {
    return NextResponse.json({ exists: false, message: 'New PIN workspace' }, { status: 200 });
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
      gameweekPlans 
    } = body;

    if (!pin || String(pin).trim().length < 4) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 });
    }

    const cleanPin = String(pin).trim();
    const allPlans = readUserPlans();

    const planData = {
      pin: cleanPin,
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

    allPlans[cleanPin] = planData;
    writeUserPlans(allPlans);

    // Also persist to KV in background if configured
    saveToKvIfConfigured(cleanPin, planData).catch(() => {});

    return NextResponse.json({ success: true, updatedAt: planData.updatedAt });
  } catch (error: any) {
    console.error('Error saving user plan:', error);
    return NextResponse.json({ error: 'Failed to persist plan', details: error?.message }, { status: 500 });
  }
}