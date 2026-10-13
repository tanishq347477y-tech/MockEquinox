import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core identity record, synchronized through the managed OAuth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  role: mysqlEnum("role", ["student", "reviewer", "admin", "super_admin"])
    .default("student")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Single-use, hashed account tokens. Raw tokens are only sent to the user and never persisted. */
export const authTokens = mysqlTable(
  "authTokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    type: mysqlEnum("type", ["email_verification", "password_reset"]).notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("auth_tokens_user_idx").on(table.userId, table.type, table.expiresAt),
  ]
);

export const exams = mysqlTable("exams", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  shortName: varchar("shortName", { length: 32 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["draft", "published", "archived"])
    .default("draft")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const subjects = mysqlTable(
  "subjects",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("subjects_exam_code").on(table.examId, table.code)]
);

export const topics = mysqlTable(
  "topics",
  {
    id: int("id").autoincrement().primaryKey(),
    subjectId: int("subjectId").notNull(),
    parentTopicId: int("parentTopicId"),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("topics_subject_idx").on(table.subjectId),
    uniqueIndex("topics_subject_slug").on(table.subjectId, table.slug),
  ]
);

export const questionTags = mysqlTable("questionTags", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 96 }).notNull(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId").notNull(),
    subjectId: int("subjectId").notNull(),
    topicId: int("topicId").notNull(),
    currentVersion: int("currentVersion").default(1).notNull(),
    type: mysqlEnum("type", ["single_mcq", "multiple_mcq", "numerical"])
      .default("single_mcq")
      .notNull(),
    difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"])
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", [
      "extracted",
      "validating",
      "needs_review",
      "approved",
      "published",
      "rejected",
      "archived",
    ])
      .default("extracted")
      .notNull(),
    qualityScore: int("qualityScore").default(0).notNull(),
    fingerprint: varchar("fingerprint", { length: 128 }),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("questions_filter_idx").on(
      table.examId,
      table.subjectId,
      table.topicId,
      table.status
    ),
    index("questions_quality_idx").on(table.qualityScore),
    uniqueIndex("questions_fingerprint_unique").on(table.fingerprint),
  ]
);

export const questionVersions = mysqlTable(
  "questionVersions",
  {
    id: int("id").autoincrement().primaryKey(),
    questionId: int("questionId").notNull(),
    version: int("version").notNull(),
    stem: text("stem").notNull(),
    options: json("options")
      .$type<Array<{ key: string; text: string }>>()
      .notNull(),
    correctOption: varchar("correctOption", { length: 8 }).notNull(),
    explanation: text("explanation"),
    marks: int("marks").default(4).notNull(),
    negativeMarks: int("negativeMarks").default(1).notNull(),
    sourceLabel: varchar("sourceLabel", { length: 256 }),
    changeSummary: varchar("changeSummary", { length: 512 }),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("question_version_unique").on(table.questionId, table.version),
  ]
);

export const questionTagLinks = mysqlTable(
  "questionTagLinks",
  {
    id: int("id").autoincrement().primaryKey(),
    questionId: int("questionId").notNull(),
    tagId: int("tagId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("question_tag_unique").on(table.questionId, table.tagId),
    index("question_tags_tag_idx").on(table.tagId),
  ]
);

export const tests = mysqlTable(
  "tests",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId").notNull(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    category: mysqlEnum("category", [
      "full_mock",
      "previous_year",
      "subject",
      "chapter",
      "topic",
      "custom",
    ])
      .default("full_mock")
      .notNull(),
    durationSeconds: int("durationSeconds").notNull(),
    totalMarks: int("totalMarks").notNull(),
    questionCount: int("questionCount").notNull(),
    negativeMarking: boolean("negativeMarking").default(true).notNull(),
    accessTier: mysqlEnum("accessTier", ["free", "subscription"])
      .default("free")
      .notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"])
      .default("draft")
      .notNull(),
    configuration: json("configuration").$type<Record<string, unknown>>(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("tests_browse_idx").on(table.examId, table.status, table.publishedAt),
  ]
);

