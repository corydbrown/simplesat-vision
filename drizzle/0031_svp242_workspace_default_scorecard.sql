-- SVP-242: per-workspace default scorecard.
--
-- Manual Evaluate / Re-evaluate clicks (no explicit scorecardId override) now
-- resolve to `workspaces.default_scorecard_id` before falling back to
-- "oldest live scorecard." Auto-scoring rules are unaffected — they pass an
-- explicit scorecardId that bypasses this fallback.
--
-- Backfill: workspaces with exactly one live scorecard get that scorecard set
-- as default. Multi-scorecard workspaces (Pronto) are left NULL — the admin
-- picks via /settings/scorecards. Zero-scorecard workspaces also stay NULL;
-- the auto-init path in scoreAndPersistTicket handles them on first manual
-- evaluate (mints IQS and sets it as the new default).
ALTER TABLE `workspaces` ADD `default_scorecard_id` text REFERENCES scorecards(id);--> statement-breakpoint
UPDATE `workspaces`
SET `default_scorecard_id` = (
  SELECT s.id FROM `scorecards` s
  WHERE s.workspace_id = workspaces.id
    AND s.archived_at IS NULL
  LIMIT 1
)
WHERE (
  SELECT COUNT(*) FROM `scorecards` s
  WHERE s.workspace_id = workspaces.id
    AND s.archived_at IS NULL
) = 1;
