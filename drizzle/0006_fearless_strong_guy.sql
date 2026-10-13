ALTER TABLE `queueWorkerSchedules` ADD `executionLeaseToken` varchar(96);--> statement-breakpoint
ALTER TABLE `queueWorkerSchedules` ADD `executionLeaseExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `queueWorkerSchedules` ADD `lastRunAt` timestamp;--> statement-breakpoint
CREATE INDEX `queue_worker_lease_idx` ON `queueWorkerSchedules` (`executionLeaseExpiresAt`);