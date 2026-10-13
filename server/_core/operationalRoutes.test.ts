import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { assertProductionConfiguration, registerOperationalRoutes } from "./operationalRoutes";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

async function requestOperationalRoute(path: string, options: Parameters<typeof registerOperationalRoutes>[1]) {
  const app = express();
  const controls = registerOperationalRoutes(app, options);
  const server = await new Promise<Server>(resolve => {
    const listening = app.listen(0, () => resolve(listening));
  });
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine test server address");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { response: await fetch(`${baseUrl}${path}`), baseUrl, controls };
}

describe("operational routes", () => {
  it("exposes liveness and a request correlation header", async () => {
    const { response } = await requestOperationalRoute("/healthz", { checkDatabase: async () => undefined });
    await expect(response.json()).resolves.toEqual({ ok: true, status: "live" });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("reports dependency readiness and a draining state", async () => {
    const checkDatabase = vi.fn().mockResolvedValue(undefined);
    const ready = await requestOperationalRoute("/readyz", { checkDatabase });
    expect(ready.response.status).toBe(200);
    await expect(ready.response.json()).resolves.toEqual({ ok: true, status: "ready" });
    expect(checkDatabase).toHaveBeenCalledTimes(1);
    ready.controls.beginDrain();
    const drained = await fetch(`${ready.baseUrl}/readyz`);
    expect(drained.status).toBe(503);
    await expect(drained.json()).resolves.toEqual({ ok: false, status: "draining" });
  });

  it("reports not-ready without leaking dependency errors", async () => {
    const { response } = await requestOperationalRoute("/readyz", { checkDatabase: async () => { throw new Error("private database detail"); } });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, status: "not_ready" });
  });
});

describe("production configuration", () => {
  it("fails fast only when a required production variable is absent", () => {
    expect(() => assertProductionConfiguration({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionConfiguration({ NODE_ENV: "production", DATABASE_URL: "db", SESSION_SECRET: "a-secure-session-secret-with-32-plus-chars", OWNER_EMAIL: "owner@example.com" })).not.toThrow();
    expect(() => assertProductionConfiguration({ NODE_ENV: "production", DATABASE_URL: "db" })).toThrow("SESSION_SECRET");
  });
});
