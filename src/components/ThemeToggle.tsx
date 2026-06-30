"use client";

import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle() {
  const { mode, resolvedTheme, cycleMode } = useTheme();

  const getTitle = () => {
    if (mode === "light") return "Přepnout na tmavý režim";
    if (mode === "dark") return "Přepnout na automatický režim";
    return "Přepnout na světlý režim";
  };

  const getLabel = () => {
    if (mode === "auto") return `Auto (${resolvedTheme === "dark" ? "tmavý" : "světlý"})`;
    return mode === "light" ? "Světlý" : "Tmavý";
  };

  return (
    <button
      onClick={cycleMode}
      className={cn(
        "relative flex h-10 items-center gap-2 rounded-xl border px-3 transition-all duration-300",
        "hover:scale-105 active:scale-95",
        resolvedTheme === "dark"
          ? "border-slate-600 bg-slate-900/70 text-amber-300 hover:border-amber-400/50 hover:bg-slate-800/70"
          : "border-slate-300 bg-white text-slate-700 hover:border-teal-400/50 hover:bg-slate-50",
      )}
      title={getTitle()}
      type="button"
    >
      {mode === "light" && (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
      {mode === "dark" && (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
      {mode === "auto" && (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      )}
      <span className="text-xs font-medium">{getLabel()}</span>
      <span className="sr-only">{getTitle()}</span>
    </button>
  );
}
