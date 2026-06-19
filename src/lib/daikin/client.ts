import { loadDaikinConfig, requireCredentials } from "./config";
import { DEFAULT_MODE, getClimatePoint, parseGatewayDevices } from "./parser";
import { readTokenFile, writeTokenFile } from "./token-store";
import type {
  DaikinSite,
  DaikinTokenSet,
  DevicesMeta,
  DevicesResponse,
  GatewayDevice,
  OperationMode,
  UnitControlPayload,
  UnitStatus,
} from "./types";
import {
  AUTHORIZE_URL,
  API_BASE_URL,
  DEFAULT_SCOPE,
  TOKEN_URL,
} from "./config";
import { getDemoSites, getDemoUnits, applyDemoControl } from "./demo";

function resolveOperationMode(
  unit: UnitStatus,
  requested?: OperationMode,
): OperationMode {
  if (requested) {
    return requested;
  }

  const current = unit.capabilities.modes.find((mode) => mode === unit.mode);
  return current ?? DEFAULT_MODE;
}

async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<DaikinTokenSet> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<DaikinTokenSet>;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const config = loadDaikinConfig();
  requireCredentials(config);

  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 429) {
    throw new Error("Daikin API rate limit reached. Try again later.");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Daikin API error (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getAccessToken(): Promise<string> {
  const config = loadDaikinConfig();
  requireCredentials(config);

  const stored = await readTokenFile(config.tokenFile);
  if (!stored?.access_token) {
    throw new Error("Not authenticated. Complete OAuth flow first.");
  }

  const expiresAt = stored.expires_at ?? 0;
  const now = Math.floor(Date.now() / 1000);

  if (expiresAt > now + 60) {
    return stored.access_token;
  }

  if (!stored.refresh_token) {
    throw new Error("Access token expired and no refresh token is available.");
  }

  const refreshed = await postForm(TOKEN_URL, {
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: stored.refresh_token,
  });

  await writeTokenFile(config.tokenFile, refreshed);
  if (!refreshed.access_token) {
    throw new Error("Refresh response did not include access_token");
  }
  return refreshed.access_token;
}

export function buildAuthorizationUrl(state: string): string {
  const config = loadDaikinConfig();
  requireCredentials(config);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: DEFAULT_SCOPE,
    state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(code: string): Promise<void> {
  const config = loadDaikinConfig();
  requireCredentials(config);

  const token = await postForm(TOKEN_URL, {
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });

  await writeTokenFile(config.tokenFile, token);
}

export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  demoMode: boolean;
  expiresAt: number | null;
  redirectUri: string;
  manualOAuth: boolean;
}> {
  const config = loadDaikinConfig();

  if (config.demoMode) {
    return {
      authenticated: true,
      demoMode: true,
      expiresAt: null,
      redirectUri: config.redirectUri,
      manualOAuth: config.manualOAuth,
    };
  }

  const token = await readTokenFile(config.tokenFile);
  return {
    authenticated: Boolean(token?.access_token),
    demoMode: false,
    expiresAt: token?.expires_at ?? null,
    redirectUri: config.redirectUri,
    manualOAuth: config.manualOAuth,
  };
}

export async function fetchSites(): Promise<DaikinSite[]> {
  const config = loadDaikinConfig();
  if (config.demoMode) {
    return getDemoSites();
  }

  const sites = await apiFetch<DaikinSite[]>("/v1/sites");
  return sites;
}

export async function fetchGatewayDevices(): Promise<GatewayDevice[]> {
  const config = loadDaikinConfig();
  if (config.demoMode) {
    return [];
  }

  return apiFetch<GatewayDevice[]>("/v1/gateway-devices");
}

export async function fetchUnits(siteId: string | null): Promise<DevicesResponse> {
  const config = loadDaikinConfig();

  if (config.demoMode) {
    const units = getDemoUnits(siteId, config.roomLabels);
    return {
      units,
      meta: {
        rawGatewayCount: units.length,
        rawSiteCount: 1,
        parsedUnitCount: units.length,
        skippedWithoutClimateControl: 0,
        siteFilterActive: false,
        activeSiteId: siteId,
        accountHint: null,
      },
    };
  }

  const [devices, sites] = await Promise.all([
    fetchGatewayDevices(),
    fetchSites(),
  ]);

  const effectiveSiteId = siteId ?? config.siteId;
  let siteDeviceIds: string[] | undefined;
  let siteFilterActive = false;

  if (effectiveSiteId) {
    const site = sites.find((item) => item.id === effectiveSiteId);
    const gatewayDevices = site?.gatewayDevices;
    if (gatewayDevices && gatewayDevices.length > 0) {
      siteDeviceIds = gatewayDevices;
      siteFilterActive = true;
    }
  }

  const filteredDevices = siteDeviceIds
    ? devices.filter((device) => siteDeviceIds?.includes(device.id))
    : devices;

  const units = parseGatewayDevices(devices, {
    siteId: effectiveSiteId,
    roomLabels: config.roomLabels,
    siteDeviceIds,
  });

  const skippedWithoutClimateControl =
    filteredDevices.length - units.length;

  const accountHint =
    devices.length === 0
      ? "Daikin API vrátilo 0 zařízení. Přihlas se stejným e-mailem a stejným způsobem (Google/Apple/e-mail) jako v Onecta appce, kde máš klimatizace. Developer Portal účet musí být stejný."
      : units.length === 0
        ? "API vrátilo zařízení, ale žádné nemá climateControl — možná jiný typ než split klimatizace."
        : null;

  const meta: DevicesMeta = {
    rawGatewayCount: devices.length,
    rawSiteCount: sites.length,
    parsedUnitCount: units.length,
    skippedWithoutClimateControl,
    siteFilterActive,
    activeSiteId: effectiveSiteId,
    accountHint,
  };

  return { units, meta };
}

async function patchCharacteristic(
  deviceId: string,
  embeddedId: string,
  characteristic: string,
  value: unknown,
  path?: string,
): Promise<void> {
  const body: { value: unknown; path?: string } = { value };
  if (path) {
    body.path = path;
  }

  await apiFetch(
    `/v1/gateway-devices/${deviceId}/management-points/${embeddedId}/characteristics/${characteristic}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function applyUnitControl(
  units: UnitStatus[],
  payload: UnitControlPayload,
): Promise<void> {
  const config = loadDaikinConfig();

  if (config.demoMode) {
    applyDemoControl(payload);
    return;
  }

  const unit = units.find((item) => item.id === payload.deviceId);
  if (!unit) {
    throw new Error(`Unknown device ${payload.deviceId}`);
  }

  const { embeddedId } = unit;
  const mode = resolveOperationMode(unit, payload.mode);

  if (payload.power !== undefined) {
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "onOffMode",
      payload.power,
    );
  }

  if (payload.mode !== undefined) {
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "operationMode",
      payload.mode,
    );
  }

  if (payload.setpointC !== undefined) {
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "temperatureControl",
      payload.setpointC,
      `/operationModes/${mode}/setpoints/roomTemperature`,
    );
  }

  if (payload.fanSpeed !== undefined) {
    const fanPrefix = `/operationModes/${mode}/fanSpeed`;
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "fanControl",
      "fixed",
      `${fanPrefix}/currentMode`,
    );
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "fanControl",
      payload.fanSpeed,
      `${fanPrefix}/modes/fixed`,
    );
  }
}

export async function applyBatchControl(
  units: UnitStatus[],
  deviceIds: string[],
  changes: Omit<UnitControlPayload, "deviceId">,
): Promise<{ succeeded: string[]; failed: { id: string; error: string }[] }> {
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const deviceId of deviceIds) {
    try {
      await applyUnitControl(units, { deviceId, ...changes });
      succeeded.push(deviceId);
      // Respect API rate limits (~20/min)
      if (!loadDaikinConfig().demoMode) {
        await sleep(400);
      }
    } catch (error) {
      failed.push({
        id: deviceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { succeeded, failed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getRawDevice(deviceId: string): Promise<GatewayDevice | null> {
  const devices = await fetchGatewayDevices();
  return devices.find((device) => device.id === deviceId) ?? null;
}

export { getClimatePoint };
