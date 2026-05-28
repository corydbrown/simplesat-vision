-- SVP-211: retarget qa_comments.author_id, qa_reactions.author_id, and
-- evaluations.edited_by from team_members.id to users.id.
--
-- Existing rows in those columns hold TEAM_MEMBER ids (the previous resolver
-- stubs wrote them). After this migration they reference users instead, so
-- the legacy values are orphans. Clean them up before the FK rebuild because
-- SQLite's `PRAGMA foreign_keys=OFF` rebuild dance silently retains rows
-- whose values don't match the new FK target — orphans then leak into
-- JOIN-against-users reads as NULL author rows.
--
-- Seed regenerates qa_comments / qa_reactions from scratch under the new
-- user-author shape, so the DELETE is safe in dev. For Turso prod, Cory
-- explicitly OK'd the wipe — the rows were stub artefacts.
DELETE FROM `qa_comments`;--> statement-breakpoint
DELETE FROM `qa_reactions`;--> statement-breakpoint
-- `evaluations.edited_by` is nullable. Existing non-null values point at
-- team_members and would orphan under the new FK; null them so the row stays
-- but loses its (incorrectly-attributed) editor. Runtime re-edits will
-- repopulate via the new user-based path.
UPDATE `evaluations` SET `edited_by` = NULL WHERE `edited_by` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`scorecard_id` text NOT NULL,
	`scorecard_version_id` text NOT NULL,
	`scored_team_member_id` text NOT NULL,
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
CREATE TABLE `__new_qa_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`message_id` text,
	`activity_id` text,
	`parent_comment_id` text,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `ticket_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`activity_id`) REFERENCES `ticket_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_comment_id`) REFERENCES `qa_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_qa_comments`("id", "workspace_id", "evaluation_id", "message_id", "activity_id", "parent_comment_id", "author_id", "body", "created_at", "updated_at") SELECT "id", "workspace_id", "evaluation_id", "message_id", "activity_id", "parent_comment_id", "author_id", "body", "created_at", "updated_at" FROM `qa_comments`;--> statement-breakpoint
DROP TABLE `qa_comments`;--> statement-breakpoint
ALTER TABLE `__new_qa_comments` RENAME TO `qa_comments`;--> statement-breakpoint
CREATE INDEX `qa_comments_workspace_id_idx` ON `qa_comments` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_evaluation_id_idx` ON `qa_comments` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_message_id_idx` ON `qa_comments` (`message_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_activity_id_idx` ON `qa_comments` (`activity_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_parent_comment_id_idx` ON `qa_comments` (`parent_comment_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_author_id_idx` ON `qa_comments` (`author_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_created_at_idx` ON `qa_comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `__new_qa_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_qa_reactions`("id", "workspace_id", "target_type", "target_id", "evaluation_id", "author_id", "emoji", "created_at") SELECT "id", "workspace_id", "target_type", "target_id", "evaluation_id", "author_id", "emoji", "created_at" FROM `qa_reactions`;--> statement-breakpoint
DROP TABLE `qa_reactions`;--> statement-breakpoint
ALTER TABLE `__new_qa_reactions` RENAME TO `qa_reactions`;--> statement-breakpoint
CREATE INDEX `qa_reactions_workspace_id_idx` ON `qa_reactions` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_evaluation_id_idx` ON `qa_reactions` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_target_idx` ON `qa_reactions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_author_id_idx` ON `qa_reactions` (`author_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `qa_reactions_unique_per_user_emoji_idx` ON `qa_reactions` (`target_type`,`target_id`,`author_id`,`emoji`);--> statement-breakpoint
ALTER TABLE `user_workspaces` ADD `team_member_id` text REFERENCES team_members(id);--> statement-breakpoint
CREATE INDEX `user_workspaces_team_member_id_idx` ON `user_workspaces` (`team_member_id`);