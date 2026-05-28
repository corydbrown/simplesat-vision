ALTER TABLE `tickets` ADD `modified_at` integer DEFAULT (unixepoch() * 1000) NOT NULL;--> statement-breakpoint
-- Backfill from real activity: max of ticket-row timestamps + the latest
-- related message/response. The naive default leaves every existing row at
-- migration-time NOW(), which would collapse the "Newest activity" sort.
UPDATE `tickets` SET `modified_at` = MAX(
  `created_at`,
  COALESCE(`solved_at`, 0),
  COALESCE(`closed_at`, 0),
  COALESCE((SELECT MAX(`created_at`) FROM `ticket_messages` WHERE `ticket_id` = `tickets`.`id`), 0),
  COALESCE((SELECT MAX(`responded_at`) FROM `responses` WHERE `ticket_id` = `tickets`.`id`), 0)
);--> statement-breakpoint
CREATE INDEX `tickets_workspace_modified_at_idx` ON `tickets` (`workspace_id`,`modified_at`);