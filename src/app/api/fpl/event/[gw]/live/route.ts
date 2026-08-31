import { NextRequest, NextResponse } from 'next/server';

const cache: Record<number, { data: any; time: number }> = {};
const CACHE_TTL = 60 * 1000; // 60 seconds (1 minute) for live match updates
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gw: string }> }
) {
  const { gw } = await params;
  const gwNum = parseInt(gw, 10);

  if (isNaN(gwNum) || gwNum < 1 || gwNum > 38) {
    return NextResponse.json({ error: 'Invalid Gameweek' }, { status: 400 });
  }

  const now = Date.now();
  if (cache[gwNum] && now - cache[gwNum].time < CACHE_TTL) {
    return NextResponse.json(cache[gwNum].data);
  }

  try {
    const res = await fetch(`https://fantasy.premierleague.com/api/event/${gwNum}/live/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner/1.0',
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json({ elements: [] });
    }

    const data = await res.json();
    const pointsMap: Record<number, number> = {};

    if (Array.isArray(data.elements)) {
      data.elements.forEach((el: any) => {
        pointsMap[el.id] = el.stats?.total_points || 0;
      });
    }

    cache[gwNum] = { data: pointsMap, time: now };
    return NextResponse.json(pointsMap);
  } catch (err) {
    console.warn(`Could not fetch live points for GW ${gwNum}:`, err);
    return NextResponse.json({});
  }
}