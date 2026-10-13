import { randomUUID } from "node:crypto";
import { appendAuditLog } from "./audit";
import {
  claimNextQueuedPdfJob,
  completeQueuedPdfJob,
  createQuestionWithVersion,
  failQueuedPdfJob,
  findQuestionByFingerprint,
  type ClaimedPdfProcessingJob,
} from "./db";
import {
  extractQuestionsFromPdf,
  type AiQuestionValidation,
  type ExtractedQuestion,
  validateExtractedQuestionsWithAi,
} from "./contentPipeline";
import {
  createQuestionFingerprint,
  scoreQuestionQuality,
} from "./questionQuality";
import { storageGetSignedUrl } from "./storage";

type QueueDependencies = {
  claimNextQueuedPdfJob: typeof claimNextQueuedPdfJob;
  completeQueuedPdfJob: typeof completeQueuedPdfJob;
  failQueuedPdfJob: typeof failQueuedPdfJob;
  findQuestionByFingerprint: typeof findQuestionByFingerprint;
  createQuestionWithVersion: typeof createQuestionWithVersion;
  appendAuditLog: typeof appendAuditLog;
  storageGetSignedUrl: typeof storageGetSignedUrl;
  extractQuestionsFromPdf: typeof extractQuestionsFromPdf;
  validateExtractedQuestionsWithAi: typeof validateExtractedQuestionsWithAi;
};

const defaults: QueueDependencies = {
  claimNextQueuedPdfJob,
  completeQueuedPdfJob,
  failQueuedPdfJob,
  findQuestionByFingerprint,
  createQuestionWithVersion,
  appendAuditLog,
  storageGetSignedUrl,
  extractQuestionsFromPdf,
  validateExtractedQuestionsWithAi,
};

function assertOwnerPdfPayload(job: ClaimedPdfProcessingJob) {
  const payload = job.payload;
  if (
    payload?.workflow !== "owner_pdf_ai_v1" ||
    !Number.isInteger(payload.uploadedBy) ||
    !Number.isInteger(payload.examId) ||
    !Number.isInteger(payload.subjectId) ||
    !Number.isInteger(payload.topicId)
  )
    throw new Error("Queued PDF job payload is invalid.");
  return payload;
}

function fallbackValidation(question: ExtractedQuestion): AiQuestionValidation {
  return {
    verdict: "needs_review",
    confidence: 0,
    issues: [
      question.explanation.trim()
        ? "AI validation was unavailable; reviewer confirmation is required."
        : "AI validation and explanation generation were unavailable.",
    ],
    explanationQuality: question.explanation.trim() ? 40 : 0,
    suggestedExplanation: "",
  };
}

async function createReviewerDrafts(
  job: ClaimedPdfProcessingJob,
  extracted: ExtractedQuestion[],
  dependencies: QueueDependencies
) {
  const payload = assertOwnerPdfPayload(job);
  let validations: AiQuestionValidation[];
  let validationFallback = false;
  try {
    validations =
      await dependencies.validateExtractedQuestionsWithAi(extracted);
  } catch {
    validations = extracted.map(fallbackValidation);
    validationFallback = true;
  }
  let created = 0;
  let duplicates = 0;
  const validationCounts = { pass: 0, needs_review: 0, reject: 0 };
  for (let index = 0; index < extracted.length; index += 1) {
    const draft = extracted[index];
    const validation = validations[index] ?? fallbackValidation(draft);
    validationCounts[validation.verdict] += 1;
    const options = draft.options.map((text, optionIndex) => ({
      key: String.fromCharCode(65 + optionIndex),
      text,
    }));
    const explanation =
      draft.explanation.trim() || validation.suggestedExplanation.trim();
    const fingerprint = createQuestionFingerprint(draft.stem, draft.options);
    if (await dependencies.findQuestionByFingerprint(fingerprint)) {
      duplicates += 1;
      continue;
    }
    const baseScore = scoreQuestionQuality({
      stem: draft.stem,
      options: draft.options,
      correctOption: draft.options[draft.correctIndex],
      explanation,
    });
    const qualityScore = Math.max(
      0,
      Math.min(
        100,
        baseScore +
          (validation.verdict === "pass"
            ? 5
            : validation.verdict === "reject"
              ? -15
              : 0)
      )
    );
    const issueSummary = validation.issues.slice(0, 4).join(" | ");
    const questionId = await dependencies.createQuestionWithVersion({
      examId: payload.examId,
      subjectId: payload.subjectId,
      topicId: payload.topicId,
      difficulty: "medium",
      status: "needs_review",
      qualityScore,
      fingerprint,
      createdBy: payload.uploadedBy,
      stem: draft.stem,
      options,
      correctOption: options[draft.correctIndex].key,
      explanation: explanation || null,
      marks: 4,
      negativeMarks: 1,
      sourceLabel: payload.sourceLabel,
      changeSummary: `AI validation: ${validation.verdict}; confidence ${validation.confidence}; explanation quality ${validation.explanationQuality}; ${issueSummary}`,
    });
    await dependencies.appendAuditLog({
      actorUserId: payload.uploadedBy,
      action: "queue.pdf_draft_created",
      entityType: "question",
      entityId: String(questionId),
      metadata: {
        documentId: job.documentId,
        qualityScore,
        aiVerdict: validation.verdict,
        aiConfidence: validation.confidence,
        aiIssues: validation.issues.slice(0, 4),
      },
    });
    created += 1;
  }
  return {
    processed: extracted.length,
    created,
    duplicates,
    aiValidation: { ...validationCounts, fallback: validationFallback },
  };
}

