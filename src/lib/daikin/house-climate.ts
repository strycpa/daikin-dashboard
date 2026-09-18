import type {
  HouseClimateAction,
  UnitControlPayload,
  UnitStatus,
} from "./types";

export type { HouseClimateAction };

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

export function planHouseClimateControl(
  unit: UnitStatus,
  action: HouseClimateAction,
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
