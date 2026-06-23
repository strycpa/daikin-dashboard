import path from "node:path";
import { usesManualOAuthRedirect } from "./oauth";
import { buildAllowedOAuthReturnUris } from "./oauth-state";

export const AUTHORIZE_URL =
  "https://idp.onecta.daikineurope.com/v1/oidc/authorize";
export const TOKEN_URL = "https://idp.onecta.daikineurope.com/v1/oidc/token";
export const API_BASE_URL = "https://api.onecta.daikineurope.com";
export const DEFAULT_SCOPE =
  "openid onecta:basic.integration offline_access";

/** Matches Daikin Developer Portal format (no http:// prefix). */
export const DEFAULT_REDIRECT_URI = "localhost:3000/api/auth/callback";

export interface DaikinConfig {
  clientId: string;
  clientSecret: string;
  /** Redirect URI registered in Daikin Developer Portal (often without scheme). */
  redirectUri: string;
  manualOAuth: boolean;
  /** Whether OAuth completes via the shared prod callback proxy. */
  usesOAuthProxy: boolean;
  oauthAllowedReturnUris: string[];
  tokenFile: string;
  siteId: string | null;
  roomLabels: Record<string, string>;
  demoMode: boolean;
}

function parseRoomLabels(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const labels: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        labels[key] = value;
      }
    }
    return labels;
  } catch {
    return {};
  }
}

export function loadDaikinConfig(): DaikinConfig {
  const clientId = process.env.DAIKIN_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.DAIKIN_CLIENT_SECRET?.trim() ?? "";
  const demoMode =
    process.env.DAIKIN_DEMO_MODE === "true" ||
    (!clientId && process.env.NODE_ENV === "development");

  const redirectUri =
    process.env.DAIKIN_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  const manualOAuth = usesManualOAuthRedirect(redirectUri);

  return {
    clientId,
    clientSecret,
    redirectUri,
    manualOAuth,
    usesOAuthProxy: manualOAuth,
    oauthAllowedReturnUris: buildAllowedOAuthReturnUris(),
    tokenFile:
      process.env.DAIKIN_TOKEN_FILE?.trim() ??
      path.join(process.cwd(), ".data", "tokens.json"),
    siteId: process.env.DAIKIN_SITE_ID?.trim() || null,
    roomLabels: parseRoomLabels(process.env.DAIKIN_ROOM_LABELS),
    demoMode,
  };
}

export function requireCredentials(config: DaikinConfig): void {
  if (config.demoMode) {
    return;
  }
  if (!config.clientId) {
    throw new Error("DAIKIN_CLIENT_ID is not configured");
  }
  if (!config.clientSecret) {
    throw new Error("DAIKIN_CLIENT_SECRET is not configured");
  }
}
