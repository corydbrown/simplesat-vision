ALTER TABLE `ticket_messages` ADD `author_subtype` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `ai_agent_participated` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `started_with_bot` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `handed_off_to_human` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `ai_resolution_state` text;