import { NextRequest, NextResponse } from "next/server";
import {
  applyBatchControl,
  applyUnitControl,
  fetchUnits,
} from "@/lib/daikin/client";
import { validateControlPayload } from "@/lib/daikin/parser";
import type { BatchControlPayload, UnitControlPayload } from "@/lib/daikin/types";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const siteId =
      typeof body === "object" &&
      body !== null &&
      "siteId" in body &&
      typeof body.siteId === "string"
        ? body.siteId
        : null;

    const { units } = await fetchUnits(siteId);

    if (
      typeof body === "object" &&
      body !== null &&
      "deviceIds" in body &&
      Array.isArray(body.deviceIds)
    ) {
      const batch = body as BatchControlPayload;
      const changes = {
        power: batch.power,
        mode: batch.mode,
        setpointC: batch.setpointC,
        fanSpeed: batch.fanSpeed,
      };

      const result = await applyBatchControl(
        units,
        batch.deviceIds,
        changes,
      );
      return NextResponse.json(result);
    }

    if (
      typeof body === "object" &&
      body !== null &&
      "deviceId" in body &&
      typeof body.deviceId === "string"
    ) {
      const payload = body as UnitControlPayload;
      const unit = units.find((item) => item.id === payload.deviceId);
      if (!unit) {
        return NextResponse.json(
          { error: `Unknown device ${payload.deviceId}` },
          { status: 404 },
        );
      }

      const validated = validateControlPayload(unit, payload);
      await applyUnitControl(units, validated);
      return NextResponse.json({ ok: true, deviceId: payload.deviceId });
    }

    return NextResponse.json({ error: "Invalid control payload" }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Control request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
