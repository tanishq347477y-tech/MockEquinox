import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  like,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  attemptAnswers,
  auditLogs,
  authTokens,
  documentUploads,
  exams,
  monthlyMockUsage,
  paymentWebhookEvents,
  payments,
  plans,
  processingJobs,
  queueWorkerSchedules,
  questionVersions,
  questions,
  subjects,
  subscriptions,
  testAttempts,
  testQuestions,
  tests,
  topics,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.email?.toLowerCase() === ENV.ownerEmail) {
      values.role = "super_admin";
      updateSet.role = "super_admin";
    } else {
      values.role = "student";
      updateSet.role = "student";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createLocalUser(input: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email = input.email.toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) return { status: "exists" as const, user: existing };
  await db.insert(users).values({
    openId: input.openId,
    name: input.name,
    email,
    passwordHash: input.passwordHash,
    emailVerifiedAt: input.emailVerifiedAt ?? null,
    loginMethod: "password",
    role: email === ENV.ownerEmail ? "super_admin" : "student",
    lastSignedIn: new Date(),
  });
  const user = await getUserByOpenId(input.openId);
  if (!user) throw new Error("Could not create account");
  return { status: "created" as const, user };
}

type AuthTokenType = "email_verification" | "password_reset";

function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthToken(input: {
  userId: number;
  type: AuthTokenType;
  ttlMs: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rawToken = randomBytes(32).toString("hex");
  const now = new Date();
  await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.userId, input.userId),
        eq(authTokens.type, input.type),
        isNull(authTokens.usedAt)
      )
    );
  await db.insert(authTokens).values({
    userId: input.userId,
    type: input.type,
    tokenHash: hashAuthToken(rawToken),
    expiresAt: new Date(now.getTime() + input.ttlMs),
  });
  return rawToken;
}

export async function consumeAuthToken(input: {
  token: string;
  type: AuthTokenType;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  const tokenHash = hashAuthToken(input.token);
  const [record] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.type, input.type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now)
      )
    )
    .limit(1);
  if (!record) return undefined;
  const updated = await db
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.id, record.id),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now)
      )
    );
  const affectedRows = Number(
    (updated as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0
  );
  return affectedRows === 1 ? record.userId : undefined;
}

export async function markUserEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateLocalPassword(
  userId: number,
  passwordHash: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(users)
    .set({ passwordHash, loginMethod: "password" })
    .where(eq(users.id, userId));
  return getUserById(userId);
}

export async function listOwnerManagedUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.lastSignedIn))
    .limit(100);
}

