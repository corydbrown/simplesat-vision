# Notion Tasks DB

The Simplesat Vision prototype's backlog lives in a Notion database. Single source of truth for what's queued, in progress, in review, and done. Agents append directly via the Notion MCP; Cory curates and prioritizes.

## URLs

- Database: https://www.notion.so/simplesat/47f44fc634ad41bdbafc5dca3b08beaa
- Parent page: "Simplesat Vision Prototype"
- Collection ID (for MCP calls): `eabfaf5e-ec65-47dd-971d-eee2c927dcfe`

## Views

- **Ready queue (Claude Code start here)** — `Status=Ready`, sorted Priority asc. Query URL: `https://www.notion.so/simplesat/47f44fc634ad41bdbafc5dca3b08beaa?v=366afb413b748160b0d7000c0c0cc28f`. Agents pick from here when Cory asks "what's next" or starts a new session — do not scan other views.
- **Backlog (Cory triage)** — `Status=Backlog`. Where deferrals land. Cory reviews periodically and promotes items to Ready.
- **All tasks by status** — board view of everything.
- **Needs Cory (Review + Blocked)** — surfaces what's waiting on Cory.
- **Done log** — closed tasks, sorted by completed date.

## Schema cheat sheet

| Property | Type | Values / notes |
|---|---|---|
| Task | title | One-sentence task description |
| Status | select | Backlog / Ready / In Progress / Blocked / Done / Declined |
| Type | select | Feature / Bug / Design tweak / Performance / Refactor / Research/Spike / Docs |
| Area | select | Frontend / Backend / AI/Prompts / Data model / Integrations / Mock data / Cross-cutting |
| Priority | select | P0 / P1 / P2 / P3 |
| Effort | select | XS (<30 min) / S (<1h) / M (1-3h) / L (half day) / XL (full day+) |
| PRD section | text | Reference to PRD part/screen |
| Dependencies | text | Free text — task IDs or descriptions |
| Repo link | url | Commit, PR, or file link |
| Notes for me | text | Free-text note from Cory. **Agents should not write here** — append notes to the "Claude Code notes" section in the page body instead, so history is preserved. |
| Task ID | auto_increment_id | Auto-assigned by Notion |
| Started at / Completed at / Created | date | Auto or set by agent |

## How agents interact

### Agent notes — the "Claude Code notes" page section

Every task page has a `## Claude Code notes` heading near the bottom (added by Cory as a template). Agents append dated bullets here at every meaningful checkpoint — spawn, brief, merge, defer — so the task carries its own history. Cory keeps `Notes for me` as his own scratch space.

**Append pattern** (use `notion-update-page` with `command=insert_content`, `position={"type":"end"}`):

```
- YYYY-MM-DD: <one-line note>. PR #N if applicable.
```

If the page has no `## Claude Code notes` heading yet (older task, or task created by an agent), the first append adds the heading too:

```
## Claude Code notes

- YYYY-MM-DD: <one-line note>.
```

Keep each bullet under ~120 chars. Multiple bullets are fine — history > terseness.

### On deferral (the main interaction)

When Cory agrees to defer scope — "let's not do that now," "v2," "punt to later," "follow-up" — create a Notion task **immediately** via the `notion-create-pages` tool. Defaults:

- **Status:** Backlog (Cory triages to Ready later)
- **Type:** best guess from context (Feature / Refactor / Bug / Design tweak / Docs / Research-Spike / Performance)
- **Area:** best guess (Frontend / Backend / Cross-cutting / etc.)
- **Priority:** P2 by default. Use P0/P1 only when context says urgent. Use P3 for nice-to-haves.
- **Effort:** best guess. When genuinely uncertain, default to M.
- **Repo link:** if there's an obvious associated PR or file.
- **Page body:** include `## Claude Code notes` heading + one bullet capturing why deferred, what surfaced it, and the PR # if applicable.
- **Don't ask the user to pick values.** Cory triages later — agents pick reasonable defaults so capture is friction-free.
- **Don't write to `Notes for me`** — that's Cory's column. All agent notes go in the page body.

Then tell Cory inline: *"Logged in Notion backlog as task #N: [title]"*. The Task ID auto-assigns; grab it from the MCP response and quote it.

### On "what's next" / new-session start

Query the **Ready queue** view. Surface 1-3 top candidates with their priority and effort. Don't dump the whole queue. Lead with the highest-priority Ready task. If Ready is empty, say so and suggest Cory triage the Backlog view.

### On worktree spawn

Append to the task's `## Claude Code notes`: `- YYYY-MM-DD: Spawned worktree feat/<branch> on port <N>.` Set `Status=In Progress` and `Started at=<today>` as properties.

### On PR merge

Append to the task's `## Claude Code notes`: `- YYYY-MM-DD: PR #N merged. <one-line of what shipped>.` Set `Status=Done`, `Completed at=<today>`, and `Repo link=<PR URL>` as properties.

There is no "In Review" status — tasks stay `In Progress` through review and flip to `Done` only on merge.

### On decline (decided against, not executed)

When a task is evaluated and rejected — *not* shipped, *not* deferred — set `Status=Declined` and clear `Completed at`. Append a `## Claude Code notes` bullet with the rationale and (if applicable) a link to the DECISIONS.md entry capturing the architectural reasoning. **Done is reserved for work that shipped to main.** A declined design proposal in Done conflates "we did this" with "we explicitly chose not to," which corrupts the Done log as a record.

If the decision might be revisited later (e.g., gated on a different surface landing), prefer `Backlog` over `Declined` — Declined signals a settled "no," not a "not yet."

### Round-trip DECISIONS.md deferrals

When a PR adds new "Phase N deferred (v2)" / "future work" / "out of scope" entries to DECISIONS.md, each deferred item must also exist as a Notion backlog task **before the PR merges**. DECISIONS.md captures *why* (architecture rationale); Notion is the actionable queue. They cross-reference:

- Each Notion task body cites "DECISIONS.md → Phase N deferred" so the worker landing on it can find the architectural context.
- DECISIONS.md entries can optionally cite `(see SVP-N)` to point back at the actionable task.

**Supervisor responsibility on PR review**: scan the PR's DECISIONS.md changes for newly-deferred items; file any that aren't already in Notion before merging. Worker briefs may also call this out explicitly: *"any items deferred to v2 in DECISIONS.md must round-trip as Notion backlog tasks before the PR opens."*

## When to update this doc

- The Tasks DB schema changes (new property, renamed select option, etc.).
- A new view becomes part of the canonical workflow.
- The MCP-call conventions change.

Otherwise this doc is stable — agents reference it once per session if needed.
