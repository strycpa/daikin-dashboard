import { NextResponse } from "next/server";
import { loadDaikinConfig } from "@/lib/daikin/config";
import {
  readDeviceNames,
  writeDeviceName,
} from "@/lib/daikin/firestore-device-names";

export async function GET(): Promise<NextResponse> {
  try {
    const config = loadDaikinConfig();

    if (!config.gcpProjectId) {
      return NextResponse.json(
        { error: "GCP_PROJECT_ID not configured" },
        { status: 500 },
      );
    }

    const deviceNames = await readDeviceNames(
      config.gcpProjectId,
      config.householdId,
    );

    return NextResponse.json({ deviceNames });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load device names",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const config = loadDaikinConfig();

    if (!config.gcpProjectId) {
      return NextResponse.json(
        { error: "GCP_PROJECT_ID not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      deviceId: string;
      customName: string | null;
      cloudName?: string | null;
    };

    if (!body.deviceId || typeof body.deviceId !== "string") {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 },
      );
    }

    if (body.customName !== null && typeof body.customName !== "string") {
      return NextResponse.json(
        { error: "customName must be a string or null" },
        { status: 400 },
      );
    }

    await writeDeviceName(
      config.gcpProjectId,
      config.householdId,
      body.deviceId,
      body.customName,
      body.cloudName ?? null,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save device name",
      },
      { status: 500 },
    );
  }
}
