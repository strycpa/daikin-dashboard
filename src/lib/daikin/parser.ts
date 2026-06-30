import type {
  FanFixedMode,
  GatewayDevice,
  ManagementPoint,
  OperationMode,
  SetpointRange,
  UnitCapabilities,
  UnitControlPayload,
  UnitStatus,
} from "./types";

const DEFAULT_MODE: OperationMode = "cooling";

function findManagementPoint(
  points: ManagementPoint[] | undefined,
  type: string,
): ManagementPoint | undefined {
  return points?.find((point) => point.managementPointType === type);
}

function characteristicValue<T>(
  point: ManagementPoint | undefined,
  name: keyof ManagementPoint,
): T | undefined {
  const item = point?.[name];
  if (typeof item === "object" && item !== null && "value" in item) {
    return item.value as T;
  }
  return undefined;
}

function coolingSetpoint(climate: ManagementPoint): SetpointRange | null {
  const temperatureControl = characteristicValue<{
    operationModes?: Record<
      string,
      { setpoints?: Record<string, SetpointRange> }
    >;
  }>(climate, "temperatureControl");

  const setpoint =
    temperatureControl?.operationModes?.[DEFAULT_MODE]?.setpoints
      ?.roomTemperature;

  return setpoint ?? null;
}

function coolingFixedFan(climate: ManagementPoint): FanFixedMode | null {
  const fanControl = characteristicValue<{
    operationModes?: Record<
      string,
      {
        fanSpeed?: {
          modes?: { fixed?: FanFixedMode };
        };
      }
    >;
  }>(climate, "fanControl");

  return (
    fanControl?.operationModes?.[DEFAULT_MODE]?.fanSpeed?.modes?.fixed ?? null
  );
}

function roomSetpoint(
  climate: ManagementPoint,
  mode: string | undefined,
): number | null {
  if (!mode) {
    return null;
  }

  const temperatureControl = characteristicValue<{
    operationModes?: Record<
      string,
      { setpoints?: Record<string, { value?: number }> }
    >;
  }>(climate, "temperatureControl");

  const value =
    temperatureControl?.operationModes?.[mode]?.setpoints?.roomTemperature
      ?.value;

  return typeof value === "number" ? value : null;
}

function sensoryTemp(
  climate: ManagementPoint,
  key: "roomTemperature" | "outdoorTemperature",
): number | null {
  const sensory = characteristicValue<Record<string, { value?: number }>>(
    climate,
    "sensoryData",
  );
  const value = sensory?.[key]?.value;
  return typeof value === "number" ? value : null;
}

function fanStatus(
  climate: ManagementPoint,
  mode: string | undefined,
): { speed: number | null; max: number | null } {
  if (!mode) {
    return { speed: null, max: null };
  }

  const fanControl = characteristicValue<{
    operationModes?: Record<
      string,
      {
        fanSpeed?: {
          currentMode?: { value?: string };
          modes?: { fixed?: { value?: number; maxValue?: number } };
        };
      }
    >;
  }>(climate, "fanControl");

  const fanSpeed = fanControl?.operationModes?.[mode]?.fanSpeed;
  const currentMode = fanSpeed?.currentMode?.value;
  const fixed = fanSpeed?.modes?.fixed;

  if (currentMode === "fixed" && typeof fixed?.value === "number") {
    return {
      speed: fixed.value,
      max: typeof fixed.maxValue === "number" ? fixed.maxValue : null,
    };
  }

  return { speed: null, max: null };
}

function buildCapabilities(climate: ManagementPoint): UnitCapabilities {
  const setpoint = coolingSetpoint(climate);
  const fan = coolingFixedFan(climate);
  const modeCharacteristic = climate.operationMode;
  const modes = (modeCharacteristic?.values ?? [
    "auto",
    "cooling",
    "heating",
    "fanOnly",
    "dry",
  ]) as OperationMode[];

  return {
    modes,
    setpointMin: setpoint?.minValue ?? 16,
    setpointMax: setpoint?.maxValue ?? 30,
    setpointStep: setpoint?.stepValue ?? 1,
    fanMin: fan?.minValue ?? 1,
    fanMax: fan?.maxValue ?? 5,
    fanStep: fan?.stepValue ?? 1,
  };
}

