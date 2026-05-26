---
name: spawn
description: Spawn a worker for a Notion task — fetches the task, runs nw with svpNN- prefix, writes BRIEF.md into the worktree, opens VS Code, updates Notion to In Progress. Worker just needs Cory to type "go" in the new session.
---

# /spawn — one-shot worker spinup with brief-as-file

Usage: `/spawn <SVP-NN>` (e.g. `/spawn SVP-80`)

Eliminates copy-paste: instead of including the brief in the chat for Cory to paste, **the brief is written to `<worktree>/BRIEF.md`**. The worker session loads CLAUDE.md → sees the worker-bootstrap instruction → reads BRIEF.md → executes. Cory's job is reduced to opening the VS Code window + typing "go".

## Steps

1. **Fetch the Notion task** by ID via `mcp__claude_ai_Notion__notion-fetch`. Extract: task title, full body, Type, Area, Priority, Effort, Dependencies, Epic relation.
   - **Stop** if task is not in `Ready` status — confirm with Cory before promoting from Backlog.

2. **Compute branch slug** from the task title: lowercase, kebab-case, drop punctuation, max 4 words. Format: `svp<N>-<slug>`. Examples: `svp80-tag-filter-tooltips`, `svp81-csv-export`. No leading/trailing/double hyphens.

3. **Spawn the worktree** via `nw <slug>`. **Stop** if `nw` errors (port collision, dirty state) — surface to Cory.

4. **Write BRIEF.md** to the worktree root via the Write tool. Format below.

5. **Open VS Code** at the new worktree path: `code <worktree-path>`.

6. **Update Notion**:
   - Status → `In Progress`
   - `Started at` → current ISO 8601 datetime with `+07:00` offset
   - **Do NOT set `Worker model` at spawn.** I can't know what Cory will actually toggle to in his worker session. The brief's "Recommended model" is a suggestion; Cory may override. Worker model gets captured at **merge time** instead, from the `/model` output the worker pastes in the PR body (see brief's "Before opening the PR" section). If the worker forgets, leave it null — Cory can fix manually.
   - Append note: `- YYYY-MM-DD: Spawned worktree feat/<branch> on port <N>. Brief written to BRIEF.md.`

7. **End-of-turn output** for Cory — one sentence per worker. Nothing more.
   > 🛠 SVP-NN spawned · port `<N>` · `feat/<branch>` · <Sonnet | Opus> · plan-mode <off | on>

   Per [[feedback-concise-spawn-handoff]]: Cory drives session start from his side. No `Cmd+Shift+P` / `New Session` / `type go` / `toggle plan mode` boilerplate — the brief on disk declares model + plan-mode and that's the contract. If multiple workers spawn in one turn, one line each.

## BRIEF.md format

````markdown
# SVP-NN — <task title>

<one-line task statement: what's the actual goal>

## Scope

<scope details from Notion task body, condensed if needed>

## What would change my mind

<explicit criteria where worker should stop and re-check. Examples:
- "If you find that <Y> turned out to be the case, stop — that changes the approach."
- "If pre-existing pattern <X> doesn't compose with what's being asked, commit WIP + leave a `// STOP — <reason>` comment + push. Supervisor's /sweep will catch it on the diff scan."
If no specific criteria apply, omit this section but DO note: "Use STOP_CONDITIONS soft-stop judgment on premise-wrong situations.">

## Recommended model

<One line: "Sonnet is fine — <one-line why>" OR "Opus — <one-line why>". Per [[feedback-opus-default]], default to Opus; only recommend Sonnet if the work is mechanical / well-scoped / no architectural decisions / Opus output would be byte-equivalent.>

## Plan mode

<"Yes — toggle plan mode before approving" OR "No — Auto mode is fine". Per [[feedback-plan-mode]], plan-mode-yes for load-bearing refactors, architectural decisions embedded in the task, tasks Sonnet has previously failed on, or multi-file plans where wrong-abstraction cost compounds.>

## Parallel workers active

<list of other active SVP-NNs + surfaces they touch — for collision avoidance.
If solo, write "None.">

## Pre-flight gates (run before declaring ready)

- `npx tsc --noEmit` clean (PageProps errors are a pre-existing Next 16 issue, ignore those)
- `npm run lint` clean
- Dev server boots at `localhost:<port>`
- Manual walk of the changed surface in both light + dark mode
- Playwright smoke for any new visible surface (see `playwright.config.ts` once SVP-Playwright lands)

## Ship time

Run `/wrap` when the work is ready. The skill captures timing + tokens + model and constructs the PR body in the right shape for `/post-merge` to parse. Don't hand-roll `gh pr create` — `/wrap` is the only way the metrics block lands consistently.

## STOP_CONDITIONS

Per [STOP_CONDITIONS.md](STOP_CONDITIONS.md):
- Hard stops: schema changes, auth/permissions, new deps, DECISIONS.md/CLAUDE.md changes → explicit yes required
- Soft stops: 15 min blocked, scope drift > 10 files, brief premise wrong → commit WIP + leave a `// STOP — <reason>` comment at the line where you got stuck + push. The supervisor's `/sweep` scans the diff for `STOP —` markers and will surface the block to Cory.

## Full Notion task

<URL>
````

## When NOT to use /spawn

- For **epic-foundation tasks** (Phase 1 of an epic) — these warrant explicit supervisor brief writing with extra architectural context. Use /spawn for Phase 2+ siblings.
- When the task is genuinely ambiguous and needs a discussion before spawning. Fix the Notion task first.

## Cross-references

- CLAUDE.md → "Worker session bootstrap" — the instruction that tells worker sessions to read BRIEF.md
- CLAUDE.md → "Worker brief template" — the canonical brief shape
- CLAUDE.md → "Spawning worktrees" — collision rules
- STOP_CONDITIONS.md — what workers escalate
- [[feedback-worktree-naming]] — svp-prefix convention