export async function listOwnerAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function listOwnerAiIntakeAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(
      or(
        like(auditLogs.action, "owner.pdf_ai_%"),
        like(auditLogs.action, "owner.json_questions_%"),
        like(auditLogs.action, "owner.staging_ai_%"),
        like(auditLogs.action, "queue.pdf_%")
      )
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function updateOwnerManagedUserRole(input: {
  userId: number;
  role: "student" | "reviewer" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(users)
    .set({ role: input.role })
    .where(eq(users.id, input.userId));
  const updated = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  return updated[0];
}

export const FREE_MONTHLY_MOCK_LIMIT = 4;

export function monthWindow(now: Date) {
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const resetsAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return { monthKey, resetsAt };
}

type MockStartAllowance = {
  tier: "free" | "subscription";
  limit: number | null;
  used: number | null;
  remaining: number | null;
  resetsAt: Date | null;
};

export type TestAttemptCreation =
  | {
      status: "created";
      attempt: typeof testAttempts.$inferSelect;
      allowance: MockStartAllowance;
    }
  | { status: "not_found" }
  | { status: "limit_reached"; allowance: MockStartAllowance };

export async function createTestAttempt(input: {
  userId: number;
  testId: number;
  durationSeconds: number;
}): Promise<TestAttemptCreation> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const startedAt = new Date();
  const { monthKey, resetsAt } = monthWindow(startedAt);
  return db.transaction(async tx => {
    const [test] = await tx
      .select({ id: tests.id, examId: tests.examId })
      .from(tests)
      .where(eq(tests.id, input.testId))
      .limit(1);
    if (!test) return { status: "not_found" };
    const [subscription] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, input.userId),
          eq(subscriptions.examId, test.examId),
          eq(subscriptions.status, "active"),
          or(
            isNull(subscriptions.expiresAt),
            gt(subscriptions.expiresAt, startedAt)
          )
        )
      )
      .limit(1);
    let allowance: MockStartAllowance;
    if (subscription) {
      allowance = {
        tier: "subscription",
        limit: null,
        used: null,
        remaining: null,
        resetsAt: null,
      };
    } else {
      await tx
        .insert(monthlyMockUsage)
        .values({ userId: input.userId, monthKey, usedCount: 0 })
        .onDuplicateKeyUpdate({ set: { updatedAt: startedAt } });
      const increment = await tx
        .update(monthlyMockUsage)
        .set({ usedCount: sql`${monthlyMockUsage.usedCount} + 1` })
        .where(
          and(
            eq(monthlyMockUsage.userId, input.userId),
            eq(monthlyMockUsage.monthKey, monthKey),
            lt(monthlyMockUsage.usedCount, FREE_MONTHLY_MOCK_LIMIT)
          )
        );
      const usedCount = Number(
        (increment as unknown as [{ affectedRows?: number }])[0]
          ?.affectedRows ?? 0
      );
      if (usedCount !== 1) {
        const [usage] = await tx
          .select({ usedCount: monthlyMockUsage.usedCount })
          .from(monthlyMockUsage)
          .where(
            and(
              eq(monthlyMockUsage.userId, input.userId),
              eq(monthlyMockUsage.monthKey, monthKey)
            )
          )
          .limit(1);
        return {
          status: "limit_reached",
          allowance: {
            tier: "free",
            limit: FREE_MONTHLY_MOCK_LIMIT,
            used: usage?.usedCount ?? FREE_MONTHLY_MOCK_LIMIT,
            remaining: 0,
            resetsAt,
          },
        };
      }
      const [usage] = await tx
        .select({ usedCount: monthlyMockUsage.usedCount })
        .from(monthlyMockUsage)
        .where(
          and(
            eq(monthlyMockUsage.userId, input.userId),
            eq(monthlyMockUsage.monthKey, monthKey)
          )
        )
        .limit(1);
      allowance = {
        tier: "free",
        limit: FREE_MONTHLY_MOCK_LIMIT,
        used: usage?.usedCount ?? 1,
        remaining: Math.max(
          0,
          FREE_MONTHLY_MOCK_LIMIT - (usage?.usedCount ?? 1)
        ),
        resetsAt,
      };
    }
    const expiresAt = new Date(
      startedAt.getTime() + input.durationSeconds * 1000
    );
    const insert = await tx.insert(testAttempts).values({
      userId: input.userId,
      testId: input.testId,
      state: "in_progress",
      startedAt,
      expiresAt,
      currentQuestionPosition: 1,
    });
    const [attempt] = await tx
      .select()
      .from(testAttempts)
      .where(eq(testAttempts.id, Number(insert[0].insertId)))
      .limit(1);
    if (!attempt) throw new Error("Attempt was not persisted");
    return { status: "created", attempt, allowance };
  });
}

export async function getMockStartAllowance(userId: number, testId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  const { monthKey, resetsAt } = monthWindow(now);
  const [test] = await db
    .select({ examId: tests.examId })
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);
  if (!test) return undefined;
  const [subscription] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.examId, test.examId),
        eq(subscriptions.status, "active"),
        or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now))
      )
    )
    .limit(1);
  if (subscription)
    return {
      tier: "subscription" as const,
      limit: null,
      used: null,
      remaining: null,
      resetsAt: null,
    };
  const [usage] = await db
    .select({ usedCount: monthlyMockUsage.usedCount })
    .from(monthlyMockUsage)
    .where(
      and(
        eq(monthlyMockUsage.userId, userId),
        eq(monthlyMockUsage.monthKey, monthKey)
      )
    )
    .limit(1);
  const used = Math.min(FREE_MONTHLY_MOCK_LIMIT, usage?.usedCount ?? 0);
  return {
    tier: "free" as const,
    limit: FREE_MONTHLY_MOCK_LIMIT,
    used,
    remaining: FREE_MONTHLY_MOCK_LIMIT - used,
    resetsAt,
  };
}

