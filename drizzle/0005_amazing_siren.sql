CREATE TABLE `queueWorkerSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(96) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(64) NOT NULL,
	`batchSize` int NOT NULL DEFAULT 1,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `queueWorkerSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `queueWorkerSchedules_name_unique` UNIQUE(`name`),
	CONSTRAINT `queueWorkerSchedules_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `processingJobs` ADD `availableAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `processingJobs` ADD `leaseToken` varchar(96);--> statement-breakpoint
ALTER TABLE `processingJobs` ADD `leaseExpiresAt` timestamp;--> statement-breakpoint
CREATE INDEX `queue_worker_task_idx` ON `queueWorkerSchedules` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `processing_ready_idx` ON `processingJobs` (`state`,`availableAt`,`id`);--> statement-breakpoint
CREATE INDEX `processing_lease_idx` ON `processingJobs` (`state`,`leaseExpiresAt`);