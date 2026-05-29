PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`scorecard_id` text NOT NULL,
	`scorecard_version_id` text NOT NULL,
	`scored_team_member_id` text,
	`overall_score` integer NOT NULL,
	`status` text DEFAULT 'ai_scored' NOT NULL,
	`ai_model` text NOT NULL,
	`ai_provider` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`cost_usd_cents` integer,
	`ai_confidence` integer NOT NULL,
	`ai_reasoning_summary` text DEFAULT '' NOT NULL,
	`scored_by` text NOT NULL,
	`scored_at` integer NOT NULL,
	`edited_by` text,
	`edited_at` integer,
	`invalidated_reason` text,
	`auto_scoring_rule_id` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scorecard_version_id`) REFERENCES `scorecard_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scored_team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auto_scoring_rule_id`) REFERENCES `auto_scoring_rules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_evaluations`("id", "workspace_id", "ticket_id", "scorecard_id", "scorecard_version_id", "scored_team_member_id", "overall_score", "status", "ai_model", "ai_provider", "input_tokens", "output_tokens", "cost_usd_cents", "ai_confidence", "ai_reasoning_summary", "scored_by", "scored_at", "edited_by", "edited_at", "invalidated_reason", "auto_scoring_rule_id") SELECT "id", "workspace_id", "ticket_id", "scorecard_id", "scorecard_version_id", "scored_team_member_id", "overall_score", "status", "ai_model", "ai_provider", "input_tokens", "output_tokens", "cost_usd_cents", "ai_confidence", "ai_reasoning_summary", "scored_by", "scored_at", "edited_by", "edited_at", "invalidated_reason", "auto_scoring_rule_id" FROM `evaluations`;--> statement-breakpoint
DROP TABLE `evaluations`;--> statement-breakpoint
ALTER TABLE `__new_evaluations` RENAME TO `evaluations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `evaluations_workspace_id_idx` ON `evaluations` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `evaluations_ticket_id_idx` ON `evaluations` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `evaluations_ticket_scored_at_idx` ON `evaluations` (`ticket_id`,`scored_at`);--> statement-breakpoint
CREATE INDEX `evaluations_scorecard_id_idx` ON `evaluations` (`scorecard_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scorecard_version_id_idx` ON `evaluations` (`scorecard_version_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scored_team_member_id_idx` ON `evaluations` (`scored_team_member_id`);--> statement-breakpoint
CREATE INDEX `evaluations_status_idx` ON `evaluations` (`status`);--> statement-breakpoint
CREATE INDEX `evaluations_scored_at_idx` ON `evaluations` (`scored_at`);--> statement-breakpoint
CREATE INDEX `evaluations_overall_score_idx` ON `evaluations` (`overall_score`);--> statement-breakpoint
CREATE INDEX `evaluations_rule_scored_at_idx` ON `evaluations` (`auto_scoring_rule_id`,`scored_at`);--> statement-breakpoint
ALTER TABLE `scorecards` ADD `applies_to` text DEFAULT 'human' NOT NULL;--> statement-breakpoint
CREATE INDEX `scorecards_applies_to_idx` ON `scorecards` (`applies_to`);