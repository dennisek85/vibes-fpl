import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = parseInt(id, 10);

  if (isNaN(teamId) || teamId <= 0) {
    return NextResponse.json({ error: 'Invalid Team ID' }, { status: 400 });
  }

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    // 1. Fetch team summary
    const entryRes = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/`, {
      headers: { 'User-Agent': userAgent },
      cache: 'no-store',
    });

    if (!entryRes.ok) {
      return NextResponse.json({ error: `Team ID ${teamId} not found on official FPL.` }, { status: entryRes.status });
    }

    const entryData = await entryRes.json();
    const currentEvent = entryData.current_event || 1;

    // 2. Fetch team history & chips
    const historyRes = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/history/`, {
      headers: { 'User-Agent': userAgent },
      cache: 'no-store',
    });
    const historyData = historyRes.ok ? await historyRes.json() : { current: [], chips: [] };

    // 3. Fetch latest picks
    let picksData: any = null;
    for (let gw = currentEvent; gw >= 1; gw--) {
      const picksRes = await fetch(`https://fantasy.premierleague.com/api/entry/${teamId}/event/${gw}/picks/`, {
        headers: { 'User-Agent': userAgent },
        cache: 'no-store',
      });
      if (picksRes.ok) {
        picksData = await picksRes.json();
        break;
      }
    }

    if (!picksData) {
      return NextResponse.json({ error: `No picks found for team ${teamId}.` }, { status: 404 });
    }

    let initialFreeTransfers = 1;
    if (historyData.current?.length) {
      initialFreeTransfers = 1;
    }

    return NextResponse.json({
      entry: entryData,
      history: historyData,
      picks: picksData.picks,
      entry_history: picksData.entry_history,
      active_chip: picksData.active_chip,
      initialFreeTransfers,
    });
  } catch (error: any) {
    console.error('Error fetching FPL team:', error);
    return NextResponse.json({ error: 'Failed to fetch team data from FPL.' }, { status: 500 });
  }
}