export async function saveAttemptProgress(input: {
  userId: number;
  attemptId: number;
  testQuestionId: number;
  selectedOption: string | null;
  markedForReview: boolean;
  elapsedSeconds: number;
  currentQuestionPosition: number;
  questionSnapshot: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const attempt = await db
    .select({
      id: testAttempts.id,
      state: testAttempts.state,
      expiresAt: testAttempts.expiresAt,
    })
    .from(testAttempts)
    .where(
      and(
        eq(testAttempts.id, input.attemptId),
        eq(testAttempts.userId, input.userId)
      )
    )
    .limit(1);
  const current = attempt[0];
  if (
    !current ||
    !["started", "in_progress", "abandoned"].includes(current.state)
  )
    return false;
  if (current.expiresAt && current.expiresAt.getTime() <= Date.now())
    return false;

  await db
    .insert(attemptAnswers)
    .values({
      attemptId: input.attemptId,
      testQuestionId: input.testQuestionId,
      selectedOption: input.selectedOption,
      markedForReview: input.markedForReview,
      elapsedSeconds: input.elapsedSeconds,
      questionSnapshot: input.questionSnapshot,
    })
    .onDuplicateKeyUpdate({
      set: {
        selectedOption: input.selectedOption,
        markedForReview: input.markedForReview,
        elapsedSeconds: input.elapsedSeconds,
        questionSnapshot: input.questionSnapshot,
      },
    });
  await db
    .update(testAttempts)
    .set({
      currentQuestionPosition: input.currentQuestionPosition,
      state: "in_progress",
    })
    .where(eq(testAttempts.id, input.attemptId));
  return true;
}

export async function getAttemptResumeState(userId: number, attemptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const attempts = await db
    .select()
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.userId, userId)))
    .limit(1);
  const attempt = attempts[0];
  if (!attempt) return undefined;
  const answers = await db
    .select()
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attempt.id));
  return { attempt, answers };
}

export async function submitAndEvaluateAttempt(
  userId: number,
  attemptId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const attempts = await db
    .select()
    .from(testAttempts)
    .where(and(eq(testAttempts.id, attemptId), eq(testAttempts.userId, userId)))
    .limit(1);
  const attempt = attempts[0];
  if (!attempt) return undefined;
  if (
    ["submitted", "evaluated", "analytics_generated"].includes(attempt.state)
  ) {
    return {
      idempotent: true,
      score: attempt.score,
      correct: attempt.correctCount,
      incorrect: attempt.incorrectCount,
      skipped: attempt.skippedCount,
    };
  }
  if (
    ![
      "started",
      "in_progress",
      "abandoned",
      "expired",
      "force_submitted",
    ].includes(attempt.state)
  )
    return undefined;

  const answers = await db
    .select({
      selectedOption: attemptAnswers.selectedOption,
      correctOption: questionVersions.correctOption,
      marks: testQuestions.marks,
      negativeMarks: testQuestions.negativeMarks,
    })
    .from(attemptAnswers)
    .innerJoin(
      testQuestions,
      eq(testQuestions.id, attemptAnswers.testQuestionId)
    )
    .innerJoin(
      questionVersions,
      and(
        eq(questionVersions.questionId, testQuestions.questionId),
        eq(questionVersions.version, testQuestions.questionVersion)
      )
    )
    .where(eq(attemptAnswers.attemptId, attemptId));

  let score = 0;
  let correct = 0;
  let incorrect = 0;
  for (const answer of answers) {
    if (!answer.selectedOption) continue;
    if (answer.selectedOption === answer.correctOption) {
      correct += 1;
      score += answer.marks;
    } else {
      incorrect += 1;
      score -= answer.negativeMarks;
    }
  }
  const skipped = Math.max(0, answers.length - correct - incorrect);
  await db
    .update(testAttempts)
    .set({
      state: "evaluated",
      submittedAt: new Date(),
      score,
      correctCount: correct,
      incorrectCount: incorrect,
      skippedCount: skipped,
    })
    .where(eq(testAttempts.id, attemptId));
  return { idempotent: false, score, correct, incorrect, skipped };
}

