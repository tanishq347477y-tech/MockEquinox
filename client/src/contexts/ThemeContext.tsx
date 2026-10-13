import React, { createContext, useContext, useEffect, useState } from "react";
import {
  baseThemeForAppearance,
  normalizeAppearance,
  readPreferenceOverrides,
  type Appearance,
} from "./themePreferences";

interface ThemeContextType {
  theme: "light" | "dark";
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark";
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = false,
}: ThemeProviderProps) {
  const overrides = readPreferenceOverrides(window.location.search);
  const [appearance, setAppearance] = useState<Appearance>(
    () =>
      overrides.appearance ??
      normalizeAppearance(localStorage.getItem("mocke-appearance"))
  );
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      overrides.reducedMotion ??
      localStorage.getItem("mocke-reduced-motion") === "true"
  );
  const theme = baseThemeForAppearance(appearance);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    root.dataset.appearance = appearance;
    root.dataset.reducedMotion = String(reducedMotion);
    localStorage.setItem("mocke-appearance", appearance);
    localStorage.setItem("mocke-reduced-motion", String(reducedMotion));
  }, [theme, appearance, reducedMotion]);

  const toggleTheme = switchable
    ? () => {
        setAppearance(prev => (prev === "dark" ? "light" : "dark"));
      }
    : undefined;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        appearance,
        setAppearance,
        reducedMotion,
        setReducedMotion,
        toggleTheme,
        switchable,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