export const testQuestions = mysqlTable(
  "testQuestions",
  {
    id: int("id").autoincrement().primaryKey(),
    testId: int("testId").notNull(),
    questionId: int("questionId").notNull(),
    questionVersion: int("questionVersion").notNull(),
    position: int("position").notNull(),
    marks: int("marks").notNull(),
    negativeMarks: int("negativeMarks").notNull(),
  },
  table => [
    uniqueIndex("test_question_position").on(table.testId, table.position),
    index("test_question_lookup").on(table.testId, table.questionId),
  ]
);

export const testAttempts = mysqlTable(
  "testAttempts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    testId: int("testId").notNull(),
    state: mysqlEnum("state", [
      "created",
      "started",
      "in_progress",
      "submitted",
      "evaluated",
      "analytics_generated",
      "abandoned",
      "expired",
      "force_submitted",
      "invalidated",
    ])
      .default("created")
      .notNull(),
    startedAt: timestamp("startedAt"),
    expiresAt: timestamp("expiresAt"),
    submittedAt: timestamp("submittedAt"),
    currentQuestionPosition: int("currentQuestionPosition")
      .default(1)
      .notNull(),
    score: int("score"),
    correctCount: int("correctCount"),
    incorrectCount: int("incorrectCount"),
    skippedCount: int("skippedCount"),
    clientVersion: varchar("clientVersion", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("attempts_user_idx").on(table.userId, table.createdAt),
    index("attempts_resume_idx").on(table.userId, table.testId, table.state),
  ]
);

/** Atomic free-tier mock-start usage ledger keyed by user and calendar month. */
export const monthlyMockUsage = mysqlTable(
  "monthlyMockUsage",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    monthKey: varchar("monthKey", { length: 7 }).notNull(),
    usedCount: int("usedCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("monthly_mock_usage_unique").on(table.userId, table.monthKey),
    index("monthly_mock_usage_month_idx").on(table.monthKey, table.userId),
  ]
);

export const attemptAnswers = mysqlTable(
  "attemptAnswers",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId").notNull(),
    testQuestionId: int("testQuestionId").notNull(),
    selectedOption: varchar("selectedOption", { length: 8 }),
    markedForReview: boolean("markedForReview").default(false).notNull(),
    elapsedSeconds: int("elapsedSeconds").default(0).notNull(),
    questionSnapshot: json("questionSnapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    savedAt: timestamp("savedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("attempt_answer_unique").on(
      table.attemptId,
      table.testQuestionId
    ),
  ]
);

export const documentUploads = mysqlTable(
  "documentUploads",
  {
    id: int("id").autoincrement().primaryKey(),
    uploadedBy: int("uploadedBy").notNull(),
    examId: int("examId"),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    originalName: varchar("originalName", { length: 320 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    sha256: varchar("sha256", { length: 128 }).notNull(),
    status: mysqlEnum("status", [
      "uploaded",
      "queued",
      "processing",
      "completed",
      "failed",
      "quarantined",
    ])
      .default("uploaded")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("documents_uploader_idx").on(table.uploadedBy, table.createdAt),
    uniqueIndex("documents_sha_unique").on(table.sha256),
  ]
);

export const processingJobs = mysqlTable(
  "processingJobs",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("documentId").notNull(),
    type: mysqlEnum("type", [
      "extract_text",
      "ocr",
      "extract_questions",
      "validate_questions",
      "detect_duplicates",
      "score_quality",
    ]).notNull(),
    state: mysqlEnum("state", [
      "queued",
      "processing",
      "completed",
      "failed",
      "dead_letter",
      "cancelled",
    ])
      .default("queued")
      .notNull(),
    attemptCount: int("attemptCount").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(3).notNull(),
    progressPercent: int("progressPercent").default(0).notNull(),
    lastError: text("lastError"),
    payload: json("payload").$type<Record<string, unknown>>(),
    queueKind: varchar("queueKind", { length: 64 }),
    availableAt: timestamp("availableAt").defaultNow().notNull(),
    leaseToken: varchar("leaseToken", { length: 96 }),
    leaseExpiresAt: timestamp("leaseExpiresAt"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("processing_queue_idx").on(table.state, table.createdAt),
    index("processing_ready_idx").on(table.state, table.availableAt, table.id),
    index("processing_queue_kind_ready_idx").on(
      table.queueKind,
      table.state,
      table.availableAt,
      table.id
    ),
    index("processing_lease_idx").on(table.state, table.leaseExpiresAt),
  ]
);

/** Durable ownership record for the platform-managed scheduled queue worker. */
export const queueWorkerSchedules = mysqlTable(
  "queueWorkerSchedules",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 96 }).notNull().unique(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", {
      length: 65,
    }).unique(),
    cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
    batchSize: int("batchSize").default(1).notNull(),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    executionLeaseToken: varchar("executionLeaseToken", { length: 96 }),
    executionLeaseExpiresAt: timestamp("executionLeaseExpiresAt"),
    lastRunAt: timestamp("lastRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("queue_worker_task_idx").on(table.scheduleCronTaskUid),
    index("queue_worker_lease_idx").on(table.executionLeaseExpiresAt),
  ]
);