export async function getStudentPerformanceSummary(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const attempts = await db
    .select({
      id: testAttempts.id,
      testId: testAttempts.testId,
      score: testAttempts.score,
      correct: testAttempts.correctCount,
      incorrect: testAttempts.incorrectCount,
      skipped: testAttempts.skippedCount,
      startedAt: testAttempts.startedAt,
      submittedAt: testAttempts.submittedAt,
      createdAt: testAttempts.createdAt,
    })
    .from(testAttempts)
    .where(
      and(eq(testAttempts.userId, userId), eq(testAttempts.state, "evaluated"))
    )
    .orderBy(desc(testAttempts.submittedAt))
    .limit(24);

  const totals = attempts.reduce(
    (acc, attempt) => {
      acc.score += attempt.score ?? 0;
      acc.correct += attempt.correct ?? 0;
      acc.incorrect += attempt.incorrect ?? 0;
      acc.skipped += attempt.skipped ?? 0;
      if (attempt.startedAt && attempt.submittedAt)
        acc.elapsedSeconds += Math.max(
          0,
          Math.floor(
            (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000
          )
        );
      return acc;
    },
    { score: 0, correct: 0, incorrect: 0, skipped: 0, elapsedSeconds: 0 }
  );
  const attemptedQuestions = totals.correct + totals.incorrect;
  return {
    totals: {
      tests: attempts.length,
      averageScore: attempts.length
        ? Math.round((totals.score / attempts.length) * 100) / 100
        : 0,
      accuracy: attemptedQuestions
        ? Math.round((totals.correct / attemptedQuestions) * 1000) / 10
        : 0,
      totalQuestions: attemptedQuestions + totals.skipped,
      totalTimeSeconds: totals.elapsedSeconds,
    },
    history: attempts.reverse().map(attempt => ({
      attemptId: attempt.id,
      testId: attempt.testId,
      score: attempt.score ?? 0,
      correct: attempt.correct ?? 0,
      incorrect: attempt.incorrect ?? 0,
      skipped: attempt.skipped ?? 0,
      completedAt: attempt.submittedAt ?? attempt.createdAt,
    })),
  };
}

export async function createDocumentWithInitialJobs(input: {
  uploadedBy: number;
  examId?: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(documentUploads).values({ ...input, status: "queued" });
  const documents = await db
    .select()
    .from(documentUploads)
    .where(eq(documentUploads.sha256, input.sha256))
    .limit(1);
  const document = documents[0];
  if (!document) throw new Error("Document was not persisted");
  await db.insert(processingJobs).values([
    {
      documentId: document.id,
      type: "extract_text",
      state: "queued",
      payload: { source: "upload" },
    },
    {
      documentId: document.id,
      type: "extract_questions",
      state: "queued",
      payload: { source: "text_extraction" },
    },
    {
      documentId: document.id,
      type: "validate_questions",
      state: "queued",
      payload: { source: "structured_questions" },
    },
    {
      documentId: document.id,
      type: "detect_duplicates",
      state: "queued",
      payload: { source: "validated_questions" },
    },
    {
      documentId: document.id,
      type: "score_quality",
      state: "queued",
      payload: { source: "deduplicated_questions" },
    },
  ]);
  return document;
}

export type QueuedPdfPayload = {
  workflow: "owner_pdf_ai_v1";
  uploadedBy: number;
  examId: number;
  subjectId: number;
  topicId: number;
  sourceLabel: string;
};

export async function createQueuedPdfDocument(input: {
  uploadedBy: number;
  examId: number;
  subjectId: number;
  topicId: number;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  sourceLabel: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const documentInsert = await tx.insert(documentUploads).values({
      uploadedBy: input.uploadedBy,
      examId: input.examId,
      storageKey: input.storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      status: "queued",
    });
    const documentId = Number(documentInsert[0].insertId);
    const payload: QueuedPdfPayload = {
      workflow: "owner_pdf_ai_v1",
      uploadedBy: input.uploadedBy,
      examId: input.examId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      sourceLabel: input.sourceLabel,
    };
    const jobInsert = await tx.insert(processingJobs).values({
      documentId,
      type: "extract_questions",
      queueKind: "owner_pdf_ai",
      state: "queued",
      payload,
      availableAt: new Date(),
    });
    const [document] = await tx
      .select()
      .from(documentUploads)
      .where(eq(documentUploads.id, documentId))
      .limit(1);
    if (!document) throw new Error("Document was not persisted");
    return { document, jobId: Number(jobInsert[0].insertId) };
  });
}

export type ClaimedPdfProcessingJob = {
  id: number;
  documentId: number;
  leaseToken: string;
  attemptCount: number;
  maxAttempts: number;
  payload: QueuedPdfPayload;
  storageKey: string;
  originalName: string;
};

export async function claimNextQueuedPdfJob(input: {
  workerToken: string;
  now?: Date;
  leaseMs?: number;
}): Promise<ClaimedPdfProcessingJob | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + (input.leaseMs ?? 150_000));
  const eligible = or(
    and(
      eq(processingJobs.state, "queued"),
      lte(processingJobs.availableAt, now)
    ),
    and(
      eq(processingJobs.state, "processing"),
      lt(processingJobs.leaseExpiresAt, now)
    )
  );
  const [candidate] = await db
    .select({ id: processingJobs.id })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.type, "extract_questions"),
        eligible
      )
    )
    .orderBy(asc(processingJobs.availableAt), asc(processingJobs.id))
    .limit(1);
  if (!candidate) return undefined;
  await db
    .update(processingJobs)
    .set({
      state: "processing",
      attemptCount: sql`${processingJobs.attemptCount} + 1`,
      progressPercent: 10,
      startedAt: now,
      leaseToken: input.workerToken,
      leaseExpiresAt,
      lastError: null,
    })
    .where(
      and(
        eq(processingJobs.id, candidate.id),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eligible
      )
    );
  const [job] = await db
    .select()
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.id, candidate.id),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.state, "processing"),
        eq(processingJobs.leaseToken, input.workerToken)
      )
    )
    .limit(1);
  if (!job) return undefined;
  const [document] = await db
    .select({
      storageKey: documentUploads.storageKey,
      originalName: documentUploads.originalName,
    })
    .from(documentUploads)
    .where(eq(documentUploads.id, job.documentId))
    .limit(1);
  if (!document) throw new Error("Queued document is missing");
  return {
    id: job.id,
    documentId: job.documentId,
    leaseToken: input.workerToken,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    payload: job.payload as QueuedPdfPayload,
    storageKey: document.storageKey,
    originalName: document.originalName,
  };
}

