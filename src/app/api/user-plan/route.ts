import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');
const USER_PLANS_FILE = path.join(DATA_DIR, 'user_plans.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USER_PLANS_FILE)) {
    fs.writeFileSync(USER_PLANS_FILE, JSON.stringify({}), 'utf-8');
  }
}

function readUserPlans(): Record<string, any> {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(USER_PLANS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeUserPlans(plans: Record<string, any>) {
  ensureDataFile();
  fs.writeFileSync(USER_PLANS_FILE, JSON.stringify(plans, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get('pin');

  if (!pin || pin.trim().length < 4) {
    return NextResponse.json({ error: 'PIN must be at least 4 digits' }, { status: 400 });
  }

  const allPlans = readUserPlans();
  const userPlan = allPlans[pin.trim()];

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

    if (!pin || pin.trim().length < 4) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 });
    }

    const allPlans = readUserPlans();
    allPlans[pin.trim()] = {
      pin: pin.trim(),
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

    writeUserPlans(allPlans);
    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('Error saving user plan:', error);
    return NextResponse.json({ error: 'Failed to persist plan' }, { status: 500 });
  }
}