import { NextResponse } from "next/server";
import { fetchSites } from "@/lib/daikin/client";

export async function GET() {
  try {
    const sites = await fetchSites();
    return NextResponse.json({ sites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sites";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
