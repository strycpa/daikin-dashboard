const DEFAULT_TTL_MS = 3_000;

interface CacheSlot<T> {
  value?: T;
  expiresAt: number;
  pending?: Promise<T>;
}

function createCacheSlot<T>(): CacheSlot<T> {
  return { expiresAt: 0 };
}

export function createShortLivedCache<T>(ttlMs = DEFAULT_TTL_MS) {
  const slot = createCacheSlot<T>();

  return async function getCached(fetcher: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (slot.value !== undefined && slot.expiresAt > now) {
      return slot.value;
    }

    if (slot.pending) {
      return slot.pending;
    }

    slot.pending = fetcher()
      .then((value) => {
        slot.value = value;
        slot.expiresAt = Date.now() + ttlMs;
        slot.pending = undefined;
        return value;
      })
      .catch((error: unknown) => {
        slot.pending = undefined;
        throw error;
      });

    return slot.pending;
  };
}
