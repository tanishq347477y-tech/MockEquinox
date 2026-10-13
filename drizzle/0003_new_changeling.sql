CREATE TABLE `paymentWebhookEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` enum('razorpay') NOT NULL DEFAULT 'razorpay',
	`eventId` varchar(128) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`payload` json NOT NULL,
	`status` enum('received','processed','failed') NOT NULL DEFAULT 'received',
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	`error` text,
	CONSTRAINT `paymentWebhookEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `paymentWebhookEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE INDEX `payment_webhook_status_idx` ON `paymentWebhookEvents` (`status`,`receivedAt`);