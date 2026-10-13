CREATE TABLE `monthlyMockUsage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`usedCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthlyMockUsage_id` PRIMARY KEY(`id`),
	CONSTRAINT `monthly_mock_usage_unique` UNIQUE(`userId`,`monthKey`)
);
--> statement-breakpoint
CREATE INDEX `monthly_mock_usage_month_idx` ON `monthlyMockUsage` (`monthKey`,`userId`);