export async function completeQueuedPdfJob(input: {
  jobId: number;
  documentId: number;
  leaseToken: string;
  metadata: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [locked] = await db
    .select({ id: processingJobs.id, payload: processingJobs.payload })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.id, input.jobId),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.state, "processing"),
        eq(processingJobs.leaseToken, input.leaseToken)
      )
    )
    .limit(1);
  if (!locked) return false;
  await db
    .update(processingJobs)
    .set({
      state: "completed",
      progressPercent: 100,
      completedAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      payload: { ...(locked.payload ?? {}), result: input.metadata },
    })
    .where(
      and(
        eq(processingJobs.id, input.jobId),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.leaseToken, input.leaseToken)
      )
    );
  await db
    .update(documentUploads)
    .set({ status: "completed" })
    .where(eq(documentUploads.id, input.documentId));
  return true;
}

export async function failQueuedPdfJob(input: {
  jobId: number;
  documentId: number;
  leaseToken: string;
  error: string;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [job] = await db
    .select({
      attemptCount: processingJobs.attemptCount,
      maxAttempts: processingJobs.maxAttempts,
    })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.id, input.jobId),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.state, "processing"),
        eq(processingJobs.leaseToken, input.leaseToken)
      )
    )
    .limit(1);
  if (!job) return { updated: false, deadLettered: false, retryAt: undefined };
  const now = input.now ?? new Date();
  const deadLettered = job.attemptCount >= job.maxAttempts;
  const retryAt = deadLettered
    ? undefined
    : new Date(
        now.getTime() +
          Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, job.attemptCount - 1))
      );
  await db
    .update(processingJobs)
    .set({
      state: deadLettered ? "dead_letter" : "queued",
      progressPercent: 0,
      lastError: input.error.slice(0, 1000),
      availableAt: retryAt ?? now,
      leaseToken: null,
      leaseExpiresAt: null,
    })
    .where(
      and(
        eq(processingJobs.id, input.jobId),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.leaseToken, input.leaseToken)
      )
    );
  await db
    .update(documentUploads)
    .set({ status: deadLettered ? "failed" : "queued" })
    .where(eq(documentUploads.id, input.documentId));
  return { updated: true, deadLettered, retryAt };
}

export async function listOwnerQueueJobs(limit = 40) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select({
      id: processingJobs.id,
      documentId: processingJobs.documentId,
      type: processingJobs.type,
      state: processingJobs.state,
      attemptCount: processingJobs.attemptCount,
      maxAttempts: processingJobs.maxAttempts,
      progressPercent: processingJobs.progressPercent,
      lastError: processingJobs.lastError,
      payload: processingJobs.payload,
      availableAt: processingJobs.availableAt,
      leaseExpiresAt: processingJobs.leaseExpiresAt,
      createdAt: processingJobs.createdAt,
      originalName: documentUploads.originalName,
    })
    .from(processingJobs)
    .innerJoin(
      documentUploads,
      eq(documentUploads.id, processingJobs.documentId)
    )
    .where(eq(processingJobs.queueKind, "owner_pdf_ai"))
    .orderBy(desc(processingJobs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function retryDeadLetterQueueJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [job] = await db
    .select({ documentId: processingJobs.documentId })
    .from(processingJobs)
    .where(
      and(
        eq(processingJobs.id, jobId),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.state, "dead_letter")
      )
    )
    .limit(1);
  if (!job) return false;
  await db
    .update(processingJobs)
    .set({
      state: "queued",
      attemptCount: 0,
      progressPercent: 0,
      lastError: null,
      availableAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
      completedAt: null,
    })
    .where(
      and(
        eq(processingJobs.id, jobId),
        eq(processingJobs.queueKind, "owner_pdf_ai"),
        eq(processingJobs.state, "dead_letter")
      )
    );
  await db
    .update(documentUploads)
    .set({ status: "queued" })
    .where(eq(documentUploads.id, job.documentId));
  return true;
}

export async function getQueueWorkerScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [schedule] = await db
    .select()
    .from(queueWorkerSchedules)
    .where(eq(queueWorkerSchedules.scheduleCronTaskUid, taskUid))
    .limit(1);
  return schedule;
}

