import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/daikin/client";
import { loadDaikinConfig } from "@/lib/daikin/config";

export async function GET() {
  const config = loadDaikinConfig();

  if (config.demoMode) {
    return NextResponse.json({
      demoMode: true,
      url: null,
      message: "Running in demo mode — configure DAIKIN_CLIENT_ID to connect.",
    });
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("daikin_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.json({
    url: buildAuthorizationUrl(state),
    redirectUri: config.redirectUri,
    manualOAuth: config.manualOAuth,
  });
}
