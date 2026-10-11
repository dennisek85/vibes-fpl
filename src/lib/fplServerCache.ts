import { updateAndGetPriceTelemetry } from "@/lib/priceTracker";

let cachedBootstrapData: any = null;
let lastBootstrapFetchTime = 0;

let cachedFixturesData: any = null;
let lastFixturesFetchTime = 0;
const FIXTURES_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (Fixtures rarely change)

export function getEffectiveBootstrapCacheTtlMs(data: any): number {
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

export async function getCachedBootstrapData(): Promise<any> {
  const now = Date.now();
  const effectiveTtl = getEffectiveBootstrapCacheTtlMs(cachedBootstrapData);
  if (cachedBootstrapData && now - lastBootstrapFetchTime < effectiveTtl) {
    return cachedBootstrapData;
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

    cachedBootstrapData = data;
    lastBootstrapFetchTime = now;
    return data;
  } catch (error: any) {
    console.error("Error fetching FPL bootstrap-static:", error);
    if (cachedBootstrapData) {
      return cachedBootstrapData;
    }
    throw error;
  }
}

export async function getCachedFixturesData(): Promise<any> {
  const now = Date.now();
  if (
    cachedFixturesData &&
    now - lastFixturesFetchTime < FIXTURES_CACHE_TTL_MS
  ) {
    return cachedFixturesData;
  }

  try {
    const res = await fetch("https://fantasy.premierleague.com/api/fixtures/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 7200 },
    });
    if (!res.ok) {
      throw new Error(`FPL API fixtures returned ${res.status}`);
    }

    const data = await res.json();
    cachedFixturesData = data;
    lastFixturesFetchTime = now;
    return data;
  } catch (error: any) {
    console.error("Error fetching FPL fixtures:", error);
    if (cachedFixturesData) return cachedFixturesData;
    throw error;
  }
}
