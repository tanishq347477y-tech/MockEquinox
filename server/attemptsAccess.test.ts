import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createTestAttempt: vi.fn() }));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  createTestAttempt: mocks.createTestAttempt,
}));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 44, openId: "monthly-test", name: "Monthly Test", email: "monthly@example.com", loginMethod: "manus", role: "student", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("attempt monthly access", () => {
  it("rejects a fifth free-tier mock start with a clear monthly plan boundary", async () => {
    mocks.createTestAttempt.mockResolvedValueOnce({ status: "limit_reached", allowance: { tier: "free", limit: 4, used: 4, remaining: 0, resetsAt: new Date("2026-09-01T00:00:00Z") } });
    await expect(appRouter.createCaller(context()).attempts.create({ testId: 1, durationSeconds: 3600 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("four mock starts") });
  });

  it("returns the remaining free monthly allowance with a created server-backed attempt", async () => {
    const attempt = { id: 51, state: "in_progress", startedAt: new Date("2026-08-01T10:00:00Z"), expiresAt: new Date("2026-08-01T11:00:00Z") };
    mocks.createTestAttempt.mockResolvedValueOnce({ status: "created", attempt, allowance: { tier: "free", limit: 4, used: 1, remaining: 3, resetsAt: new Date("2026-09-01T00:00:00Z") } });
    const result = await appRouter.createCaller(context()).attempts.create({ testId: 1, durationSeconds: 3600 });
    expect(result).toMatchObject({ attemptId: 51, allowance: { tier: "free", remaining: 3 } });
  });
});
