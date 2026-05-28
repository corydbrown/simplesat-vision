DROP INDEX `scorecards_is_default_idx`;--> statement-breakpoint
ALTER TABLE `scorecards` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `scorecards` ADD `scoring_philosophy` text;--> statement-breakpoint
ALTER TABLE `scorecards` ADD `band_descriptors` text;--> statement-breakpoint
ALTER TABLE `scorecards` ADD `domain_context` text;--> statement-breakpoint
ALTER TABLE `scorecards` ADD `tone_expectations` text;--> statement-breakpoint
CREATE INDEX `scorecards_archived_at_idx` ON `scorecards` (`archived_at`);--> statement-breakpoint
ALTER TABLE `scorecards` DROP COLUMN `is_default`;--> statement-breakpoint
ALTER TABLE `scorecard_criteria` ADD `weight_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scorecard_version_criteria` ADD `weight_percent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scorecard_versions` ADD `scoring_philosophy` text;--> statement-breakpoint
ALTER TABLE `scorecard_versions` ADD `band_descriptors` text;--> statement-breakpoint
ALTER TABLE `scorecard_versions` ADD `domain_context` text;--> statement-breakpoint
ALTER TABLE `scorecard_versions` ADD `tone_expectations` text;--> statement-breakpoint
-- SVP-228 backfill: criterion-level weight now drives overall-score math.
-- Existing rubrics have exactly one weighted criterion per non-autofail
-- category, so copying the parent's category weight onto the child criterion
-- preserves the overall-score formula byte-for-byte. Autofail criteria stay
-- at weight 0 because their parent category was already weight 0.
UPDATE `scorecard_criteria`
SET `weight_percent` = (
  SELECT `weight_percent` FROM `scorecard_categories`
  WHERE `scorecard_categories`.`id` = `scorecard_criteria`.`category_id`
);--> statement-breakpoint
UPDATE `scorecard_version_criteria`
SET `weight_percent` = (
  SELECT `svc`.`weight_percent`
  FROM `scorecard_version_categories` AS `svc`
  WHERE `svc`.`id` = `scorecard_version_criteria`.`version_category_id`
);