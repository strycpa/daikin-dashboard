/** Ensures redirect_uri sent to Daikin includes an explicit scheme. */
export function normalizeRedirectUriForOAuth(redirectUri: string): string {
  const trimmed = redirectUri.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^https:\/\//i.test(trimmed) || /^http:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const isLocalhost =
    /^localhost(?::\d+)?(?:\/|$)/i.test(trimmed) ||
    /^127\.0\.0\.1(?::\d+)?(?:\/|$)/i.test(trimmed);

  return `${isLocalhost ? "http" : "https"}://${trimmed}`;
}

export function usesManualOAuthRedirect(redirectUri: string): boolean {
  try {
    const parsed = new URL(normalizeRedirectUriForOAuth(redirectUri));
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function parseOAuthInput(input: string): {
  code: string;
  state: string | null;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Vlož authorization code nebo celou callback URL z konzole.");
  }

  if (trimmed.includes("code=")) {
    let urlText = trimmed;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      const queryIndex = trimmed.indexOf("?");
      const pathPart = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
      const queryPart = queryIndex >= 0 ? trimmed.slice(queryIndex) : "";
      urlText = normalizeRedirectUriForOAuth(pathPart) + queryPart;
    }

    let url: URL;
    try {
      url = new URL(urlText);
    } catch {
      throw new Error("Nepodařilo se přečíst callback URL.");
    }

    const code = url.searchParams.get("code");
    if (!code) {
      throw new Error("V URL chybí parametr code.");
    }

    return { code, state: url.searchParams.get("state") };
  }

  return { code: trimmed, state: null };
}
