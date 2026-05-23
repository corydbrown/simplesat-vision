CREATE TABLE `coaching_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`strength_points` text DEFAULT '[]' NOT NULL,
	`growth_points` text DEFAULT '[]' NOT NULL,
	`example_message_ids` text DEFAULT '[]' NOT NULL,
	`generated_by` text NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `coaching_notes_evaluation_id_idx` ON `coaching_notes` (`evaluation_id`);--> statement-breakpoint
CREATE TABLE `evaluation_category_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`category_id` text NOT NULL,
	`ai_score` integer NOT NULL,
	`human_score` integer,
	`effective_score` integer NOT NULL,
	`ai_reasoning` text DEFAULT '' NOT NULL,
	`highlighted_message_ids` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `scorecard_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evaluation_category_scores_evaluation_id_idx` ON `evaluation_category_scores` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `evaluation_category_scores_category_id_idx` ON `evaluation_category_scores` (`category_id`);--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`scorecard_id` text NOT NULL,
	`scorecard_version` integer NOT NULL,
	`scored_team_member_id` text NOT NULL,
	`overall_score` integer NOT NULL,
	`status` text DEFAULT 'ai_scored' NOT NULL,
	`ai_model` text NOT NULL,
	`ai_confidence` integer NOT NULL,
	`ai_reasoning_summary` text DEFAULT '' NOT NULL,
	`scored_by` text NOT NULL,
	`scored_at` integer NOT NULL,
	`edited_by` text,
	`edited_at` integer,
	`invalidated_reason` text,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scored_team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edited_by`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `evaluations_ticket_id_idx` ON `evaluations` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scorecard_id_idx` ON `evaluations` (`scorecard_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scored_team_member_id_idx` ON `evaluations` (`scored_team_member_id`);--> statement-breakpoint
CREATE INDEX `evaluations_status_idx` ON `evaluations` (`status`);--> statement-breakpoint
CREATE INDEX `evaluations_scored_at_idx` ON `evaluations` (`scored_at`);--> statement-breakpoint
CREATE INDEX `evaluations_overall_score_idx` ON `evaluations` (`overall_score`);--> statement-breakpoint
CREATE TABLE `scorecard_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`scorecard_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`weight_percent` integer DEFAULT 0 NOT NULL,
	`scale_type` text DEFAULT 'likert_5' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`is_autofail` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scorecard_categories_scorecard_id_idx` ON `scorecard_categories` (`scorecard_id`);--> statement-breakpoint
CREATE INDEX `scorecard_categories_order_idx` ON `scorecard_categories` (`order`);--> statement-breakpoint
CREATE TABLE `scorecard_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`text` text NOT NULL,
	`anchor_5` text DEFAULT '' NOT NULL,
	`anchor_3` text DEFAULT '' NOT NULL,
	`anchor_1` text DEFAULT '' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `scorecard_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scorecard_criteria_category_id_idx` ON `scorecard_criteria` (`category_id`);--> statement-breakpoint
CREATE INDEX `scorecard_criteria_order_idx` ON `scorecard_criteria` (`order`);--> statement-breakpoint
CREATE TABLE `scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scorecards_is_default_idx` ON `scorecards` (`is_default`);--> statement-breakpoint
CREATE INDEX `scorecards_enabled_idx` ON `scorecards` (`enabled`);--> statement-breakpoint
DROP TABLE `qa_evaluations`;