export const plans = mysqlTable(
  "plans",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId").notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    durationDays: int("durationDays").notNull(),
    amountPaise: int("amountPaise").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("plan_exam_code").on(table.examId, table.code)]
);

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    examId: int("examId").notNull(),
    planId: int("planId").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "active",
      "expired",
      "cancelled",
      "paused",
      "payment_failed",
    ])
      .default("pending")
      .notNull(),
    startsAt: timestamp("startsAt"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("subscriptions_access_idx").on(
      table.userId,
      table.examId,
      table.status,
      table.expiresAt
    ),
  ]
);

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    subscriptionId: int("subscriptionId"),
    provider: mysqlEnum("provider", ["razorpay"]).default("razorpay").notNull(),
    providerOrderId: varchar("providerOrderId", { length: 128 }).notNull(),
    providerPaymentId: varchar("providerPaymentId", { length: 128 }),
    amountPaise: int("amountPaise").notNull(),
    currency: varchar("currency", { length: 8 }).default("INR").notNull(),
    status: mysqlEnum("status", [
      "created",
      "authorized",
      "captured",
      "failed",
      "refunded",
    ])
      .default("created")
      .notNull(),
    signatureVerifiedAt: timestamp("signatureVerifiedAt"),
    idempotencyKey: varchar("idempotencyKey", { length: 128 })
      .notNull()
      .unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("payments_order_unique").on(table.providerOrderId),
    index("payments_user_idx").on(table.userId, table.createdAt),
  ]
);

export const paymentWebhookEvents = mysqlTable(
  "paymentWebhookEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: mysqlEnum("provider", ["razorpay"]).default("razorpay").notNull(),
    eventId: varchar("eventId", { length: 128 }).notNull().unique(),
    eventType: varchar("eventType", { length: 128 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", ["received", "processed", "failed"])
      .default("received")
      .notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    processedAt: timestamp("processedAt"),
    error: text("error"),
  },
  table => [
    index("payment_webhook_status_idx").on(table.status, table.receivedAt),
  ]
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId"),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entityType", { length: 96 }).notNull(),
    entityId: varchar("entityId", { length: 96 }),
    requestId: varchar("requestId", { length: 128 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_actor_idx").on(table.actorUserId, table.createdAt),
    index("audit_entity_idx").on(table.entityType, table.entityId),
  ]
);

/** Shared fixed-window counters for replica-consistent abuse protection. */
export const rateLimitBuckets = mysqlTable(
  "rateLimitBuckets",
  {
    id: int("id").autoincrement().primaryKey(),
    limitKey: varchar("limitKey", { length: 191 }).notNull(),
    windowStartedAt: timestamp("windowStartedAt").notNull(),
    requestCount: int("requestCount").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("rate_limit_key_window_unique").on(
      table.limitKey,
      table.windowStartedAt
    ),
    index("rate_limit_window_idx").on(table.windowStartedAt),
  ]
);
