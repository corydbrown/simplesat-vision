CREATE TABLE `qa_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`message_id` text,
	`activity_id` text,
	`parent_comment_id` text,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `ticket_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`activity_id`) REFERENCES `ticket_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_comment_id`) REFERENCES `qa_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qa_comments_evaluation_id_idx` ON `qa_comments` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_message_id_idx` ON `qa_comments` (`message_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_activity_id_idx` ON `qa_comments` (`activity_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_parent_comment_id_idx` ON `qa_comments` (`parent_comment_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_author_id_idx` ON `qa_comments` (`author_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_created_at_idx` ON `qa_comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `qa_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qa_reactions_evaluation_id_idx` ON `qa_reactions` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_target_idx` ON `qa_reactions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_author_id_idx` ON `qa_reactions` (`author_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `qa_reactions_unique_per_user_emoji_idx` ON `qa_reactions` (`target_type`,`target_id`,`author_id`,`emoji`);