export async function runPdfQueueBatch(input: {
  maxJobs: number;
  workerToken?: string;
  dependencies?: Partial<QueueDependencies>;
}) {
  const dependencies = { ...defaults, ...input.dependencies };
  const workerToken = input.workerToken ?? randomUUID();
  const outcomes: Array<{
    jobId: number;
    state: "completed" | "retry_scheduled" | "dead_letter";
  }> = [];
  for (
    let index = 0;
    index < Math.min(Math.max(input.maxJobs, 1), 2);
    index += 1
  ) {
    const job = await dependencies.claimNextQueuedPdfJob({
      workerToken: `${workerToken}-${index}`,
    });
    if (!job) break;
    try {
      await dependencies.appendAuditLog({
        actorUserId: job.payload.uploadedBy,
        action: "queue.pdf_extraction_started",
        entityType: "processingJob",
        entityId: String(job.id),
        metadata: { documentId: job.documentId, attempt: job.attemptCount },
      });
      const signedUrl = await dependencies.storageGetSignedUrl(job.storageKey);
      const extracted = await dependencies.extractQuestionsFromPdf(signedUrl);
      const result = await createReviewerDrafts(job, extracted, dependencies);
      await dependencies.completeQueuedPdfJob({
        jobId: job.id,
        documentId: job.documentId,
        leaseToken: job.leaseToken,
        metadata: result,
      });
      await dependencies.appendAuditLog({
        actorUserId: job.payload.uploadedBy,
        action: "queue.pdf_completed",
        entityType: "documentUpload",
        entityId: String(job.documentId),
        metadata: result,
      });
      outcomes.push({ jobId: job.id, state: "completed" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown PDF queue error";
      await dependencies.appendAuditLog({
        actorUserId: job.payload.uploadedBy,
        action: "queue.pdf_extraction_failed",
        entityType: "processingJob",
        entityId: String(job.id),
        metadata: {
          documentId: job.documentId,
          attempt: job.attemptCount,
          error: message.slice(0, 240),
        },
      });
      const failed = await dependencies.failQueuedPdfJob({
        jobId: job.id,
        documentId: job.documentId,
        leaseToken: job.leaseToken,
        error: message,
      });
      await dependencies.appendAuditLog({
        actorUserId: job.payload.uploadedBy,
        action: failed.deadLettered
          ? "queue.pdf_dead_letter"
          : "queue.pdf_retry_scheduled",
        entityType: "documentUpload",
        entityId: String(job.documentId),
        metadata: {
          jobId: job.id,
          attempt: job.attemptCount,
          retryAt: failed.retryAt?.toISOString(),
        },
      });
      outcomes.push({
        jobId: job.id,
        state: failed.deadLettered ? "dead_letter" : "retry_scheduled",
      });
    }
  }
  return { workerToken, outcomes };
}
