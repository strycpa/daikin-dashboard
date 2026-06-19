import { NextRequest, NextResponse } from "next/server";
import { fetchUnits } from "@/lib/daikin/client";

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get("siteId");

  try {
    const result = await fetchUnits(siteId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load devices";
    const status = message.includes("Not authenticated") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
