import fs from "node:fs/promises";
import path from "node:path";
import type { DaikinTokenSet } from "./types";

function parseTokenJson(raw: string): DaikinTokenSet | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed as DaikinTokenSet;
  } catch {
    return null;
  }
}

export async function readTokenFile(
  tokenFile: string,
): Promise<DaikinTokenSet | null> {
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

export async function writeTokenFile(
  tokenFile: string,
  token: DaikinTokenSet,
): Promise<void> {
  const enriched: DaikinTokenSet = { ...token };
  if (enriched.expires_in !== undefined && enriched.expires_at === undefined) {
    enriched.expires_at = Math.floor(Date.now() / 1000) + enriched.expires_in;
  }

  await fs.mkdir(path.dirname(tokenFile), { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify(enriched, null, 2), {
    mode: 0o600,
  });
}
