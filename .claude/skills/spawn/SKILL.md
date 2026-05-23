---
name: spawn
description: Spawn a worker for a Notion task — fetches the task, runs nw with svpNN- prefix, opens VS Code, drafts the paste-ready worker brief. Replaces the manual 5-step spawn ceremony.
---

# /spawn — one-shot worker spinup

Usage: `/spawn <SVP-NN>` (e.g. `/spawn SVP-80`)

Eliminates the multi-step ceremony: fetch task → decide branch name → `nw` → `code` → mark In Progress → draft brief.

## Steps

1. **Fetch the Notion task** by ID:
   - Resolve the task page via `mcp__claude_ai_Notion__notion-fetch` with the SVP-NN as the search query, OR if you already have the page ID, fetch directly.
   - Extract: task title, full body, Type, Area, Priority, Effort, Dependencies, Epic relation (if any).
   - **Stop** if the task is not in `Ready` status — confirm with Cory before promoting from Backlog.

2. **Compute branch slug** from the task title:
   - Lowercase, kebab-case, drop punctuation, max 4 words.
   - Format: `svp<N>-<slug>`. Examples: `svp80-tag-filter-tooltips`, `svp81-csv-export`.
   - **No leading hyphens, no double hyphens, no trailing hyphens.**

3. **Spawn the worktree** via `nw <slug>`:
   - Confirms branch name, port, path.
   - **Stop** if `nw` errors (port collision, dirty state, etc.) — surface to Cory.

4. **Open VS Code** at the new worktree path: `code <worktree-path>`.

5. **Update Notion**:
   - Set Status → `In Progress`.
   - Set `Started at` → current datetime (ISO 8601 with Bangkok offset `+07:00`).
   - Append a Claude Code note: `- YYYY-MM-DD: Spawned worktree feat/<branch> on port <N>.` Mention parallel workers if any are active.

6. **Draft the paste-ready brief**. Format:

   ````markdown
   🪟 **SVP-NN — <task title>** · port <N> · `feat/<branch>`

   Paste into the new VS Code window:

   ```
   /start
   The task: SVP-NN — <one-line task description>

   <scope details from the Notion task body, condensed>

   <"What would change my mind" criteria if applicable>

   <Parallel workers heads-up if other worktrees are active>

   Per [STOP_CONDITIONS.md](STOP_CONDITIONS.md): commit + push + Slack `@cory` if blocked 15 min, schema/auth/deps changes need explicit yes.

   Pre-flight before declaring ready: npx tsc --noEmit clean, npm run lint clean, dev server boots at localhost:<N>, manual walk of the changed surface in both light + dark mode.

   Full brief: <Notion task URL>
   ```
   ````

7. **End-of-turn output**:
   - Worktree path + branch + port (clickable links).
   - The brief block above, paste-ready.
   - Status block per CLAUDE.md "Definition of done."

## When NOT to use /spawn

- For epic-foundation tasks (Phase 1 of an epic) — these warrant explicit supervisor brief writing with extra architectural context. Use `/spawn` for sibling Phase 2+ tasks where the foundation is already shipped.
- When the task is genuinely ambiguous and needs a discussion before spawning. `/spawn` assumes the brief is good-enough as written; if it isn't, fix the Notion task first.

## Cross-references

- CLAUDE.md → "Spawning worktrees" — the rules around the 3-worker cap, collision checks
- CLAUDE.md → "Sample-then-fan-out" — when to use one spawn vs many
- STOP_CONDITIONS.md — what workers escalate
- [[feedback-worktree-naming]] memory — svp-prefix convention
