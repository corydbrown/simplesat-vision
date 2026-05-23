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

1. **Verify merge state**:
   - `gh pr view <PR> --json state,mergeCommit,headRefName,title`.
   - If state ≠ `MERGED`, stop and tell Cory ("PR #N is `<state>`, not merged — not cleaning up").
   - Capture: merge commit SHA (short), head branch name, PR title.

2. **Sync supervisor main** if not already:
   - `git pull --ff-only origin main` (handles "your branch is behind" cleanly).

3. **Cleanup worktree + branch**:
   - Parse SVP ID from branch name (`feat/svp<N>-*`) for downstream Notion lookup.
   - `git worktree remove <worktrees-root>/<branch-without-feat-prefix>` — if it errors with "Directory not empty," check what's there (probably node_modules/.next leftovers); confirm with Cory before `rm -rf`.
   - `git branch -d feat/svp<N>-*` (lowercase `-d` refuses unmerged; the branch should be merged so this works).
   - `git fetch --prune` to clean remote refs.

4. **Mark Notion task Done**:
   - Resolve the Notion task page by SVP-NN (search Notion via `mcp__claude_ai_Notion__notion-search` with the SVP-NN, or use cached ID if known).
   - `Status` → `Done`.
   - `Completed at` → current datetime (ISO 8601 with `+07:00` offset; `is_datetime: 1`).
   - `Repo link` → the PR URL.
   - Append a Claude Code note: `- YYYY-MM-DD: PR #N squash-merged as \`<sha>\`. <one-line of what shipped>. Worktree cleaned up.`

5. **Scan the merge diff for DECISIONS.md deferrals**:
   - `gh pr view <PR> --json files --jq '.files[] | select(.filename == "DECISIONS.md")'`.
   - If `DECISIONS.md` changed, `git diff <merge-commit>~1 <merge-commit> -- DECISIONS.md` and grep for new "Phase N deferred (v2)" / "future work" / "out of scope" entries.
   - For each new deferral that does NOT already exist as a Notion Backlog task, **file it now** via `mcp__claude_ai_Notion__notion-create-pages` — Status: Backlog, defaults per NOTION.md.
   - Per [[feedback-nits-inline]], don't file PR review nits as follow-ups (those should have been fixed inline before merge). But DECISIONS.md deferrals ARE architectural choices that warrant tracking.

6. **End-of-turn output**:
   - Confirm cleanup with the merge commit SHA + worktree path removed + branch deleted.
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
