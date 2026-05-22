PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_saved_views` (
	`id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`entity` text NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`workspace_id`, `entity`, `id`)
);
--> statement-breakpoint
INSERT INTO `__new_saved_views`("id", "workspace_id", "entity", "name", "state", "position", "created_at", "updated_at") SELECT "id", "workspace_id", "entity", "name", "state", "position", "created_at", "updated_at" FROM `saved_views`;--> statement-breakpoint
DROP TABLE `saved_views`;--> statement-breakpoint
ALTER TABLE `__new_saved_views` RENAME TO `saved_views`;--> statement-breakpoint
PRAGMA foreign_keys=ON;