import { describe, expect, it, vi } from "vitest";
import { runPdfQueueBatch } from "./pdfQueueWorker";

const job = {
  id: 17,
  documentId: 7,
  leaseToken: "lease-17",
  attemptCount: 1,
  maxAttempts: 3,
  payload: {
    workflow: "owner_pdf_ai_v1" as const,
    uploadedBy: 1,
    examId: 1,
    subjectId: 2,
    topicId: 3,
    sourceLabel: "AI PDF import · source.pdf",
  },
  storageKey: "owner-imports/1/source.pdf",
  originalName: "source.pdf",
};

const extracted = [
  {
    stem: "Which quality control ensures imported questions cannot bypass reviewer approval?",
    options: [
      "Direct publish",
      "Reviewer draft workflow",
      "Payment capture",
      "Student profile",
    ],
    correctIndex: 1,
    explanation:
      "Imported questions remain review drafts until a reviewer approves them.",
    confidence: 93,
  },
];

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    claimNextQueuedPdfJob: vi.fn().mockResolvedValue(job),
    completeQueuedPdfJob: vi.fn().mockResolvedValue(true),
    failQueuedPdfJob: vi
      .fn()
      .mockResolvedValue({
        updated: true,
        deadLettered: false,
        retryAt: new Date("2026-08-27T00:01:00Z"),
      }),
    findQuestionByFingerprint: vi.fn().mockResolvedValue(undefined),
    createQuestionWithVersion: vi.fn().mockResolvedValue(44),
    appendAuditLog: vi.fn().mockResolvedValue(undefined),
    storageGetSignedUrl: vi
      .fn()
      .mockResolvedValue("https://signed.example/source.pdf"),
    extractQuestionsFromPdf: vi.fn().mockResolvedValue(extracted),
    ...overrides,
  } as never;
}

describe("durable PDF queue worker", () => {
  it("claims a queued PDF, creates review-only drafts, records AI validation, and stops at the configured batch bound", async () => {
    const deps = dependencies({
      validateExtractedQuestionsWithAi: vi
        .fn()
        .mockResolvedValue([
          {
            verdict: "pass",
            confidence: 94,
            issues: ["No issues reported."],
            explanationQuality: 92,
            suggestedExplanation:
              "The reviewer-approved workflow prevents direct publication.",
          },
        ]),
    });
    const result = await runPdfQueueBatch({
      maxJobs: 1,
      workerToken: "worker",
      dependencies: deps,
    });
    expect(result.outcomes).toEqual([{ jobId: 17, state: "completed" }]);
    expect(deps.storageGetSignedUrl).toHaveBeenCalledWith(
      "owner-imports/1/source.pdf"
    );
    expect(deps.createQuestionWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "needs_review",
        createdBy: 1,
        sourceLabel: "AI PDF import · source.pdf",
        qualityScore: 100,
        changeSummary: expect.stringContaining("AI validation: pass"),
      })
    );
    expect(deps.completeQueuedPdfJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 17,
        documentId: 7,
        metadata: expect.objectContaining({
          processed: 1,
          created: 1,
          duplicates: 0,
          aiValidation: {
            pass: 1,
            needs_review: 0,
            reject: 0,
            fallback: false,
          },
        }),
      })
    );
  });

  it("keeps drafts safe when the second AI validation pass is unavailable", async () => {
    const deps = dependencies({
      validateExtractedQuestionsWithAi: vi
        .fn()
        .mockRejectedValue(new Error("AI provider unavailable")),
    });
    await runPdfQueueBatch({ maxJobs: 1, dependencies: deps });
    expect(deps.createQuestionWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "needs_review",
        changeSummary: expect.stringContaining("AI validation: needs_review"),
      })
    );
    expect(deps.completeQueuedPdfJob).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          aiValidation: { pass: 0, needs_review: 1, reject: 0, fallback: true },
        }),
      })
    );
  });

  it("withholds duplicate drafts and schedules a bounded retry when extraction fails", async () => {
    const duplicateDeps = dependencies({
      findQuestionByFingerprint: vi.fn().mockResolvedValue({ id: 99 }),
    });
    await runPdfQueueBatch({ maxJobs: 1, dependencies: duplicateDeps });
    expect(duplicateDeps.createQuestionWithVersion).not.toHaveBeenCalled();
    expect(duplicateDeps.completeQueuedPdfJob).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          processed: 1,
          created: 0,
          duplicates: 1,
        }),
      })
    );

    const failureDeps = dependencies({
      extractQuestionsFromPdf: vi
        .fn()
        .mockRejectedValue(new Error("provider unavailable")),
    });
    const result = await runPdfQueueBatch({
      maxJobs: 1,
      dependencies: failureDeps,
    });
    expect(result.outcomes).toEqual([{ jobId: 17, state: "retry_scheduled" }]);
    expect(failureDeps.failQueuedPdfJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 17,
        leaseToken: "lease-17",
        error: "provider unavailable",
      })
    );
    expect(failureDeps.completeQueuedPdfJob).not.toHaveBeenCalled();
  });
});
