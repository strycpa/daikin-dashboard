export function usesManualOAuthRedirect(redirectUri: string): boolean {
  return !/^https?:\/\//i.test(redirectUri);
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
    const urlText = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;

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
