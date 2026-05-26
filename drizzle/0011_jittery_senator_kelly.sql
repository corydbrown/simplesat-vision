CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workos_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_seen_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_workos_id_unq` ON `users` (`workos_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unq` ON `users` (`email`);