import type { OperationMode, UnitStatus } from "@/lib/daikin/types";

export const MODE_LABELS: Record<string, string> = {
  auto: "Auto",
  cooling: "Chlazení",
  heating: "Topení",
  fanOnly: "Ventilace",
  dry: "Odsušování",
};

export function formatTemperature(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(1)}°C`;
}

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

export function averageRoomTemp(units: UnitStatus[]): number | null {
  const readings = units
    .map((unit) => unit.roomTempC)
    .filter((value): value is number => value !== null);

  if (readings.length === 0) {
    return null;
  }

  return readings.reduce((sum, value) => sum + value, 0) / readings.length;
}

export function countPoweredOn(units: UnitStatus[]): number {
  return units.filter((unit) => unit.power === "on").length;
}

export const OPERATION_MODES: OperationMode[] = [
  "auto",
  "cooling",
  "heating",
  "fanOnly",
  "dry",
];
