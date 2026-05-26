-- SVP-147: Workspace foundation (Epic 2 Phase 1)
-- Adds workspaces + user_workspaces, backfills every root data table's
-- workspace_id to 'wks_bloom_beauty', and enforces NOT NULL via table rebuild.
-- Queries continue to ignore workspace_id until Phase 2 wires through
-- requireWorkspace().

CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text,
	`integration_type` text DEFAULT 'mock' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_by` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unq` ON `workspaces` (`slug`);--> statement-breakpoint

CREATE TABLE `user_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_workspaces_user_id_workspace_id_unq` ON `user_workspaces` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `user_workspaces_user_id_idx` ON `user_workspaces` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_workspaces_workspace_id_idx` ON `user_workspaces` (`workspace_id`);--> statement-breakpoint

-- Seed the demo workspace so every existing root row can FK to it during
-- backfill. Simplesat + Pronto workspaces are inserted by src/db/seed.ts,
-- not the migration, since their ids are random (only Bloom needs a stable
-- literal so this UPDATE can target it).
INSERT INTO `workspaces` (`id`, `name`, `slug`, `integration_type`, `created_at`, `created_by`)
VALUES ('wks_bloom_beauty', 'Bloom Beauty', 'bloom-beauty', 'mock', (unixepoch() * 1000), NULL);
--> statement-breakpoint

-- Backfill saved_views: existing rows have workspace_id = 'demo' (the
-- pre-migration constant). Point them at the new stable id.
UPDATE `saved_views` SET `workspace_id` = 'wks_bloom_beauty' WHERE `workspace_id` = 'demo';
--> statement-breakpoint

-- Each root table below gets workspace_id (text, NOT NULL, FK, indexed) via
-- the __new_ rebuild pattern. SELECT *, 'wks_bloom_beauty' appends the
-- workspace_id column with the bloom_beauty literal for every existing row.
-- PRAGMA foreign_keys=OFF wraps the whole sequence so cross-table FKs
-- (tickets→customers, evaluations→tickets, etc.) don't trip when their
-- target table is mid-rebuild.

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- customers
CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`tier` text NOT NULL,
	`language` text,
	`company` text,
	`company_external_id` text,
	`company_domain` text,
	`helpdesk_external_id` text,
	`custom_properties` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_customers` SELECT *, 'wks_bloom_beauty' FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
CREATE INDEX `customers_company_idx` ON `customers` (`company`);--> statement-breakpoint
CREATE INDEX `customers_tier_idx` ON `customers` (`tier`);--> statement-breakpoint
CREATE INDEX `customers_language_idx` ON `customers` (`language`);--> statement-breakpoint
CREATE INDEX `customers_workspace_id_idx` ON `customers` (`workspace_id`);--> statement-breakpoint

-- team_member_groups
CREATE TABLE `__new_team_member_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_team_member_groups` SELECT *, 'wks_bloom_beauty' FROM `team_member_groups`;--> statement-breakpoint
DROP TABLE `team_member_groups`;--> statement-breakpoint
ALTER TABLE `__new_team_member_groups` RENAME TO `team_member_groups`;--> statement-breakpoint
CREATE INDEX `team_member_groups_name_idx` ON `team_member_groups` (`name`);--> statement-breakpoint
CREATE INDEX `team_member_groups_workspace_id_idx` ON `team_member_groups` (`workspace_id`);--> statement-breakpoint

-- team_members
CREATE TABLE `__new_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`team` text NOT NULL,
	`helpdesk_external_id` text,
	`avatar_color` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`region` text,
	`language` text,
	`custom_properties` text DEFAULT '{}' NOT NULL,
	`group_id` text REFERENCES `team_member_groups`(`id`),
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_team_members` SELECT *, 'wks_bloom_beauty' FROM `team_members`;--> statement-breakpoint
DROP TABLE `team_members`;--> statement-breakpoint
ALTER TABLE `__new_team_members` RENAME TO `team_members`;--> statement-breakpoint
CREATE INDEX `team_members_team_idx` ON `team_members` (`team`);--> statement-breakpoint
CREATE INDEX `team_members_region_idx` ON `team_members` (`region`);--> statement-breakpoint
CREATE INDEX `team_members_group_id_idx` ON `team_members` (`group_id`);--> statement-breakpoint
CREATE INDEX `team_members_workspace_id_idx` ON `team_members` (`workspace_id`);--> statement-breakpoint

