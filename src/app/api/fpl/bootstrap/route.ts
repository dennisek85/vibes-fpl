import { NextResponse } from "next/server";
import { updateAndGetPriceTelemetry } from "@/lib/priceTracker";

let cachedData: any = null;
let lastFetchTime = 0;

function getEffectiveCacheTtlMs(data: any): number {
  if (!data?.events || !Array.isArray(data.events)) {
    return 5 * 60 * 1000;
  }
  const nextEvent = data.events.find((e: any) => e.is_next);
  if (nextEvent?.deadline_time) {
    const deadlineMs = new Date(nextEvent.deadline_time).getTime();
    const msUntilDeadline = deadlineMs - Date.now();
    // Within 60 minutes of deadline: drop cache TTL to 30 seconds for live team & injury news
    if (msUntilDeadline > 0 && msUntilDeadline <= 60 * 60 * 1000) {
      return 30 * 1000;
    }
  }
  return 5 * 60 * 1000;
}

export async function GET() {
  const now = Date.now();
  const effectiveTtl = getEffectiveCacheTtlMs(cachedData);
  if (cachedData && now - lastFetchTime < effectiveTtl) {
    const isNearDeadline = effectiveTtl <= 30 * 1000;
    return NextResponse.json(cachedData, {
      headers: {
        "Cache-Control": isNearDeadline
          ? "public, s-maxage=30, stale-while-revalidate=60"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  try {
    const res = await fetch(
      "https://fantasy.premierleague.com/api/bootstrap-static/",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      throw new Error(`FPL API responded with status ${res.status}`);
    }

    const data = await res.json();

    // Process live elements through the persistent price baseline tracker
    if (Array.isArray(data.elements)) {
      const { dailyDeltas } = updateAndGetPriceTelemetry(data.elements);
      data.elements.forEach((p: any) => {
        if (dailyDeltas[p.id]) {
          p.priceTelemetry = dailyDeltas[p.id];
        }
      });
    }

    cachedData = data;
    lastFetchTime = now;

    const isNearDeadline = getEffectiveCacheTtlMs(data) <= 30 * 1000;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isNearDeadline
          ? "public, s-maxage=30, stale-while-revalidate=60"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("Error fetching FPL bootstrap-static:", error);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }
    return NextResponse.json(
      {
        error:
          "Failed to fetch official FPL data. Please check connection or try again.",
      },
      { status: 502 },
    );
  }
}