export async function getQueueWorkerSchedule() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [schedule] = await db
    .select()
    .from(queueWorkerSchedules)
    .where(eq(queueWorkerSchedules.name, "owner-pdf-ai-queue"))
    .limit(1);
  return schedule;
}

export async function saveQueueWorkerSchedule(input: {
  taskUid: string;
  batchSize: number;
  enabled: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getQueueWorkerSchedule();
  if (existing) {
    await db
      .update(queueWorkerSchedules)
      .set({
        scheduleCronTaskUid: input.taskUid,
        batchSize: input.batchSize,
        isEnabled: input.enabled,
      })
      .where(eq(queueWorkerSchedules.id, existing.id));
  } else {
    await db.insert(queueWorkerSchedules).values({
      name: "owner-pdf-ai-queue",
      scheduleCronTaskUid: input.taskUid,
      cronExpression: "0 * * * * *",
      batchSize: input.batchSize,
      isEnabled: input.enabled,
    });
  }
  return getQueueWorkerSchedule();
}

export async function setQueueWorkerScheduleEnabled(enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const schedule = await getQueueWorkerSchedule();
  if (!schedule) return undefined;
  await db
    .update(queueWorkerSchedules)
    .set({ isEnabled: enabled })
    .where(eq(queueWorkerSchedules.id, schedule.id));
  return getQueueWorkerSchedule();
}

export async function claimQueueWorkerRun(input: {
  taskUid: string;
  workerToken: string;
  now?: Date;
  leaseMs?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = input.now ?? new Date();
  const [schedule] = await db
    .select()
    .from(queueWorkerSchedules)
    .where(eq(queueWorkerSchedules.scheduleCronTaskUid, input.taskUid))
    .limit(1);
  if (!schedule) return { status: "orphan" as const };
  if (!schedule.isEnabled) return { status: "disabled" as const };
  const eligible = or(
    isNull(queueWorkerSchedules.executionLeaseExpiresAt),
    lt(queueWorkerSchedules.executionLeaseExpiresAt, now)
  );
  await db
    .update(queueWorkerSchedules)
    .set({
      executionLeaseToken: input.workerToken,
      executionLeaseExpiresAt: new Date(
        now.getTime() + (input.leaseMs ?? 115_000)
      ),
      lastRunAt: now,
    })
    .where(and(eq(queueWorkerSchedules.id, schedule.id), eligible));
  const [claimed] = await db
    .select()
    .from(queueWorkerSchedules)
    .where(
      and(
        eq(queueWorkerSchedules.id, schedule.id),
        eq(queueWorkerSchedules.executionLeaseToken, input.workerToken)
      )
    )
    .limit(1);
  return claimed
    ? { status: "claimed" as const, schedule: claimed }
    : { status: "busy" as const };
}

export async function releaseQueueWorkerRun(input: {
  taskUid: string;
  workerToken: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(queueWorkerSchedules)
    .set({ executionLeaseToken: null, executionLeaseExpiresAt: null })
    .where(
      and(
        eq(queueWorkerSchedules.scheduleCronTaskUid, input.taskUid),
        eq(queueWorkerSchedules.executionLeaseToken, input.workerToken)
      )
    );
}

export async function findQuestionByFingerprint(fingerprint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db
    .select({
      id: questions.id,
      status: questions.status,
      qualityScore: questions.qualityScore,
    })
    .from(questions)
    .where(eq(questions.fingerprint, fingerprint))
    .limit(1);
  return result[0];
}

export async function listQuestionBank(input: {
  examId?: number;
  subjectId?: number;
  topicId?: number;
  status?:
    | "extracted"
    | "validating"
    | "needs_review"
    | "approved"
    | "published"
    | "rejected"
    | "archived";
  difficulty?: "easy" | "medium" | "hard";
  search?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const conditions = [];
  if (input.examId) conditions.push(eq(questions.examId, input.examId));
  if (input.subjectId)
    conditions.push(eq(questions.subjectId, input.subjectId));
  if (input.topicId) conditions.push(eq(questions.topicId, input.topicId));
  if (input.status) conditions.push(eq(questions.status, input.status));
  if (input.difficulty)
    conditions.push(eq(questions.difficulty, input.difficulty));
  if (input.search)
    conditions.push(like(questionVersions.stem, `%${input.search.trim()}%`));
  return db
    .select({
      id: questions.id,
      examId: questions.examId,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
      currentVersion: questions.currentVersion,
      difficulty: questions.difficulty,
      status: questions.status,
      qualityScore: questions.qualityScore,
      fingerprint: questions.fingerprint,
      stem: questionVersions.stem,
      updatedAt: questions.updatedAt,
    })
    .from(questions)
    .innerJoin(
      questionVersions,
      and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.version, questions.currentVersion)
      )
    )
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(questions.updatedAt))
    .limit(100);
}

export async function getOwnerManagedQuestion(questionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db
    .select({
      id: questions.id,
      examId: questions.examId,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
      currentVersion: questions.currentVersion,
      difficulty: questions.difficulty,
      status: questions.status,
      qualityScore: questions.qualityScore,
      stem: questionVersions.stem,
      options: questionVersions.options,
      correctOption: questionVersions.correctOption,
      explanation: questionVersions.explanation,
      marks: questionVersions.marks,
      negativeMarks: questionVersions.negativeMarks,
      sourceLabel: questionVersions.sourceLabel,
    })
    .from(questions)
    .innerJoin(
      questionVersions,
      and(
        eq(questionVersions.questionId, questions.id),
        eq(questionVersions.version, questions.currentVersion)
      )
    )
    .where(eq(questions.id, questionId))
    .limit(1);
  return result[0];
}

export async function getOwnerContentReferences() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [examRows, subjectRows, topicRows] = await Promise.all([
    db
      .select({
        id: exams.id,
        name: exams.name,
        shortName: exams.shortName,
        status: exams.status,
      })
      .from(exams)
      .limit(100),
    db
      .select({
        id: subjects.id,
        examId: subjects.examId,
        name: subjects.name,
        code: subjects.code,
      })
      .from(subjects)
      .limit(500),
    db
      .select({
        id: topics.id,
        subjectId: topics.subjectId,
        name: topics.name,
        slug: topics.slug,
      })
      .from(topics)
      .limit(1_000),
  ]);
  return { exams: examRows, subjects: subjectRows, topics: topicRows };
}

