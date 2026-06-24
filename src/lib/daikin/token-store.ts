import fs from "node:fs/promises";
import path from "node:path";
import {
  readCurrentTokenFromFirestore,
  writeCurrentTokenToFirestore,
} from "./firestore-tokens";
import type { DaikinTokenSet } from "./types";

export type TokenBackend = "firestore" | "file";

export interface TokenStoreContext {
  backend: TokenBackend;
  householdId: string;
  tokenFile: string;
  gcpProjectId: string | null;
}

function parseTokenJson(raw: string): DaikinTokenSet | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    if (
      !("access_token" in parsed) ||
      typeof parsed.access_token !== "string" ||
      parsed.access_token.length === 0
    ) {
      return null;
    }

    return {
      access_token: parsed.access_token,
      refresh_token:
        "refresh_token" in parsed && typeof parsed.refresh_token === "string"
          ? parsed.refresh_token
          : undefined,
      expires_in:
        "expires_in" in parsed && typeof parsed.expires_in === "number"
          ? parsed.expires_in
          : undefined,
      expires_at:
        "expires_at" in parsed && typeof parsed.expires_at === "number"
          ? parsed.expires_at
          : undefined,
      token_type:
        "token_type" in parsed && typeof parsed.token_type === "string"
          ? parsed.token_type
          : undefined,
      scope:
        "scope" in parsed && typeof parsed.scope === "string"
          ? parsed.scope
          : undefined,
    };
  } catch {
    return null;
  }
}

function enrichToken(token: DaikinTokenSet): DaikinTokenSet {
  const enriched: DaikinTokenSet = { ...token };
  if (enriched.expires_in !== undefined && enriched.expires_at === undefined) {
    enriched.expires_at = Math.floor(Date.now() / 1000) + enriched.expires_in;
  }
  return enriched;
}

async function readTokenFromFile(tokenFile: string): Promise<DaikinTokenSet | null> {
  const fromEnv = process.env.DAIKIN_TOKENS_JSON?.trim();
  if (fromEnv) {
    const token = parseTokenJson(fromEnv);
    if (token) {
      return token;
    }
  }

  try {
    const raw = await fs.readFile(tokenFile, "utf8");
    return parseTokenJson(raw);
  } catch {
    return null;
  }
}

async function writeTokenToFile(
  tokenFile: string,
  token: DaikinTokenSet,
): Promise<void> {
  const enriched = enrichToken(token);
  await fs.mkdir(path.dirname(tokenFile), { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify(enriched, null, 2), {
    mode: 0o600,
  });
}

export async function readStoredToken(
  context: TokenStoreContext,
): Promise<DaikinTokenSet | null> {
  if (context.backend === "firestore") {
    if (!context.gcpProjectId) {
      throw new Error(
        "Firestore token backend requires GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.",
      );
    }

    const fromFirestore = await readCurrentTokenFromFirestore(
      context.gcpProjectId,
      context.householdId,
    );
    if (fromFirestore) {
      return fromFirestore;
    }

    const legacy = await readTokenFromFile(context.tokenFile);
    if (legacy) {
      await writeCurrentTokenToFirestore(
        context.gcpProjectId,
        context.householdId,
        legacy,
      );
      return legacy;
    }

    return null;
  }

  return readTokenFromFile(context.tokenFile);
}

export async function writeStoredToken(
  context: TokenStoreContext,
  token: DaikinTokenSet,
): Promise<void> {
  const enriched = enrichToken(token);

  if (context.backend === "firestore") {
    if (!context.gcpProjectId) {
      throw new Error(
        "Firestore token backend requires GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT.",
      );
    }

    await writeCurrentTokenToFirestore(
      context.gcpProjectId,
      context.householdId,
      enriched,
    );
    return;
  }

  await writeTokenToFile(context.tokenFile, enriched);
}

/** @deprecated Use readStoredToken with TokenStoreContext */
export async function readTokenFile(
  tokenFile: string,
): Promise<DaikinTokenSet | null> {
  return readTokenFromFile(tokenFile);
}

/** @deprecated Use writeStoredToken with TokenStoreContext */
export async function writeTokenFile(
  tokenFile: string,
  token: DaikinTokenSet,
): Promise<void> {
  await writeTokenToFile(tokenFile, token);
}
