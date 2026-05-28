CREATE TABLE `evaluation_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`feedback_text` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evaluation_feedback_workspace_id_idx` ON `evaluation_feedback` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `evaluation_feedback_evaluation_id_idx` ON `evaluation_feedback` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `evaluation_feedback_created_by_idx` ON `evaluation_feedback` (`created_by`);--> statement-breakpoint
CREATE UNIQUE INDEX `evaluation_feedback_unique_per_user_idx` ON `evaluation_feedback` (`evaluation_id`,`created_by`);