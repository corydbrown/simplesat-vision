ALTER TABLE `team_members` ADD `kind` text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE `team_members` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `model` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `system_prompt_url` text;--> statement-breakpoint
ALTER TABLE `team_members` ADD `deployed_at` integer;