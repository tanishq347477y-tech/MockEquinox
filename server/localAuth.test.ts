import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const mocks = vi.hoisted(() => ({ createLocalUser: vi.fn(), getUserByEmail: vi.fn(), createSessionToken: vi.fn() }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<typeof import("./db")>()), createLocalUser: mocks.createLocalUser, getUserByEmail: mocks.getUserByEmail }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mocks.createSessionToken } }));

import { appRouter } from "./routers";

function context() {
  const cookie = vi.fn();
  return { ctx: { user: null, req: { protocol: "https", headers: {} }, res: { cookie } } as unknown as TrpcContext, cookie };
}

describe("portable local authentication", () => {
  const originalOwnerEmail = ENV.ownerEmail;
  beforeAll(() => {
    ENV.ownerEmail = "owner@example.com";
    mocks.createSessionToken.mockResolvedValue("signed-local-session");
  });
  afterAll(() => { ENV.ownerEmail = originalOwnerEmail; });

  it("registers a local password account, identifies the configured owner, and writes an HTTP-only session cookie", async () => {
    mocks.createLocalUser.mockResolvedValue({ status: "created", user: { id: 5, openId: "local-5", name: "Owner", email: "owner@example.com" } });
    const { ctx, cookie } = context();
    const result = await appRouter.createCaller(ctx).auth.register({ name: "Owner", email: "OWNER@example.com", password: "a-longer-secure-password" });
    expect(mocks.createLocalUser).toHaveBeenCalledWith(expect.objectContaining({ email: "owner@example.com", openId: expect.stringMatching(/^local_/) }));
    expect(mocks.createSessionToken).toHaveBeenCalledWith("local-5", { name: "Owner" });
    expect(cookie).toHaveBeenCalledWith(expect.any(String), "signed-local-session", expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
    expect(result.user.isOwner).toBe(true);
  });

  it("rejects invalid credentials without writing a session", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: 5, openId: "local-5", passwordHash: null });
    const { ctx, cookie } = context();
    await expect(appRouter.createCaller(ctx).auth.login({ email: "owner@example.com", password: "wrong-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookie).not.toHaveBeenCalled();
  });
});
