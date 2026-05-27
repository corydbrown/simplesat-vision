# Data shape

Entity quick-reference + seed scale + custom-attribute model + content banks. Pairs with [ARCHITECTURE.md](ARCHITECTURE.md) (which covers the runtime patterns) and `src/db/schema.ts` (the source of truth).

## Entity quick-ref

| Entity | Internal id | External id | Avg rating threshold | Notes |
|---|---|---|---|---|
| Ticket | `tkt_<nanoid>` | `externalId` (numeric string) | n/a | All seeded `source='zendesk'`. `status` is raw source text + a generated `is_resolved` boolean. Carries `priority` enum (low/normal/high/urgent, default normal). `teamMemberId` is resolved from the lossless `sourceAgents` bag via `resolveTeamMember`. Raw-capture: `sourceTags`, `sourceMetrics`. 50 tickets carry a full `ticket_messages` + `ticket_events` timeline. |
| Ticket message | `tkm_<nanoid>` | none | n/a | One row per chat / email / phone / social message, plus internal notes. `authorRole` is `customer` or `agent`. |
| Ticket event | `tke_<nanoid>` | none | n/a | One row per audit-style event (status change, assignment, priority bump, survey sent, etc.). |
| Customer | `cus_<nanoid>` | `externalId` | <3 red, <4 amber | Bloom Beauty B2C retail. ~95% individuals with `organization = null`; ~5% B2B (with `organization`, `organizationExternalId`, `organizationDomain`). First 3 are detractor B2B accounts (Atlas Hospitality, Pacific Beauty Distributors, Crown Department Stores). Core columns: tier (insider/gold/elite), language. Carries sparse `customProperties` JSON for beauty-personalization + loyalty + engagement attributes. |
| Team member | `tm_<nanoid>` | none yet | <3.5 red, <4 amber | 4 seeded as low performers. First-class `region`, `language`, `groupId` (FK to `team_member_groups`); additional sparse `customProperties` JSON. |
| Team member group | `tmg_<nanoid>` | none | n/a | Six seeded groups (Customer Care / Returns & Exchanges / Online Orders / Stores & BOPIS / Loyalty & VIP / Escalations). Mirrors Zendesk Groups. Used for filtering and `TeamGroupPill`. |
| Response | `rsp_<nanoid>` | none yet | follows customer thresholds | `answers` JSON has rating/multi-choice/multi-select/comment; each may carry per-answer `topics`. Rolled-up dedup'd `topics` JSON at the row level. `surveyId` FK + denormalized `surveyType`. |
| Survey | `svy_<nanoid>` | none yet | n/a | Has metric (csat/nps/ces/five_star/custom), channel, scale, status, questions JSON. Pill + popover + drawer + `/surveys/[id]`. **Not in primary nav** — survey management eventually lives in settings. |
| QA Evaluation | `qa_<nanoid>` | (schema exists, no data) | — | Strategic placeholder for phase 4+ |

## Seed scale

`npm run db:reset` produces:

- 8 surveys
- 1,200 customers
- 25 team members across 6 groups
- 50,000 tickets
- ~14,200 responses (~11,400 with rolled-up topics)
- 50 tickets with full timeline: 351 ticket messages + 289 ticket events
- Comment banks: `db/comments.json` (response comments) + `db/ticket-messages.json` (Bloom Beauty retail-voice messages)

Faker is seeded deterministically (`faker.seed(42)`) so re-running `db:reset` produces identical data.

## Core fields vs custom attributes

Every entity in Simplesat is modelled as a fixed set of **core fields** plus a flat **`customAttributes` array** in the public API. The schema mirrors this:

- **Core fields** = real DB columns (name, email, organization, language, tier, …). Rendered via dedicated components (`CompanyPill`, `TierPill`, `TeamGroupPill`, etc.) and have stable types. (`CompanyPill` keeps its component name; it now renders the `organization` string.)
- **Custom attributes** = sparse JSON bag in `customProperties`. Rendered via the generic `customFieldProperties` adapter. The public API serializes these as a flat `customAttributes: [{key, value}]` array.

**Critical**: Simplesat genuinely cannot attribute a custom-attribute value to a specific integration. The public API, Zendesk push, Intercom webhook, CSV import, and manual edits all write into the same single namespace. **Do not** tag `CustomFieldDef` entries with a `source` attribute and **do not** render "Synced from X" anywhere — that would be a fiction. The `group` field on `CustomFieldDef` is a user-curated semantic category (Profile / Beauty profile / Loyalty / Engagement / Purchase behavior / B2B for customers; Profile / Schedule / Skills / Performance for team members), not provenance.

The "many customers with many custom attributes" UX is faked via two layers:

1. **`customers.customProperties` / `team_members.customProperties`** — JSON column carrying sparse values keyed by definition ID. Each customer holds 25-50 of the ~55 available customer keys; each team member holds 8-16 of the ~22 team-member keys.
2. **`src/lib/properties/custom-fields.ts`** — TS const array of `CustomFieldDef` ({id, label, group, dataType, importance 1-5, defaultVisible, enumValues?, sample()}). Importance drives default ordering + default visibility. `sample()` is a closure used by seed.

`src/lib/properties/custom-field-properties.tsx` turns those defs into `Property<T>[]` entries that the customer + team-member registries spread in. Custom attributes show up automatically as hidable columns grouped by semantic category and as filterable pivot fields in Reports (importance ≥3 surfaces in the rail; the rest stay in the column picker only).

**Don't add a `property_definitions` DB table for this** — the TS const is hand-tunable for the demo narrative and keeps everything serverless-friendly.

## Topic taxonomy

`src/lib/topics.ts` defines the 68 predefined topics across 20 groups (sourced from production via `csv_exports/topics_groups.csv`). Each topic has `{ id, label, group }` where `id` is the kebab-case slug used in storage. Per-answer topics live on `SurveyAnswer.topics`; response-level `topics` is rolled-up + deduped via `rollupTopics()` (negative > neutral > positive on conflict).

**Don't invent new topics.** The taxonomy comes from production; updates land via that CSV. The seed only uses real topic IDs.

## Content banks

Two hand-curated synthetic banks, no PII, no harvest.

- **`db/comments.json`** — response comments, bucketed by metric × rating (`csat_1..5`, `ces_1..5`, `five_star_1..5`, `nps_promoter/passive/detractor`, `custom`). Seed loads it via `pickComment(metric, rating)`. Empty buckets fall back to the nearest CSAT bucket.
- **`db/ticket-messages.json`** — Bloom Beauty retail-voice ticket messages, bucketed by ticket-subject category × slot (`customer_initial` / `customer_followup` / `agent_reply` / `agent_resolution`) plus a flat `internal_notes` array. Seed loads it via `pickMessage(category, slot)`. `_default` catches subjects without a tailored bucket.

If you reseed for a different vertical, rewrite the banks from scratch rather than harvesting from real exports.
