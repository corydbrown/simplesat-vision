# Notion Tasks DB

The Simplesat Vision prototype's backlog lives in a Notion database. Single source of truth for what's queued, in progress, in review, and done. Agents append directly via the Notion MCP; Cory curates and prioritizes.

## URLs

- Database: https://www.notion.so/simplesat/47f44fc634ad41bdbafc5dca3b08beaa
- Parent page: "Simplesat Vision Prototype"
- Collection ID (for MCP calls): `eabfaf5e-ec65-47dd-971d-eee2c927dcfe`

## Views

- **Ready queue (Claude Code start here)** — `Status=Ready`, sorted Priority asc. Agents pick from here when Cory asks "what's next" or starts a new session.
- **Backlog (Cory triage)** — `Status=Backlog`. Where deferrals land. Cory reviews periodically and promotes items to Ready.
- **All tasks by status** — board view of everything.
- **Needs Cory (Review + Blocked)** — surfaces what's waiting on Cory.
- **Done log** — closed tasks, sorted by completed date.

## Schema cheat sheet

| Property | Type | Values / notes |
|---|---|---|
| Task | title | One-sentence task description |
| Status | select | Backlog / Ready / In Progress / In Review / Blocked / Done |
| Type | select | Feature / Bug / Design tweak / Performance / Refactor / Research/Spike / Docs |
| Area | select | Frontend / Backend / AI/Prompts / Data model / Integrations / Mock data / Cross-cutting |
| Priority | select | P0 / P1 / P2 / P3 |
| Effort | select | XS (<30 min) / S (<1h) / M (1-3h) / L (half day) / XL (full day+) |
| PRD section | text | Reference to PRD part/screen |
| Dependencies | text | Free text — task IDs or descriptions |
| Repo link | url | Commit, PR, or file link |
| Notes for me | text | Short note from Claude Code at task completion |
| Task ID | auto_increment_id | Auto-assigned by Notion |
| Started at / Completed at / Created | date | Auto or set by agent |

## How agents interact

### On deferral (the main interaction)

When Cory agrees to defer scope — "let's not do that now," "v2," "punt to later," "follow-up" — create a Notion task **immediately** via the `mcp__claude_ai_Notion__notion-create-pages` tool. Defaults:

- **Status:** Backlog (Cory triages to Ready later)
- **Type:** best guess from context (Feature / Refactor / Bug / Design tweak / Docs / Research-Spike / Performance)
- **Area:** best guess (Frontend / Backend / Cross-cutting / etc.)
- **Priority:** P2 by default. Use P0/P1 only when context says urgent. Use P3 for nice-to-haves.
- **Effort:** best guess. When genuinely uncertain, default to M.
- **Notes for me:** one short context line — why deferred, what surfaced it, PR # if applicable.
- **Repo link:** if there's an obvious associated PR or file.
- **Don't ask the user to pick values.** Cory triages later — agents pick reasonable defaults so capture is friction-free.

Then tell Cory inline: *"Logged in Notion backlog as task #N: [title]"*. The Task ID auto-assigns; grab it from the MCP response and quote it.

### On "what's next" / new-session start

Query the **Ready queue** view. Surface 1-3 top candidates with their priority and effort. Don't dump the whole queue. Lead with the highest-priority Ready task. If Ready is empty, say so and suggest Cory triage the Backlog view.

### On task completion (PR merges)

If you have the Task ID handy from the original deferral, update Status to `Done` (or `In Review` if Cory hasn't verified yet) and add a one-line `Notes for me` + the `Repo link` to the merged PR. **Optional polish** — only do this if the Task ID is in the conversation context. Don't fish for tasks to update.

## When to update this doc

- The Tasks DB schema changes (new property, renamed select option, etc.).
- A new view becomes part of the canonical workflow.
- The MCP-call conventions change.

Otherwise this doc is stable — agents reference it once per session if needed.
