CREATE TABLE `surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`metric` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`scale` integer NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `surveys_metric_idx` ON `surveys` (`metric`);--> statement-breakpoint
CREATE INDEX `surveys_channel_idx` ON `surveys` (`channel`);--> statement-breakpoint
CREATE INDEX `surveys_status_idx` ON `surveys` (`status`);--> statement-breakpoint
ALTER TABLE `customers` ADD `custom_properties` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `responses` ADD `survey_id` text NOT NULL REFERENCES surveys(id);--> statement-breakpoint
ALTER TABLE `responses` ADD `topics` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `responses_survey_id_idx` ON `responses` (`survey_id`);--> statement-breakpoint
CREATE INDEX `responses_survey_type_idx` ON `responses` (`survey_type`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `region` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `language` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `zendesk_group` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `custom_properties` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `team_members_region_idx` ON `team_members` (`region`);