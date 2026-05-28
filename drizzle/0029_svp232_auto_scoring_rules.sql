CREATE TABLE `auto_scoring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`filter_predicate` text DEFAULT '[]' NOT NULL,
	`scorecard_id` text NOT NULL,
	`sampling_percent` integer DEFAULT 100 NOT NULL,
	`daily_cap` integer,
	`priority` integer DEFAULT 100 NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `auto_scoring_rules_workspace_priority_idx` ON `auto_scoring_rules` (`workspace_id`,`priority`);--> statement-breakpoint
CREATE INDEX `auto_scoring_rules_scorecard_id_idx` ON `auto_scoring_rules` (`scorecard_id`);--> statement-breakpoint
ALTER TABLE `evaluations` ADD `auto_scoring_rule_id` text REFERENCES auto_scoring_rules(id);--> statement-breakpoint
CREATE INDEX `evaluations_rule_scored_at_idx` ON `evaluations` (`auto_scoring_rule_id`,`scored_at`);--> statement-breakpoint
-- SVP-232: backfill a default "Score all tickets with IQS" rule for every
-- existing workspace that already has an IQS scorecard (Bloom Beauty,
-- Simplesat, Pronto). Workspaces without one are skipped gracefully — they'll
-- get a default rule the next time their scorecard is provisioned (seed or
-- runtime auto-init). The rule is deletable; users own their fallback.
INSERT INTO `auto_scoring_rules` (
  `id`, `workspace_id`, `name`, `enabled`, `filter_predicate`,
  `scorecard_id`, `sampling_percent`, `daily_cap`, `priority`,
  `created_by`, `created_at`, `updated_at`
)
SELECT
  'asr_' || lower(hex(randomblob(8))),
  w.id,
  'Score all tickets with IQS',
  1,
  '[]',
  (
    SELECT s.id FROM `scorecards` s
    WHERE s.workspace_id = w.id
      AND s.name = 'IQS (Internal Quality Score)'
      AND s.archived_at IS NULL
    ORDER BY s.created_at ASC
    LIMIT 1
  ),
  100,
  500,
  100,
  NULL,
  unixepoch() * 1000,
  unixepoch() * 1000
FROM `workspaces` w
WHERE EXISTS (
  SELECT 1 FROM `scorecards` s
  WHERE s.workspace_id = w.id
    AND s.name = 'IQS (Internal Quality Score)'
    AND s.archived_at IS NULL
);