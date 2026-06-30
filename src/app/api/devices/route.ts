import { NextRequest, NextResponse } from "next/server";
import { fetchUnits } from "@/lib/daikin/client";

function parseGatewayDeviceIds(
  request: NextRequest,
): string[] | undefined {
  const raw = request.nextUrl.searchParams.get("gatewayDeviceIds");
  if (!raw) {
    return undefined;
  }

  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return ids.length > 0 ? ids : undefined;
}

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get("siteId");
  const gatewayDeviceIds = parseGatewayDeviceIds(request);
  const knownSiteCountRaw = request.nextUrl.searchParams.get("knownSiteCount");
  const knownSiteCount = knownSiteCountRaw
    ? Number.parseInt(knownSiteCountRaw, 10)
    : undefined;

  try {
    const result = await fetchUnits(siteId, {
      gatewayDeviceIds,
      knownSiteCount:
        knownSiteCount !== undefined && Number.isFinite(knownSiteCount)
          ? knownSiteCount
          : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load devices";
    const status = message.includes("Not authenticated") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
