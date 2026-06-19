export type PowerState = "on" | "off";

export type OperationMode =
  | "auto"
  | "cooling"
  | "heating"
  | "fanOnly"
  | "dry";

export interface DaikinTokenSet {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  scope?: string;
}

export interface CharacteristicValue<T = unknown> {
  value?: T;
  settable?: boolean;
  values?: T[];
}

export interface SetpointRange {
  value?: number;
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  settable?: boolean;
}

export interface FanFixedMode {
  value?: number;
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  settable?: boolean;
}

export interface ManagementPoint {
  embeddedId?: string;
  managementPointType?: string;
  operationMode?: CharacteristicValue<string>;
  onOffMode?: CharacteristicValue<PowerState>;
  powerfulMode?: CharacteristicValue<string>;
  temperatureControl?: CharacteristicValue<{
    operationModes?: Record<
      string,
      {
        setpoints?: Record<string, SetpointRange>;
      }
    >;
  }>;
  fanControl?: CharacteristicValue<{
    operationModes?: Record<
      string,
      {
        fanSpeed?: {
          currentMode?: CharacteristicValue<string>;
          modes?: {
            fixed?: FanFixedMode;
          };
        };
      }
    >;
  }>;
  sensoryData?: CharacteristicValue<{
    roomTemperature?: { value?: number };
    outdoorTemperature?: { value?: number };
  }>;
}

export interface GatewayDevice {
  id: string;
  deviceModel?: string;
  name?: string;
  type?: string;
  isCloudConnectionUp?: CharacteristicValue<boolean>;
  managementPoints?: ManagementPoint[];
}

export interface DaikinSite {
  id: string;
  name?: string;
  gatewayDevices?: string[];
}

export interface UnitCapabilities {
  modes: OperationMode[];
  setpointMin: number;
  setpointMax: number;
  setpointStep: number;
  fanMin: number;
  fanMax: number;
  fanStep: number;
}

export interface UnitStatus {
  id: string;
  siteId: string | null;
  label: string;
  model: string;
  embeddedId: string;
  online: boolean;
  power: PowerState;
  mode: OperationMode | string;
  setpointC: number | null;
  roomTempC: number | null;
  outdoorTempC: number | null;
  fanSpeed: number | null;
  fanMax: number | null;
  capabilities: UnitCapabilities;
}

export interface UnitControlPayload {
  deviceId: string;
  power?: PowerState;
  mode?: OperationMode;
  setpointC?: number;
  fanSpeed?: number;
}

export interface BatchControlPayload {
  deviceIds: string[];
  power?: PowerState;
  mode?: OperationMode;
  setpointC?: number;
  fanSpeed?: number;
}

export interface DevicesMeta {
  rawGatewayCount: number;
  rawSiteCount: number;
  parsedUnitCount: number;
  skippedWithoutClimateControl: number;
  siteFilterActive: boolean;
  activeSiteId: string | null;
  accountHint: string | null;
}

export interface DevicesResponse {
  units: UnitStatus[];
  meta: DevicesMeta;
}
