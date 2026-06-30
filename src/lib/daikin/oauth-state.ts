import { normalizeRedirectUriForOAuth } from "./oauth";
import { localOAuthReturnUri } from "./request-origin";

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

export { resolveOAuthReturnUri } from "./request-origin";

export function buildAllowedOAuthReturnUris(): string[] {
  const uris = [localOAuthReturnUri()];

  const publicUrl = process.env.DAIKIN_PUBLIC_URL?.trim();
  if (publicUrl) {
    uris.push(`${publicUrl.replace(/\/$/, "")}/api/auth/callback`);
  }

  return uris;
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
