"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 rounded-full transition-all duration-300",
        checked ? "bg-teal-400 shadow-glow-teal" : "bg-slate-600",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  suffix?: string;
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  suffix,
}: SliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-700 accent-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="w-14 text-right font-mono text-sm text-teal-300">
        {value}
        {suffix}
      </span>
    </div>
  );
}

interface SelectProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function Select({ value, options, onChange, disabled }: SelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-slate-600/80 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-400/60 focus:ring-2 focus:ring-teal-400/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-glow-teal hover:from-teal-400 hover:to-cyan-400",
        variant === "secondary" &&
          "border border-slate-600 bg-slate-800/80 text-slate-100 hover:border-teal-500/40 hover:bg-slate-700/80",
        variant === "ghost" &&
          "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        variant === "danger" &&
          "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
        className,
      )}
      {...props}
    />
  );
}
