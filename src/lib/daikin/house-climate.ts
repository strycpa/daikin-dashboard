import type {
  HouseClimateAction,
  HouseClimateRestoreUnit,
  OperationMode,
  UnitControlPayload,
  UnitStatus,
} from "./types";

export type { HouseClimateAction, HouseClimateRestoreUnit };

export type HouseClimateMode = Extract<HouseClimateAction, "heating" | "cooling">;

export type HouseClimateSkipReason = "offline" | "unsupported-mode";

export type HouseClimatePlan =
  | { kind: "apply"; payload: UnitControlPayload }
  | { kind: "skip"; reason: HouseClimateSkipReason };

export interface HouseClimateUnitResult {
  id: string;
  label: string;
}

export interface HouseClimateSkipped extends HouseClimateUnitResult {
  reason: HouseClimateSkipReason;
}

export interface HouseClimateFailed extends HouseClimateUnitResult {
  error: string;
}

export interface HouseClimateResult {
  action: HouseClimateAction;
  succeeded: HouseClimateUnitResult[];
  failed: HouseClimateFailed[];
  skipped: HouseClimateSkipped[];
}

export function isHouseClimateAction(
  value: unknown,
): value is HouseClimateAction {
  return value === "heating" || value === "cooling" || value === "off";
}

export function isOperationModeValue(value: unknown): value is OperationMode {
  return (
    value === "auto" ||
    value === "cooling" ||
    value === "heating" ||
    value === "fanOnly" ||
    value === "dry"
  );
}

export function targetSetpointC(
  unit: UnitStatus,
  action: HouseClimateMode,
): number {
  if (action === "heating") {
    return unit.capabilities.setpointMax;
  }
  return unit.capabilities.setpointMin;
}

export function targetFanSpeed(unit: UnitStatus): number {
  return unit.capabilities.fanMax;
}

export function captureHouseClimateRestore(
  units: UnitStatus[],
): HouseClimateRestoreUnit[] {
  return units.map((unit) => {
    const restore: HouseClimateRestoreUnit = { deviceId: unit.id };
    if (isOperationModeValue(unit.mode)) {
      restore.mode = unit.mode;
    }
    if (typeof unit.setpointC === "number") {
      restore.setpointC = unit.setpointC;
    }
    if (typeof unit.fanSpeed === "number") {
      restore.fanSpeed = unit.fanSpeed;
    }
    return restore;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readHouseClimateRestore(
  value: unknown,
): HouseClimateRestoreUnit[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: HouseClimateRestoreUnit[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.deviceId !== "string") {
      continue;
    }

    const restore: HouseClimateRestoreUnit = { deviceId: entry.deviceId };
    if (isOperationModeValue(entry.mode)) {
      restore.mode = entry.mode;
    }
    if (typeof entry.setpointC === "number") {
      restore.setpointC = entry.setpointC;
    }
    if (typeof entry.fanSpeed === "number") {
      restore.fanSpeed = entry.fanSpeed;
    }
    items.push(restore);
  }

  return items;
}

function restoreForUnit(
  unit: UnitStatus,
  restore: HouseClimateRestoreUnit | undefined,
): Pick<UnitControlPayload, "mode" | "setpointC" | "fanSpeed"> {
  if (!restore) {
    return {};
  }

  const payload: Pick<UnitControlPayload, "mode" | "setpointC" | "fanSpeed"> = {};
  if (restore.mode !== undefined && unit.capabilities.modes.includes(restore.mode)) {
    payload.mode = restore.mode;
  }
  if (typeof restore.setpointC === "number") {
    payload.setpointC = restore.setpointC;
  }
  if (typeof restore.fanSpeed === "number") {
    payload.fanSpeed = restore.fanSpeed;
  }
  return payload;
}

export function planHouseClimateControl(
  unit: UnitStatus,
  action: HouseClimateAction,
  restore?: HouseClimateRestoreUnit,
): HouseClimatePlan {
  if (!unit.online) {
    return { kind: "skip", reason: "offline" };
  }

  if (action === "off") {
    return {
      kind: "apply",
      payload: {
        deviceId: unit.id,
        power: "off",
        ...restoreForUnit(unit, restore),
      },
    };
  }

  if (!unit.capabilities.modes.includes(action)) {
    return { kind: "skip", reason: "unsupported-mode" };
  }

  return {
    kind: "apply",
    payload: {
      deviceId: unit.id,
      power: "on",
      mode: action,
      setpointC: targetSetpointC(unit, action),
      fanSpeed: targetFanSpeed(unit),
    },
  };
}
