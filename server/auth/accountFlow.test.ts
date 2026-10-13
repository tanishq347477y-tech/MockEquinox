import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({
  consumeAuthToken: vi.fn(),
  markUserEmailVerified: vi.fn(),
  updateLocalPassword: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<typeof import("../db")>()),
  consumeAuthToken: mocks.consumeAuthToken,
  markUserEmailVerified: mocks.markUserEmailVerified,
  updateLocalPassword: mocks.updateLocalPassword,
}));
vi.mock("../_core/sdk", () => ({
  sdk: { createSessionToken: mocks.createSessionToken },
}));

import { appRouter } from "../routers";

const user = {
  id: 8,
  openId: "local-8",
  name: "Verified Learner",
  email: "learner@example.com",
  loginMethod: "password",
  passwordHash: "never-return-this-hash",
  emailVerifiedAt: null,
  role: "student" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function context(): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn() } as TrpcContext["res"],
  };
}

describe("local account token flows", () => {
  it("never returns password hashes from auth.me", async () => {
    const result = await appRouter.createCaller(context()).auth.me();
    expect(result).toMatchObject({
      id: 8,
      email: "learner@example.com",
      emailVerifiedAt: null,
      isOwner: false,
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("openId");
  });

  it("consumes an email verification token once and starts a safe session", async () => {
    mocks.consumeAuthToken.mockResolvedValueOnce(8);
    mocks.markUserEmailVerified.mockResolvedValueOnce({
      ...user,
      emailVerifiedAt: new Date(),
    });
    mocks.createSessionToken.mockResolvedValueOnce("signed-session");
    const result = await appRouter
      .createCaller(context())
      .auth.verifyEmail({ token: "v".repeat(64) });
    expect(mocks.consumeAuthToken).toHaveBeenCalledWith({
      token: "v".repeat(64),
      type: "email_verification",
    });
    expect(mocks.markUserEmailVerified).toHaveBeenCalledWith(8);
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(mocks.createSessionToken).toHaveBeenCalledWith("local-8", {
      name: "Verified Learner",
    });
  });

  it("hashes a replacement password only after a valid reset token", async () => {
    mocks.consumeAuthToken.mockResolvedValueOnce(8);
    mocks.updateLocalPassword.mockResolvedValueOnce({ ...user });
    const result = await appRouter
      .createCaller(context())
      .auth.resetPassword({
        token: "r".repeat(64),
        password: "a-new-long-secure-password",
      });
    expect(result).toEqual({ success: true });
    expect(mocks.consumeAuthToken).toHaveBeenCalledWith({
      token: "r".repeat(64),
      type: "password_reset",
    });
    expect(mocks.updateLocalPassword).toHaveBeenCalledWith(
      8,
      expect.any(String)
    );
    expect(mocks.updateLocalPassword.mock.calls[0]?.[1]).not.toBe(
      "a-new-long-secure-password"
    );
  });
});
