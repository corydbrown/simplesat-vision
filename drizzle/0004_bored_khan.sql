CREATE TABLE `ticket_events` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`actor_team_member_id` text,
	`actor_customer_id` text,
	`verb` text NOT NULL,
	`field_name` text,
	`previous_value` text,
	`new_value` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ticket_events_ticket_id_idx` ON `ticket_events` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_events_created_at_idx` ON `ticket_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `ticket_events_verb_idx` ON `ticket_events` (`verb`);--> statement-breakpoint
CREATE INDEX `ticket_events_actor_team_member_id_idx` ON `ticket_events` (`actor_team_member_id`);--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`author_role` text NOT NULL,
	`customer_id` text,
	`team_member_id` text,
	`channel` text NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`type` text DEFAULT 'comment' NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ticket_messages_ticket_id_idx` ON `ticket_messages` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `ticket_messages_created_at_idx` ON `ticket_messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `ticket_messages_team_member_id_idx` ON `ticket_messages` (`team_member_id`);--> statement-breakpoint
CREATE INDEX `ticket_messages_customer_id_idx` ON `ticket_messages` (`customer_id`);--> statement-breakpoint
ALTER TABLE `tickets` DROP COLUMN `conversation`;