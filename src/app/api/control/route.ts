import { NextRequest, NextResponse } from "next/server";
import {
  applyBatchControl,
  applyHouseClimate,
  applyUnitControl,
  fetchUnits,
} from "@/lib/daikin/client";
import {
  isHouseClimateAction,
  readHouseClimateRestore,
} from "@/lib/daikin/house-climate";
import { validateControlPayload } from "@/lib/daikin/parser";
import type {
  OperationMode,
  PowerState,
  UnitControlPayload,
} from "@/lib/daikin/types";
import { OPERATION_MODES } from "@/lib/utils";

/** House-wide climate can take over a minute: one PATCH per characteristic, paced for Daikin's 20 req/min cap. */
export const maxDuration = 180;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalSiteId(body: Record<string, unknown>): string | null {
  return typeof body.siteId === "string" ? body.siteId : null;
}

function isPowerState(value: unknown): value is PowerState {
  return value === "on" || value === "off";
}

function isOperationMode(value: unknown): value is OperationMode {
  return (
    typeof value === "string" &&
    OPERATION_MODES.some((mode) => mode === value)
  );
}

function readOptionalPower(
  body: Record<string, unknown>,
): PowerState | undefined {
  return isPowerState(body.power) ? body.power : undefined;
}

function readOptionalMode(
  body: Record<string, unknown>,
): OperationMode | undefined {
  return isOperationMode(body.mode) ? body.mode : undefined;
}

function readOptionalNumber(
  body: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof body[key] === "number" ? body[key] : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Invalid control payload" }, { status: 400 });
    }

    const siteId = readOptionalSiteId(body);
    const { units } = await fetchUnits(siteId);

    if (isHouseClimateAction(body.houseClimate)) {
      const result = await applyHouseClimate(
        units,
        body.houseClimate,
        readHouseClimateRestore(body.restore),
      );
      return NextResponse.json(result);
    }

    if (Array.isArray(body.deviceIds) && body.deviceIds.every((id) => typeof id === "string")) {
      const result = await applyBatchControl(units, body.deviceIds, {
        power: readOptionalPower(body),
        mode: readOptionalMode(body),
        setpointC: readOptionalNumber(body, "setpointC"),
        fanSpeed: readOptionalNumber(body, "fanSpeed"),
      });
      return NextResponse.json(result);
    }

    if (typeof body.deviceId === "string") {
      const payload: UnitControlPayload = {
        deviceId: body.deviceId,
        power: readOptionalPower(body),
        mode: readOptionalMode(body),
        setpointC: readOptionalNumber(body, "setpointC"),
        fanSpeed: readOptionalNumber(body, "fanSpeed"),
      };
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
