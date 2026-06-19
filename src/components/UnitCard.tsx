"use client";

import type { OperationMode, UnitStatus } from "@/lib/daikin/types";
import { formatTemperature, modeLabel, OPERATION_MODES } from "@/lib/utils";
import { cn } from "@/lib/cn";
import { Button, Select, Slider, Toggle } from "@/components/ui/controls";

interface UnitCardProps {
  unit: UnitStatus;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  onControl: (changes: {
    power?: "on" | "off";
    mode?: OperationMode;
    setpointC?: number;
    fanSpeed?: number;
  }) => Promise<void>;
  busy: boolean;
}

export function UnitCard({
  unit,
  selected,
  onSelectChange,
  onControl,
  busy,
}: UnitCardProps) {
  const isOn = unit.power === "on";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border p-5 shadow-card transition-all duration-300",
        isOn
          ? "border-teal-400/45 bg-card-on-gradient shadow-glow-teal-soft"
          : "border-slate-700/60 bg-card-gradient hover:border-slate-500/60",
        selected && "border-teal-400/60 shadow-glow-teal ring-1 ring-teal-400/25",
        !unit.online && "opacity-60",
      )}
    >
      {isOn && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-teal-400/80 to-transparent" />
      )}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition",
          isOn ? "bg-teal-400/25" : "bg-teal-400/10 group-hover:bg-teal-400/20",
        )}
      />

      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">
            {unit.model}
          </p>
          <div className="flex items-center gap-2">
            {isOn && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]"
                aria-hidden
              />
            )}
            <h2 className={cn("text-lg font-semibold", isOn ? "text-white" : "text-slate-300")}>
              {unit.label}
            </h2>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600/50 bg-slate-900/50 px-2.5 py-1.5 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectChange(event.target.checked)}
            className="accent-teal-400"
          />
          Skupina
        </label>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Metric label="V místnosti" value={formatTemperature(unit.roomTempC)} />
        <Metric label="Venku" value={formatTemperature(unit.outdoorTempC)} />
        <Metric
          label="Stav"
          value={isOn ? "Zapnuto" : "Vypnuto"}
          accent={isOn ? "text-teal-300" : "text-slate-400"}
        />
        <Metric label="Režim" value={modeLabel(unit.mode)} />
      </div>

      <div className="mt-auto space-y-4 border-t border-slate-700/60 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Power</span>
          <Toggle
            checked={isOn}
            disabled={busy || !unit.online}
            label={`Toggle ${unit.label}`}
            onChange={(checked) =>
              onControl({ power: checked ? "on" : "off" })
            }
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-300">Teplota</span>
            <span className="font-mono text-teal-300">
              {unit.setpointC ?? unit.capabilities.setpointMin}°C
            </span>
          </div>
          <Slider
            value={unit.setpointC ?? unit.capabilities.setpointMin}
            min={unit.capabilities.setpointMin}
            max={unit.capabilities.setpointMax}
            step={unit.capabilities.setpointStep}
            suffix="°C"
            disabled={busy || !unit.online || !isOn}
            onChange={(value) => onControl({ setpointC: value })}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-300">Ventilátor</span>
            <span className="font-mono text-teal-300">
              {unit.fanSpeed ?? 1}
              {unit.fanMax ? `/${unit.fanMax}` : ""}
            </span>
          </div>
          <Slider
            value={unit.fanSpeed ?? unit.capabilities.fanMin}
            min={unit.capabilities.fanMin}
            max={unit.capabilities.fanMax}
            step={unit.capabilities.fanStep}
            disabled={busy || !unit.online || !isOn}
            onChange={(value) => onControl({ fanSpeed: value })}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-300">Režim</p>
          <Select
            value={unit.mode}
            disabled={busy || !unit.online || !isOn}
            options={OPERATION_MODES.filter((mode) =>
              unit.capabilities.modes.includes(mode),
            ).map((mode) => ({
              value: mode,
              label: modeLabel(mode),
            }))}
            onChange={(value) => onControl({ mode: value as OperationMode })}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy || !unit.online}
            onClick={() => onControl({ power: "on", mode: "cooling" })}
          >
            Cool 22°
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            disabled={busy || !unit.online}
            onClick={() => onControl({ power: "off" })}
          >
            Off
          </Button>
        </div>
      </div>

      {!unit.online && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-950/40 backdrop-blur-[1px]">
          <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
            Offline
          </span>
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={cn("font-mono text-sm font-medium", accent)}>{value}</p>
    </div>
  );
}
