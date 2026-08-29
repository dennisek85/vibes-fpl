import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SavedPlan } from '@/types/fpl';

declare global {
  var __plansMemoryCache: SavedPlan[] | undefined;
}

if (!globalThis.__plansMemoryCache) {
  globalThis.__plansMemoryCache = [];
}

function getPlansFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'plans.json');
  }
  const localDataDir = path.join(process.cwd(), '.data');
  return path.join(localDataDir, 'plans.json');
}

function readPlans(): SavedPlan[] {
  const filePath = getPlansFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      globalThis.__plansMemoryCache = parsed;
      return parsed;
    }
  } catch (err) {
    console.warn('Plans filesystem read warning:', err);
  }
  return globalThis.__plansMemoryCache || [];
}

function writePlans(plans: SavedPlan[]) {
  globalThis.__plansMemoryCache = plans;
  const filePath = getPlansFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(plans, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Plans filesystem write warning:', err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const allPlans = readPlans();

  if (teamId) {
    const filtered = allPlans.filter(p => p.teamId === parseInt(teamId, 10));
    return NextResponse.json(filtered);
  }

  return NextResponse.json(allPlans);
}

export async function POST(req: NextRequest) {
  try {
    const body: SavedPlan = await req.json();
    if (!body.teamId || !body.gameweekPlans) {
      return NextResponse.json({ error: 'Invalid plan data' }, { status: 400 });
    }

    const allPlans = readPlans();
    const existingIndex = allPlans.findIndex(p => p.id === body.id || (p.teamId === body.teamId && p.teamName === body.teamName));

    if (existingIndex >= 0) {
      allPlans[existingIndex] = { ...body, savedAt: new Date().toISOString() };
    } else {
      allPlans.unshift({
        ...body,
        id: body.id || `plan_${Date.now()}`,
        savedAt: new Date().toISOString(),
      });
    }

    writePlans(allPlans);
    return NextResponse.json({ success: true, count: allPlans.length });
  } catch (err: any) {
    console.error('Error saving plan:', err);
    return NextResponse.json({ error: 'Failed to save plan', details: err?.message }, { status: 500 });
  }
}