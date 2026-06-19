import type {
  DaikinSite,
  OperationMode,
  UnitControlPayload,
  UnitStatus,
} from "./types";

const DEMO_SITE_ID = "demo-home";

let demoUnits: UnitStatus[] = createInitialDemoUnits();

function createInitialDemoUnits(): UnitStatus[] {
  const rooms = ["Obývák", "Ložnice", "Děti", "Pracovna", "Kuchyně"];

  return rooms.map((label, index) => ({
    id: `demo-unit-${index + 1}`,
    siteId: DEMO_SITE_ID,
    label,
    model: "Comfora FTXP",
    embeddedId: "climateControl",
    online: index !== 4,
    power: index === 2 ? "off" : "on",
    mode: (index % 2 === 0 ? "cooling" : "heating") as OperationMode,
    setpointC: 22 + (index % 3),
    roomTempC: 23.5 + index * 0.3,
    outdoorTempC: 31.2,
    fanSpeed: 3,
    fanMax: 5,
    capabilities: {
      modes: ["auto", "cooling", "heating", "fanOnly", "dry"],
      setpointMin: 16,
      setpointMax: 30,
      setpointStep: 1,
      fanMin: 1,
      fanMax: 5,
      fanStep: 1,
    },
  }));
}

export function getDemoSites(): DaikinSite[] {
  return [
    {
      id: DEMO_SITE_ID,
      name: "Demo domácnost",
      gatewayDevices: demoUnits.map((unit) => unit.id),
    },
  ];
}

export function getDemoUnits(
  siteId: string | null,
  roomLabels: Record<string, string>,
): UnitStatus[] {
  if (siteId && siteId !== DEMO_SITE_ID) {
    return [];
  }

  return demoUnits.map((unit) => ({
    ...unit,
    label: roomLabels[unit.id] ?? unit.label,
  }));
}

export function applyDemoControl(payload: UnitControlPayload): void {
  demoUnits = demoUnits.map((unit) => {
    if (unit.id !== payload.deviceId) {
      return unit;
    }

    return {
      ...unit,
      power: payload.power ?? unit.power,
      mode: payload.mode ?? unit.mode,
      setpointC: payload.setpointC ?? unit.setpointC,
      fanSpeed: payload.fanSpeed ?? unit.fanSpeed,
    };
  });
}

export function resetDemoUnits(): void {
  demoUnits = createInitialDemoUnits();
}
