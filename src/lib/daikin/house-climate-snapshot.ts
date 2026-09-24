import {
  captureHouseClimateRestore,
  readHouseClimateRestore,
} from "./house-climate";
import type { HouseClimateRestoreUnit, UnitStatus } from "./types";

export const HOUSE_CLIMATE_SNAPSHOT_KEY = "daikin-house-climate-snapshot";

export interface SnapshotStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function browserSessionStorage(): SnapshotStorage | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  return sessionStorage;
}

export function readHouseClimateSnapshot(
  storage: SnapshotStorage | null = browserSessionStorage(),
): HouseClimateRestoreUnit[] {
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(HOUSE_CLIMATE_SNAPSHOT_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || !("units" in parsed)) {
      return [];
    }
    return readHouseClimateRestore(parsed.units);
  } catch {
    return [];
  }
}

export function rememberHouseClimateSnapshot(
  units: UnitStatus[],
  storage: SnapshotStorage | null = browserSessionStorage(),
): void {
  if (!storage) {
    return;
  }

  if (readHouseClimateSnapshot(storage).length > 0) {
    return;
  }

  storage.setItem(
    HOUSE_CLIMATE_SNAPSHOT_KEY,
    JSON.stringify({
      capturedAt: Date.now(),
      units: captureHouseClimateRestore(units),
    }),
  );
}

export function clearHouseClimateSnapshot(
  storage: SnapshotStorage | null = browserSessionStorage(),
): void {
  storage?.removeItem(HOUSE_CLIMATE_SNAPSHOT_KEY);
}
