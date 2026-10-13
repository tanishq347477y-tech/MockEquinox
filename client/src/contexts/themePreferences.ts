export const appearanceOptions = ["light", "dark", "high-contrast"] as const;
export type Appearance = (typeof appearanceOptions)[number];

export function normalizeAppearance(
  value: string | null | undefined,
  fallback: Appearance = "dark"
): Appearance {
  return appearanceOptions.includes(value as Appearance)
    ? (value as Appearance)
    : fallback;
}

export function baseThemeForAppearance(appearance: Appearance) {
  return appearance === "light" ? "light" : "dark";
}

export function readPreferenceOverrides(search: string) {
  const params = new URLSearchParams(search);
  const rawAppearance = params.get("appearance");
  const rawMotion = params.get("motion");
  return {
    appearance: rawAppearance ? normalizeAppearance(rawAppearance) : undefined,
    reducedMotion:
      rawMotion === "reduce" ? true : rawMotion === "full" ? false : undefined,
  };
}
