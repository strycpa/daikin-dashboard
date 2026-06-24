import { normalizeRedirectUriForOAuth } from "./oauth";

export interface OAuthProxyState {
  v: 1;
  /** Random nonce stored in the initiating app's cookie. */
  n: string;
  /** Full callback URL (with scheme) where the code should be delivered. */
  returnTo: string;
}

export function encodeOAuthProxyState(state: OAuthProxyState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeOAuthProxyState(raw: string): OAuthProxyState | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    return isOAuthProxyState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isOAuthProxyState(value: unknown): value is OAuthProxyState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "v" in value &&
    value.v === 1 &&
    "n" in value &&
    typeof value.n === "string" &&
    value.n.length > 0 &&
    "returnTo" in value &&
    typeof value.returnTo === "string" &&
    value.returnTo.length > 0
  );
}

export function normalizeOAuthEndpoint(uri: string): string {
  const parsed = new URL(normalizeRedirectUriForOAuth(uri));
  return `${parsed.host}${parsed.pathname}`.toLowerCase();
}

export function resolveOAuthReturnUri(requestOrigin?: string): string {
  const explicit = process.env.DAIKIN_OAUTH_RETURN_URI?.trim();
  if (explicit) {
    return explicit;
  }

  const publicUrl = process.env.DAIKIN_PUBLIC_URL?.trim();
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, "")}/api/auth/callback`;
  }

  if (requestOrigin) {
    return `${requestOrigin.replace(/\/$/, "")}/api/auth/callback`;
  }

  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT?.trim() || "3000";
    return `http://localhost:${port}/api/auth/callback`;
  }

  throw new Error(
    "Cannot resolve OAuth return URI. Set DAIKIN_OAUTH_RETURN_URI or DAIKIN_PUBLIC_URL.",
  );
}

export function buildAllowedOAuthReturnUris(): string[] {
  const fromEnv =
    process.env.DAIKIN_OAUTH_ALLOWED_RETURN_URIS?.split(",")
      .map((entry) => entry.trim())
      .filter(Boolean) ?? [];

  const defaults = [
    "http://localhost:3000/api/auth/callback",
    "http://127.0.0.1:3000/api/auth/callback",
  ];

  const publicUrl = process.env.DAIKIN_PUBLIC_URL?.trim();
  if (publicUrl) {
    defaults.push(`${publicUrl.replace(/\/$/, "")}/api/auth/callback`);
  }

  const returnUri = process.env.DAIKIN_OAUTH_RETURN_URI?.trim();
  if (returnUri) {
    defaults.push(returnUri);
  }

  const registeredRedirect = process.env.DAIKIN_REDIRECT_URI?.trim();
  if (registeredRedirect) {
    defaults.push(normalizeRedirectUriForOAuth(registeredRedirect));
  }

  return [...new Set([...defaults, ...fromEnv])];
}

export function isAllowedOAuthReturnUri(
  returnTo: string,
  allowed: readonly string[],
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(returnTo);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.pathname !== "/api/auth/callback") {
    return false;
  }

  const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  return allowed.some((allowedUri) => {
    try {
      const candidate = new URL(allowedUri);
      return (
        `${candidate.protocol}//${candidate.host}${candidate.pathname}` ===
        normalized
      );
    } catch {
      return false;
    }
  });
}

export function resolveOAuthNonce(state: string): {
  nonce: string;
  proxyState: OAuthProxyState | null;
} {
  const proxyState = decodeOAuthProxyState(state);
  if (proxyState) {
    return { nonce: proxyState.n, proxyState };
  }

  return { nonce: state, proxyState: null };
}

export function usesOAuthProxy(
  redirectUri: string,
  oauthReturnUri: string,
  manualOAuth: boolean,
): boolean {
  return (
    manualOAuth ||
    normalizeOAuthEndpoint(redirectUri) !==
      normalizeOAuthEndpoint(oauthReturnUri)
  );
}
