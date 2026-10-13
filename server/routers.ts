import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  createAuthToken,
  createDocumentWithInitialJobs,
  createLocalUser,
  createOwnerManagedExam,
  createOwnerManagedSubject,
  createOwnerManagedTopic,
  createPendingPayment,
  createQueuedPdfDocument,
  createQuestionWithVersion,
  createTestAttempt,
  consumeAuthToken,
  findQuestionByFingerprint,
  getAttemptResumeState,
  getContentOperationsSummary,
  getMockStartAllowance,
  getOwnerContentReferences,
  getOwnerManagedQuestion,
  getPlanById,
  getQueueWorkerSchedule,
  getStudentPerformanceSummary,
  getSubscriptionAccess,
  getTransactionHistory,
  getUserByEmail,
  listOwnerAuditLogs,
  listOwnerAiIntakeAuditLogs,
  listOwnerManagedUsers,
  listOwnerQueueJobs,
  listQuestionBank,
  markUserEmailVerified,
  retryDeadLetterQueueJob,
  reviseQuestionWithVersion,
  saveAttemptProgress,
  saveQueueWorkerSchedule,
  setQueueWorkerScheduleEnabled,
  submitAndEvaluateAttempt,
  updateLocalPassword,
  updateOwnerManagedExam,
  updateOwnerManagedUserRole,
  updateQuestionStatus,
} from "./db";
import { appendAuditLog } from "./audit";
import {
  createQuestionFingerprint,
  scoreQuestionQuality,
} from "./questionQuality";
import { storagePut } from "./storage";
import { getRazorpayConfig } from "./razorpayConfig";
import {
  createPaymentIdempotencyKey,
  createRazorpayOrder,
} from "./razorpayOrders";
import {
  extractQuestionsFromText,
  type ExtractedQuestion,
} from "./contentPipeline";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  adminProcedure,
  ownerProcedure,
  protectedProcedure,
  publicProcedure,
  reviewerProcedure,
  router,
} from "./_core/trpc";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import {
  hashPassword,
  normalizeEmail,
  validatePassword,
  verifyPassword,
} from "./auth/credentials";
import { createSharedRateLimiter } from "./security";
import { canTransitionAttempt, scoreAttempt } from "./testEngine";
import { isEmailDeliveryConfigured, sendAccountEmail } from "./email";
import {
  getConfiguredServiceStatuses,
  probeExternalServices,
} from "./serviceStatus";

const previewScoreRateLimit = createSharedRateLimiter(40, 60_000);
const ownerIntakeRateLimit = createSharedRateLimiter(3, 10 * 60_000);
const paymentOrderRateLimit = createSharedRateLimiter(5, 10 * 60_000);
const authRateLimit = createSharedRateLimiter(10, 10 * 60_000);

type ImportDraft = {
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
};

async function createOwnerImportDrafts(input: {
  examId: number;
  subjectId: number;
  topicId: number;
  sourceLabel: string;
  drafts: ImportDraft[];
  userId: number;
}) {
  const created: Array<{
    questionId: number;
    qualityScore: number;
    duplicate: boolean;
    stem: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }> = [];
  for (const draft of input.drafts) {
    const options = draft.options.map((text, index) => ({
      key: String.fromCharCode(65 + index),
      text,
    }));
    const fingerprint = createQuestionFingerprint(draft.stem, draft.options);
    const duplicate = await findQuestionByFingerprint(fingerprint);
    if (duplicate) {
      created.push({
        questionId: duplicate.id,
        qualityScore: duplicate.qualityScore,
        duplicate: true,
        stem: draft.stem,
        options: draft.options,
        correctIndex: draft.correctIndex,
        explanation: draft.explanation,
      });
      continue;
    }
    const qualityScore = scoreQuestionQuality({
      stem: draft.stem,
      options: draft.options,
      correctOption: draft.options[draft.correctIndex],
      explanation: draft.explanation,
    });
    const questionId = await createQuestionWithVersion({
      examId: input.examId,
      subjectId: input.subjectId,
      topicId: input.topicId,
      difficulty: draft.difficulty ?? "medium",
      status: "needs_review",
      qualityScore,
      fingerprint,
      createdBy: input.userId,
      stem: draft.stem,
      options,
      correctOption: options[draft.correctIndex].key,
      explanation: draft.explanation,
      marks: 4,
      negativeMarks: 1,
      sourceLabel: input.sourceLabel,
    });
    await appendAuditLog({
      actorUserId: input.userId,
      action: "owner.import_draft_created",
      entityType: "question",
      entityId: String(questionId),
      metadata: { sourceLabel: input.sourceLabel, qualityScore },
    });
    created.push({
      questionId,
      qualityScore,
      duplicate: false,
      stem: draft.stem,
      options: draft.options,
      correctIndex: draft.correctIndex,
      explanation: draft.explanation,
    });
  }
  return {
    processed: input.drafts.length,
    created: created.filter(item => !item.duplicate).length,
    duplicates: created.filter(item => item.duplicate).length,
    drafts: created,
  };
}

function writeLocalSession(
  ctx: { req: any; res: any },
  user: { openId: string; name: string | null }
) {
  return sdk
    .createSessionToken(user.openId, { name: user.name ?? "MockE learner" })
    .then(token => {
      ctx.res.cookie(COOKIE_NAME, token, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: ONE_YEAR_MS,
      });
    });
}

