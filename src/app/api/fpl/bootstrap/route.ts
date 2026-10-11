import { NextResponse } from "next/server";
import {
  getCachedBootstrapData,
  getEffectiveBootstrapCacheTtlMs,
} from "@/lib/fplServerCache";

export async function GET() {
  try {
    const data = await getCachedBootstrapData();
    const effectiveTtl = getEffectiveBootstrapCacheTtlMs(data);
    const isNearDeadline = effectiveTtl <= 30 * 1000;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": isNearDeadline
          ? "public, s-maxage=30, stale-while-revalidate=60"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("Error in /api/fpl/bootstrap GET:", error);
    return NextResponse.json(
      {
        error:
          "Failed to fetch official FPL data. Please check connection or try again.",
      },
      { status: 502 },
    );
  }
}
