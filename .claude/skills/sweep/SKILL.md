---
name: sweep
description: On-demand sweep of open PRs + in-code STOP markers + auto-PR-on-pushed-branch. Eliminates "is the worker done?" checking — pushed work surfaces as an open PR ready for review within one sweep cycle.
---

# /sweep — review all open PRs, surface STOP markers, auto-PR pushed branches

Usage: `/sweep`

On-demand alternative to `/loop 15m sweep…`. Use when:

- Cory just came back and wants a status check
- A long-running worker just pushed; review now
- Between merges, to see what landed since last review

## Steps

1. **Scan open PR diffs + pushed-branch tip commits for `STOP —` markers.** Workers leave `// STOP — <reason>` comments in code when soft-blocked (per STOP_CONDITIONS.md). Surface any found ones **first** — a blocked worker is more urgent than any PR.
   ```bash
   # In each pushed feat/svp* branch, grep the tip-of-branch diff:
   git fetch origin --quiet
   for branch in $(git ls-remote --heads origin 'feat/svp*' | awk '{print $2}' | sed 's|refs/heads/||'); do
     git log origin/main..origin/$branch -p 2>/dev/null | grep -nE '^\+.*STOP —' | head -5
   done
   ```
   If a STOP marker is found, report it as: `🛑 <branch> @ <file:line> — <reason quoted from the marker>`. Cory decides what to do — clear it, redirect the worker, or take over.

2. **Detect pushed-but-not-PR'd branches.** Workers sometimes push their feature branch but stall before opening a PR (the SVP-71/74 failure mode). Catch and auto-PR:
   ```bash
   git fetch origin --quiet  # ensure we have the latest refs
   git ls-remote --heads origin 'feat/svp*' | awk '{print $2}' | sed 's|refs/heads/||' > /tmp/pushed
   gh pr list --state open --json headRefName --jq '.[].headRefName' > /tmp/with-prs
   comm -23 <(sort /tmp/pushed) <(sort /tmp/with-prs) > /tmp/pushed-no-pr
   ```
   **CRITICAL filter — only treat as stalled worker if branch has NO merged PR.** Many old merged PRs leave stale remote refs (because `gh pr merge` doesn't `--delete-branch` by default). They show up in `/tmp/pushed-no-pr` but are NOT stalled work — they're merged + unpruned.

   ⚠️ **Do NOT use `git rev-list --count origin/main..origin/<branch>`** — it lies for squash-merged branches. Squash merge creates a new commit SHA on main with no ancestry link to the feature branch, so the original branch's commits still appear "ahead" forever. Use the GitHub PR state instead — it's the only source of truth:

   ```bash
   for branch in $(cat /tmp/pushed-no-pr); do
     # Was this branch ever merged via a PR? Check both states.
     merged=$(gh pr list --state merged --head "$branch" --json number --jq 'length')
     if [ "$merged" -eq 0 ]; then
       echo "ACTUAL stalled worker: $branch (never merged via PR)"
     fi
   done
   ```

   For each branch that has NO merged PR:
   - Parse `SVP-N` from the branch name (`feat/svpNN-...` → `SVP-NN`).
   - Fetch the Notion task to get title + acceptance criteria.
   - `gh pr create` with title from the most-recent commit subject, body templated from the Notion task's Scope + Acceptance sections, plus a footer: `Auto-opened by /sweep — worker pushed but didn't open a PR.`
   - Treat the freshly-opened PR as a NEW PR in the review step below.

   For each branch that has 0 commits ahead of main: silently ignore — it's a stale merged ref. Optional hygiene pass: report the count in the sweep output ("N stale remote refs detected — clean up via `gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>` per branch, or batch via the cleanup skill once it supports remote pruning").

3. **List open PRs** via `gh pr list --state open --json number,title,headRefName,createdAt`.

4. **Compare PRs against recent transcript.** PRs already reviewed in this session should not be re-reviewed unless a new commit has landed since last review.
   - Track-checks: PR title in my recent messages, last commit SHA known vs current.
   - If a PR has been re-pushed (rebase / new commits), treat as fresh and re-review.

5. **For each NEW or UPDATED PR**: full code review per the `/review` skill flow:
   - Pull metadata + diff
   - Read key implementation files from the worktree
   - Run pre-flight (tsc + lint) on the worktree
   - Compare against the brief (from `<worktree>/BRIEF.md` or the Notion task)
   - Post structured verdict: overview, what's right, things to push on, verdict (ship-it / fix-then-ship / hold)
   - **Per [[feedback-nits-inline]]**: nits get fixed in this turn, not filed as follow-ups. Supervisor commits to the worker branch authorized.

6. **For SKIPPED PRs** (already reviewed, no new commits): one-line acknowledgment.

7. **If no STOP markers + no new/updated PRs + no pushed-no-PR branches**: "no new PRs, no STOP markers, no stalled workers" and end the turn.

8. **End-of-turn output order**:
   1. STOP markers (most urgent)
   2. Auto-opened PRs (need first review)
   3. PR verdicts for new/updated PRs
   4. Skipped PR acknowledgments
   5. Status block

## When NOT to use /sweep

- When you want to review one specific PR — use `/review <PR>` instead.
- When you want recurring autonomous polling — use `/loop 15m sweep…` instead.

## Cross-references

- `/review` — single-PR deep review
- `/loop` — recurring autonomous version
- [[feedback-nits-inline]] — fix nits in the same turn as the review
- STOP_CONDITIONS.md → "Escalation channel" — in-code STOP marker convention
- CLAUDE.md → "Definition of done" — status block format
- [[feedback-no-slack]] — Slack is intentionally NOT a coordination surface here
