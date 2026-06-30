"use client";

import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300",
        "hover:scale-105 active:scale-95",
        theme === "dark"
          ? "border-slate-600 bg-slate-900/70 text-amber-300 hover:border-amber-400/50 hover:bg-slate-800/70"
          : "border-slate-300 bg-white text-slate-700 hover:border-teal-400/50 hover:bg-slate-50",
      )}
      title={theme === "dark" ? "Přepnout na denní režim" : "Přepnout na noční režim"}
      type="button"
    >
      {theme === "dark" ? (
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
      ) : (
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
      <span className="sr-only">
        {theme === "dark" ? "Přepnout na denní režim" : "Přepnout na noční režim"}
      </span>
    </button>
  );
}
