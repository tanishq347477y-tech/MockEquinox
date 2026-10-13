CREATE TABLE `questionTagLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questionTagLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_tag_unique` UNIQUE(`questionId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `questionTags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(96) NOT NULL,
	`slug` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questionTags_id` PRIMARY KEY(`id`),
	CONSTRAINT `questionTags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `question_tags_tag_idx` ON `questionTagLinks` (`tagId`);