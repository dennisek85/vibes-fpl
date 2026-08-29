import { NextRequest, NextResponse } from 'next/server';

interface ElementSummaryCache {
  data: any;
  timestamp: number;
}

const summaryCache = new Map<number, ElementSummaryCache>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 });
    }

    const cached = summaryCache.get(playerId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      });
    }

    const res = await fetch(`https://fantasy.premierleague.com/api/element-summary/${playerId}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      if (cached) {
        return NextResponse.json(cached.data);
      }
      return NextResponse.json({ error: 'Failed to fetch element summary' }, { status: res.status });
    }

    const data = await res.json();
    summaryCache.set(playerId, { data, timestamp: now });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (err: any) {
    console.error('Error fetching element summary:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err?.message }, { status: 500 });
  }
}