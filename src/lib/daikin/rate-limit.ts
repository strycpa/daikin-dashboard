/** Daikin Onecta allows 20 requests/minute. Leave headroom for device-list GETs. */
export const DAIKIN_WRITE_MIN_INTERVAL_MS = 3_500;
export const DAIKIN_RATE_LIMIT_MAX_RETRIES = 3;
export const DAIKIN_RATE_LIMIT_DEFAULT_RETRY_MS = 15_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseRetryAfterMs(
  header: string | null,
  now = Date.now(),
): number | null {
  if (!header) {
    return null;
  }

  const trimmed = header.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) {
    return null;
  }

  return Math.max(0, dateMs - now);
}

export interface DaikinWritePacer {
  wait: () => Promise<void>;
}

export function createDaikinWritePacer(options?: {
  minIntervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): DaikinWritePacer {
  const minIntervalMs = options?.minIntervalMs ?? DAIKIN_WRITE_MIN_INTERVAL_MS;
  const now = options?.now ?? Date.now;
  const sleepFn = options?.sleep ?? sleep;
  let lastWriteAt: number | null = null;
  let chain: Promise<void> = Promise.resolve();

  function wait(): Promise<void> {
    const run = chain.then(async () => {
      if (lastWriteAt !== null) {
        const elapsed = now() - lastWriteAt;
        if (elapsed < minIntervalMs) {
          await sleepFn(minIntervalMs - elapsed);
        }
      }
      lastWriteAt = now();
    });

    chain = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  return { wait };
}

const defaultWritePacer = createDaikinWritePacer();

export function waitForDaikinWriteSlot(): Promise<void> {
  return defaultWritePacer.wait();
}
