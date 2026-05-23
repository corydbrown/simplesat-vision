# Worker stop conditions

Explicit triggers for **stop and check in** before continuing. These exist because workers that plow through stop conditions silently waste hours of unattended-run time when they hit something that needed a human call.

When a worker hits any of these, the worker should:

1. **Commit whatever WIP is in a coherent state** to the feature branch (don't leave Cory with uncommittable diffs).
2. **Push the branch** so the work is visible from the supervisor.
3. **Slack the supervisor** with the standard escalation format:
   ```
   @cory svp<N> blocked — <one-sentence reason>. WIP pushed at <sha>. Worktree port <N>.
   ```
4. **Wait** for the supervisor (or Cory) to respond before proceeding. Do not improvise the call.

Workers re-confirm they're on track every time they ship a milestone — these are the moments that warrant a pause, not "I'll just figure it out."

## Hard stops — never proceed without an explicit yes

- **Schema changes** outside the briefed scope. Migrations are blast-radius decisions, not implementation details.
- **Auth, permissions, or workspace-scoping** code, today or anticipating future. CLAUDE.md → Trajectory says the seam matters; don't guess at it.
- **New dependencies** (`package.json` adds). Each one is a future maintenance + supply-chain decision.
- **Anything that touches `DECISIONS.md` or `CLAUDE.md`** — architectural docs need supervisor review, not worker drift.
- **Force-push to a branch with someone else's commits** (e.g. if Cory or supervisor has committed to your branch). Use `--force-with-lease` minimum; check first.

## Soft stops — push your WIP and Slack before continuing

- **15 minutes blocked** on any single sub-problem. Don't burn the next 45 minutes confused.
- **More than 10 files touched** in a single commit when the brief implied a narrower scope. Either the brief is wrong or you've drifted; surface it.
- **The brief's premise turned out to be wrong.** (Sibling task already shipped X; cited file doesn't exist; recommended approach doesn't compile.) Stop and re-brief.
- **Tests would have to be modified to pass.** If existing tests fail because of your change, the change might be wrong — or the tests might be. Either way, that's a decision, not an implementation detail.
- **A "what would change my mind" criterion from the brief fires.** Briefs that include explicit criteria (e.g. "if you find Y, stop and tell me") are pre-signaling decision points. Honor them.

## Quiet warnings — fix and proceed but flag in the PR body

These don't require Slack, but should appear in the PR's "Things worth pushing on" section so the reviewer sees them:

- **Existing code patterns you're not following deliberately.** ("I used X here even though the codebase uses Y because…")
- **Inconsistencies you noticed but didn't fix.** Flag them; don't quietly leave a TODO.
- **Performance trade-offs you made.** ("Query is O(n²) but n is bounded by scorecard categories ≤ 10.")

## What this prevents

Real failures from prior sessions:

- **Silent worker stalls** (SVP-71 + SVP-74 committed locally then stalled ~3 hours before pushing). Soft stop "15 min blocked" + Slack escalation = immediate signal.
- **Sibling brief drift** (PR #56 + PR #57 shipped divergent `score-color.ts` because each brief had slightly different language). Soft stop "brief premise wrong" = worker would have asked.
- **Scope creep** in foundational PRs. Hard stops on schema / auth / deps catch the "while I'm in there…" moves.

## Escalation channel

**Slack channel:** `#simplesat-vision-prototype`. Workers ping `@cory` explicitly; the supervisor's `/sweep` skill also reads this channel and surfaces escalations alongside PR reviews so Cory sees them in either surface.

If Slack isn't available, leave a clearly-labeled `// STOP — <reason>` comment in the code at the line where you got stuck, push the WIP, and wait. The supervisor's next PR sweep will catch it via the diff scan.
