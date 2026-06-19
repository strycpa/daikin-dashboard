"use client";

import type { OperationMode, UnitStatus } from "@/lib/daikin/types";
import { modeLabel, OPERATION_MODES } from "@/lib/utils";
import { Button, Select, Slider } from "@/components/ui/controls";

interface MasterPanelProps {
  units: UnitStatus[];
  selectedIds: Set<string>;
  onSelectAll: (selected: boolean) => void;
  onApply: (changes: {
    power?: "on" | "off";
    mode?: OperationMode;
    setpointC?: number;
    fanSpeed?: number;
  }) => Promise<void>;
  busy: boolean;
  draftSetpoint: number;
  draftFan: number;
  draftMode: OperationMode;
  onDraftSetpointChange: (value: number) => void;
  onDraftFanChange: (value: number) => void;
  onDraftModeChange: (mode: OperationMode) => void;
}

export function MasterPanel({
  units,
  selectedIds,
  onSelectAll,
  onApply,
  busy,
  draftSetpoint,
  draftFan,
  draftMode,
  onDraftSetpointChange,
  onDraftFanChange,
  onDraftModeChange,
}: MasterPanelProps) {
  const selectedCount = selectedIds.size;
  const allSelected = units.length > 0 && selectedCount === units.length;
  const caps = units[0]?.capabilities;

  return (
    <section className="rounded-2xl border border-teal-500/20 bg-master-gradient p-6 shadow-glow-teal-soft">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-teal-400/80">
            Master control
          </p>
          <h2 className="text-xl font-semibold text-white">
            Hromadné ovládání
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {selectedCount} z {units.length} jednotek vybráno
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onSelectAll(event.target.checked)}
            className="accent-teal-400"
          />
          Vybrat vše
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <div>
          <p className="mb-2 text-sm text-slate-300">Cílová teplota</p>
          <Slider
            value={draftSetpoint}
            min={caps?.setpointMin ?? 16}
            max={caps?.setpointMax ?? 30}
            step={caps?.setpointStep ?? 1}
            suffix="°C"
            disabled={busy || selectedCount === 0}
            onChange={onDraftSetpointChange}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-300">Ventilátor</p>
          <Slider
            value={draftFan}
            min={caps?.fanMin ?? 1}
            max={caps?.fanMax ?? 5}
            step={caps?.fanStep ?? 1}
            disabled={busy || selectedCount === 0}
            onChange={onDraftFanChange}
          />
        </div>

        <div>
          <p className="mb-2 text-sm text-slate-300">Režim</p>
          <Select
            value={draftMode}
            disabled={busy || selectedCount === 0}
            options={OPERATION_MODES.map((mode) => ({
              value: mode,
              label: modeLabel(mode),
            }))}
            onChange={(value) => onDraftModeChange(value as OperationMode)}
          />
        </div>

        <div className="flex flex-wrap gap-2 lg:flex-col">
          <Button
            disabled={busy || selectedCount === 0}
            onClick={() =>
              onApply({
                power: "on",
                mode: draftMode,
                setpointC: draftSetpoint,
                fanSpeed: draftFan,
              })
            }
          >
            Aplikovat na vybrané
          </Button>
          <Button
            variant="secondary"
            disabled={busy || selectedCount === 0}
            onClick={() => onApply({ power: "on", mode: "cooling", setpointC: 22 })}
          >
            Vše Cool 22°
          </Button>
          <Button
            variant="danger"
            disabled={busy || selectedCount === 0}
            onClick={() => onApply({ power: "off" })}
          >
            Vypnout vybrané
          </Button>
        </div>
      </div>
    </section>
  );
}
