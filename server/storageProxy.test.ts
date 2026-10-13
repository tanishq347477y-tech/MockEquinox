import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));

import { registerStorageProxy } from "./_core/storageProxy";

describe("private owner-import storage", () => {
  const servers: Array<ReturnType<express.Express["listen"]>> = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    mocks.authenticateRequest.mockReset();
  });

  it("returns a non-enumerable 404 for unauthenticated owner source material before storage access", async () => {
    mocks.authenticateRequest.mockResolvedValue(null);
    const app = express();
    registerStorageProxy(app);
    const server = app.listen(0);
    servers.push(server);
    await new Promise<void>(resolve => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/storage/owner-imports/1/source.pdf`);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});