-- surveys
CREATE TABLE `__new_surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`scale` integer NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_surveys` SELECT *, 'wks_bloom_beauty' FROM `surveys`;--> statement-breakpoint
DROP TABLE `surveys`;--> statement-breakpoint
ALTER TABLE `__new_surveys` RENAME TO `surveys`;--> statement-breakpoint
CREATE INDEX `surveys_metric_idx` ON `surveys` (`metric`);--> statement-breakpoint
CREATE INDEX `surveys_channel_idx` ON `surveys` (`channel`);--> statement-breakpoint
CREATE INDEX `surveys_status_idx` ON `surveys` (`status`);--> statement-breakpoint
CREATE INDEX `surveys_workspace_id_idx` ON `surveys` (`workspace_id`);--> statement-breakpoint

-- tickets
CREATE TABLE `__new_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`channel` text NOT NULL,
	`helpdesk` text NOT NULL,
	`helpdesk_external_id` text,
	`customer_id` text NOT NULL,
	`assigned_team_member_id` text,
	`created_at` integer NOT NULL,
	`first_response_at` integer,
	`solved_at` integer,
	`closed_at` integer,
	`message_count` integer DEFAULT 0 NOT NULL,
	`agent_message_count` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`survey_eligible` integer DEFAULT true NOT NULL,
	`survey_sent_at` integer,
	`survey_not_sent_reason` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tickets` SELECT *, 'wks_bloom_beauty' FROM `tickets`;--> statement-breakpoint