export async function createOwnerManagedExam(input: {
  slug: string;
  name: string;
  shortName: string;
  description?: string | null;
  status: "draft" | "published" | "archived";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const insert = await db.insert(exams).values(input);
  const examId = Number(insert[0].insertId);
  const created = await db
    .select()
    .from(exams)
    .where(eq(exams.id, examId))
    .limit(1);
  return created[0];
}

export async function updateOwnerManagedExam(input: {
  examId: number;
  slug: string;
  name: string;
  shortName: string;
  description?: string | null;
  status: "draft" | "published" | "archived";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(exams)
    .set({
      slug: input.slug,
      name: input.name,
      shortName: input.shortName,
      description: input.description ?? null,
      status: input.status,
    })
    .where(eq(exams.id, input.examId));
  const updated = await db
    .select()
    .from(exams)
    .where(eq(exams.id, input.examId))
    .limit(1);
  return updated[0];
}

export async function createOwnerManagedSubject(input: {
  examId: number;
  name: string;
  code: string;
  position: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const insert = await db.insert(subjects).values(input);
  const subjectId = Number(insert[0].insertId);
  const created = await db
    .select()
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);
  return created[0];
}

export async function createOwnerManagedTopic(input: {
  subjectId: number;
  name: string;
  slug: string;
  position: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const insert = await db.insert(topics).values(input);
  const topicId = Number(insert[0].insertId);
  const created = await db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  return created[0];
}

export async function createQuestionWithVersion(input: {
  examId: number;
  subjectId: number;
  topicId: number;
  difficulty: "easy" | "medium" | "hard";
  status:
    | "extracted"
    | "validating"
    | "needs_review"
    | "approved"
    | "published"
    | "rejected"
    | "archived";
  qualityScore: number;
  fingerprint: string;
  createdBy: number;
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctOption: string;
  explanation?: string | null;
  marks: number;
  negativeMarks: number;
  sourceLabel?: string | null;
  changeSummary?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const insert = await db.insert(questions).values({
    examId: input.examId,
    subjectId: input.subjectId,
    topicId: input.topicId,
    difficulty: input.difficulty,
    status: input.status,
    qualityScore: input.qualityScore,
    fingerprint: input.fingerprint,
    createdBy: input.createdBy,
  });
  const questionId = Number(insert[0].insertId);
  await db.insert(questionVersions).values({
    questionId,
    version: 1,
    stem: input.stem,
    options: input.options,
    correctOption: input.correctOption,
    explanation: input.explanation ?? null,
    marks: input.marks,
    negativeMarks: input.negativeMarks,
    sourceLabel: input.sourceLabel ?? null,
    changeSummary: input.changeSummary ?? null,
    createdBy: input.createdBy,
  });
  return questionId;
}

export async function updateQuestionStatus(input: {
  questionId: number;
  status:
    | "extracted"
    | "validating"
    | "needs_review"
    | "approved"
    | "published"
    | "rejected"
    | "archived";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(questions)
    .set({ status: input.status })
    .where(eq(questions.id, input.questionId));
}

export async function reviseQuestionWithVersion(input: {
  questionId: number;
  updatedBy: number;
  difficulty: "easy" | "medium" | "hard";
  qualityScore: number;
  fingerprint: string;
  stem: string;
  options: Array<{ key: string; text: string }>;
  correctOption: string;
  explanation?: string | null;
  marks: number;
  negativeMarks: number;
  sourceLabel?: string | null;
  changeSummary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db
    .select({ id: questions.id, currentVersion: questions.currentVersion })
    .from(questions)
    .where(eq(questions.id, input.questionId))
    .limit(1);
  const question = existing[0];
  if (!question) return undefined;
  const nextVersion = question.currentVersion + 1;
  await db.insert(questionVersions).values({
    questionId: input.questionId,
    version: nextVersion,
    stem: input.stem,
    options: input.options,
    correctOption: input.correctOption,
    explanation: input.explanation ?? null,
    marks: input.marks,
    negativeMarks: input.negativeMarks,
    sourceLabel: input.sourceLabel ?? null,
    changeSummary: input.changeSummary,
    createdBy: input.updatedBy,
  });
  await db
    .update(questions)
    .set({
      currentVersion: nextVersion,
      difficulty: input.difficulty,
      qualityScore: input.qualityScore,
      fingerprint: input.fingerprint,
      status: "needs_review",
    })
    .where(eq(questions.id, input.questionId));
  return nextVersion;
}

export async function recordPaymentWebhookEvent(input: {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  try {
    await db.insert(paymentWebhookEvents).values({
      provider: "razorpay",
      eventId: input.eventId,
      eventType: input.eventType,
      payload: input.payload,
      status: "received",
    });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function getPlanById(planId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.active, true)))
    .limit(1);
  return result[0];
}

export async function createPendingPayment(input: {
  userId: number;
  planId: number;
  providerOrderId: string;
  amountPaise: number;
  idempotencyKey: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(payments).values({
    userId: input.userId,
    providerOrderId: input.providerOrderId,
    amountPaise: input.amountPaise,
    idempotencyKey: input.idempotencyKey,
    status: "created",
  });
}

export async function getSubscriptionAccess(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"))
    )
    .orderBy(desc(subscriptions.expiresAt));
  const now = Date.now();
  return rows.filter(row => !row.expiresAt || row.expiresAt.getTime() > now);
}

export async function getTransactionHistory(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select({
      id: payments.id,
      providerOrderId: payments.providerOrderId,
      providerPaymentId: payments.providerPaymentId,
      amountPaise: payments.amountPaise,
      currency: payments.currency,
      status: payments.status,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
    .limit(50);
}

export async function getContentOperationsSummary() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [
    documents,
    jobs,
    questionRows,
    userRows,
    subscriptionRows,
    paymentRows,
    recentStudents,
  ] = await Promise.all([
    db.select({ status: documentUploads.status }).from(documentUploads),
    db.select({ state: processingJobs.state }).from(processingJobs),
    db
      .select({
        status: questions.status,
        qualityScore: questions.qualityScore,
      })
      .from(questions),
    db.select({ id: users.id }).from(users),
    db.select({ status: subscriptions.status }).from(subscriptions),
    db
      .select({ amountPaise: payments.amountPaise, status: payments.status })
      .from(payments),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(desc(users.lastSignedIn))
      .limit(6),
  ]);
  const queuedDocuments = documents.filter(
    row => row.status === "queued"
  ).length;
  const processing = jobs.filter(row => row.state === "processing").length;
  const failed = jobs.filter(row => row.state === "failed").length;
  const needsReview = questionRows.filter(
    row => row.status === "needs_review"
  ).length;
  const publishedQuestions = questionRows.filter(
    row => row.status === "published"
  ).length;
  const qualityEligible = questionRows.filter(
    row => (row.qualityScore ?? 0) >= 70
  ).length;
  const capturedRevenuePaise = paymentRows
    .filter(row => row.status === "captured")
    .reduce((sum, row) => sum + row.amountPaise, 0);
  return {
    queued: queuedDocuments,
    processing,
    needsReview,
    failed,
    publishedQuestions,
    validationPassRate: questionRows.length
      ? Math.round((qualityEligible / questionRows.length) * 1000) / 10
      : 0,
    users: userRows.length,
    activeSubscriptions: subscriptionRows.filter(row => row.status === "active")
      .length,
    capturedRevenuePaise,
    recentStudents,
  };
}
