"use client";

import type { HouseClimateAction } from "@/lib/daikin/types";
import { cn } from "@/lib/cn";

interface HouseClimatePanelProps {
  unitCount: number;
  busy: boolean;
  activeAction: HouseClimateAction | null;
  onApply: (action: HouseClimateAction) => Promise<void>;
}

const BUTTONS: {
  action: HouseClimateAction;
  eyebrow: string;
  idleTitle: string;
  busyTitle: string;
  subtitle: string;
  className: string;
}[] = [
  {
    action: "heating",
    eyebrow: "Topení",
    idleTitle: "Vytopit dům",
    busyTitle: "Vytápím dům…",
    subtitle: "Topení · max. teplota · ventilátor naplno",
    className:
      "border-orange-400/40 bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-[0_0_28px_rgb(249_115_22_/_0.28)] hover:from-orange-400 hover:to-rose-400 [html[data-theme='light']_&]:shadow-[0_0_20px_rgb(249_115_22_/_0.2)]",
  },
  {
    action: "off",
    eyebrow: "Vypnout",
    idleTitle: "STOP",
    busyTitle: "Vypínám dům…",
    subtitle: "Vypne všechny online jednotky",
    className:
      "border-rose-500/50 bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-[0_0_28px_rgb(244_63_94_/_0.22)] hover:from-slate-700 hover:to-slate-900 [html[data-theme='light']_&]:from-slate-800 [html[data-theme='light']_&]:to-slate-900 [html[data-theme='light']_&]:shadow-[0_0_20px_rgb(244_63_94_/_0.18)]",
  },
  {
    action: "cooling",
    eyebrow: "Chlazení",
    idleTitle: "Vychladit dům",
    busyTitle: "Chladím dům…",
    subtitle: "Chlazení · min. teplota · ventilátor naplno",
    className:
      "border-cyan-400/40 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_28px_rgb(6_182_212_/_0.28)] hover:from-cyan-400 hover:to-blue-500 [html[data-theme='light']_&]:shadow-[0_0_20px_rgb(6_182_212_/_0.2)]",
  },
];

export function HouseClimatePanel({
  unitCount,
  busy,
  activeAction,
  onApply,
}: HouseClimatePanelProps) {
  const disabled = busy || unitCount === 0;

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-card-gradient p-5 shadow-card [html[data-theme='light']_&]:border-slate-200">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-400/80 [html[data-theme='light']_&]:text-teal-600">
          Dům
        </p>
        <h2 className="text-xl font-semibold text-white [html[data-theme='light']_&]:text-slate-900">
          Vytopit / STOP / vychladit
        </h2>
        <p className="mt-1 text-sm text-slate-400 [html[data-theme='light']_&]:text-slate-600">
          Zapne všechny online jednotky na maximum topení nebo chlazení, nebo je
          vypne. Daikin API nemá hromadný zápis, proto se povely posílají
          postupně s ohledem na limit 20 požadavků za minutu.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {BUTTONS.map((button) => {
          const isBusy = activeAction === button.action;
          return (
            <HouseClimateButton
              key={button.action}
              eyebrow={button.eyebrow}
              title={isBusy ? button.busyTitle : button.idleTitle}
              subtitle={button.subtitle}
              disabled={disabled}
              busy={isBusy}
              className={button.className}
              onClick={() => void onApply(button.action)}
            />
          );
        })}
      </div>
    </section>
  );
}

function HouseClimateButton({
  eyebrow,
  title,
  subtitle,
  disabled,
  busy,
  className,
  onClick,
}: {
  eyebrow: string;
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
        {eyebrow}
      </span>
      <span className="mt-1 text-2xl font-semibold sm:text-3xl">{title}</span>
      <span className="mt-1 text-sm text-white/80">{subtitle}</span>
    </button>
  );
}
