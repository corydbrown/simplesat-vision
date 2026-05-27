import type { EntityKey, SavedView } from "./types";

/** First-load defaults seeded into localStorage. The "All ENTITY" view is
 *  NOT included here — it is hardcoded and immutable, materialized by the
 *  provider. Customers and team-members rely on filter fields that hit
 *  correlated subqueries (`total_tickets`, `avg_rating`, `total_responses`)
 *  for the computed "At risk" / "Low performers" views. */
export const SEED_VIEWS: Record<EntityKey, SavedView[]> = {
  customers: [
    {
      id: "insider",
      name: "Insider",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "tier", op: "in", value: ["insider"] }],
      },
    },
    {
      id: "gold",
      name: "Gold",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "tier", op: "in", value: ["gold"] }],
      },
    },
    {
      id: "elite",
      name: "Elite",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "tier", op: "in", value: ["elite"] }],
      },
    },
    {
      id: "b2b-accounts",
      name: "B2B accounts",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "organization", op: "notnull" }],
      },
    },
    {
      id: "at-risk",
      name: "At risk",
      state: {
        sorts: [{ key: "avg_rating", dir: "asc" }],
        group: null,
        layout: null,
        filters: [
          { propertyId: "total_tickets", op: "gte", value: 3 },
          { propertyId: "avg_rating", op: "lt", value: 3 },
        ],
      },
    },
  ],
  tickets: [
    {
      id: "open",
      name: "Open",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "status", op: "in", value: ["open"] }],
      },
    },
    {
      id: "unassigned",
      name: "Unassigned",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "assignee_id", op: "isnull" }],
      },
    },
    {
      id: "detractors",
      name: "Detractors",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "response_rating", op: "lte", value: 2 }],
      },
    },
    {
      // PRD: tickets whose QA score warrants a manager look — either a low
      // automated score OR a manager-flagged invalidation. Surfaces
      // worst-first so a QA manager opening the view sees what to action
      // next at the top.
      id: "needs-qa-review",
      name: "Needs QA review",
      state: {
        sorts: [{ key: "qa_score", dir: "asc" }],
        group: null,
        layout: null,
        filters: [
          { propertyId: "qa_score", op: "lt", value: 75 },
          {
            propertyId: "qa_status",
            op: "in",
            value: ["invalidated"],
            combinator: "OR",
          },
        ],
      },
    },
    {
      // PRD Part 8: coachable conversations surface here. OR-grouped signals
      // (transfers, multi-reassignment, SLA breach, escalation) catch every
      // shape of "this one needed manager attention" without users having to
      // build the filter themselves.
      id: "high-signal-tickets",
      name: "High-signal tickets",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [
          { propertyId: "had_transfer", op: "eq", value: true },
          {
            propertyId: "reassignment_count",
            op: "gte",
            value: 2,
            combinator: "OR",
          },
          {
            propertyId: "sla_breached",
            op: "eq",
            value: true,
            combinator: "OR",
          },
          {
            propertyId: "escalated",
            op: "eq",
            value: true,
            combinator: "OR",
          },
        ],
      },
    },
    {
      id: "survey-not-fired",
      name: "Survey not fired",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "survey_not_sent_reason", op: "notnull" }],
      },
    },
    {
      id: "this-week",
      name: "This week",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [
          {
            propertyId: "created_at",
            op: "relative",
            value: { n: 7, unit: "days", dir: "past" },
          },
        ],
      },
    },
  ],
  responses: [
    {
      id: "detractors",
      name: "Detractors",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "rating", op: "lte", value: 2 }],
      },
    },
    {
      id: "promoters",
      name: "Promoters",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "rating", op: "eq", value: 5 }],
      },
    },
    {
      id: "with-comments",
      name: "With comments",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "comment", op: "notnull" }],
      },
    },
    {
      id: "this-week",
      name: "This week",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [
          {
            propertyId: "responded_at",
            op: "relative",
            value: { n: 7, unit: "days", dir: "past" },
          },
        ],
      },
    },
  ],
  coaching: [
    {
      // QA evaluations that landed in the AI-scored state and haven't been
      // touched by a manager yet — the daily review queue. Sorts worst-first
      // so the most actionable score surfaces at the top.
      id: "needs-my-attention",
      name: "Needs my attention",
      state: {
        sorts: [{ key: "overall_score", dir: "asc" }],
        group: null,
        layout: null,
        filters: [{ propertyId: "status", op: "in", value: ["ai_scored"] }],
      },
    },
    {
      // Evaluations a manager has inline-edited — useful for calibration
      // review and seeing where the AI most needed correction.
      id: "recently-edited",
      name: "Recently edited",
      state: {
        sorts: [{ key: "edited_at", dir: "desc" }],
        group: null,
        layout: null,
        filters: [{ propertyId: "status", op: "in", value: ["edited"] }],
      },
    },
    {
      // PRD: auto-failed evaluations are a distinct compliance bucket from
      // generally-low scores. Time-bound to the last 7 days so the view
      // mirrors a weekly QA standup; longer windows can be added ad-hoc.
      id: "auto-failed-this-week",
      name: "Auto-failed this week",
      state: {
        sorts: [{ key: "scored_at", dir: "desc" }],
        group: null,
        layout: null,
        filters: [
          { propertyId: "auto_failed", op: "eq", value: true },
          {
            propertyId: "scored_at",
            op: "relative",
            value: { n: 7, unit: "days", dir: "past" },
          },
        ],
      },
    },
    {
      // Per-agent coaching pivot: group by scored team member so a manager
      // can pick an agent and scan their recent scores side by side.
      id: "by-team-member",
      name: "By team member",
      state: {
        sorts: [{ key: "scored_at", dir: "desc" }],
        group: { propertyId: "scored_team_member", dir: "asc" },
        layout: null,
        filters: [],
      },
    },
  ],
  "team-members": [
    {
      id: "front-line",
      name: "Front line",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "team", op: "in", value: ["Front line"] }],
      },
    },
    {
      id: "senior",
      name: "Senior",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "team", op: "in", value: ["Senior"] }],
      },
    },
    {
      id: "specialist",
      name: "Specialist",
      state: {
        sorts: [],
        group: null,
        layout: null,
        filters: [{ propertyId: "team", op: "in", value: ["Specialist"] }],
      },
    },
    {
      id: "low-performers",
      name: "Low performers",
      state: {
        sorts: [{ key: "avg_rating", dir: "asc" }],
        group: null,
        layout: null,
        filters: [
          { propertyId: "total_responses", op: "gte", value: 20 },
          { propertyId: "avg_rating", op: "lt", value: 3.5 },
        ],
      },
    },
  ],
};

/** Label shown for the immutable "All ENTITY" view in sidebar + breadcrumb. */
export const ALL_VIEW_LABEL: Record<EntityKey, string> = {
  customers: "All customers",
  tickets: "All tickets",
  responses: "All responses",
  "team-members": "All members",
  coaching: "All evaluations",
};

export const ENTITY_BASE_PATH: Record<EntityKey, string> = {
  customers: "/customers",
  tickets: "/tickets",
  responses: "/responses",
  "team-members": "/team-members",
  coaching: "/coaching",
};

/** Source-of-truth order for entity-bound nav sections. The sidebar
 *  (`primary-nav.tsx`) and the search palette's "Views" group both iterate
 *  this array so the two surfaces stay in lock-step. Reports lives in the
 *  sidebar but has no entity binding, so it is appended separately. */
export const NAV_SECTION_ORDER: readonly EntityKey[] = [
  "responses",
  "customers",
  "team-members",
  "tickets",
  "coaching",
];
