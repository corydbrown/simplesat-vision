CREATE TABLE `team_member_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_member_groups_name_idx` ON `team_member_groups` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "name", "email", "tier", "language", "company", "company_external_id", "company_domain", "helpdesk_external_id", "custom_properties", "created_at", "updated_at") SELECT "id", "name", "email", "tier", NULL AS "language", "company", NULL AS "company_external_id", NULL AS "company_domain", "helpdesk_external_id", "custom_properties", "created_at", "updated_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `customers_company_idx` ON `customers` (`company`);--> statement-breakpoint
CREATE INDEX `customers_tier_idx` ON `customers` (`tier`);--> statement-breakpoint
CREATE INDEX `customers_language_idx` ON `customers` (`language`);--> statement-breakpoint
ALTER TABLE `team_members` ADD `group_id` text REFERENCES team_member_groups(id);--> statement-breakpoint
CREATE INDEX `team_members_group_id_idx` ON `team_members` (`group_id`);--> statement-breakpoint
ALTER TABLE `team_members` DROP COLUMN `zendesk_group`;--> statement-breakpoint
ALTER TABLE `tickets` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
CREATE INDEX `tickets_priority_idx` ON `tickets` (`priority`);