import { NextResponse } from "next/server";
import { getCachedFixturesData } from "@/lib/fplServerCache";

export async function GET() {
  try {
    const data = await getCachedFixturesData();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error in /api/fpl/fixtures GET:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixtures" },
      { status: 502 },
    );
  }
}
