-- SVP-175 — Ingest schema foundation.
-- Hand-written lossless variant: drizzle-kit can't express column renames
-- non-interactively, so the auto-generated draft modeled these as ADD+DROP
-- (which would discard data). Renames below use ALTER TABLE RENAME COLUMN to
-- preserve existing rows + FKs; only genuinely-new columns are ADDed. The
-- meta snapshot (0016) reflects the final schema either way.

-- customers: source-neutral renames -----------------------------------------
DROP INDEX `customers_company_idx`;--> statement-breakpoint
ALTER TABLE `customers` RENAME COLUMN `company` TO `organization`;--> statement-breakpoint
ALTER TABLE `customers` RENAME COLUMN `company_external_id` TO `organization_external_id`;--> statement-breakpoint
ALTER TABLE `customers` RENAME COLUMN `company_domain` TO `organization_domain`;--> statement-breakpoint
ALTER TABLE `customers` RENAME COLUMN `helpdesk_external_id` TO `external_id`;--> statement-breakpoint
CREATE INDEX `customers_organization_idx` ON `customers` (`organization`);--> statement-breakpoint

-- team_members: source-neutral rename ---------------------------------------
ALTER TABLE `team_members` RENAME COLUMN `helpdesk_external_id` TO `external_id`;--> statement-breakpoint

-- tickets: renames + raw-capture columns ------------------------------------
DROP INDEX `tickets_assigned_team_member_id_idx`;--> statement-breakpoint
DROP INDEX `tickets_helpdesk_idx`;--> statement-breakpoint
ALTER TABLE `tickets` RENAME COLUMN `helpdesk` TO `source`;--> statement-breakpoint
ALTER TABLE `tickets` RENAME COLUMN `helpdesk_external_id` TO `external_id`;--> statement-breakpoint
ALTER TABLE `tickets` RENAME COLUMN `assigned_team_member_id` TO `team_member_id`;--> statement-breakpoint
-- is_resolved: VIRTUAL generated (STORED can't be added via ALTER TABLE).
ALTER TABLE `tickets` ADD `is_resolved` integer GENERATED ALWAYS AS ((status IN ('solved', 'closed'))) VIRTUAL NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `source_agents` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `source_metrics` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `source_tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX `tickets_team_member_id_idx` ON `tickets` (`team_member_id`);--> statement-breakpoint
CREATE INDEX `tickets_source_idx` ON `tickets` (`source`);--> statement-breakpoint
-- Backfill source_agents from the now-renamed team_member_id (decision #4:
-- the lossless source bag is the source of truth; today the only role we
-- captured was the assignee). Done in the migration, not at runtime.
UPDATE `tickets`
SET `source_agents` = json_object(
  'assignee',
  (SELECT `external_id` FROM `team_members` WHERE `team_members`.`id` = `tickets`.`team_member_id`)
)
WHERE `team_member_id` IS NOT NULL
  AND (SELECT `external_id` FROM `team_members` WHERE `team_members`.`id` = `tickets`.`team_member_id`) IS NOT NULL;--> statement-breakpoint

-- responses: provenance column ----------------------------------------------
ALTER TABLE `responses` ADD `source` text DEFAULT 'simplesat' NOT NULL;--> statement-breakpoint
CREATE INDEX `responses_source_idx` ON `responses` (`source`);
