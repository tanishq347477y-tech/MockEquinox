CREATE TABLE `attemptAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`testQuestionId` int NOT NULL,
	`selectedOption` varchar(8),
	`markedForReview` boolean NOT NULL DEFAULT false,
	`elapsedSeconds` int NOT NULL DEFAULT 0,
	`questionSnapshot` json NOT NULL,
	`savedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attemptAnswers_id` PRIMARY KEY(`id`),
	CONSTRAINT `attempt_answer_unique` UNIQUE(`attemptId`,`testQuestionId`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(96) NOT NULL,
	`entityId` varchar(96),
	`requestId` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentUploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uploadedBy` int NOT NULL,
	`examId` int,
	`storageKey` varchar(512) NOT NULL,
	`originalName` varchar(320) NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`sizeBytes` int NOT NULL,
	`sha256` varchar(128) NOT NULL,
	`status` enum('uploaded','queued','processing','completed','failed','quarantined') NOT NULL DEFAULT 'uploaded',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentUploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `documents_sha_unique` UNIQUE(`sha256`)
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(96) NOT NULL,
	`name` varchar(160) NOT NULL,
	`shortName` varchar(32) NOT NULL,
	`description` text,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exams_id` PRIMARY KEY(`id`),
	CONSTRAINT `exams_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`subscriptionId` int,
	`provider` enum('razorpay') NOT NULL DEFAULT 'razorpay',
	`providerOrderId` varchar(128) NOT NULL,
	`providerPaymentId` varchar(128),
	`amountPaise` int NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'INR',
	`status` enum('created','authorized','captured','failed','refunded') NOT NULL DEFAULT 'created',
	`signatureVerifiedAt` timestamp,
	`idempotencyKey` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_idempotencyKey_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `payments_order_unique` UNIQUE(`providerOrderId`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`durationDays` int NOT NULL,
	`amountPaise` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_exam_code` UNIQUE(`examId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `processingJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`type` enum('extract_text','ocr','extract_questions','validate_questions','detect_duplicates','score_quality') NOT NULL,
	`state` enum('queued','processing','completed','failed','dead_letter','cancelled') NOT NULL DEFAULT 'queued',
	`attemptCount` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`progressPercent` int NOT NULL DEFAULT 0,
	`lastError` text,
	`payload` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processingJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questionVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`version` int NOT NULL,
	`stem` text NOT NULL,
	`options` json NOT NULL,
	`correctOption` varchar(8) NOT NULL,
	`explanation` text,
	`marks` int NOT NULL DEFAULT 4,
	`negativeMarks` int NOT NULL DEFAULT 1,
	`sourceLabel` varchar(256),
	`changeSummary` varchar(512),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questionVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_version_unique` UNIQUE(`questionId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examId` int NOT NULL,
	`subjectId` int NOT NULL,
	`topicId` int NOT NULL,
	`currentVersion` int NOT NULL DEFAULT 1,
	`type` enum('single_mcq','multiple_mcq','numerical') NOT NULL DEFAULT 'single_mcq',
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`status` enum('extracted','validating','needs_review','approved','published','rejected','archived') NOT NULL DEFAULT 'extracted',
	`qualityScore` int NOT NULL DEFAULT 0,
	`fingerprint` varchar(128),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `questions_fingerprint_unique` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`code` varchar(32) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subjects_id` PRIMARY KEY(`id`),
	CONSTRAINT `subjects_exam_code` UNIQUE(`examId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`examId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('pending','active','expired','cancelled','paused','payment_failed') NOT NULL DEFAULT 'pending',
	`startsAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`testId` int NOT NULL,
	`state` enum('created','started','in_progress','submitted','evaluated','analytics_generated','abandoned','expired','force_submitted','invalidated') NOT NULL DEFAULT 'created',
	`startedAt` timestamp,
	`expiresAt` timestamp,
	`submittedAt` timestamp,
	`currentQuestionPosition` int NOT NULL DEFAULT 1,
	`score` int,
	`correctCount` int,
	`incorrectCount` int,
	`skippedCount` int,
	`clientVersion` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `testAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`testId` int NOT NULL,
	`questionId` int NOT NULL,
	`questionVersion` int NOT NULL,
	`position` int NOT NULL,
	`marks` int NOT NULL,
	`negativeMarks` int NOT NULL,
	CONSTRAINT `testQuestions_id` PRIMARY KEY(`id`),
	CONSTRAINT `test_question_position` UNIQUE(`testId`,`position`)
);
--> statement-breakpoint
CREATE TABLE `tests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examId` int NOT NULL,
	`slug` varchar(128) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`category` enum('full_mock','previous_year','subject','chapter','topic','custom') NOT NULL DEFAULT 'full_mock',
	`durationSeconds` int NOT NULL,
	`totalMarks` int NOT NULL,
	`questionCount` int NOT NULL,
	`negativeMarking` boolean NOT NULL DEFAULT true,
	`accessTier` enum('free','subscription') NOT NULL DEFAULT 'free',
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`configuration` json,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tests_id` PRIMARY KEY(`id`),
	CONSTRAINT `tests_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subjectId` int NOT NULL,
	`parentTopicId` int,
	`name` varchar(160) NOT NULL,
	`slug` varchar(160) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `topics_subject_slug` UNIQUE(`subjectId`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','reviewer','admin','super_admin') NOT NULL DEFAULT 'student';--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `auditLogs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `documents_uploader_idx` ON `documentUploads` (`uploadedBy`,`createdAt`);--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `processing_queue_idx` ON `processingJobs` (`state`,`createdAt`);--> statement-breakpoint
CREATE INDEX `questions_filter_idx` ON `questions` (`examId`,`subjectId`,`topicId`,`status`);--> statement-breakpoint
CREATE INDEX `questions_quality_idx` ON `questions` (`qualityScore`);--> statement-breakpoint
CREATE INDEX `subscriptions_access_idx` ON `subscriptions` (`userId`,`examId`,`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `attempts_user_idx` ON `testAttempts` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `attempts_resume_idx` ON `testAttempts` (`userId`,`testId`,`state`);--> statement-breakpoint
CREATE INDEX `test_question_lookup` ON `testQuestions` (`testId`,`questionId`);--> statement-breakpoint
CREATE INDEX `tests_browse_idx` ON `tests` (`examId`,`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `topics_subject_idx` ON `topics` (`subjectId`);