import type { NextRequest } from "next/server";

export function localOAuthReturnUri(): string {
  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}/api/auth/callback`;
}

function productionOAuthReturnUri(): string {
  const publicUrl = process.env.DAIKIN_PUBLIC_URL?.trim();
  if (!publicUrl) {
    throw new Error("DAIKIN_PUBLIC_URL is required outside local development.");
  }
  return `${publicUrl.replace(/\/$/, "")}/api/auth/callback`;
}

function isLocalRequest(request?: Pick<NextRequest, "nextUrl">): boolean {
  return request?.nextUrl.hostname === "localhost";
}

/** OAuth callback where this instance should receive the authorization code. */
export function resolveOAuthReturnUri(
  request?: Pick<NextRequest, "nextUrl">,
): string {
  if (isLocalRequest(request) || process.env.NODE_ENV === "development") {
    return localOAuthReturnUri();
  }

  return productionOAuthReturnUri();
}

/** Base URL for in-app redirects after OAuth (never 0.0.0.0). */
export function resolveAppBaseUrl(
  request?: Pick<NextRequest, "nextUrl">,
): string {
  if (isLocalRequest(request)) {
    return request.nextUrl.origin;
  }

  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT?.trim() || "3000";
    return `http://localhost:${port}`;
  }

  const publicUrl = process.env.DAIKIN_PUBLIC_URL?.trim();
  if (!publicUrl) {
    throw new Error("DAIKIN_PUBLIC_URL is required outside local development.");
  }

  return publicUrl.replace(/\/$/, "");
}

export function appRedirectUrl(
  request: Pick<NextRequest, "nextUrl">,
  pathnameWithSearch: string,
): URL {
  return new URL(pathnameWithSearch, `${resolveAppBaseUrl(request)}/`);
}
