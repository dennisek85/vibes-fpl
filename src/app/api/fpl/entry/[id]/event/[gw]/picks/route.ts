import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; gw: string }> }
) {
  const { id, gw } = await params;
  const teamId = parseInt(id, 10);
  const gwNum = parseInt(gw, 10);

  if (isNaN(teamId) || isNaN(gwNum)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${gwNum}/picks/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch event picks' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error fetching event picks:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}