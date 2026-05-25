---
name: post-merge
description: After a PR merges — auto-cleanup the worktree, delete the branch, prune remote refs, mark the Notion task Done with PR link, scan the merge diff for new "Phase N deferred" entries in DECISIONS.md and file Notion follow-ups. Replaces the manual post-merge ceremony.
---

# /post-merge — one-shot post-merge cleanup

Usage: `/post-merge <PR-number>` (e.g. `/post-merge 60`)

Replaces the ~3-minute manual ceremony: verify merge → cleanup worktree → delete branch → prune → mark Notion Done → scan DECISIONS.md for new deferrals.

## Prerequisite

The PR must be **MERGED**. If not, abort and tell Cory.

## Steps

1. **Merge with --delete-branch.** If invoking /post-merge as part of "merge N" trigger (not just for cleanup-after-someone-else-merged), use:
   ```bash
   gh pr merge <PR> --squash --delete-branch
   ```
   The `--delete-branch` flag deletes BOTH local and remote branch on success. **If the local delete fails** because the branch is still checked out in a worktree, that's expected — handle in step 3. **Always include `--delete-branch`** so we don't accumulate stale remote refs (the failure mode /sweep had to filter around).

2. **Verify merge state**:
   - `gh pr view <PR> --json state,mergeCommit,headRefName,title`.
   - If state ≠ `MERGED`, stop and tell Cory ("PR #N is `<state>`, not merged — not cleaning up").
   - Capture: merge commit SHA (short), head branch name, PR title.

2. **Sync supervisor main** if not already:
   - `git pull --ff-only origin main` (handles "your branch is behind" cleanly).

3. **Cleanup worktree + branch**:
   - Parse SVP ID from branch name (`feat/svp<N>-*`) for downstream Notion lookup.
   - **Pre-clean the worktree-local artifacts first.** The brief-as-file pattern writes `BRIEF.md` to the worktree root, which is intentionally never committed. `git worktree remove` refuses with "contains modified or untracked files" if it's still there. Run:
     ```bash
     rm -f <worktree-path>/BRIEF.md
     ```
   - `git worktree remove <worktree-path>` — should now succeed cleanly. If it STILL errors with "Directory not empty," check what's there (probably node_modules/.next leftovers that should be in .gitignore — investigate the gitignore gap rather than `--force`); confirm with Cory before `rm -rf`.
   - `git branch -d feat/svp<N>-*` (lowercase `-d` refuses unmerged; the branch should be merged so this works). If you used `gh pr merge --delete-branch` in step 1, the local delete may have already happened or failed silently because the worktree held the branch — running it now finishes the job.
   - `git fetch --prune` to clean remote refs.

4. **Capture metrics from GitHub + PR body** (do this BEFORE the Notion write so all properties land in one update):
   - **First commit timestamp** (`Worker started`):
     ```bash
     gh pr view <PR> --json commits --jq '.commits[0].committedDate'
     ```
     This is the FIRST commit on the branch (not the most-recent). The `.commits` array is chronological.
   - **PR createdAt** (`Worker finished`):
     ```bash
     gh pr view <PR> --json createdAt --jq '.createdAt'
     ```
   - **Tokens used**:
     ```bash
     gh pr view <PR> --json body --jq '.body' | grep -A 10 '## Tokens used' | grep -iE 'total.*tokens?:' | head -1
     ```
     Parse the number out (strip commas). If the heading is missing or the regex doesn't match, leave `Tokens used` null — the worker didn't paste `/cost`, and that's fine (null is honest).

5. **Mark Notion task Done** — single `update_properties` call with everything:
   - Resolve the Notion task page by SVP-NN (search via `mcp__claude_ai_Notion__notion-search` or use cached ID).
   - `Status` → `Done`.
   - `Completed at` → current datetime (ISO 8601 with `+07:00` offset; `is_datetime: 1`). This is the supervisor-merge time.
   - `Worker started` → first-commit datetime (from step 4), `is_datetime: 1`.
   - `Worker finished` → PR createdAt (from step 4), `is_datetime: 1`.
   - `Tokens used` → parsed number (from step 4), or omit if null.
   - `Repo link` → the PR URL.
   - Append a Claude Code note: `- YYYY-MM-DD: PR #N squash-merged as \`<sha>\`. <one-line of what shipped>. Worktree cleaned up.`

6. **Scan the merge diff for DECISIONS.md deferrals**:
   - `gh pr view <PR> --json files --jq '.files[] | select(.filename == "DECISIONS.md")'`.
   - If `DECISIONS.md` changed, `git diff <merge-commit>~1 <merge-commit> -- DECISIONS.md` and grep for new "Phase N deferred (v2)" / "future work" / "out of scope" entries.
   - For each new deferral that does NOT already exist as a Notion Backlog task, **file it now** via `mcp__claude_ai_Notion__notion-create-pages` — Status: Backlog, defaults per NOTION.md.
   - Per [[feedback-nits-inline]], don't file PR review nits as follow-ups (those should have been fixed inline before merge). But DECISIONS.md deferrals ARE architectural choices that warrant tracking.

7. **End-of-turn output**:
   - Confirm cleanup with the merge commit SHA + worktree path removed + branch deleted.
   - Note the metrics captured (worker duration + tokens, or "no /cost paste — Tokens used null").
   - Note any DECISIONS.md deferrals filed.
   - Updated worktree count + open PR count.

## When NOT to use /post-merge

- Pre-merge cleanups (e.g. worktree removal while PR is still open) — those require explicit yes from Cory per the destructive-ops rule.
- For PRs that weren't tied to a Notion task (rare — most should be).

## Cross-references

- [[feedback-auto-cleanup-merged-worktrees]] — the standing authority for this cleanup pattern
- [[feedback-nits-inline]] — why we DON'T file follow-ups for PR review nits (fix inline instead)
- NOTION.md → "On PR merge" — the Notion update conventions
- CLAUDE.md → "Definition of done" — the status block format
