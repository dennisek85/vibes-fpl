import { NextResponse } from "next/server";

let cachedFixtures: any = null;
let lastFixturesFetch = 0;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (Fixtures rarely change)
export async function GET() {
  const now = Date.now();
  if (cachedFixtures && now - lastFixturesFetch < CACHE_TTL_MS) {
    return NextResponse.json(cachedFixtures);
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
    cachedFixtures = data;
    lastFixturesFetch = now;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching FPL fixtures:", error);
    if (cachedFixtures) return NextResponse.json(cachedFixtures);
    return NextResponse.json(
      { error: "Failed to fetch fixtures" },
      { status: 502 },
    );
  }
}
