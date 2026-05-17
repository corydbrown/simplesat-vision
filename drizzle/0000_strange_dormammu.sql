CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`company` text NOT NULL,
	`tier` text NOT NULL,
	`helpdesk_external_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_company_idx` ON `customers` (`company`);--> statement-breakpoint
CREATE INDEX `customers_tier_idx` ON `customers` (`tier`);--> statement-breakpoint
CREATE TABLE `qa_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`team_member_id` text NOT NULL,
	`score` integer NOT NULL,
	`model_used` text NOT NULL,
	`evaluated_at` integer NOT NULL,
	`evaluation_type` text NOT NULL,
	`rubric_version` text NOT NULL,
	`breakdown` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `qa_evaluations_ticket_id_idx` ON `qa_evaluations` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `qa_evaluations_team_member_id_idx` ON `qa_evaluations` (`team_member_id`);--> statement-breakpoint
CREATE INDEX `qa_evaluations_evaluated_at_idx` ON `qa_evaluations` (`evaluated_at`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`team_member_id` text,
	`survey_type` text NOT NULL,
	`rating` integer NOT NULL,
	`scale` integer NOT NULL,
	`comment` text,
	`responded_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `responses_ticket_id_idx` ON `responses` (`ticket_id`);--> statement-breakpoint
CREATE INDEX `responses_customer_id_idx` ON `responses` (`customer_id`);--> statement-breakpoint
CREATE INDEX `responses_team_member_id_idx` ON `responses` (`team_member_id`);--> statement-breakpoint
CREATE INDEX `responses_rating_idx` ON `responses` (`rating`);--> statement-breakpoint
CREATE INDEX `responses_responded_at_idx` ON `responses` (`responded_at`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`team` text NOT NULL,
	`helpdesk_external_id` text,
	`avatar_color` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_members_team_idx` ON `team_members` (`team`);--> statement-breakpoint
CREATE TABLE `tickets` (
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
	`conversation` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_team_member_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tickets_customer_id_idx` ON `tickets` (`customer_id`);--> statement-breakpoint
CREATE INDEX `tickets_assigned_team_member_id_idx` ON `tickets` (`assigned_team_member_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `tickets_created_at_idx` ON `tickets` (`created_at`);--> statement-breakpoint
CREATE INDEX `tickets_solved_at_idx` ON `tickets` (`solved_at`);--> statement-breakpoint
CREATE INDEX `tickets_closed_at_idx` ON `tickets` (`closed_at`);--> statement-breakpoint
CREATE INDEX `tickets_survey_sent_at_idx` ON `tickets` (`survey_sent_at`);--> statement-breakpoint
CREATE INDEX `tickets_helpdesk_idx` ON `tickets` (`helpdesk`);