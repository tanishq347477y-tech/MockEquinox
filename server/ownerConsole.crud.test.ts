import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";

const mocks = vi.hoisted(() => ({
  appendAuditLog: vi.fn(),
  listOwnerAuditLogs: vi.fn(),
  listOwnerAiIntakeAuditLogs: vi.fn(),
  listOwnerManagedUsers: vi.fn(),
  updateOwnerManagedUserRole: vi.fn(),
  getOwnerContentReferences: vi.fn(),
  findQuestionByFingerprint: vi.fn(),
  createQuestionWithVersion: vi.fn(),
  createDocumentWithInitialJobs: vi.fn(),
  createQueuedPdfDocument: vi.fn(),
  storagePut: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  extractQuestionsFromPdf: vi.fn(),
  extractQuestionsFromText: vi.fn(),
  getPlanById: vi.fn(),
  reviseQuestionWithVersion: vi.fn(),
  updateQuestionStatus: vi.fn(),
}));

vi.mock("./audit", () => ({ appendAuditLog: mocks.appendAuditLog }));
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listOwnerAuditLogs: mocks.listOwnerAuditLogs,
    listOwnerAiIntakeAuditLogs: mocks.listOwnerAiIntakeAuditLogs,
    listOwnerManagedUsers: mocks.listOwnerManagedUsers,
    updateOwnerManagedUserRole: mocks.updateOwnerManagedUserRole,
    getOwnerContentReferences: mocks.getOwnerContentReferences,
    findQuestionByFingerprint: mocks.findQuestionByFingerprint,
    createQuestionWithVersion: mocks.createQuestionWithVersion,
    createDocumentWithInitialJobs: mocks.createDocumentWithInitialJobs,
    createQueuedPdfDocument: mocks.createQueuedPdfDocument,
    getPlanById: mocks.getPlanById,
    reviseQuestionWithVersion: mocks.reviseQuestionWithVersion,
    updateQuestionStatus: mocks.updateQuestionStatus,
  };
});
vi.mock("./storage", async importOriginal => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storagePut: mocks.storagePut,
  storageGetSignedUrl: mocks.storageGetSignedUrl,
}));
vi.mock("./contentPipeline", async importOriginal => ({
  ...(await importOriginal<typeof import("./contentPipeline")>()),
  extractQuestionsFromPdf: mocks.extractQuestionsFromPdf,
  extractQuestionsFromText: mocks.extractQuestionsFromText,
}));

import { appRouter } from "./routers";

function ownerContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "owner-crud-test",
      name: "Owner",
      email: "owner@example.com",
      loginMethod: "password",
      role: "super_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function nonOwnerContext(
  role: "student" | "reviewer" | "admin" = "reviewer"
): TrpcContext {
  return {
    user: {
      id: 8,
      openId: "non-owner-test",
      name: "Not Owner",
      email: "reviewer@example.com",
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

const questionInput = {
  examId: 1,
  subjectId: 2,
  topicId: 3,
  difficulty: "medium" as const,
  stem: "A sufficiently detailed question prompt is required for the content workflow.",
  options: [
    { key: "A", text: "One" },
    { key: "B", text: "Two" },
    { key: "C", text: "Three" },
    { key: "D", text: "Four" },
  ],
  correctOption: "A",
  explanation: "The first option is correct for this controlled contract test.",
  marks: 4,
  negativeMarks: 1,
  sourceLabel: "Owner console test",
};

describe("owner console CRUD contracts", () => {
  const originalOwner = ENV.ownerEmail;
  const originalStagingAiTestMode = ENV.stagingAiTestMode;
  beforeAll(() => {
    ENV.ownerEmail = "owner@example.com";
    ENV.stagingAiTestMode = false;
    mocks.appendAuditLog.mockResolvedValue(undefined);
    mocks.listOwnerAuditLogs.mockResolvedValue([
      {
        id: 9,
        action: "owner.question_published",
        entityType: "question",
        entityId: "44",
        metadata: { version: 2 },
        createdAt: new Date("2026-08-26T10:00:00Z"),
        actorName: "Owner",
      },
    ]);
    mocks.listOwnerAiIntakeAuditLogs.mockResolvedValue([
      {
        id: 18,
        action: "queue.pdf_completed",
        entityType: "documentUpload",
        entityId: "7",
        metadata: { created: 4 },
        createdAt: new Date(),
        actorName: "Owner",
      },
    ]);
    mocks.listOwnerManagedUsers.mockResolvedValue([
      {
        id: 2,
        openId: "learner",
        name: "Learner",
        email: "learner@example.com",
        role: "student",
        createdAt: new Date(),
        lastSignedIn: new Date(),
      },
    ]);
    mocks.updateOwnerManagedUserRole.mockResolvedValue({
      id: 2,
      name: "Learner",
      email: "learner@example.com",
      role: "reviewer",
      lastSignedIn: new Date(),
    });
    mocks.getOwnerContentReferences.mockResolvedValue({
      exams: [],
      subjects: [],
      topics: [],
    });
    mocks.findQuestionByFingerprint.mockResolvedValue(undefined);
    mocks.createQuestionWithVersion.mockResolvedValue(44);
    mocks.createDocumentWithInitialJobs.mockResolvedValue({ id: 7 });
    mocks.createQueuedPdfDocument.mockResolvedValue({
      document: { id: 7 },
      jobId: 17,
    });
    mocks.storagePut.mockResolvedValue({
      key: "owner-imports/1/source.pdf",
      url: "/api/storage/owner-imports/1/source.pdf",
    });
    mocks.storageGetSignedUrl.mockResolvedValue(
      "https://signed.example/source.pdf"
    );
    mocks.extractQuestionsFromPdf.mockResolvedValue([
      {
        stem: "Which step must occur before a reviewer can publish an imported question?",
        options: [
          "Immediate publication",
          "Manual reviewer approval",
          "Student attempt",
          "Payment capture",
        ],
        correctIndex: 1,
        explanation: "Imports remain reviewer drafts until approved.",
        confidence: 94,
      },
    ]);
    mocks.extractQuestionsFromText.mockResolvedValue([
      {
        stem: "Which step keeps a staging AI test from changing production content?",
        options: [
          "It writes directly",
          "It uses no-write isolation",
          "It publishes immediately",
          "It skips validation",
        ],
        correctIndex: 1,
        explanation:
          "The smoke test returns structured output without persistence.",
        confidence: 96,
      },
    ]);
    mocks.getPlanById.mockResolvedValue({
      id: 1,
      examId: 1,
      name: "Security test plan",
      amountPaise: 100,
      active: true,
    });
    mocks.reviseQuestionWithVersion.mockResolvedValue(2);
    mocks.updateQuestionStatus.mockResolvedValue(undefined);
  });
  afterAll(() => {
    ENV.ownerEmail = originalOwner;
    ENV.stagingAiTestMode = originalStagingAiTestMode;
  });

  it("updates a non-owner role and records the action", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.users.updateRole({ userId: 2, role: "reviewer" })
    ).resolves.toMatchObject({ id: 2, role: "reviewer" });
    expect(mocks.updateOwnerManagedUserRole).toHaveBeenCalledWith({
      userId: 2,
      role: "reviewer",
    });
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "owner.user_role_updated",
        entityId: "2",
      })
    );
  });

  it("returns bounded administrative history through the owner-only audit-log procedure", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.audit.list({ limit: 25 })
    ).resolves.toMatchObject([
      { id: 9, action: "owner.question_published", actorName: "Owner" },
    ]);
    expect(mocks.listOwnerAuditLogs).toHaveBeenCalledWith(25);
  });

  it("returns the filtered owner-only AI intake ledger", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.audit.aiIntake({ limit: 50 })
    ).resolves.toMatchObject([
      { action: "queue.pdf_completed", entityId: "7" },
    ]);
    expect(mocks.listOwnerAiIntakeAuditLogs).toHaveBeenCalledWith(50);
  });

  it("creates a versioned question and records its owner audit entry", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.content.create(questionInput)
    ).resolves.toMatchObject({ questionId: 44, status: "needs_review" });
    expect(mocks.createQuestionWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        createdBy: 1,
        status: "needs_review",
        stem: questionInput.stem,
      })
    );
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "owner.question_created",
        entityId: "44",
      })
    );
  });

  it("versions and publishes existing questions through audited owner actions", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.content.update({
        ...questionInput,
        questionId: 44,
        changeSummary: "Clarified the prompt wording.",
      })
    ).resolves.toMatchObject({ questionId: 44, version: 2 });
    await expect(
      caller.ownerConsole.content.setStatus({
        questionId: 44,
        status: "published",
      })
    ).resolves.toEqual({ questionId: 44, status: "published" });
    expect(mocks.reviseQuestionWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 44, updatedBy: 1 })
    );
    expect(mocks.updateQuestionStatus).toHaveBeenCalledWith({
      questionId: 44,
      status: "published",
    });
  });

  it("stores a PDF as a durable queued AI job without processing it inside the intake request", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const base64 = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 test source").toString("base64")}`;
    await expect(
      caller.ownerConsole.intake.processPdf({
        fileName: "source.pdf",
        base64,
        examId: 1,
        subjectId: 2,
        topicId: 3,
      })
    ).resolves.toMatchObject({ documentId: 7, jobId: 17, status: "queued" });
    expect(mocks.storagePut).toHaveBeenCalledWith(
      expect.stringContaining("owner-imports/1/source.pdf"),
      expect.any(Buffer),
      "application/pdf"
    );
    expect(mocks.createQueuedPdfDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedBy: 1,
        examId: 1,
        subjectId: 2,
        topicId: 3,
        sourceLabel: "AI PDF import · source.pdf",
      })
    );
    expect(mocks.extractQuestionsFromPdf).not.toHaveBeenCalled();
    expect(mocks.createQuestionWithVersion).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLabel: expect.stringContaining("AI PDF import"),
      })
    );
  });

  it("validates structured JSON questions and creates review-only drafts", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.intake.importJson({
        fileName: "questions.json",
        examId: 1,
        subjectId: 2,
        topicId: 3,
        questions: [
          {
            stem: "Which process prevents an imported question from bypassing review controls?",
            options: [
              "Immediate publish",
              "Duplicate and quality review",
              "Checkout confirmation",
              "Learner profile update",
            ],
            correctIndex: 1,
            explanation: "Imported questions stay in needs-review status.",
            difficulty: "medium",
          },
        ],
      })
    ).resolves.toMatchObject({
      created: 1,
      duplicates: 0,
      sourceLabel: "Structured JSON import · questions.json",
    });
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "owner.json_questions_imported" })
    );
  });

  it("rejects non-PDF bytes before storage or AI processing begins", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.intake.processPdf({
        fileName: "not-a-pdf.pdf",
        base64: `data:application/pdf;base64,${Buffer.from("plain text").toString("base64")}`,
        examId: 1,
        subjectId: 2,
        topicId: 3,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects malformed structured question arrays before reviewer drafts are created", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.intake.importJson({
        fileName: "invalid.json",
        examId: 1,
        subjectId: 2,
        topicId: 3,
        questions: [
          {
            stem: "This malformed question does not contain exactly four answer options.",
            options: ["One", "Two", "Three"],
            correctIndex: 0,
          },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("runs the staging AI smoke test only when explicitly enabled and never creates a question or queue job", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const sourceText =
      "This staging source is long enough to exercise structured extraction without touching the question bank or durable queue.";
    await expect(
      caller.ownerConsole.intake.testExtract({ sourceText })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    ENV.stagingAiTestMode = true;
    await expect(
      caller.ownerConsole.intake.testExtract({ sourceText })
    ).resolves.toMatchObject({
      mode: "staging_no_write",
      processed: 1,
      questions: [{ correctIndex: 1 }],
    });
    expect(mocks.extractQuestionsFromText).toHaveBeenCalledWith(sourceText);
    expect(mocks.createQuestionWithVersion).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLabel: expect.stringContaining("staging"),
      })
    );
    expect(mocks.createQueuedPdfDocument).not.toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLabel: expect.stringContaining("staging"),
      })
    );
    expect(mocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "owner.staging_ai_test_completed",
        metadata: expect.objectContaining({ writes: false }),
      })
    );
  });

  it("blocks every PDF upload and AI extraction entry point for non-owner identities", async () => {
    const caller = appRouter.createCaller(nonOwnerContext());
    const base64 = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 test source").toString("base64")}`;
    await expect(
      caller.ownerConsole.intake.processPdf({
        fileName: "source.pdf",
        base64,
        examId: 1,
        subjectId: 2,
        topicId: 3,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.documents.ingestPdf({ fileName: "source.pdf", base64, examId: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.reviewer.extractDrafts({
        examId: 1,
        subjectId: 2,
        topicId: 3,
        sourceText:
          "This source is intentionally long enough to reach the authorization boundary before any AI extraction is attempted.",
        sourceLabel: "Non-owner test",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.extractQuestionsFromPdf).not.toHaveBeenCalled();
  });

  it("throttles repeated owner-intake work before unbounded AI processing can occur", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await expect(
      caller.ownerConsole.intake.importJson({
        fileName: "limit.json",
        examId: 1,
        subjectId: 2,
        topicId: 3,
        questions: [
          {
            stem: "This request intentionally verifies that source intake becomes rate limited after the configured threshold.",
            options: ["One", "Two", "Three", "Four"],
            correctIndex: 0,
          },
        ],
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("throttles repeated payment-order creation before gateway work is attempted", async () => {
    const caller = appRouter.createCaller(ownerContext());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        caller.payments.createOrder({ planId: 1 })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    }
    await expect(
      caller.payments.createOrder({ planId: 1 })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
