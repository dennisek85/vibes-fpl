import { NextResponse } from 'next/server';

let cachedProjections: any = null;
let cacheTime = 0;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (Solio updates every 4 hours)

export async function GET() {
  const now = Date.now();
  if (cachedProjections && now - cacheTime < CACHE_TTL_MS) {
    return NextResponse.json(cachedProjections);
  }

  try {
    const res = await fetch('https://fpl.solioanalytics.com/api/data/latest.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FPL-Planner-AI/1.0',
        'Accept': 'application/json',
      },
      next: { revalidate: 14400 },
    });

    if (res.ok) {
      const data = await res.json();
      cachedProjections = data;
      cacheTime = now;
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn('Could not fetch Solio analytics endpoint:', err);
  }

  if (cachedProjections) {
    return NextResponse.json(cachedProjections);
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    topProjected: [],
    source: 'fallback',
  });
}