export function parseGatewayDevice(
  device: GatewayDevice,
  options: {
    siteId: string | null;
    roomLabels: Record<string, string>;
    fallbackIndex: number;
    customDeviceNames?: Record<string, { customName: string | null; cloudName: string | null }>;
  },
): UnitStatus | null {
  const climate = findManagementPoint(device.managementPoints, "climateControl");
  if (!climate) {
    return null;
  }

  const embeddedId = climate.embeddedId ?? "climateControl";
  const mode =
    characteristicValue<string>(climate, "operationMode") ?? DEFAULT_MODE;
  const power = characteristicValue<"on" | "off">(climate, "onOffMode") ?? "off";
  const fan = fanStatus(climate, mode);
  const online = device.isCloudConnectionUp?.value ?? true;

  const defaultLabel = `Unit ${options.fallbackIndex + 1}`;
  const customName = options.customDeviceNames?.[device.id]?.customName;
  
  const label =
    customName ??
    options.roomLabels[device.id] ??
    device.name ??
    device.deviceModel ??
    defaultLabel;

  return {
    id: device.id,
    siteId: options.siteId,
    label,
    model: device.deviceModel ?? "Daikin",
    embeddedId,
    online,
    power,
    mode,
    setpointC: roomSetpoint(climate, mode),
    roomTempC: sensoryTemp(climate, "roomTemperature"),
    outdoorTempC: sensoryTemp(climate, "outdoorTemperature"),
    fanSpeed: fan.speed,
    fanMax: fan.max,
    capabilities: buildCapabilities(climate),
  };
}

export function parseGatewayDevices(
  devices: GatewayDevice[],
  options: {
    siteId: string | null;
    roomLabels: Record<string, string>;
    siteDeviceIds?: string[];
    customDeviceNames?: Record<string, { customName: string | null; cloudName: string | null }>;
  },
): UnitStatus[] {
  const filtered =
    options.siteDeviceIds && options.siteDeviceIds.length > 0
      ? devices.filter((device) => options.siteDeviceIds?.includes(device.id))
      : devices;

  return filtered
    .map((device, index) =>
      parseGatewayDevice(device, {
        siteId: options.siteId,
        roomLabels: options.roomLabels,
        fallbackIndex: index,
        customDeviceNames: options.customDeviceNames,
      }),
    )
    .filter((unit): unit is UnitStatus => unit !== null);
}

export function validateControlPayload(
  unit: UnitStatus,
  payload: UnitControlPayload,
): UnitControlPayload {
  const result: UnitControlPayload = { deviceId: payload.deviceId };

  if (payload.power !== undefined) {
    result.power = payload.power;
  }

  if (payload.mode !== undefined) {
    if (!unit.capabilities.modes.includes(payload.mode)) {
      throw new Error(`Mode ${payload.mode} is not supported on ${unit.label}`);
    }
    result.mode = payload.mode;
  }

  if (payload.setpointC !== undefined) {
    const { setpointMin, setpointMax, setpointStep } = unit.capabilities;
    if (payload.setpointC < setpointMin || payload.setpointC > setpointMax) {
      throw new Error(
        `Setpoint must be between ${setpointMin}°C and ${setpointMax}°C`,
      );
    }
    const steps = Math.round((payload.setpointC - setpointMin) / setpointStep);
    result.setpointC = setpointMin + steps * setpointStep;
  }

  if (payload.fanSpeed !== undefined) {
    const { fanMin, fanMax, fanStep } = unit.capabilities;
    if (payload.fanSpeed < fanMin || payload.fanSpeed > fanMax) {
      throw new Error(`Fan speed must be between ${fanMin} and ${fanMax}`);
    }
    if ((payload.fanSpeed - fanMin) % fanStep !== 0) {
      throw new Error(`Fan speed must use step ${fanStep}`);
    }
    result.fanSpeed = payload.fanSpeed;
  }

  return result;
}

export function getClimatePoint(device: GatewayDevice): ManagementPoint | null {
  return findManagementPoint(device.managementPoints, "climateControl") ?? null;
}

export { DEFAULT_MODE };