DROP TABLE `tickets`;--> statement-breakpoint
ALTER TABLE `__new_tickets` RENAME TO `tickets`;--> statement-breakpoint
CREATE INDEX `tickets_customer_id_idx` ON `tickets` (`customer_id`);--> statement-breakpoint
CREATE INDEX `tickets_assigned_team_member_id_idx` ON `tickets` (`assigned_team_member_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_created_at_idx` ON `tickets` (`created_at`);--> statement-breakpoint
CREATE INDEX `tickets_solved_at_idx` ON `tickets` (`solved_at`);--> statement-breakpoint
CREATE INDEX `tickets_closed_at_idx` ON `tickets` (`closed_at`);--> statement-breakpoint
CREATE INDEX `tickets_survey_sent_at_idx` ON `tickets` (`survey_sent_at`);--> statement-breakpoint
CREATE INDEX `tickets_helpdesk_idx` ON `tickets` (`helpdesk`);--> statement-breakpoint
CREATE INDEX `tickets_priority_idx` ON `tickets` (`priority`);--> statement-breakpoint
CREATE INDEX `tickets_workspace_id_idx` ON `tickets` (`workspace_id`);--> statement-breakpoint

-- responses
CREATE TABLE `__new_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`team_member_id` text,
	`survey_type` text NOT NULL,
	`rating` integer NOT NULL,
	`scale` integer NOT NULL,
	`comment` text,
	`responded_at` integer NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`survey_id` text NOT NULL REFERENCES `surveys`(`id`),
	`topics` text DEFAULT '[]' NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_responses` SELECT *, 'wks_bloom_beauty' FROM `responses`;--> statement-breakpoint
DROP TABLE `responses`;--> statement-breakpoint
ALTER TABLE `__new_responses` RENAME TO `responses`;--> statement-breakpoint
CREATE INDEX `responses_ticket_id_idx` ON `responses` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `responses_customer_id_idx` ON `responses` (`customer_id`);--> statement-breakpoint
CREATE INDEX `responses_team_member_id_idx` ON `responses` (`team_member_id`);--> statement-breakpoint
CREATE INDEX `responses_survey_id_idx` ON `responses` (`survey_id`);--> statement-breakpoint
CREATE INDEX `responses_survey_type_idx` ON `responses` (`survey_type`);--> statement-breakpoint
CREATE INDEX `responses_rating_idx` ON `responses` (`rating`);--> statement-breakpoint
CREATE INDEX `responses_responded_at_idx` ON `responses` (`responded_at`);--> statement-breakpoint
CREATE INDEX `responses_workspace_id_idx` ON `responses` (`workspace_id`);--> statement-breakpoint

-- scorecards
CREATE TABLE `__new_scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_scorecards` SELECT *, 'wks_bloom_beauty' FROM `scorecards`;--> statement-breakpoint
DROP TABLE `scorecards`;--> statement-breakpoint
ALTER TABLE `__new_scorecards` RENAME TO `scorecards`;--> statement-breakpoint
CREATE INDEX `scorecards_is_default_idx` ON `scorecards` (`is_default`);--> statement-breakpoint
CREATE INDEX `scorecards_enabled_idx` ON `scorecards` (`enabled`);--> statement-breakpoint
CREATE INDEX `scorecards_workspace_id_idx` ON `scorecards` (`workspace_id`);--> statement-breakpoint

-- evaluations
CREATE TABLE `__new_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`scorecard_id` text NOT NULL,
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
	`scorecard_version_id` text NOT NULL REFERENCES `scorecard_versions`(`id`),
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scored_team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`edited_by`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_evaluations` SELECT *, 'wks_bloom_beauty' FROM `evaluations`;--> statement-breakpoint
DROP TABLE `evaluations`;--> statement-breakpoint
ALTER TABLE `__new_evaluations` RENAME TO `evaluations`;--> statement-breakpoint
CREATE INDEX `evaluations_ticket_id_idx` ON `evaluations` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scorecard_id_idx` ON `evaluations` (`scorecard_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scorecard_version_id_idx` ON `evaluations` (`scorecard_version_id`);--> statement-breakpoint
CREATE INDEX `evaluations_scored_team_member_id_idx` ON `evaluations` (`scored_team_member_id`);--> statement-breakpoint
CREATE INDEX `evaluations_status_idx` ON `evaluations` (`status`);--> statement-breakpoint
CREATE INDEX `evaluations_scored_at_idx` ON `evaluations` (`scored_at`);--> statement-breakpoint
CREATE INDEX `evaluations_overall_score_idx` ON `evaluations` (`overall_score`);--> statement-breakpoint
CREATE INDEX `evaluations_workspace_id_idx` ON `evaluations` (`workspace_id`);--> statement-breakpoint

-- coaching_notes
CREATE TABLE `__new_coaching_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`strength_points` text DEFAULT '[]' NOT NULL,
	`growth_points` text DEFAULT '[]' NOT NULL,
	`example_message_ids` text DEFAULT '[]' NOT NULL,
	`generated_by` text NOT NULL,
	`generated_at` integer NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_coaching_notes` SELECT *, 'wks_bloom_beauty' FROM `coaching_notes`;--> statement-breakpoint
DROP TABLE `coaching_notes`;--> statement-breakpoint
ALTER TABLE `__new_coaching_notes` RENAME TO `coaching_notes`;--> statement-breakpoint
CREATE INDEX `coaching_notes_evaluation_id_idx` ON `coaching_notes` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `coaching_notes_workspace_id_idx` ON `coaching_notes` (`workspace_id`);--> statement-breakpoint

-- qa_comments
CREATE TABLE `__new_qa_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`message_id` text,
	`activity_id` text,
	`parent_comment_id` text,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `ticket_messages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`activity_id`) REFERENCES `ticket_events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_comment_id`) REFERENCES `qa_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_qa_comments` SELECT *, 'wks_bloom_beauty' FROM `qa_comments`;--> statement-breakpoint
DROP TABLE `qa_comments`;--> statement-breakpoint
ALTER TABLE `__new_qa_comments` RENAME TO `qa_comments`;--> statement-breakpoint
CREATE INDEX `qa_comments_evaluation_id_idx` ON `qa_comments` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_message_id_idx` ON `qa_comments` (`message_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_activity_id_idx` ON `qa_comments` (`activity_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_parent_comment_id_idx` ON `qa_comments` (`parent_comment_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_author_id_idx` ON `qa_comments` (`author_id`);--> statement-breakpoint
CREATE INDEX `qa_comments_created_at_idx` ON `qa_comments` (`created_at`);--> statement-breakpoint
CREATE INDEX `qa_comments_workspace_id_idx` ON `qa_comments` (`workspace_id`);--> statement-breakpoint

-- qa_reactions
CREATE TABLE `__new_qa_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`author_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`workspace_id` text NOT NULL REFERENCES `workspaces`(`id`),
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_qa_reactions` SELECT *, 'wks_bloom_beauty' FROM `qa_reactions`;--> statement-breakpoint
DROP TABLE `qa_reactions`;--> statement-breakpoint
ALTER TABLE `__new_qa_reactions` RENAME TO `qa_reactions`;--> statement-breakpoint
CREATE INDEX `qa_reactions_evaluation_id_idx` ON `qa_reactions` (`evaluation_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_target_idx` ON `qa_reactions` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `qa_reactions_author_id_idx` ON `qa_reactions` (`author_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `qa_reactions_unique_per_user_emoji_idx` ON `qa_reactions` (`target_type`,`target_id`,`author_id`,`emoji`);--> statement-breakpoint
CREATE INDEX `qa_reactions_workspace_id_idx` ON `qa_reactions` (`workspace_id`);--> statement-breakpoint

PRAGMA foreign_keys=ON;
