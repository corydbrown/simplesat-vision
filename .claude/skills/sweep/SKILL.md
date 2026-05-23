---
name: sweep
description: On-demand sweep of open PRs — review any I haven't reviewed yet (compare against my recent transcript), post verdict here for each. The single-shot version of the /loop pattern.
---

# /sweep — review all open PRs not yet seen

Usage: `/sweep`

On-demand alternative to running `/loop 15m sweep open PRs…`. Useful when:

- Cory just came back and wants a status check
- A long-running worker just pushed and Cory wants the review now
- Between merges, to see what landed since the last review

## Steps

1. **List open PRs** via `gh pr list --state open --json number,title,headRefName,createdAt`.

2. **Read Slack escalations** from `#simplesat-vision-prototype` via `mcp__claude_ai_Slack__slack_read_channel`. Filter for messages that match the worker escalation format (`@cory svp-N blocked: ...`) and that are newer than the last sweep. Surface these prominently at the top of the output — a blocked worker is more urgent than a new PR.

3. **Compare PRs against recent transcript**. PRs I've already reviewed in this session should not be re-reviewed unless a new commit has landed on them since last review.
   - Track-checks: PR title in my recent messages, last commit SHA known vs current.
   - If a PR has been re-pushed (rebase / new commits), treat as fresh and re-review.

4. **For each NEW or UPDATED PR**: run a full code review per the `/review` skill's flow:
   - Pull metadata + diff
   - Read key implementation files from the worktree (faster than diff parsing)
   - Run pre-flight (tsc + lint) on the worktree
   - Compare against the brief from the Notion task
   - Post a structured verdict: overview, what's right, things to push on, verdict (ship-it / fix-then-ship / hold)
   - **Per [[feedback-nits-inline]]**: if any nits surface, fix them in this turn — don't file as follow-ups.

5. **For SKIPPED PRs** (already reviewed, no new commits): one-line acknowledgment ("PR #N — no new commits since last review, verdict stands").

6. **If no open PRs AND no Slack escalations**: "no new PRs, no Slack escalations" and end the turn.

7. **End-of-turn output**: Slack escalations first (if any), then PR verdicts, then status block.

## When NOT to use /sweep

- When you specifically want to review one PR — use `/review <PR>` instead.
- When you want autonomous recurring polling — use `/loop 15m sweep open PRs…` instead.

## Cross-references

- `/review` — single-PR deep review
- `/loop` — recurring autonomous version
- [[feedback-nits-inline]] — fix nits in the same turn as the review
- CLAUDE.md → "Definition of done" — status block format for verdicts
