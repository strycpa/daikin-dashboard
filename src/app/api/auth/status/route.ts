import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/daikin/client";

export async function GET() {
  const status = await getAuthStatus();
  return NextResponse.json(status);
}
