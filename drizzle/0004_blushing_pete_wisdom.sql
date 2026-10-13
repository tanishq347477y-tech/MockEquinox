CREATE TABLE `rateLimitBuckets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`limitKey` varchar(191) NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rateLimitBuckets_id` PRIMARY KEY(`id`),
	CONSTRAINT `rate_limit_key_window_unique` UNIQUE(`limitKey`,`windowStartedAt`)
);
--> statement-breakpoint
CREATE INDEX `rate_limit_window_idx` ON `rateLimitBuckets` (`windowStartedAt`);