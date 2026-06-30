import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationUrl } from "@/lib/daikin/client";
import { loadDaikinConfig } from "@/lib/daikin/config";
import {
  encodeOAuthProxyState,
  resolveOAuthReturnUri,
  usesOAuthProxy,
} from "@/lib/daikin/oauth-state";

export async function GET(request: NextRequest) {
  const config = loadDaikinConfig();

  if (config.demoMode) {
    return NextResponse.json({
      demoMode: true,
      url: null,
      message: "Running in demo mode — configure DAIKIN_CLIENT_ID to connect.",
    });
  }

  const nonce = randomBytes(24).toString("hex");
  const oauthReturnUri = resolveOAuthReturnUri(request);
  const proxyFlow = usesOAuthProxy(
    config.redirectUri,
    oauthReturnUri,
    config.manualOAuth,
  );
  const state = proxyFlow
    ? encodeOAuthProxyState({ v: 1, n: nonce, returnTo: oauthReturnUri })
    : nonce;

  const cookieStore = await cookies();
  cookieStore.set("daikin_oauth_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.json({
    url: buildAuthorizationUrl(state),
    redirectUri: config.redirectUri,
    oauthReturnUri,
    manualOAuth: config.manualOAuth,
    usesOAuthProxy: proxyFlow,
  });
}
