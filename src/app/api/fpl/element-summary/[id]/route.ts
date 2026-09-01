import { NextRequest, NextResponse } from "next/server";

interface ElementSummaryCache {
  data: any;
  timestamp: number;
}

const summaryCache = new Map<number, ElementSummaryCache>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const playerId = parseInt(id, 10);

    if (isNaN(playerId)) {
      return NextResponse.json({ error: "Invalid player ID" }, { status: 400 });
    }

    const cached = summaryCache.get(playerId);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      });
    }

    const res = await fetch(
      `https://fantasy.premierleague.com/api/element-summary/${playerId}/`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
          Referer: "https://fantasy.premierleague.com/",
          Origin: "https://fantasy.premierleague.com",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Ch-Ua":
            '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
        },
        next: { revalidate: 3600 },
      },
    );

    if (!res.ok) {
      if (cached) {
        return NextResponse.json(cached.data);
      }
      console.warn(
        `FPL element-summary API returned status ${res.status} for player ${playerId}`,
      );
      // Graceful fallback response to prevent breaking the client with red 403 errors
      return NextResponse.json(
        {
          history: [],
          fixtures: [],
          history_past: [],
          status: "unavailable",
          note: `FPL API status ${res.status}`,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      );
    }

    const data = await res.json();
    summaryCache.set(playerId, { data, timestamp: now });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err: any) {
    console.error("Error fetching element summary:", err);
    return NextResponse.json(
      { history: [], fixtures: [], history_past: [], error: err?.message },
      { status: 200 },
    );
  }
}
