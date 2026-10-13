import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("client security exposure", () => {
  it("uses only httpOnly cookie transport and does not mirror a session token into browser storage or Authorization headers", () => {
    const transport = source("client/src/main.tsx");
    const auth = source("client/src/_core/hooks/useAuth.ts");
    expect(transport).not.toContain("manus-cookie");
    expect(transport).not.toContain("Authorization: `Bearer");
    expect(auth).not.toContain("manus-cookie");
    expect(auth).not.toContain("localStorage");
    expect(auth).not.toContain("sessionStorage");
  });

  it("does not embed Forge credentials or a browser map proxy in active client source", () => {
    const map = source("client/src/components/Map.tsx");
    expect(map).not.toContain("VITE_FRONTEND_FORGE_API_KEY");
    expect(map).not.toContain("VITE_FRONTEND_FORGE_API_URL");
    expect(map).not.toContain("maps/api/js?key=");
  });
});
