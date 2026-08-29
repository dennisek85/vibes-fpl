import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SavedPlan } from '@/types/fpl';

const DATA_DIR = path.join(process.cwd(), '.data');
const PLANS_FILE = path.join(DATA_DIR, 'plans.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PLANS_FILE)) {
    fs.writeFileSync(PLANS_FILE, JSON.stringify([]), 'utf-8');
  }
}

function readPlans(): SavedPlan[] {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(PLANS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writePlans(plans: SavedPlan[]) {
  ensureDataFile();
  fs.writeFileSync(PLANS_FILE, JSON.stringify(plans, null, 2), 'utf-8');
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
        id: body.id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        savedAt: new Date().toISOString(),
      });
    }

    writePlans(allPlans);
    return NextResponse.json({ success: true, plan: body });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 });
  }
}