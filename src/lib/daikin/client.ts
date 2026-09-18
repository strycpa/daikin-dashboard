import { loadDaikinConfig, requireCredentials, getTokenStoreContext } from "./config";
import { DEFAULT_MODE, getClimatePoint, parseGatewayDevices, validateControlPayload } from "./parser";
import { readStoredToken, writeStoredToken } from "./token-store";
import {
  readDeviceNames,
  syncCloudNames,
} from "./firestore-device-names";
import {
  DAIKIN_RATE_LIMIT_DEFAULT_RETRY_MS,
  DAIKIN_RATE_LIMIT_MAX_RETRIES,
  parseRetryAfterMs,
  sleep,
  waitForDaikinWriteSlot,
} from "./rate-limit";
import {
  planHouseClimateControl,
  type HouseClimateResult,
} from "./house-climate";
import type {
  DaikinSite,
  DaikinTokenSet,
  DevicesMeta,
  DevicesResponse,
  GatewayDevice,
  HouseClimateAction,
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

function isWriteMethod(method: string | undefined): boolean {
  return method === "PATCH" || method === "POST" || method === "PUT" || method === "DELETE";
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const config = loadDaikinConfig();
  requireCredentials(config);

  const method = init?.method ?? "GET";
  if (isWriteMethod(method) && attempt === 0) {
    await waitForDaikinWriteSlot();
  }

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
    if (attempt >= DAIKIN_RATE_LIMIT_MAX_RETRIES) {
      throw new Error("Daikin API rate limit reached. Try again later.");
    }

    const retryAfterMs =
      parseRetryAfterMs(response.headers.get("Retry-After")) ??
      DAIKIN_RATE_LIMIT_DEFAULT_RETRY_MS;
    await sleep(retryAfterMs);
    return apiFetch<T>(path, init, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Daikin API error (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    // Write endpoints return an empty body; callers do not use the parsed value.
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getAccessToken(): Promise<string> {
  const config = loadDaikinConfig();
  requireCredentials(config);

  const stored = await readStoredToken(getTokenStoreContext(config));
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

  await writeStoredToken(getTokenStoreContext(config), refreshed);
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

  await writeStoredToken(getTokenStoreContext(config), token);
}

export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  demoMode: boolean;
  expiresAt: number | null;
  redirectUri: string;
  manualOAuth: boolean;
  usesOAuthProxy: boolean;
  householdId: string;
  tokenBackend: "firestore" | "file";
}> {
  const config = loadDaikinConfig();

  if (config.demoMode) {
    return {
      authenticated: true,
      demoMode: true,
      expiresAt: null,
      redirectUri: config.redirectUri,
      manualOAuth: config.manualOAuth,
      usesOAuthProxy: config.usesOAuthProxy,
      householdId: config.householdId,
      tokenBackend: config.tokenBackend,
    };
  }

  const token = await readStoredToken(getTokenStoreContext(config));
  return {
    authenticated: Boolean(token?.access_token),
    demoMode: false,
    expiresAt: token?.expires_at ?? null,
    redirectUri: config.redirectUri,
    manualOAuth: config.manualOAuth,
    usesOAuthProxy: config.usesOAuthProxy,
    householdId: config.householdId,
    tokenBackend: config.tokenBackend,
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

  let customDeviceNames: Record<string, { customName: string | null; cloudName: string | null }> = {};
  
  if (config.gcpProjectId && config.tokenBackend === "firestore") {
    try {
      const deviceNamesFromFirestore = await readDeviceNames(
        config.gcpProjectId,
        config.householdId,
      );
      
      customDeviceNames = Object.fromEntries(
        Object.entries(deviceNamesFromFirestore).map(([id, record]) => [
          id,
          { customName: record.customName, cloudName: record.cloudName },
        ]),
      );

      const cloudNames = devices.map((device) => ({
        id: device.id,
        cloudName: device.name ?? null,
      }));
      
      await syncCloudNames(config.gcpProjectId, config.householdId, cloudNames);
    } catch (error) {
      console.error("Failed to load device names from Firestore:", error);
    }
  }

  const units = parseGatewayDevices(devices, {
    siteId: effectiveSiteId,
    roomLabels: config.roomLabels,
    siteDeviceIds,
    customDeviceNames,
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
  const modeChanging =
    payload.mode !== undefined && payload.mode !== unit.mode;

  if (payload.power !== undefined && payload.power !== unit.power) {
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "onOffMode",
      payload.power,
    );
  }

  if (modeChanging && payload.mode !== undefined) {
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "operationMode",
      payload.mode,
    );
  }

  if (
    payload.setpointC !== undefined &&
    (modeChanging || payload.setpointC !== unit.setpointC)
  ) {
    await patchCharacteristic(
      unit.id,
      embeddedId,
      "temperatureControl",
      payload.setpointC,
      `/operationModes/${mode}/setpoints/roomTemperature`,
    );
  }

  if (
    payload.fanSpeed !== undefined &&
    (modeChanging || payload.fanSpeed !== unit.fanSpeed)
  ) {
    const fanPrefix = `/operationModes/${mode}/fanSpeed`;
    if (modeChanging || unit.fanSpeed === null) {
      await patchCharacteristic(
        unit.id,
        embeddedId,
        "fanControl",
        "fixed",
        `${fanPrefix}/currentMode`,
      );
    }
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
    } catch (error) {
      failed.push({
        id: deviceId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { succeeded, failed };
}

export async function applyHouseClimate(
  units: UnitStatus[],
  action: HouseClimateAction,
): Promise<HouseClimateResult> {
  const succeeded: HouseClimateResult["succeeded"] = [];
  const failed: HouseClimateResult["failed"] = [];
  const skipped: HouseClimateResult["skipped"] = [];

  for (const unit of units) {
    const plan = planHouseClimateControl(unit, action);
    if (plan.kind === "skip") {
      skipped.push({
        id: unit.id,
        label: unit.label,
        reason: plan.reason,
      });
      continue;
    }

    try {
      const validated = validateControlPayload(unit, plan.payload);
      await applyUnitControl(units, validated);
      succeeded.push({ id: unit.id, label: unit.label });
    } catch (error) {
      failed.push({
        id: unit.id,
        label: unit.label,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { action, succeeded, failed, skipped };
}

export async function getRawDevice(deviceId: string): Promise<GatewayDevice | null> {
  const devices = await fetchGatewayDevices();
  return devices.find((device) => device.id === deviceId) ?? null;
}

export { getClimatePoint };