function publicUser(
  user: {
    id: number;
    name: string | null;
    email: string | null;
    role: string;
    emailVerifiedAt?: Date | null;
  },
  isOwner: boolean
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    isOwner,
  };
}

function accountLink(kind: "verify" | "reset", token: string) {
  return `${ENV.appOrigin.replace(/\/$/, "")}/#login?${kind}=${encodeURIComponent(token)}`;
}

async function sendVerificationMessage(user: {
  id: number;
  email: string | null;
  name: string | null;
}) {
  if (!user.email || !isEmailDeliveryConfigured())
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Email delivery is not configured. Set the server email variables before using account verification.",
    });
  const token = await createAuthToken({
    userId: user.id,
    type: "email_verification",
    ttlMs: 24 * 60 * 60 * 1000,
  });
  const link = accountLink("verify", token);
  await sendAccountEmail({
    to: user.email,
    subject: "Verify your MockE account",
    text: `Verify your MockE account: ${link}`,
    html: `<p>Hello ${user.name || "learner"},</p><p>Verify your MockE account within 24 hours:</p><p><a href="${link}">${link}</a></p>`,
  });
}

async function sendPasswordResetMessage(user: {
  id: number;
  email: string | null;
  name: string | null;
}) {
  if (!user.email || !isEmailDeliveryConfigured())
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Password reset delivery is not configured. Set the server email variables before requesting a reset.",
    });
  const token = await createAuthToken({
    userId: user.id,
    type: "password_reset",
    ttlMs: 60 * 60 * 1000,
  });
  const link = accountLink("reset", token);
  await sendAccountEmail({
    to: user.email,
    subject: "Reset your MockE password",
    text: `Reset your MockE password: ${link}`,
    html: `<p>Hello ${user.name || "learner"},</p><p>Reset your MockE password within one hour:</p><p><a href="${link}">${link}</a></p><p>If you did not request this, you can ignore this message.</p>`,
  });
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user
        ? publicUser(
            opts.ctx.user,
            Boolean(
              ENV.ownerEmail &&
                opts.ctx.user.email?.toLowerCase() === ENV.ownerEmail
            )
          )
        : null
    ),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().email().max(320),
          password: z.string().min(12).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const rate = await authRateLimit(
          `auth-register:${normalizeEmail(input.email)}`
        );
        if (!rate.allowed)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many account requests. Please wait before retrying.",
          });
        if (!validatePassword(input.password))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose a password of at least 12 characters.",
          });
        if (ENV.isProduction && !isEmailDeliveryConfigured())
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Account verification is temporarily unavailable until the server email provider is configured.",
          });
        const result = await createLocalUser({
          openId: `local_${randomUUID()}`,
          name: input.name,
          email: normalizeEmail(input.email),
          passwordHash: await hashPassword(input.password),
          emailVerifiedAt: isEmailDeliveryConfigured() ? null : new Date(),
        });
        if (result.status === "exists")
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "An account already exists for this email. Sign in instead.",
          });
        if (isEmailDeliveryConfigured()) {
          await sendVerificationMessage(result.user);
          return {
            user: publicUser(
              result.user,
              Boolean(ENV.ownerEmail && result.user.email === ENV.ownerEmail)
            ),
            verificationRequired: true,
          };
        }
        await writeLocalSession(ctx, result.user);
        return {
          user: publicUser(
            result.user,
            Boolean(ENV.ownerEmail && result.user.email === ENV.ownerEmail)
          ),
          verificationRequired: false,
        };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const email = normalizeEmail(input.email);
        const rate = await authRateLimit(`auth-login:${email}`);
        if (!rate.allowed)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many sign-in attempts. Please wait before retrying.",
          });
        const user = await getUserByEmail(email);
        if (!user || !(await verifyPassword(input.password, user.passwordHash)))
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Incorrect email or password.",
          });
        if (!user.emailVerifiedAt && isEmailDeliveryConfigured())
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Verify your email before signing in. Use the resend verification option below.",
          });
        await writeLocalSession(ctx, user);
        return {
          user: publicUser(
            user,
            Boolean(ENV.ownerEmail && user.email === ENV.ownerEmail)
          ),
          verificationRequired: false,
        };
      }),
    requestVerification: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320) }))
      .mutation(async ({ input }) => {
        const email = normalizeEmail(input.email);
        const rate = await authRateLimit(`auth-verify:${email}`);
        if (!rate.allowed)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Too many verification requests. Please wait before retrying.",
          });
        const user = await getUserByEmail(email);
        if (user && !user.emailVerifiedAt) await sendVerificationMessage(user);
        return { accepted: true } as const;
      }),
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string().trim().min(32).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const userId = await consumeAuthToken({
          token: input.token,
          type: "email_verification",
        });
        if (!userId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This verification link is invalid or expired. Request a new one.",
          });
        const user = await markUserEmailVerified(userId);
        if (!user)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The account for this verification link no longer exists.",
          });
        await writeLocalSession(ctx, user);
        return {
          user: publicUser(
            user,
            Boolean(ENV.ownerEmail && user.email === ENV.ownerEmail)
          ),
        };
      }),
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320) }))
      .mutation(async ({ input }) => {
        const email = normalizeEmail(input.email);
        const rate = await authRateLimit(`auth-reset-request:${email}`);
        if (!rate.allowed)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many reset requests. Please wait before retrying.",
          });
        const user = await getUserByEmail(email);
        if (user) await sendPasswordResetMessage(user);
        return { accepted: true } as const;
      }),
    resetPassword: publicProcedure
      .input(
        z.object({
          token: z.string().trim().min(32).max(128),
          password: z.string().min(12).max(200),
        })
      )
      .mutation(async ({ input }) => {
        if (!validatePassword(input.password))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose a password of at least 12 characters.",
          });
        const userId = await consumeAuthToken({
          token: input.token,
          type: "password_reset",
        });
        if (!userId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This reset link is invalid or expired. Request a new one.",
          });
        await updateLocalPassword(userId, await hashPassword(input.password));
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  catalog: router({
    featured: publicProcedure.query(() => ({
      exam: { id: 1, slug: "jee-main", name: "JEE Main", shortName: "JEE" },
      test: {
        id: 1,
        slug: "jee-main-full-mock-07",
        title: "JEE Main · Full Mock 07",
        durationSeconds: 10800,
        questionCount: 60,
        totalMarks: 240,
        accessTier: "subscription",
      },
    })),
  }),

  attempts: router({
    create: protectedProcedure
      .input(
        z.object({
          testId: z.number().int().positive(),
          durationSeconds: z.number().int().min(60).max(21_600),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const result = await createTestAttempt({
          userId: ctx.user.id,
          ...input,
        });
        if (result.status === "not_found")
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This mock test is unavailable.",
          });
        if (result.status === "limit_reached")
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Your free plan includes four mock starts each calendar month. Choose a monthly plan for additional mock starts.",
            cause: { allowance: result.allowance },
          });
        const attempt = result.attempt;
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "attempt.created",
          entityType: "testAttempt",
          entityId: String(attempt.id),
          metadata: { testId: input.testId },
        });
        return {
          attemptId: attempt.id,
          state: attempt.state,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          allowance: result.allowance,
        };
      }),
    allowance: protectedProcedure
      .input(
        z.object({ testId: z.number().int().positive().default(1) }).optional()
      )
      .query(({ input, ctx }) =>
        getMockStartAllowance(ctx.user.id, input?.testId ?? 1)
      ),
    saveProgress: protectedProcedure
      .input(
        z.object({
          attemptId: z.number().int().positive(),
          testQuestionId: z.number().int().positive(),
          selectedOption: z.string().max(8).nullable(),
          markedForReview: z.boolean(),
          elapsedSeconds: z.number().int().nonnegative(),
          currentQuestionPosition: z.number().int().positive(),
          questionSnapshot: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const saved = await saveAttemptProgress({
          userId: ctx.user.id,
          ...input,
        });
        if (!saved)
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This attempt cannot be updated. Refresh its current status.",
          });
        return { savedAt: new Date() };
      }),
    resume: protectedProcedure
      .input(z.object({ attemptId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const state = await getAttemptResumeState(ctx.user.id, input.attemptId);
        if (!state)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Attempt not found.",
          });
        return state;
      }),
    submit: protectedProcedure
      .input(z.object({ attemptId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const result = await submitAndEvaluateAttempt(
          ctx.user.id,
          input.attemptId
        );
        if (!result)
          throw new TRPCError({
            code: "CONFLICT",
            message: "This attempt cannot be submitted in its current state.",
          });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "attempt.submitted",
          entityType: "testAttempt",
          entityId: String(input.attemptId),
          metadata: { idempotent: result.idempotent, score: result.score },
        });
        return result;
      }),
    previewScore: protectedProcedure
      .input(
        z.object({
          answers: z.array(
            z.object({
              questionId: z.number().int().positive(),
              selectedOption: z.string().nullable(),
              correctOption: z.string(),
              positiveMarks: z.number().nonnegative(),
              negativeMarks: z.number().nonnegative(),
              subject: z.string().min(1),
              topic: z.string().min(1),
              elapsedSeconds: z.number().nonnegative(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const limit = await previewScoreRateLimit(
          `preview-score:${ctx.user.id}`
        );
        if (!limit.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many scoring requests. Please wait before retrying.",
          });
        }
        return scoreAttempt(input.answers);
      }),
    validateTransition: protectedProcedure
      .input(z.object({ current: z.string(), next: z.string() }))
      .mutation(({ input }) => ({
        valid: canTransitionAttempt(
          input.current.toUpperCase(),
          input.next.toUpperCase()
        ),
      })),
  }),

  reviewer: router({
    queueSummary: reviewerProcedure.query(() => getContentOperationsSummary()),
    queueList: reviewerProcedure
      .input(z.object({ search: z.string().trim().max(128).optional() }))
      .query(({ input }) =>
        listQuestionBank({ status: "needs_review", search: input.search })
      ),
    inspectQuestion: reviewerProcedure
      .input(
        z.object({
          stem: z.string().min(1).max(20_000),
          options: z.array(z.string().max(5_000)).min(2).max(6),
          correctOption: z.string().max(5_000).nullable().optional(),
          explanation: z.string().max(20_000).nullable().optional(),
        })
      )
      .query(async ({ input }) => {
        const fingerprint = createQuestionFingerprint(
          input.stem,
          input.options
        );
        const duplicate = await findQuestionByFingerprint(fingerprint);
        return {
          fingerprint,
          qualityScore: scoreQuestionQuality(input),
          duplicate,
        };
      }),
    extractDrafts: ownerProcedure
      .input(
        z.object({
          examId: z.number().int().positive(),
          subjectId: z.number().int().positive(),
          topicId: z.number().int().positive(),
          sourceText: z.string().trim().min(80).max(120_000),
          sourceLabel: z.string().trim().min(3).max(256),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const extracted = await extractQuestionsFromText(input.sourceText);
        const drafts = [] as Array<{
          questionId: number;
          qualityScore: number;
          duplicate: boolean;
        }>;
        for (const item of extracted) {
          const options = item.options.map((text, index) => ({
            key: String.fromCharCode(65 + index),
            text,
          }));
          const fingerprint = createQuestionFingerprint(
            item.stem,
            item.options
          );
          const duplicate = await findQuestionByFingerprint(fingerprint);
          if (duplicate) {
            drafts.push({
              questionId: duplicate.id,
              qualityScore: duplicate.qualityScore,
              duplicate: true,
            });
            continue;
          }
          const qualityScore = scoreQuestionQuality({
            stem: item.stem,
            options: item.options,
            correctOption: item.options[item.correctIndex],
            explanation: item.explanation,
          });
          const questionId = await createQuestionWithVersion({
            examId: input.examId,
            subjectId: input.subjectId,
            topicId: input.topicId,
            difficulty: "medium",
            status: "needs_review",
            qualityScore,
            fingerprint,
            createdBy: ctx.user.id,
            stem: item.stem,
            options,
            correctOption: options[item.correctIndex].key,
            explanation: item.explanation,
            marks: 4,
            negativeMarks: 1,
            sourceLabel: input.sourceLabel,
          });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "question.ai_draft_created",
            entityType: "question",
            entityId: String(questionId),
            metadata: { confidence: item.confidence, qualityScore },
          });
          drafts.push({ questionId, qualityScore, duplicate: false });
        }
        return { processed: extracted.length, drafts };
      }),
  }),

  documents: router({
    ingestPdf: ownerProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(320),
          base64: z.string().min(16).max(35_000_000),
          examId: z.number().int().positive().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const bytes = Buffer.from(
          input.base64.replace(/^data:application\/pdf;base64,/, ""),
          "base64"
        );
        if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only valid PDF documents can enter the content pipeline.",
          });
        }
        if (bytes.length > 25 * 1024 * 1024) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "PDF uploads are limited to 25 MB.",
          });
        }
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        const storage = await storagePut(
          `uploads/${ctx.user.id}/${input.fileName}`,
          bytes,
          "application/pdf"
        );
        const document = await createDocumentWithInitialJobs({
          uploadedBy: ctx.user.id,
          examId: input.examId,
          storageKey: storage.key,
          originalName: input.fileName,
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          sha256,
        });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "document.ingested",
          entityType: "documentUpload",
          entityId: String(document.id),
          metadata: { sha256, sizeBytes: bytes.length },
        });
        return {
          documentId: document.id,
          status: document.status,
          storageUrl: storage.url,
          jobsCreated: 5,
        };
      }),
  }),

  questionBank: router({
    list: adminProcedure
      .input(
        z.object({
          examId: z.number().int().positive().optional(),
          subjectId: z.number().int().positive().optional(),
          topicId: z.number().int().positive().optional(),
          status: z
            .enum([
              "extracted",
              "validating",
              "needs_review",
              "approved",
              "published",
              "rejected",
              "archived",
            ])
            .optional(),
          difficulty: z.enum(["easy", "medium", "hard"]).optional(),
          search: z.string().trim().max(128).optional(),
        })
      )
      .query(({ input }) => listQuestionBank(input)),
    create: adminProcedure
      .input(
        z.object({
          examId: z.number().int().positive(),
          subjectId: z.number().int().positive(),
          topicId: z.number().int().positive(),
          difficulty: z.enum(["easy", "medium", "hard"]),
          stem: z.string().trim().min(20).max(20_000),
          options: z
            .array(
              z.object({
                key: z.string().min(1).max(8),
                text: z.string().trim().min(1).max(5_000),
              })
            )
            .length(4),
          correctOption: z.string().min(1).max(8),
          explanation: z.string().max(20_000).optional(),
          marks: z.number().int().min(1).max(100).default(4),
          negativeMarks: z.number().int().min(0).max(100).default(1),
          sourceLabel: z.string().max(256).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!input.options.some(option => option.key === input.correctOption)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "The correct option must be present in the provided options.",
          });
        }
        const fingerprint = createQuestionFingerprint(
          input.stem,
          input.options.map(option => option.text)
        );
        const duplicate = await findQuestionByFingerprint(fingerprint);
        if (duplicate)
          throw new TRPCError({
            code: "CONFLICT",
            message: `Potential duplicate question ${duplicate.id} detected.`,
          });
        const qualityScore = scoreQuestionQuality({
          stem: input.stem,
          options: input.options.map(option => option.text),
          correctOption: input.options.find(
            option => option.key === input.correctOption
          )?.text,
          explanation: input.explanation,
        });
        const questionId = await createQuestionWithVersion({
          ...input,
          status: qualityScore >= 70 ? "needs_review" : "extracted",
          qualityScore,
          fingerprint,
          createdBy: ctx.user.id,
        });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "question.created",
          entityType: "question",
          entityId: String(questionId),
          metadata: { qualityScore, fingerprint },
        });
        return {
          questionId,
          qualityScore,
          status: qualityScore >= 70 ? "needs_review" : "extracted",
        };
      }),
    review: reviewerProcedure
      .input(
        z.object({
          questionId: z.number().int().positive(),
          decision: z.enum(["approved", "rejected"]),
          note: z.string().trim().min(3).max(512),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await updateQuestionStatus({
          questionId: input.questionId,
          status: input.decision,
        });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: `question.${input.decision}`,
          entityType: "question",
          entityId: String(input.questionId),
          metadata: { note: input.note },
        });
        return { questionId: input.questionId, status: input.decision };
      }),
    update: adminProcedure
      .input(
        z.object({
          questionId: z.number().int().positive(),
          difficulty: z.enum(["easy", "medium", "hard"]),
          stem: z.string().trim().min(20).max(20_000),
          options: z
            .array(
              z.object({
                key: z.string().min(1).max(8),
                text: z.string().trim().min(1).max(5_000),
              })
            )
            .length(4),
          correctOption: z.string().min(1).max(8),
          explanation: z.string().max(20_000).optional(),
          marks: z.number().int().min(1).max(100).default(4),
          negativeMarks: z.number().int().min(0).max(100).default(1),
          sourceLabel: z.string().max(256).optional(),
          changeSummary: z.string().trim().min(3).max(512),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!input.options.some(option => option.key === input.correctOption)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "The correct option must be present in the provided options.",
          });
        }
        const fingerprint = createQuestionFingerprint(
          input.stem,
          input.options.map(option => option.text)
        );
        const qualityScore = scoreQuestionQuality({
          stem: input.stem,
          options: input.options.map(option => option.text),
          correctOption: input.options.find(
            option => option.key === input.correctOption
          )?.text,
          explanation: input.explanation,
        });
        const version = await reviseQuestionWithVersion({
          ...input,
          updatedBy: ctx.user.id,
          qualityScore,
          fingerprint,
        });
        if (!version)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Question not found.",
          });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "question.revised",
          entityType: "question",
          entityId: String(input.questionId),
          metadata: {
            version,
            qualityScore,
            changeSummary: input.changeSummary,
          },
        });
        return {
          questionId: input.questionId,
          version,
          qualityScore,
          status: "needs_review" as const,
        };
      }),
    archive: adminProcedure
      .input(z.object({ questionId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        await updateQuestionStatus({
          questionId: input.questionId,
          status: "archived",
        });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "question.archived",
          entityType: "question",
          entityId: String(input.questionId),
        });
        return { questionId: input.questionId, status: "archived" as const };
      }),
  }),

  payments: router({
    availability: protectedProcedure.query(() => ({
      provider: "razorpay" as const,
      enabled: Boolean(getRazorpayConfig()),
      message: getRazorpayConfig()
        ? "Payment configuration is ready for server-side order creation."
        : "Checkout is disabled until production Razorpay variables are supplied.",
    })),
    access: protectedProcedure.query(({ ctx }) =>
      getSubscriptionAccess(ctx.user.id)
    ),
    transactions: protectedProcedure.query(({ ctx }) =>
      getTransactionHistory(ctx.user.id)
    ),
    createOrder: protectedProcedure
      .input(z.object({ planId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const limit = await paymentOrderRateLimit(
          `payment-order:${ctx.user.id}`
        );
        if (!limit.allowed)
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message:
              "Too many payment-order requests. Please wait before retrying.",
          });
        const plan = await getPlanById(input.planId);
        if (!plan)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The selected subscription plan is unavailable.",
          });
        const config = getRazorpayConfig();
        if (!config)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Razorpay checkout is disabled until production variables are supplied.",
          });
        if (plan.durationDays !== 30 || plan.amountPaise <= 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Only active monthly paid plans can create a checkout order.",
          });
        const idempotencyKey = createPaymentIdempotencyKey();
        const order = await createRazorpayOrder({
          amountPaise: plan.amountPaise,
          receipt: `mocke_${idempotencyKey.slice(0, 24)}`,
          notes: {
            userId: String(ctx.user.id),
            planId: String(plan.id),
            examId: String(plan.examId),
            idempotencyKey,
          },
        });
        await createPendingPayment({
          userId: ctx.user.id,
          planId: plan.id,
          providerOrderId: order.id,
          amountPaise: plan.amountPaise,
          idempotencyKey,
        });
        await appendAuditLog({
          actorUserId: ctx.user.id,
          action: "payment.order_created",
          entityType: "payment",
          entityId: order.id,
          metadata: { planId: plan.id, amountPaise: plan.amountPaise },
        });
        return {
          keyId: config.keyId,
          orderId: order.id,
          amountPaise: order.amount,
          currency: order.currency,
          planName: plan.name,
        };
      }),
  }),

  analytics: router({
    summary: protectedProcedure.query(({ ctx }) =>
      getStudentPerformanceSummary(ctx.user.id)
    ),
  }),

  ownerConsole: router({
    services: router({
      configured: ownerProcedure.query(() => getConfiguredServiceStatuses()),
      probe: ownerProcedure.mutation(() => probeExternalServices()),
    }),
    audit: router({
      list: ownerProcedure
        .input(
          z
            .object({ limit: z.number().int().min(1).max(200).default(100) })
            .optional()
        )
        .query(({ input }) => listOwnerAuditLogs(input?.limit ?? 100)),
      aiIntake: ownerProcedure
        .input(
          z
            .object({ limit: z.number().int().min(1).max(200).default(100) })
            .optional()
        )
        .query(({ input }) => listOwnerAiIntakeAuditLogs(input?.limit ?? 100)),
    }),
    users: router({
      list: ownerProcedure.query(() => listOwnerManagedUsers()),
      updateRole: ownerProcedure
        .input(
          z.object({
            userId: z.number().int().positive(),
            role: z.enum(["student", "reviewer", "admin"]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          if (input.userId === ctx.user.id) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Your owner account role is protected and cannot be changed here.",
            });
          }
          const user = await updateOwnerManagedUserRole(input);
          if (!user)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User not found.",
            });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.user_role_updated",
            entityType: "user",
            entityId: String(input.userId),
            metadata: { role: input.role },
          });
          return user;
        }),
    }),
    content: router({
      references: ownerProcedure.query(() => getOwnerContentReferences()),
      createExam: ownerProcedure
        .input(
          z.object({
            slug: z
              .string()
              .trim()
              .toLowerCase()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .max(96),
            name: z.string().trim().min(2).max(160),
            shortName: z.string().trim().min(2).max(32),
            description: z.string().trim().max(20_000).optional(),
            status: z.enum(["draft", "published", "archived"]).default("draft"),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const exam = await createOwnerManagedExam(input);
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.exam_created",
            entityType: "exam",
            entityId: String(exam.id),
            metadata: { slug: exam.slug, status: exam.status },
          });
          return exam;
        }),
      updateExam: ownerProcedure
        .input(
          z.object({
            examId: z.number().int().positive(),
            slug: z
              .string()
              .trim()
              .toLowerCase()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .max(96),
            name: z.string().trim().min(2).max(160),
            shortName: z.string().trim().min(2).max(32),
            description: z.string().trim().max(20_000).optional(),
            status: z.enum(["draft", "published", "archived"]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const exam = await updateOwnerManagedExam(input);
          if (!exam)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Exam not found.",
            });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.exam_updated",
            entityType: "exam",
            entityId: String(input.examId),
            metadata: { slug: input.slug, status: input.status },
          });
          return exam;
        }),
      createSubject: ownerProcedure
        .input(
          z.object({
            examId: z.number().int().positive(),
            name: z.string().trim().min(2).max(128),
            code: z
              .string()
              .trim()
              .toUpperCase()
              .regex(/^[A-Z0-9_-]+$/)
              .max(32),
            position: z.number().int().min(0).max(10_000).default(0),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const subject = await createOwnerManagedSubject(input);
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.subject_created",
            entityType: "subject",
            entityId: String(subject.id),
            metadata: { examId: input.examId, code: input.code },
          });
          return subject;
        }),
      createTopic: ownerProcedure
        .input(
          z.object({
            subjectId: z.number().int().positive(),
            name: z.string().trim().min(2).max(160),
            slug: z
              .string()
              .trim()
              .toLowerCase()
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
              .max(160),
            position: z.number().int().min(0).max(10_000).default(0),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const topic = await createOwnerManagedTopic(input);
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.topic_created",
            entityType: "topic",
            entityId: String(topic.id),
            metadata: { subjectId: input.subjectId, slug: input.slug },
          });
          return topic;
        }),
      list: ownerProcedure
        .input(
          z.object({
            examId: z.number().int().positive().optional(),
            status: z
              .enum([
                "extracted",
                "validating",
                "needs_review",
                "approved",
                "published",
                "rejected",
                "archived",
              ])
              .optional(),
            search: z.string().trim().max(128).optional(),
          })
        )
        .query(({ input }) => listQuestionBank(input)),
      detail: ownerProcedure
        .input(z.object({ questionId: z.number().int().positive() }))
        .query(async ({ input }) => {
          const question = await getOwnerManagedQuestion(input.questionId);
          if (!question)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Question not found.",
            });
          return question;
        }),
      create: ownerProcedure
        .input(
          z.object({
            examId: z.number().int().positive(),
            subjectId: z.number().int().positive(),
            topicId: z.number().int().positive(),
            difficulty: z.enum(["easy", "medium", "hard"]),
            stem: z.string().trim().min(20).max(20_000),
            options: z
              .array(
                z.object({
                  key: z.string().min(1).max(8),
                  text: z.string().trim().min(1).max(5_000),
                })
              )
              .length(4),
            correctOption: z.string().min(1).max(8),
            explanation: z.string().max(20_000).optional(),
            marks: z.number().int().min(1).max(100).default(4),
            negativeMarks: z.number().int().min(0).max(100).default(1),
            sourceLabel: z.string().max(256).optional(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          if (
            !input.options.some(option => option.key === input.correctOption)
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "The correct option must be one of the provided options.",
            });
          }
          const fingerprint = createQuestionFingerprint(
            input.stem,
            input.options.map(option => option.text)
          );
          const duplicate = await findQuestionByFingerprint(fingerprint);
          if (duplicate)
            throw new TRPCError({
              code: "CONFLICT",
              message: `Potential duplicate question ${duplicate.id} detected.`,
            });
          const qualityScore = scoreQuestionQuality({
            stem: input.stem,
            options: input.options.map(option => option.text),
            correctOption: input.options.find(
              option => option.key === input.correctOption
            )?.text,
            explanation: input.explanation,
          });
          const questionId = await createQuestionWithVersion({
            ...input,
            status: "needs_review",
            qualityScore,
            fingerprint,
            createdBy: ctx.user.id,
          });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.question_created",
            entityType: "question",
            entityId: String(questionId),
            metadata: { qualityScore },
          });
          return { questionId, qualityScore, status: "needs_review" as const };
        }),
      update: ownerProcedure
        .input(
          z.object({
            questionId: z.number().int().positive(),
            difficulty: z.enum(["easy", "medium", "hard"]),
            stem: z.string().trim().min(20).max(20_000),
            options: z
              .array(
                z.object({
                  key: z.string().min(1).max(8),
                  text: z.string().trim().min(1).max(5_000),
                })
              )
              .length(4),
            correctOption: z.string().min(1).max(8),
            explanation: z.string().max(20_000).optional(),
            marks: z.number().int().min(1).max(100).default(4),
            negativeMarks: z.number().int().min(0).max(100).default(1),
            sourceLabel: z.string().max(256).optional(),
            changeSummary: z.string().trim().min(3).max(512),
          })
        )
        .mutation(async ({ input, ctx }) => {
          if (
            !input.options.some(option => option.key === input.correctOption)
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "The correct option must be one of the provided options.",
            });
          }
          const fingerprint = createQuestionFingerprint(
            input.stem,
            input.options.map(option => option.text)
          );
          const qualityScore = scoreQuestionQuality({
            stem: input.stem,
            options: input.options.map(option => option.text),
            correctOption: input.options.find(
              option => option.key === input.correctOption
            )?.text,
            explanation: input.explanation,
          });
          const version = await reviseQuestionWithVersion({
            ...input,
            updatedBy: ctx.user.id,
            qualityScore,
            fingerprint,
          });
          if (!version)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Question not found.",
            });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.question_updated",
            entityType: "question",
            entityId: String(input.questionId),
            metadata: {
              version,
              qualityScore,
              changeSummary: input.changeSummary,
            },
          });
          return { questionId: input.questionId, version, qualityScore };
        }),
      setStatus: ownerProcedure
        .input(
          z.object({
            questionId: z.number().int().positive(),
            status: z.enum([
              "needs_review",
              "approved",
              "published",
              "rejected",
              "archived",
            ]),
          })
        )
        .mutation(async ({ input, ctx }) => {
          await updateQuestionStatus(input);
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: `owner.question_${input.status}`,
            entityType: "question",
            entityId: String(input.questionId),
          });
          return input;
        }),
    }),
    intake: router({
      processPdf: ownerProcedure
        .input(
          z.object({
            fileName: z.string().trim().min(1).max(320),
            base64: z.string().min(16).max(35_000_000),
            examId: z.number().int().positive(),
            subjectId: z.number().int().positive(),
            topicId: z.number().int().positive(),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const limit = await ownerIntakeRateLimit(
            `owner-intake:${ctx.user.id}`
          );
          if (!limit.allowed)
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message:
                "Too many source-intake requests. Please wait before retrying.",
            });
          const bytes = Buffer.from(
            input.base64.replace(/^data:application\/pdf;base64,/, ""),
            "base64"
          );
          if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Upload a valid PDF document.",
            });
          if (bytes.length > 25 * 1024 * 1024)
            throw new TRPCError({
              code: "PAYLOAD_TOO_LARGE",
              message: "PDF uploads are limited to 25 MB.",
            });
          const sha256 = createHash("sha256").update(bytes).digest("hex");
          const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
          const storage = await storagePut(
            `owner-imports/${ctx.user.id}/${safeName}`,
            bytes,
            "application/pdf"
          );
          const sourceLabel = `AI PDF import · ${safeName}`;
          const queued = await createQueuedPdfDocument({
            uploadedBy: ctx.user.id,
            examId: input.examId,
            subjectId: input.subjectId,
            topicId: input.topicId,
            storageKey: storage.key,
            originalName: safeName,
            mimeType: "application/pdf",
            sizeBytes: bytes.length,
            sha256,
            sourceLabel,
          });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.pdf_ai_queued",
            entityType: "documentUpload",
            entityId: String(queued.document.id),
            metadata: { jobId: queued.jobId, sizeBytes: bytes.length },
          });
          return {
            documentId: queued.document.id,
            jobId: queued.jobId,
            status: "queued" as const,
            storageUrl: storage.url,
            sourceLabel,
          };
        }),
      importJson: ownerProcedure
        .input(
          z.object({
            fileName: z
              .string()
              .trim()
              .min(1)
              .max(320)
              .default("question-import.json"),
            examId: z.number().int().positive(),
            subjectId: z.number().int().positive(),
            topicId: z.number().int().positive(),
            questions: z
              .array(
                z.object({
                  stem: z.string().trim().min(20).max(20_000),
                  options: z
                    .array(z.string().trim().min(1).max(5_000))
                    .length(4),
                  correctIndex: z.number().int().min(0).max(3),
                  explanation: z.string().trim().max(20_000).default(""),
                  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
                })
              )
              .min(1)
              .max(50),
          })
        )
        .mutation(async ({ input, ctx }) => {
          const limit = await ownerIntakeRateLimit(
            `owner-intake:${ctx.user.id}`
          );
          if (!limit.allowed)
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message:
                "Too many source-intake requests. Please wait before retrying.",
            });
          const sourceLabel = `Structured JSON import · ${input.fileName}`;
          const review = await createOwnerImportDrafts({
            examId: input.examId,
            subjectId: input.subjectId,
            topicId: input.topicId,
            sourceLabel,
            drafts: input.questions,
            userId: ctx.user.id,
          });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.json_questions_imported",
            entityType: "questionImport",
            entityId: input.fileName,
            metadata: {
              created: review.created,
              duplicates: review.duplicates,
            },
          });
          return { sourceLabel, ...review };
        }),
      testExtract: ownerProcedure
        .input(
          z.object({
            sourceText: z.string().trim().min(80).max(30_000),
          })
        )
        .mutation(async ({ input, ctx }) => {
          if (ENV.isProduction || !ENV.stagingAiTestMode) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Staging AI test extraction is disabled. Enable STAGING_AI_TEST_MODE only in a non-production staging environment.",
            });
          }
          const startedAt = Date.now();
          try {
            const questions = await extractQuestionsFromText(input.sourceText);
            const result = {
              mode: "staging_no_write" as const,
              processed: questions.length,
              questions,
              latencyMs: Date.now() - startedAt,
            };
            await appendAuditLog({
              actorUserId: ctx.user.id,
              action: "owner.staging_ai_test_completed",
              entityType: "stagingAiTest",
              metadata: {
                processed: result.processed,
                latencyMs: result.latencyMs,
                writes: false,
              },
            });
            return result;
          } catch (error) {
            await appendAuditLog({
              actorUserId: ctx.user.id,
              action: "owner.staging_ai_test_failed",
              entityType: "stagingAiTest",
              metadata: {
                latencyMs: Date.now() - startedAt,
                writes: false,
                error:
                  error instanceof Error
                    ? error.message.slice(0, 240)
                    : "Unknown AI test error",
              },
            });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "The staging AI test could not complete. Check the owner service status and server logs.",
            });
          }
        }),
    }),
    queue: router({
      status: ownerProcedure.query(() => getQueueWorkerSchedule()),
      list: ownerProcedure
        .input(
          z
            .object({ limit: z.number().int().min(1).max(100).default(40) })
            .default({ limit: 40 })
        )
        .query(({ input }) => listOwnerQueueJobs(input.limit)),
      schedule: ownerProcedure
        .input(
          z
            .object({ batchSize: z.number().int().min(1).max(1).default(1) })
            .default({ batchSize: 1 })
        )
        .mutation(async ({ input, ctx }) => {
          const cron = "0 * * * * *";
          const taskUid = "external-cron";
          const schedule = await saveQueueWorkerSchedule({
            taskUid,
            batchSize: input.batchSize,
            enabled: true,
          });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.queue_worker_scheduled",
            entityType: "queueWorker",
            entityId: taskUid,
            metadata: {
              cron,
              batchSize: input.batchSize,
              trigger: "external-cron",
            },
          });
          return schedule;
        }),
      setEnabled: ownerProcedure
        .input(z.object({ enabled: z.boolean() }))
        .mutation(async ({ input, ctx }) => {
          const schedule = await getQueueWorkerSchedule();
          if (!schedule?.scheduleCronTaskUid)
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Configure the external queue worker before changing its state.",
            });
          const updated = await setQueueWorkerScheduleEnabled(input.enabled);
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: input.enabled
              ? "owner.queue_worker_enabled"
              : "owner.queue_worker_paused",
            entityType: "queueWorker",
            entityId: schedule.scheduleCronTaskUid,
          });
          return updated;
        }),
      retry: ownerProcedure
        .input(z.object({ jobId: z.number().int().positive() }))
        .mutation(async ({ input, ctx }) => {
          const retried = await retryDeadLetterQueueJob(input.jobId);
          if (!retried)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Only dead-letter queue jobs can be retried.",
            });
          await appendAuditLog({
            actorUserId: ctx.user.id,
            action: "owner.queue_job_retried",
            entityType: "processingJob",
            entityId: String(input.jobId),
          });
          return { retried: true };
        }),
    }),
  }),

  admin: router({
    operationsSummary: ownerProcedure.query(() =>
      getContentOperationsSummary()
    ),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
