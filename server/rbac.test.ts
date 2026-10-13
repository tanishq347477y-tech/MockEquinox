import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

function createContext(role: "student" | "reviewer" | "admin" | "super_admin", openId = "rbac-user", email = "rbac@example.com"): TrpcContext {
  return {
    user: {
      id: 1,
      openId,
      name: "RBAC Test",
      email,
      loginMethod: "password",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("role procedure boundaries", () => {
  const originalOwnerEmail = ENV.ownerEmail;
  beforeAll(() => { ENV.ownerEmail = "owner@example.com"; });
  afterAll(() => { ENV.ownerEmail = originalOwnerEmail; });
  it("keeps reviewer operations unavailable to students", async () => {
    const caller = appRouter.createCaller(createContext("student"));
    await expect(caller.reviewer.queueSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows reviewers into content queues but not administrator metrics", async () => {
    const caller = appRouter.createCaller(createContext("reviewer"));
    await expect(caller.reviewer.queueSummary()).resolves.toMatchObject({ needsReview: expect.any(Number), queued: expect.any(Number) });
    await expect(caller.admin.operationsSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps developer metrics unavailable to non-owner administrators", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.reviewer.queueSummary()).resolves.toMatchObject({ processing: expect.any(Number) });
    await expect(caller.admin.operationsSummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.audit.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.queue.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.queue.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.queue.schedule()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.queue.setEnabled({ enabled: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.queue.retry({ jobId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.content.references()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.intake.importJson({ examId: 1, subjectId: 1, topicId: 1, questions: [{ stem: "A non-owner import request must fail before any question can be persisted.", options: ["One", "Two", "Three", "Four"], correctIndex: 0 }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.ownerConsole.content.create({
      examId: 1,
      subjectId: 1,
      topicId: 1,
      difficulty: "medium",
      stem: "A valid non-owner mutation attempt must be rejected before persistence.",
      options: [{ key: "A", text: "One" }, { key: "B", text: "Two" }, { key: "C", text: "Three" }, { key: "D", text: "Four" }],
      correctOption: "A",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows only the configured project owner into developer metrics", async () => {
    const caller = appRouter.createCaller(createContext("admin", "owner-test", "owner@example.com"));
    await expect(caller.admin.operationsSummary()).resolves.toMatchObject({ publishedQuestions: expect.any(Number), users: expect.any(Number) });
    await expect(caller.ownerConsole.users.list()).resolves.toEqual(expect.any(Array));
    await expect(caller.ownerConsole.audit.list()).resolves.toEqual(expect.any(Array));
    await expect(caller.ownerConsole.queue.status()).resolves.toBeUndefined();
    await expect(caller.ownerConsole.queue.list()).resolves.toEqual(expect.any(Array));
    await expect(caller.ownerConsole.content.references()).resolves.toMatchObject({ exams: expect.any(Array), subjects: expect.any(Array), topics: expect.any(Array) });
    await expect(caller.ownerConsole.users.updateRole({ userId: 1, role: "student" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
