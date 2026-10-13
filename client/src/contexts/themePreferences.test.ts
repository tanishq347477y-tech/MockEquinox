import { describe, expect, it } from "vitest";
import {
  baseThemeForAppearance,
  normalizeAppearance,
  readPreferenceOverrides,
} from "./themePreferences";

describe("theme preferences", () => {
  it("accepts light, dark, and high-contrast modes", () => {
    expect(normalizeAppearance("light")).toBe("light");
    expect(normalizeAppearance("dark")).toBe("dark");
    expect(normalizeAppearance("high-contrast")).toBe("high-contrast");
    expect(normalizeAppearance("unknown", "dark")).toBe("dark");
  });

  it("maps light mode to the light CSS theme and the others to dark", () => {
    expect(baseThemeForAppearance("light")).toBe("light");
    expect(baseThemeForAppearance("dark")).toBe("dark");
    expect(baseThemeForAppearance("high-contrast")).toBe("dark");
  });

  it("supports deterministic appearance and motion overrides for visual QA", () => {
    expect(readPreferenceOverrides("?appearance=light&motion=reduce")).toEqual({
      appearance: "light",
      reducedMotion: true,
    });
    expect(
      readPreferenceOverrides("?appearance=high-contrast&motion=full")
    ).toEqual({ appearance: "high-contrast", reducedMotion: false });
    expect(readPreferenceOverrides("")).toEqual({
      appearance: undefined,
      reducedMotion: undefined,
    });
  });
});
