CREATE INDEX `evaluations_ticket_scored_at_idx` ON `evaluations` (`ticket_id`,`scored_at`);--> statement-breakpoint
CREATE INDEX `ticket_events_ticket_verb_prev_idx` ON `ticket_events` (`ticket_id`,`verb`,`previous_value`);--> statement-breakpoint
CREATE INDEX `ticket_messages_ticket_author_created_idx` ON `ticket_messages` (`ticket_id`,`author_role`,`created_at`);