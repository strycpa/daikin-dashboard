"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme-mode") as ThemeMode | null;
    
    if (stored === "light" || stored === "dark" || stored === "auto") {
      setModeState(stored);
      if (stored === "auto") {
        setResolvedTheme(getSystemTheme());
      } else {
        setResolvedTheme(stored);
      }
    } else {
      setModeState("auto");
      setResolvedTheme(getSystemTheme());
    }
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem("theme-mode", newMode);
    
    const resolved = newMode === "auto" ? getSystemTheme() : newMode;
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  };

  const cycleMode = () => {
    const modes: ThemeMode[] = ["light", "dark", "auto"];
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
  };

  useEffect(() => {
    if (!mounted) return;

    if (mode !== "auto") {
      document.documentElement.setAttribute("data-theme", mode);
      setResolvedTheme(mode);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      const systemTheme = mediaQuery.matches ? "dark" : "light";
      setResolvedTheme(systemTheme);
      document.documentElement.setAttribute("data-theme", systemTheme);
    };

    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [mode, mounted]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode, cycleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
