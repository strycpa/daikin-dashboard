"use client";

import type { HouseClimateAction } from "@/lib/daikin/types";
import { cn } from "@/lib/cn";

interface HouseClimatePanelProps {
  unitCount: number;
  busy: boolean;
  activeAction: HouseClimateAction | null;
  onApply: (action: HouseClimateAction) => Promise<void>;
}

export function HouseClimatePanel({
  unitCount,
  busy,
  activeAction,
  onApply,
}: HouseClimatePanelProps) {
  const disabled = busy || unitCount === 0;
  const heatingBusy = activeAction === "heating";
  const coolingBusy = activeAction === "cooling";

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-card-gradient p-5 shadow-card [html[data-theme='light']_&]:border-slate-200">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-400/80 [html[data-theme='light']_&]:text-teal-600">
          Dům
        </p>
        <h2 className="text-xl font-semibold text-white [html[data-theme='light']_&]:text-slate-900">
          Vytopit / vychladit naplno
        </h2>
        <p className="mt-1 text-sm text-slate-400 [html[data-theme='light']_&]:text-slate-600">
          Zapne všechny online jednotky na maximum topení nebo chlazení
          (krajní teplota a nejvyšší ventilátor). Daikin API nemá hromadný
          zápis, proto se povely posílají postupně s ohledem na limit 20
          požadavků za minutu.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HouseClimateButton
          action="heating"
          title={heatingBusy ? "Vytápím dům…" : "Vytopit dům"}
          subtitle="Topení · max. teplota · ventilátor naplno"
          disabled={disabled}
          busy={heatingBusy}
          className="border-orange-400/40 bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-[0_0_28px_rgb(249_115_22_/_0.28)] hover:from-orange-400 hover:to-rose-400 [html[data-theme='light']_&]:shadow-[0_0_20px_rgb(249_115_22_/_0.2)]"
          onClick={() => void onApply("heating")}
        />
        <HouseClimateButton
          action="cooling"
          title={coolingBusy ? "Chladím dům…" : "Vychladit dům"}
          subtitle="Chlazení · min. teplota · ventilátor naplno"
          disabled={disabled}
          busy={coolingBusy}
          className="border-cyan-400/40 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_28px_rgb(6_182_212_/_0.28)] hover:from-cyan-400 hover:to-blue-500 [html[data-theme='light']_&]:shadow-[0_0_20px_rgb(6_182_212_/_0.2)]"
          onClick={() => void onApply("cooling")}
        />
      </div>
    </section>
  );
}

function HouseClimateButton({
  action,
  title,
  subtitle,
  disabled,
  busy,
  className,
  onClick,
}: {
  action: HouseClimateAction;
  title: string;
  subtitle: string;
  disabled: boolean;
  busy: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      aria-busy={busy}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-28 flex-col items-start justify-center rounded-2xl border px-6 py-5 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
        {action === "heating" ? "Topení" : "Chlazení"}
      </span>
      <span className="mt-1 text-2xl font-semibold sm:text-3xl">{title}</span>
      <span className="mt-1 text-sm text-white/80">{subtitle}</span>
    </button>
  );
}
