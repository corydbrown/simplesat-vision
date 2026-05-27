CREATE TABLE `workspace_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_api_keys_key_hash_unq` ON `workspace_api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `workspace_api_keys_workspace_id_idx` ON `workspace_api_keys` (`workspace_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`team_member_id` text,
	`survey_id` text,
	`survey_type` text NOT NULL,
	`rating` integer NOT NULL,
	`scale` integer NOT NULL,
	`comment` text,
	`source` text DEFAULT 'simplesat' NOT NULL,
	`external_id` text,
	`responded_at` integer NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`topics` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`survey_id`) REFERENCES `surveys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_responses`("id", "workspace_id", "ticket_id", "customer_id", "team_member_id", "survey_id", "survey_type", "rating", "scale", "comment", "source", "external_id", "responded_at", "answers", "topics") SELECT "id", "workspace_id", "ticket_id", "customer_id", "team_member_id", "survey_id", "survey_type", "rating", "scale", "comment", "source", NULL AS "external_id", "responded_at", "answers", "topics" FROM `responses`;--> statement-breakpoint
DROP TABLE `responses`;--> statement-breakpoint
ALTER TABLE `__new_responses` RENAME TO `responses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `responses_workspace_id_idx` ON `responses` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `responses_workspace_customer_rating_idx` ON `responses` (`workspace_id`,`customer_id`,`rating`);--> statement-breakpoint
CREATE INDEX `responses_ticket_id_idx` ON `responses` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `responses_customer_id_idx` ON `responses` (`customer_id`);--> statement-breakpoint
CREATE INDEX `responses_team_member_id_idx` ON `responses` (`team_member_id`);--> statement-breakpoint
CREATE INDEX `responses_survey_id_idx` ON `responses` (`survey_id`);--> statement-breakpoint
CREATE INDEX `responses_survey_type_idx` ON `responses` (`survey_type`);--> statement-breakpoint
CREATE INDEX `responses_source_idx` ON `responses` (`source`);--> statement-breakpoint
CREATE INDEX `responses_workspace_source_responded_idx` ON `responses` (`workspace_id`,`source`,`responded_at`);--> statement-breakpoint
CREATE INDEX `responses_rating_idx` ON `responses` (`rating`);--> statement-breakpoint
CREATE INDEX `responses_responded_at_idx` ON `responses` (`responded_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `responses_workspace_external_id_unq` ON `responses` (`workspace_id`,`external_id`) WHERE external_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE `ticket_messages` ADD `external_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_messages_external_id_unq` ON `ticket_messages` (`external_id`) WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_workspace_external_id_unq` ON `customers` (`workspace_id`,`external_id`) WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_workspace_external_id_unq` ON `team_members` (`workspace_id`,`external_id`) WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_workspace_external_id_unq` ON `tickets` (`workspace_id`,`external_id`) WHERE external_id IS NOT NULL;