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

## Before opening the PR — worker metrics

The supervisor populates Notion's worker-time + tokens + model from a `## Worker metrics` section in the PR body. Build it like this right before pushing:

```bash
# 1. End timestamp + reconstruct start
END=$(date -Iseconds)
START=$(cat .worker-meta)  # written by the worker-bootstrap on first message

# 2. Capture /cost and /model
#    Run /cost and /model in chat; copy the "Total tokens" number and the model name.

# 3. Write the PR body to .pr-body.md (gitignored), e.g.:
cat > .pr-body.md <<EOF
## Summary

<1–3 bullets of what shipped>

## Test plan

- [ ] <bulleted checklist>

## Worker metrics

- Started: $START
- Finished: $END
- Tokens: <number from /cost, no commas — if you forgot to run /cost, write nothing after the colon, do NOT write "unknown" or "TBD">
- Model: <name from /model, e.g. claude-opus-4-7 — if missing, leave blank>
EOF

# 4. Push + create PR
git push -u origin "$(git branch --show-current)"
gh pr create --title "<title>" --body-file .pr-body.md
```

`Started` comes from `.worker-meta` (written by the worker-bootstrap on the first user message — see CLAUDE.md → "Worker session bootstrap"). `Finished` is wall-clock at PR-open. We don't track pause/resume yet — auto-mode work is rarely interrupted; if you do pause for a Cory question, the wall-clock will be slightly inflated, which is fine.

If you forget the section, the supervisor falls back to first-commit / PR-createdAt and the timing will be wrong — please don't forget. Tokens and Model are likewise null-honest if missing.

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
