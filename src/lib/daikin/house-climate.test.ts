import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UnitStatus } from "./types";
import {
  isHouseClimateAction,
  planHouseClimateControl,
  targetFanSpeed,
  targetSetpointC,
} from "./house-climate";
import {
  createDaikinWritePacer,
  parseRetryAfterMs,
} from "./rate-limit";

function makeUnit(overrides: Partial<UnitStatus> = {}): UnitStatus {
  return {
    id: "demo-unit-1",
    siteId: "demo-home",
    label: "Obývák",
    model: "Comfora FTXP",
    embeddedId: "climateControl",
    online: true,
    power: "off",
    mode: "cooling",
    setpointC: 22,
    roomTempC: 23.5,
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
    ...overrides,
  };
}

describe("house climate planning", () => {
  it("accepts heating, cooling, and off", () => {
    assert.equal(isHouseClimateAction("heating"), true);
    assert.equal(isHouseClimateAction("cooling"), true);
    assert.equal(isHouseClimateAction("off"), true);
    assert.equal(isHouseClimateAction("auto"), false);
    assert.equal(isHouseClimateAction("fanOnly"), false);
  });

  it("heats a unit at max setpoint and max fan", () => {
    const unit = makeUnit();
    const plan = planHouseClimateControl(unit, "heating");

    assert.equal(plan.kind, "apply");
    if (plan.kind !== "apply") {
      return;
    }

    assert.deepEqual(plan.payload, {
      deviceId: "demo-unit-1",
      power: "on",
      mode: "heating",
      setpointC: 30,
      fanSpeed: 5,
    });
    assert.equal(targetSetpointC(unit, "heating"), 30);
    assert.equal(targetFanSpeed(unit), 5);
  });

  it("cools a unit at min setpoint and max fan", () => {
    const unit = makeUnit({
      capabilities: {
        modes: ["cooling", "heating"],
        setpointMin: 18,
        setpointMax: 32,
        setpointStep: 1,
        fanMin: 1,
        fanMax: 7,
        fanStep: 1,
      },
    });
    const plan = planHouseClimateControl(unit, "cooling");

    assert.equal(plan.kind, "apply");
    if (plan.kind !== "apply") {
      return;
    }

    assert.deepEqual(plan.payload, {
      deviceId: "demo-unit-1",
      power: "on",
      mode: "cooling",
      setpointC: 18,
      fanSpeed: 7,
    });
  });

  it("skips offline units", () => {
    const plan = planHouseClimateControl(makeUnit({ online: false }), "heating");
    assert.deepEqual(plan, { kind: "skip", reason: "offline" });
  });

  it("skips units that cannot heat or cool", () => {
    const dryOnly = makeUnit({
      capabilities: {
        modes: ["dry", "fanOnly"],
        setpointMin: 16,
        setpointMax: 30,
        setpointStep: 1,
        fanMin: 1,
        fanMax: 5,
        fanStep: 1,
      },
    });

    assert.deepEqual(planHouseClimateControl(dryOnly, "heating"), {
      kind: "skip",
      reason: "unsupported-mode",
    });
    assert.deepEqual(planHouseClimateControl(dryOnly, "cooling"), {
      kind: "skip",
      reason: "unsupported-mode",
    });
  });

  it("stops an online unit with power off only", () => {
    const plan = planHouseClimateControl(makeUnit({ power: "on" }), "off");
    assert.equal(plan.kind, "apply");
    if (plan.kind !== "apply") {
      return;
    }

    assert.deepEqual(plan.payload, {
      deviceId: "demo-unit-1",
      power: "off",
    });
  });

  it("skips offline units for stop as well", () => {
    const plan = planHouseClimateControl(makeUnit({ online: false }), "off");
    assert.deepEqual(plan, { kind: "skip", reason: "offline" });
  });
});

describe("Daikin write pacer", () => {
  it("does not wait before the first write", async () => {
    const sleeps: number[] = [];
    let clock = 10_000;
    const pacer = createDaikinWritePacer({
      minIntervalMs: 1_000,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await pacer.wait();
    assert.deepEqual(sleeps, []);
    assert.equal(clock, 10_000);
  });

  it("spaces subsequent writes by the configured interval", async () => {
    const sleeps: number[] = [];
    let clock = 0;
    const pacer = createDaikinWritePacer({
      minIntervalMs: 1_000,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await pacer.wait();
    clock += 200;
    await pacer.wait();
    clock += 1_500;
    await pacer.wait();

    assert.deepEqual(sleeps, [800]);
  });

  it("serializes concurrent waiters", async () => {
    const sleeps: number[] = [];
    let clock = 0;
    const pacer = createDaikinWritePacer({
      minIntervalMs: 500,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    await Promise.all([pacer.wait(), pacer.wait(), pacer.wait()]);
    assert.deepEqual(sleeps, [500, 500]);
  });
});

describe("Retry-After parsing", () => {
  it("parses delay-seconds", () => {
    assert.equal(parseRetryAfterMs("12"), 12_000);
    assert.equal(parseRetryAfterMs("0"), 0);
  });

  it("parses HTTP dates relative to now", () => {
    const now = Date.parse("Wed, 21 Oct 2015 07:28:00 GMT");
    assert.equal(
      parseRetryAfterMs("Wed, 21 Oct 2015 07:28:10 GMT", now),
      10_000,
    );
    assert.equal(
      parseRetryAfterMs("Wed, 21 Oct 2015 07:27:00 GMT", now),
      0,
    );
  });

  it("returns null for missing or invalid values", () => {
    assert.equal(parseRetryAfterMs(null), null);
    assert.equal(parseRetryAfterMs(""), null);
    assert.equal(parseRetryAfterMs("nope"), null);
  });
});
