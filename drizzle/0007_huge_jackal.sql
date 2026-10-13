ALTER TABLE `processingJobs` ADD `queueKind` varchar(64);--> statement-breakpoint
CREATE INDEX `processing_queue_kind_ready_idx` ON `processingJobs` (`queueKind`,`state`,`availableAt`,`id`);