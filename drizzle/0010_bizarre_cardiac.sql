CREATE TABLE `scorecard_version_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`scorecard_version_id` text NOT NULL,
	`source_category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`weight_percent` integer DEFAULT 0 NOT NULL,
	`scale_type` text DEFAULT 'likert_5' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`is_autofail` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`scorecard_version_id`) REFERENCES `scorecard_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_category_id`) REFERENCES `scorecard_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scorecard_version_categories_version_id_idx` ON `scorecard_version_categories` (`scorecard_version_id`);--> statement-breakpoint
CREATE INDEX `scorecard_version_categories_source_id_idx` ON `scorecard_version_categories` (`source_category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scorecard_version_categories_version_source_idx` ON `scorecard_version_categories` (`scorecard_version_id`,`source_category_id`);--> statement-breakpoint
CREATE TABLE `scorecard_version_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`version_category_id` text NOT NULL,
	`source_criterion_id` text NOT NULL,
	`text` text NOT NULL,
	`anchor_5` text DEFAULT '' NOT NULL,
	`anchor_3` text DEFAULT '' NOT NULL,
	`anchor_1` text DEFAULT '' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`version_category_id`) REFERENCES `scorecard_version_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_criterion_id`) REFERENCES `scorecard_criteria`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `scorecard_version_criteria_category_id_idx` ON `scorecard_version_criteria` (`version_category_id`);--> statement-breakpoint
CREATE INDEX `scorecard_version_criteria_source_id_idx` ON `scorecard_version_criteria` (`source_criterion_id`);--> statement-breakpoint
CREATE TABLE `scorecard_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`scorecard_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`auto_fail_floor` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scorecard_versions_scorecard_id_idx` ON `scorecard_versions` (`scorecard_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `scorecard_versions_scorecard_id_version_idx` ON `scorecard_versions` (`scorecard_id`,`version`);--> statement-breakpoint
ALTER TABLE `evaluations` ADD `scorecard_version_id` text NOT NULL REFERENCES scorecard_versions(id);--> statement-breakpoint
CREATE INDEX `evaluations_scorecard_version_id_idx` ON `evaluations` (`scorecard_version_id`);--> statement-breakpoint
ALTER TABLE `evaluations` DROP COLUMN `scorecard_version`;