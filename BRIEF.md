# coaching-port — Phase 5 Batch 2: port the winning mockup to production `/coaching/[evaluationId]`

**The task:** translate the winning mockup (`qa-window/tight` base + `qa-window/quiet` polish, plus all round-7 refinements) into real production code at `src/app/(workspace)/coaching/[evaluationId]/page.tsx`. Replace the placeholder from Batch 1 with the real coaching surface.

**Notion task:** https://www.notion.so/36aafb413b7481f0be31c7cc2d2dd906 (read the full body — it has the comprehensive design spec already)

**Effort: XL.** This is the load-bearing PR of Phase 5. Take your time. Push early/often even when incoherent — supervisor watches your branch.

## ⚠ Production-shape from day 1 — Cory's explicit ask

**Cory said: "let's make sure we implement these with really good, tight, organized, shared components. So that as we continue to make changes, we're only making them in that shared component area."**

DO NOT just translate the mockup file inline. EXTRACT EVERY REUSABLE PIECE into `src/components/coaching/` as a proper shared component. Future iterations (and Batch 3 / Phase 6+) need to edit ONE place, not three.

### Concrete shared components to create

In `src/components/coaching/`:
- `<CoachingTicket>` — top-level layout (two-column sticky), takes evaluation + ticket + messages + activities + comments + reactions as props
- `<MessageBubble>` — single message (agent or customer); composes everything below
- `<MessagePopup>` — Slack-style hover/focus toolbar (top-right, icon-only, proper bg-popover, 4 icons: 💬 🏷 😀 ↵). Appears on hover OR keyboard focus. NO label/kbd hints visible by default.
- `<CitationChip>` — 5-dot scale + label + AI Sparkles + click → opens Inspect with focus on this row. Category-color as left tint, NO colored circle.
- `<CitationList>` — list of CitationChips under a bubble
- `<ReactionRow>` — Slack-style chips (emoji + count + hover tooltip). Curated 6-set from `src/lib/qa/coaching/reactions.ts`. `+ emoji` affordance reveals inline curated 6-row picker. Column-contained.
- `<CommentIcon>` — single `💬` icon (NO count) under bubbles that have comments. Click → opens Inspect with comment input focused.
- `<InspectPanel>` — right-sidebar transform when a message is selected. Header `← Back` only (no kbd hint visible). "Message N" right-justified. Body contains Citations + Comments. NO Reactions section (reactions stay under-message/under-comment only). NO empty state copy. NO "Related activity."
- `<CommentRow>` — Notion-style: avatar (left, ~24px) + name + muted `text-muted-foreground/70` date + body left-justified + reactions row + reply input nested. Hover surfaces edit/delete (own comments only) + react icons (Notion pattern). Up-arrow from empty input → edit last comment if it's yours.
- `<CommentComposer>` — textarea + Submit button. **Enter** submits (NOT Cmd+Enter). Shift+Enter for newline. NO `⌘⏎` hint inside the button (drop entirely per Cory's latest). Esc blurs.
- `<MessageNumber>` — small `M1, M2...` label, right-justified on bubble row (`text-xs muted`)
- `<QaOverviewPanel>` — the default right-sidebar state (when no message selected). Shows the 5 category cards with scores. Click category → mute + outline + auto-scroll first cited to top.
- `<CategoryCard>` — single category with score, weight, AI reasoning summary; clickable for the mute behavior.
- `<KeyboardShortcuts>` — single hook + context that owns multi-Esc, arrow nav between columns, C/T/R bindings, focus management. Suppresses single-letter shortcuts when textarea/input has focus.

If you find yourself writing inline JSX more than once for the same visual, **extract immediately**.

## Round-7 unified base — locked spec (apply ALL)

### Layout
- Two-column **always sticky** (`grid-cols-[1fr_<sidebar-width>]` or similar). Convo left, QA panel right. Never overlap. Bottom padding ~150px on convo column so last message breathes when arrow-navigating.

### On-message popup (Slack-style)
- Small horizontal **icon-strip floating top-right** of bubble, slightly overlapping top edge
- `bg-popover` + shadow + border. Must NOT bleed through sender/timestamp text underneath.
- Icon-only by default. No kbd hint badges visible.
- 4 actions: 💬 Comment (C) · 🏷 Cite (T) · 😀 React (R) · ↵ Inspect
- Hover OR keyboard focus shows it.
- For customer messages: Cite icon HIDDEN (customer messages aren't categorize-able).

### Kbd hints HIDDEN for V1
- Shortcuts WORK (C/T/R/Enter/Esc/Cmd+Enter/arrows).
- Visual hint badges do NOT render.
- Skip both hold-Cmd reveal AND top-page toggle from rounds — V1 ships with no reveal mechanic. Post-V1 iteration.
- `?` cheat sheet Dialog still available (full keyboard reference).

### Arrow key nav
- Arrow up/down (or J/K) navigate messages in convo. Focused message gets `ring-2 ring-ring` + slight lift.
- **Right arrow** in convo → focus enters the right panel:
  - If Inspect is open → focus enters Inspect's first nav item
  - If Inspect closed (QA Overview shown) → focus enters the first category card
- **Left arrow** → back to convo
- **Within QA Overview** (categories): Down/Up nav categories; Enter selects → mute uncited + outline cited + auto-scroll first cited to top.
- **Within Inspect**: Down/Up nav citations → comment composer → existing comments. Enter on citation opens score editor inline (arrow keys 1-5, Enter confirms, Esc cancels). Enter on "Add citation" opens category picker.

### Inspect mode
- Click bubble OR press Enter → opens Inspect for that message
- Header: `← Back` (no Esc label — kbd hints hidden by default)
- "Message N" right-justified in header
- NO category-score list, NO overall score, NO CTA strip, NO Reactions section, NO counts, NO empty-state copy, NO "Related activity" section
- **NO auto-focus on comment input.** Focus lands on first nav item (Add citation row or first existing citation).
- Click outside Inspect → closes (treats like Esc)

### AI reasoning per citation
- When citation row is focused in Inspect, AI reasoning text appears inline below (`text-sm italic muted`)
- References messages via clickable "Message N" chips
- Source: existing `evaluation_category_scores.ai_reasoning` field — replace any `msg_5` references with `Message 5` style. Hand-translate at render time.

### Citation chips (under-bubble)
- **NO colored circle**
- **5-dot scale** (●●●●○ for 4/5), NOT numeric. Dot color = category color.
- AI Sparkles icon on AI-added citations only
- Click → opens Inspect with that citation focused
- "Add citation" outline should be visible/inviting

### Reactions (Slack-style)
- Curated 6-set imported from `src/lib/qa/coaching/reactions.ts` — `COACHING_REACTIONS = ["👀", "👍", "❤️", "🔥", "✨", "😬"]`
- Chips below the bubble: emoji + count. Hover for tooltip listing reactor names.
- `+ emoji` affordance reveals inline 6-row picker. NO full emoji picker.
- Click own reaction → toggles off
- Same pattern on COMMENTS (Notion-style — chip below body)
- **NO reactions section in Inspect panel.** Reactions are message-level/comment-level only.

### Column-contained popovers
- Reaction picker on an agent bubble (right column) opens **LEFT**
- Reaction picker on a customer bubble (left column) opens **RIGHT**
- Reaction picker on the QA sidebar opens **LEFT** (into sidebar)
- Any picker/tray/popover must expand within its parent column
- **Bug to NOT replicate**: clicking React on a customer message showed two popups simultaneously in round 7. ONE popup only.

### Multi-Esc
- Esc pops one layer: open tray → open picker → blur textarea → exit Inspect → clear category mute → root
- Each press unwinds exactly one layer

### Comments (Notion-style)
- Avatar (left, ~24px) + name + muted "Just now" / muted date + body (LEFT-justified always) + reactions row below body + reply input below
- Date `text-muted-foreground/70`, smaller
- Comment box **BELOW** comments (Notion-pattern — feels like contributing to bottom of thread)
- **Enter** submits. Shift+Enter newline.
- Hover surfaces edit + delete (own comments only) + react (Notion-style hover actions)
- Up-arrow from empty composer → edit your last comment if it's yours
- All comments reactable
- Server actions: `createComment`, `editComment`, `deleteComment`, `addReaction`, `removeReaction` — all in `src/lib/qa/coaching/actions.ts` (from Batch 1)

### Customer messages
- Commentable yes
- NOT categorize-able (T does nothing; Cite icon hidden in popup)
- NO "customer messages aren't scored" text or empty state

### Friendly references
- "Message N" everywhere (NOT "msg_5"). Translate at render time.
- Small `M1, M2...` label right-justified on each bubble (`text-xs muted`)
- Clickable Message-N chips scroll the convo + flash-highlight target

### Activity toggle (default OFF)
- Switch in the QA panel header (or top of convo) — "Show activity"
- When ON: Linear-style horizontal dividers between messages
- Activities get the popup on hover/focus (Comment + Inspect only — no Cite/React)
- Activities commentable (stretch — OK to skip if scope creeps)

### Keyboard suppression in textareas
- When a textarea/input has focus, single-letter shortcuts (R, T, C) **MUST NOT fire** — they're text input
- Only Esc + Cmd+Enter work inside textareas (and Enter submits per the new rule)

### Bugs DO-NOT-REPEAT from round 7
- "Add citation" button MUST open the citation picker, NOT close Inspect
- Mouse-click on React icon MUST open ONE menu (not duplicate)
- R/T/C single-letter shortcuts MUST NOT fire when textarea focused

## Data wiring

- Use the existing `getEvaluationById(id)` query (added in Batch 1) to load the evaluation + scorecard + categories
- Load messages + activities via existing `messages` and `ticket_events` queries (extend or compose)
- Load comments via `CommentProvider.listComments(evaluationId)` from Batch 1
- Load reactions via `CommentProvider.listReactions(evaluationId)` from Batch 1
- All mutations go through the existing server actions from Batch 1 (Batch 1 wired `createComment`, `editComment`, `deleteComment`, `addReaction`, `removeReaction` + `editCategoryScore` from SVP-58)
- New server actions needed (if not already in Batch 1):
  - `attachCategory(evaluationId, messageId, categoryId, score)` — adds a citation; updates `evaluation_category_scores.highlightedMessageIds` JSON array + sets human override on the score if needed. Check if Batch 1 covered this; if not, add to `src/lib/qa/actions.ts`.
  - `removeCategory(evaluationId, messageId, categoryId)` — removes a message from a category's highlights
  - Note: SVP-58 added `editCategoryScore` — use that for score changes.

## What would change my mind

- **If a shared component you're about to write would only have one caller**, ask: is that caller likely to change soon, OR are there clearly 2+ future callers? If neither, inline it. Don't over-extract.
- **If the multi-Esc layer state machine starts feeling like spaghetti** (>5 states with cross-coupling), step back and consider a single state-machine module (a reducer + a hook). Don't sprawl Esc handlers across multiple useEffects.
- **If the right-arrow-into-QA-panel nav makes the focus model too complex** (e.g., the QA panel's internal focus state has to coordinate with the convo's focus), simplify: maintain a single `focusedSurface: "convo" | "inspect" | "overview"` state. Each surface owns its own internal focus.
- **If the inline citation score editor (Enter on citation → arrows 1-5) doesn't compose cleanly with `editCategoryScore` action**, push back on the action's signature rather than shoehorning. The action might need to take a `messageId` too if we're attaching to a specific message.

## Pre-flight gates

- `npx tsc --noEmit` clean
- `npm run lint` clean
- Dev server boots at `localhost:3001`
- `/coaching/[any-existing-eval-id]` renders the real UI (not the placeholder)
- Full keyboard walk WITHOUT mouse:
  - ↓ ↓ ↓ traverse messages
  - → enters QA panel (Overview state)
  - ↓ ↓ select a category
  - Enter → mutes uncited + scrolls first cited to top
  - ← back to convo
  - Enter on focused message → Inspect opens
  - ↓ nav to "Add citation" row → Enter → picker opens → ↓/↑ select category → Enter → score picker opens → ↓/↑ pick score → Enter confirms
  - ↓ nav to comment composer → Enter → focuses textarea → type → Enter posts (NOT Cmd+Enter)
  - Esc blurs → Esc closes Inspect → Esc clears category mute → at root
- Click outside Inspect closes Inspect
- Reaction `+` in QA sidebar expands LEFT (no overflow)
- Reaction `+` on customer message expands RIGHT (no overflow)
- Reaction `+` on agent message expands LEFT (no overflow)
- Click React icon on customer message → ONE popup, not two
- T on customer message does nothing (visually disabled or Cite icon hidden)
- Light + dark mode walk
- Test edit/delete on own comment vs another's (only own works)
- Up-arrow in empty comment composer → edits last comment if yours

## Bugs DO-NOT-REPEAT verification
- Add citation must open picker (not close Inspect)
- Mouse-click React on customer message → one menu
- R/T/C suppressed inside textarea

## Notes on production-shape

This is PRODUCTION code. Per CLAUDE.md:
- **Strict TS, no `any`**
- **Server Components by default.** Use `"use client"` only for interactive surfaces (the whole coaching detail page will be a client component — that's expected).
- **No raw Tailwind hues** — production hue tokens only (`bg-blue-light` etc.)
- **No JSX in `.ts` files** — `.tsx` if JSX present
- **URL is state container** for `inspect=<msgId>`, `category=<catId>`, etc. — keeps deep-linking + back-button right.
- **No date/number libraries** — `Intl.*` via `src/lib/format.ts`
- **No `<a>` tags for internal nav** — use Next `Link`
- **Mockup carries do NOT survive**: copy/paste no inline data from `/mockups/qa-window/tight` — read from the DB.
- **Reuse Batch 1 work**: comment server actions, reactions constant, query helpers. Don't reimplement.

## Effort: XL · `/fast` OFF · high effort

Estimated ~6-10 focused hours. Take it in coherent chunks; push early and often even before opening the PR. Supervisor watches for pushed branches and opens PRs via `/sweep` once you're coherent. If you stall >15 min, commit WIP + ping supervisor in chat.

## Parallel worker active

- `llm-scoring` (port 3002) — rename ClaudeScoringProvider → LlmScoringProvider + implement real API call. **No file collisions with your work.** Their changes are in `src/lib/qa/scoring/`; yours are in `src/components/coaching/`, `src/app/(workspace)/coaching/`, and possibly `src/lib/qa/actions.ts`.
