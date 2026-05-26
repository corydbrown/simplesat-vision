import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export type CustomerTier = "insider" | "gold" | "elite";
export type TicketStatus = "open" | "pending" | "solved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type Channel = "email" | "chat" | "phone" | "social";
export type Helpdesk = "zendesk" | "gladly" | "gorgias" | "intercom";
export type SurveyType = "csat" | "nps" | "ces" | "five_star" | "custom";
export type SurveyChannel =
  | "intercom"
  | "zendesk"
  | "oneoff_email"
  | "web_embed"
  | "generic_embed";
export type SurveyStatus = "active" | "archived" | "draft";
export type SurveyNotSentReason =
  | "tag_excluded"
  | "suppression_list"
  | "channel_disabled"
  | "automation_close";
export type TopicSentiment = "positive" | "neutral" | "negative";

/** QA evaluation lifecycle states. `ai_scored` is the entry state when the
 *  scoring provider returns. `edited` means a human overrode at least one
 *  category score. `contested` is the agent-flag state. `invalidated` is a
 *  soft-delete (kept for audit). `finalized` is post-calibration sign-off. */
export type QaEvaluationStatus =
  | "ai_scored"
  | "edited"
  | "contested"
  | "invalidated"
  | "finalized";

/** Per-category scoring scale. `likert_5` is the default 1-5 rubric scale.
 *  `binary` is for auto-fail items (0/1). `three_state` is reserved for
 *  yes/partial/no style criteria that some Phase 2 scorecards may want. */
export type ScorecardScaleType = "likert_5" | "binary" | "three_state";

export type TopicTag = { topic: string; sentiment: TopicSentiment };

/** Verbs for ticket_events. Mirrors the Zendesk Audit `Change` event types
 *  + the activity-stream verb set. Add new verbs by extending this union and
 *  updating the enum on the `verb` column. */
export type TicketEventVerb =
  | "ticket_created"
  | "status_changed"
  | "assignee_changed"
  | "group_changed"
  | "priority_changed"
  | "tag_added"
  | "tag_removed"
  | "subject_changed"
  | "merged"
  | "survey_sent"
  | "survey_response_received"
  | "sla_breached"
  | "escalated"
  | "ai_handoff"
  | "ticket_reopened";

export type TicketMessageType = "comment" | "voice_comment" | "chat_message";
export type TicketMessageAuthorRole = "customer" | "agent" | "system";
export type TicketMessageChannel =
  | "email"
  | "chat"
  | "phone"
  | "social"
  | "internal";

export type SurveyAnswer =
  | {
      type: "rating";
      question: string;
      value: number;
      scale: number;
      topics?: TopicTag[];
    }
  | {
      type: "multi-choice";
      question: string;
      options: string[];
      value: string;
      topics?: TopicTag[];
    }
  | {
      type: "multi-select";
      question: string;
      options: string[];
      value: string[];
      topics?: TopicTag[];
    }
  | {
      type: "comment";
      question: string;
      value: string;
      topics?: TopicTag[];
    };

/** Schema for a survey's question definitions. Mirrors the SurveyAnswer
 *  discriminated union but without the answered value. */
export type SurveyQuestion =
  | { type: "rating"; question: string; scale: number }
  | { type: "multi-choice"; question: string; options: string[] }
  | { type: "multi-select"; question: string; options: string[] }
  | { type: "comment"; question: string };

export const surveys = sqliteTable(
  "surveys",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    metric: text("metric", {
      enum: ["csat", "nps", "ces", "five_star", "custom"],
    })
      .notNull()
      .$type<SurveyType>(),
    channel: text("channel", {
      enum: [
        "intercom",
        "zendesk",
        "oneoff_email",
        "web_embed",
        "generic_embed",
      ],
    })
      .notNull()
      .$type<SurveyChannel>(),
    status: text("status", { enum: ["active", "archived", "draft"] })
      .notNull()
      .$type<SurveyStatus>(),
    scale: integer("scale").notNull(),
    questions: text("questions", { mode: "json" })
      .$type<SurveyQuestion[]>()
      .notNull()
      .default(sql`'[]'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("surveys_metric_idx").on(t.metric),
    index("surveys_channel_idx").on(t.channel),
    index("surveys_status_idx").on(t.status),
  ],
);

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    /** Core: customer's display name. */
    name: text("name").notNull(),
    /** Core: primary email (login + helpdesk identity). */
    email: text("email").notNull(),
    /** Core: loyalty tier. Bloom Beauty's three-tier program. */
    tier: text("tier", { enum: ["insider", "gold", "elite"] })
      .notNull()
      .$type<CustomerTier>(),
    /** Core: optional ISO language code (en, es, fr, de, ja, …). Per Cory:
     *  language is a reserved core field in Simplesat's public API, alongside
     *  name/email/company — not a custom attribute. */
    language: text("language"),
    /** Core: organization the customer belongs to, when applicable. Nullable
     *  by design — Bloom Beauty is mid-market B2C, so ~95% of customers are
     *  individuals with no company. The remainder are wholesale buyers,
     *  corporate gifting accounts, and influencer partnerships. There is no
     *  Companies entity — `company*` columns are rolled up from the help-desk
     *  organization when present (Zendesk Organizations API). */
    company: text("company"),
    /** Core rollup: the help-desk organization's external ID (e.g. Zendesk
     *  org id). Present when `company` is. */
    companyExternalId: text("company_external_id"),
    /** Core rollup: organization domain (e.g. atlashospitality.com). Used for
     *  domain-based segmentation. */
    companyDomain: text("company_domain"),
    helpdeskExternalId: text("helpdesk_external_id"),
    /** Custom attributes bag. In Simplesat's public API these surface as a
     *  flat `customAttributes: [{key, value}]` array, with definitions in
     *  src/lib/properties/custom-fields.ts. Sparse by design: any given
     *  customer carries 25-50 of the ~50-60 possible keys. The system does
     *  NOT track which integration wrote which value — customAttributes is a
     *  single namespace any source can write into. */
    customProperties: text("custom_properties", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("customers_company_idx").on(t.company),
    index("customers_tier_idx").on(t.tier),
    index("customers_language_idx").on(t.language),
  ],
);

/** Team-member groups. Mirrors Zendesk's Groups resource — a basic taxonomy
 *  for organizing team members (Customer Care, Returns, Stores, etc.). Used
 *  for filtering and future routing rules. */
export const teamMemberGroups = sqliteTable(
  "team_member_groups",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("team_member_groups_name_idx").on(t.name)],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    /** Core: display name. */
    name: text("name").notNull(),
    /** Core: work email (also helpdesk login). */
    email: text("email").notNull(),
    /** Core: job title (free-text — "Beauty Advisor", "Returns Specialist"). */
    role: text("role").notNull(),
    /** Core: high-level team grouping (free-string — "Front line", "Senior",
     *  "Specialist"). Distinct from the canonical `groupId` taxonomy. */
    team: text("team").notNull(),
    /** Core: geographic region (e.g. "North America", "EMEA"). */
    region: text("region"),
    /** Core: spoken language. */
    language: text("language"),
    /** Core: canonical group assignment (FK to team_member_groups). Mirrors
     *  Zendesk Groups; the team member can belong to one primary group. */
    groupId: text("group_id").references(() => teamMemberGroups.id),
    helpdeskExternalId: text("helpdesk_external_id"),
    avatarColor: text("avatar_color").notNull(),
    /** Custom attributes bag — same single-namespace shape as customers. */
    customProperties: text("custom_properties", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("team_members_team_idx").on(t.team),
    index("team_members_region_idx").on(t.region),
    index("team_members_group_id_idx").on(t.groupId),
  ],
);

/** Authenticated humans. A `user` is a person who logs into the prototype
 *  via WorkOS AuthKit. Distinct from `team_members` (helpdesk agents): a
 *  user may or may not also be a team_member, and a team_member may or may
 *  not have a user account. The email-match seam between them lands in a
 *  later epic. */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    workosId: text("workos_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("users_workos_id_unq").on(t.workosId),
    uniqueIndex("users_email_unq").on(t.email),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    subject: text("subject").notNull(),
    status: text("status", {
      enum: ["open", "pending", "solved", "closed"],
    })
      .notNull()
      .$type<TicketStatus>(),
    channel: text("channel", {
      enum: ["email", "chat", "phone", "social"],
    })
      .notNull()
      .$type<Channel>(),
    helpdesk: text("helpdesk", {
      enum: ["zendesk", "gladly", "gorgias", "intercom"],
    })
      .notNull()
      .$type<Helpdesk>(),
    /** Priority. Mirrors Zendesk Tickets `priority` (low/normal/high/urgent). */
    priority: text("priority", {
      enum: ["low", "normal", "high", "urgent"],
    })
      .notNull()
      .$type<TicketPriority>()
      .default("normal"),
    helpdeskExternalId: text("helpdesk_external_id"),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    assignedTeamMemberId: text("assigned_team_member_id").references(
      () => teamMembers.id,
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    firstResponseAt: integer("first_response_at", { mode: "timestamp_ms" }),
    solvedAt: integer("solved_at", { mode: "timestamp_ms" }),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    messageCount: integer("message_count").notNull().default(0),
    agentMessageCount: integer("agent_message_count").notNull().default(0),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    surveyEligible: integer("survey_eligible", { mode: "boolean" })
      .notNull()
      .default(true),
    surveySentAt: integer("survey_sent_at", { mode: "timestamp_ms" }),
    surveyNotSentReason: text("survey_not_sent_reason", {
      enum: [
        "tag_excluded",
        "suppression_list",
        "channel_disabled",
        "automation_close",
      ],
    }).$type<SurveyNotSentReason>(),
  },
  (t) => [
    index("tickets_customer_id_idx").on(t.customerId),
    index("tickets_assigned_team_member_id_idx").on(t.assignedTeamMemberId),
    index("tickets_status_idx").on(t.status),
    index("tickets_created_at_idx").on(t.createdAt),
    index("tickets_solved_at_idx").on(t.solvedAt),
    index("tickets_closed_at_idx").on(t.closedAt),
    index("tickets_survey_sent_at_idx").on(t.surveySentAt),
    index("tickets_helpdesk_idx").on(t.helpdesk),
    index("tickets_priority_idx").on(t.priority),
  ],
);

/** Per-ticket message log. Mirrors Zendesk Ticket Comments — the public
 *  back-and-forth between customer and agent, plus internal-only notes that
 *  agents leave for each other. Exactly one of `customerId` / `teamMemberId`
 *  is set when `authorRole` is "customer" / "agent"; both null when the
 *  author is "system" (automation, bot reply, deflection note). */
export const ticketMessages = sqliteTable(
  "ticket_messages",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    authorRole: text("author_role", {
      enum: ["customer", "agent", "system"],
    })
      .notNull()
      .$type<TicketMessageAuthorRole>(),
    customerId: text("customer_id").references(() => customers.id),
    teamMemberId: text("team_member_id").references(() => teamMembers.id),
    /** Delivery channel this message arrived on. Tracks per-message because a
     *  ticket can mix channels (chat session escalated to email, etc.). The
     *  `internal` channel marks agent-only notes, not customer-visible. */
    channel: text("channel", {
      enum: ["email", "chat", "phone", "social", "internal"],
    })
      .notNull()
      .$type<TicketMessageChannel>(),
    /** Zendesk parlance: `public=true` means visible to the customer; `false`
     *  is an internal note. Denormalized from `channel="internal"` for
     *  faster filtering. */
    isPublic: integer("is_public", { mode: "boolean" })
      .notNull()
      .default(true),
    type: text("type", {
      enum: ["comment", "voice_comment", "chat_message"],
    })
      .notNull()
      .$type<TicketMessageType>()
      .default("comment"),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("ticket_messages_ticket_id_idx").on(t.ticketId),
    index("ticket_messages_created_at_idx").on(t.createdAt),
    index("ticket_messages_team_member_id_idx").on(t.teamMemberId),
    index("ticket_messages_customer_id_idx").on(t.customerId),
  ],
);

/** Per-ticket lifecycle events. Mirrors Zendesk Audit `Change` events
 *  (status / assignee / priority / tag flips) plus the activity-stream verbs
 *  (survey sent, response received, merge, SLA breach). Messages are NOT in
 *  this table — they have their own `ticket_messages`. The detail-page
 *  Activity timeline interleaves the two by `createdAt`. */
export const ticketEvents = sqliteTable(
  "ticket_events",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    /** Who caused the change. `system` covers automations, triggers, the
     *  survey scheduler, etc. — `actorTeamMemberId` / `actorCustomerId`
     *  stay null in that case. */
    actorRole: text("actor_role", {
      enum: ["customer", "agent", "system"],
    })
      .notNull()
      .$type<TicketMessageAuthorRole>(),
    actorTeamMemberId: text("actor_team_member_id").references(
      () => teamMembers.id,
    ),
    actorCustomerId: text("actor_customer_id").references(() => customers.id),
    verb: text("verb", {
      enum: [
        "ticket_created",
        "status_changed",
        "assignee_changed",
        "group_changed",
        "priority_changed",
        "tag_added",
        "tag_removed",
        "subject_changed",
        "merged",
        "survey_sent",
        "survey_response_received",
        "sla_breached",
        "escalated",
        "ai_handoff",
        "ticket_reopened",
      ],
    })
      .notNull()
      .$type<TicketEventVerb>(),
    /** For Change-style verbs, the underlying field that changed (e.g.
     *  "status", "assignee_id", "priority"). Null for non-Change verbs. */
    fieldName: text("field_name"),
    /** String-cast prior / new values. Cast at read-time when typed
     *  rendering is needed. Null when not applicable to the verb. */
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    /** Verb-specific extras: `{group_id}` for assignee changes, `{survey_id,
     *  response_id}` for survey verbs, `{tag}` for tag adds, etc. */
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("ticket_events_ticket_id_idx").on(t.ticketId),
    index("ticket_events_created_at_idx").on(t.createdAt),
    index("ticket_events_verb_idx").on(t.verb),
    index("ticket_events_actor_team_member_id_idx").on(t.actorTeamMemberId),
  ],
);

export const responses = sqliteTable(
  "responses",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    teamMemberId: text("team_member_id").references(() => teamMembers.id),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id),
    /** Denormalized from surveys.metric for fast filtering + index-friendly
     *  metric aggregations. Keep in sync with the survey at write time. */
    surveyType: text("survey_type", {
      enum: ["csat", "nps", "ces", "five_star", "custom"],
    })
      .notNull()
      .$type<SurveyType>(),
    rating: integer("rating").notNull(),
    scale: integer("scale").notNull(),
    comment: text("comment"),
    respondedAt: integer("responded_at", { mode: "timestamp_ms" }).notNull(),
    answers: text("answers", { mode: "json" })
      .$type<SurveyAnswer[]>()
      .notNull()
      .default(sql`'[]'`),
    /** Rolled-up, deduped topics across all answers. If the same topic
     *  appears with conflicting sentiments, negative wins (worse signal). */
    topics: text("topics", { mode: "json" })
      .$type<TopicTag[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (t) => [
    index("responses_ticket_id_idx").on(t.ticketId),
    index("responses_customer_id_idx").on(t.customerId),
    index("responses_team_member_id_idx").on(t.teamMemberId),
    index("responses_survey_id_idx").on(t.surveyId),
    index("responses_survey_type_idx").on(t.surveyType),
    index("responses_rating_idx").on(t.rating),
    index("responses_responded_at_idx").on(t.respondedAt),
  ],
);

/** A configurable QA scorecard. Phase 1 ships a single default scorecard
 *  hydrated from src/lib/qa/default-scorecard.ts at seed; Phase 2 will allow
 *  multiple scorecards per workspace. No `account_id` yet — the seam is left
 *  clean for multi-tenant later (see CLAUDE.md → Trajectory). `version`
 *  bumps when a manager edits the rubric; each bump writes an immutable
 *  `scorecard_versions` snapshot, and evaluations FK into that snapshot via
 *  `evaluations.scorecard_version_id`. The integer on this row mirrors the
 *  *current* (latest) version for convenience. */
export const scorecards = sqliteTable(
  "scorecards",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("scorecards_is_default_idx").on(t.isDefault),
    index("scorecards_enabled_idx").on(t.enabled),
  ],
);

/** A category within a scorecard. Maps 1:1 to a PRD Part 7 rubric category
 *  (Customer Connection, Resolution Quality, Communication, Process &
 *  Ownership, Compliance & Safety). `weight_percent` is the contribution to
 *  the overall score when `is_autofail` is false. Auto-fail categories carry
 *  weight 0 and instead force the overall score to a floor when any of their
 *  criteria fail. */
export const scorecardCategories = sqliteTable(
  "scorecard_categories",
  {
    id: text("id").primaryKey(),
    scorecardId: text("scorecard_id")
      .notNull()
      .references(() => scorecards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    weightPercent: integer("weight_percent").notNull().default(0),
    scaleType: text("scale_type", {
      enum: ["likert_5", "binary", "three_state"],
    })
      .notNull()
      .$type<ScorecardScaleType>()
      .default("likert_5"),
    order: integer("order").notNull().default(0),
    isAutofail: integer("is_autofail", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    index("scorecard_categories_scorecard_id_idx").on(t.scorecardId),
    index("scorecard_categories_order_idx").on(t.order),
  ],
);

/** A criterion within a category — the lowest-grain rubric item. For likert
 *  scales `anchor_5` / `anchor_3` / `anchor_1` describe what a 5 / 3 / 1
 *  looks like; for binary auto-fail items `text` holds the rule and anchors
 *  are empty. */
export const scorecardCriteria = sqliteTable(
  "scorecard_criteria",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => scorecardCategories.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    anchor5: text("anchor_5").notNull().default(""),
    anchor3: text("anchor_3").notNull().default(""),
    anchor1: text("anchor_1").notNull().default(""),
    order: integer("order").notNull().default(0),
  },
  (t) => [
    index("scorecard_criteria_category_id_idx").on(t.categoryId),
    index("scorecard_criteria_order_idx").on(t.order),
  ],
);

/** Immutable snapshot of a scorecard at the moment a `version` was minted.
 *  Every save of the scorecard editor produces a new row here capturing the
 *  rubric text (categories + criteria) as it stood when that version went
 *  live. Evaluations FK into this row via `evaluations.scorecard_version_id`
 *  so historical evals continue to render the rubric they were scored
 *  against, even after the live `scorecard_categories` / `scorecard_criteria`
 *  text is edited.
 *
 *  `auto_fail_floor` is snapshotted here even though today it's a global
 *  constant (PRD default 30) — when it becomes per-scorecard, the seam is
 *  already in place. */
export const scorecardVersions = sqliteTable(
  "scorecard_versions",
  {
    id: text("id").primaryKey(),
    scorecardId: text("scorecard_id")
      .notNull()
      .references(() => scorecards.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    autoFailFloor: integer("auto_fail_floor").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("scorecard_versions_scorecard_id_idx").on(t.scorecardId),
    uniqueIndex("scorecard_versions_scorecard_id_version_idx").on(
      t.scorecardId,
      t.version,
    ),
  ],
);

/** Snapshot of a category inside a `scorecard_versions` row. Mirrors
 *  `scorecard_categories` shape. `source_category_id` is the logical
 *  category identity (the live `scorecard_categories.id` at snapshot time) —
 *  cross-version rollups (heatmap, agent profile) aggregate evaluation
 *  category scores by this logical id, while eval-time text resolves via
 *  this row. */
export const scorecardVersionCategories = sqliteTable(
  "scorecard_version_categories",
  {
    id: text("id").primaryKey(),
    scorecardVersionId: text("scorecard_version_id")
      .notNull()
      .references(() => scorecardVersions.id, { onDelete: "cascade" }),
    sourceCategoryId: text("source_category_id")
      .notNull()
      .references(() => scorecardCategories.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    weightPercent: integer("weight_percent").notNull().default(0),
    scaleType: text("scale_type", {
      enum: ["likert_5", "binary", "three_state"],
    })
      .notNull()
      .$type<ScorecardScaleType>()
      .default("likert_5"),
    order: integer("order").notNull().default(0),
    isAutofail: integer("is_autofail", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    index("scorecard_version_categories_version_id_idx").on(
      t.scorecardVersionId,
    ),
    index("scorecard_version_categories_source_id_idx").on(t.sourceCategoryId),
    uniqueIndex("scorecard_version_categories_version_source_idx").on(
      t.scorecardVersionId,
      t.sourceCategoryId,
    ),
  ],
);

/** Snapshot of a criterion inside a `scorecard_version_categories` row.
 *  Mirrors `scorecard_criteria` shape. `source_criterion_id` is the logical
 *  criterion identity (the live `scorecard_criteria.id` at snapshot time). */
export const scorecardVersionCriteria = sqliteTable(
  "scorecard_version_criteria",
  {
    id: text("id").primaryKey(),
    versionCategoryId: text("version_category_id")
      .notNull()
      .references(() => scorecardVersionCategories.id, {
        onDelete: "cascade",
      }),
    sourceCriterionId: text("source_criterion_id")
      .notNull()
      .references(() => scorecardCriteria.id),
    text: text("text").notNull(),
    anchor5: text("anchor_5").notNull().default(""),
    anchor3: text("anchor_3").notNull().default(""),
    anchor1: text("anchor_1").notNull().default(""),
    order: integer("order").notNull().default(0),
  },
  (t) => [
    index("scorecard_version_criteria_category_id_idx").on(t.versionCategoryId),
    index("scorecard_version_criteria_source_id_idx").on(t.sourceCriterionId),
  ],
);

/** One QA evaluation of one ticket against one scorecard version. The
 *  scoring provider (mock or LLM, selected via env) writes one row here plus
 *  one per-category row in `evaluation_category_scores` and one coaching
 *  note. `overall_score` is 0-100; per-category scores live on the child
 *  table at the scorecard's native scale. */
export const evaluations = sqliteTable(
  "evaluations",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    scorecardId: text("scorecard_id")
      .notNull()
      .references(() => scorecards.id),
    /** FK into `scorecard_versions` — the immutable rubric snapshot this
     *  evaluation was scored against. The integer version number lives on
     *  that row; resolve via join. Older evaluations keep their original
     *  snapshot even after the scorecard is edited. */
    scorecardVersionId: text("scorecard_version_id")
      .notNull()
      .references(() => scorecardVersions.id),
    /** The team member whose work is being scored (the assigned agent on
     *  the ticket at scoring time). Distinct from `scored_by` (which is the
     *  identity that produced the score — provider name + optional human). */
    scoredTeamMemberId: text("scored_team_member_id")
      .notNull()
      .references(() => teamMembers.id),
    overallScore: integer("overall_score").notNull(),
    status: text("status", {
      enum: [
        "ai_scored",
        "edited",
        "contested",
        "invalidated",
        "finalized",
      ],
    })
      .notNull()
      .$type<QaEvaluationStatus>()
      .default("ai_scored"),
    /** Provider identity: `mock-deterministic-v1`, `claude-haiku-4-5-…`, etc.
     *  Lets us track score drift when the underlying model changes. */
    aiModel: text("ai_model").notNull(),
    /** 0-1 self-reported confidence from the provider. */
    aiConfidence: integer("ai_confidence").notNull(),
    aiReasoningSummary: text("ai_reasoning_summary").notNull().default(""),
    /** Provider id (`mock`, `claude`) or human team member id when a human
     *  produced the score directly. Free-text — not an FK — so external
     *  scorers (calibration tools) can be represented later. */
    scoredBy: text("scored_by").notNull(),
    scoredAt: integer("scored_at", { mode: "timestamp_ms" }).notNull(),
    editedBy: text("edited_by").references(() => teamMembers.id),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    invalidatedReason: text("invalidated_reason"),
  },
  (t) => [
    index("evaluations_ticket_id_idx").on(t.ticketId),
    index("evaluations_scorecard_id_idx").on(t.scorecardId),
    index("evaluations_scorecard_version_id_idx").on(t.scorecardVersionId),
    index("evaluations_scored_team_member_id_idx").on(t.scoredTeamMemberId),
    index("evaluations_status_idx").on(t.status),
    index("evaluations_scored_at_idx").on(t.scoredAt),
    index("evaluations_overall_score_idx").on(t.overallScore),
  ],
);

/** Per-category score within an evaluation. `ai_score` is the provider's
 *  call; `human_score` is set when a manager edits inline; `effective_score`
 *  is the value queries should use (human if present, else AI). We store
 *  effective rather than computing on read so list/pivot queries stay simple.
 *  `highlighted_message_ids` references the messages on the parent ticket
 *  that drove this category's score — that's what the SVP-54 supporting-
 *  message highlight UI reads. */
export const evaluationCategoryScores = sqliteTable(
  "evaluation_category_scores",
  {
    id: text("id").primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => scorecardCategories.id),
    aiScore: integer("ai_score").notNull(),
    humanScore: integer("human_score"),
    /** Required justification text captured when a manager sets `humanScore`
     *  inline. NULL while the row reflects the AI score only. */
    humanScoreReason: text("human_score_reason"),
    effectiveScore: integer("effective_score").notNull(),
    aiReasoning: text("ai_reasoning").notNull().default(""),
    highlightedMessageIds: text("highlighted_message_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  (t) => [
    index("evaluation_category_scores_evaluation_id_idx").on(t.evaluationId),
    index("evaluation_category_scores_category_id_idx").on(t.categoryId),
  ],
);

/** Coaching note generated alongside each evaluation. Bullet caps (3 each)
 *  are enforced at the provider layer per PRD D-3; the JSON columns stay
 *  loose. `example_message_ids` references the messages that illustrate
 *  the bullet points. `generated_by` mirrors `evaluations.scored_by`. */
export const coachingNotes = sqliteTable(
  "coaching_notes",
  {
    id: text("id").primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    strengthPoints: text("strength_points", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    growthPoints: text("growth_points", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    exampleMessageIds: text("example_message_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    generatedBy: text("generated_by").notNull(),
    generatedAt: integer("generated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("coaching_notes_evaluation_id_idx").on(t.evaluationId),
  ],
);

/** Reaction-target polymorphism. A reaction may attach to a `ticket_message`
 *  (the customer ↔ agent transcript surfaced in the QA evaluation), a
 *  `qa_comment` (a coaching note that one team member leaves on the
 *  evaluation), or a `ticket_event` (a status / assignee / tag flip on the
 *  activity stream). All three live on the same evaluation surface, so a
 *  single polymorphic table keeps the read path (list reactions for an
 *  evaluation → 1 query) simple. If the join shape ever gets gnarly we can
 *  split per-target without changing the column names that callers know. */
export type QaReactionTargetType = "message" | "comment" | "activity";

/** Coaching comments on a QA evaluation surface. A comment can:
 *  - anchor to a specific `ticket_messages.id` (e.g. "great empathy here")
 *  - anchor to a specific `ticket_events.id` (e.g. flag a status flip — UI
 *    wiring lands post-V1; column exists from day 1 so the seam is clean)
 *  - be unanchored (`messageId` and `activityId` both null) → a top-level
 *    comment on the evaluation overall
 *  - reply to another comment via `parentCommentId` (threading supported
 *    by the data model; V1 UI may render a flat list).
 *
 *  V1 visibility model: every comment is visible to everyone on the
 *  evaluation surface. NO `visibility` column. A post-V1 task may introduce
 *  one; until then the absence is intentional.
 *
 *  V1 body model: plain text. No @mention parsing today — that lands later
 *  as a layered `body_markup` column or similar so the migration is
 *  additive, not a rewrite. */
export const qaComments = sqliteTable(
  "qa_comments",
  {
    id: text("id").primaryKey(),
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    /** Null = comment on the evaluation overall, not anchored to a message. */
    messageId: text("message_id").references(() => ticketMessages.id, {
      onDelete: "set null",
    }),
    /** Null = not anchored to an activity event. Post-V1 UI surface. */
    activityId: text("activity_id").references(() => ticketEvents.id, {
      onDelete: "set null",
    }),
    /** Self-referential FK for threading. Null = top-level. Cascade so a
     *  deleted parent takes its replies with it. */
    parentCommentId: text("parent_comment_id").references(
      (): import("drizzle-orm/sqlite-core").AnySQLiteColumn => qaComments.id,
      { onDelete: "cascade" },
    ),
    authorId: text("author_id")
      .notNull()
      .references(() => teamMembers.id),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("qa_comments_evaluation_id_idx").on(t.evaluationId),
    index("qa_comments_message_id_idx").on(t.messageId),
    index("qa_comments_activity_id_idx").on(t.activityId),
    index("qa_comments_parent_comment_id_idx").on(t.parentCommentId),
    index("qa_comments_author_id_idx").on(t.authorId),
    index("qa_comments_created_at_idx").on(t.createdAt),
  ],
);

/** Emoji reactions on the QA evaluation surface. Polymorphic via
 *  (`targetType`, `targetId`) — see `QaReactionTargetType`. The curated
 *  6-emoji set is enforced at the provider layer, not at the DB, so the
 *  schema stays neutral if product ever expands the set.
 *
 *  Unique on (targetType, targetId, authorId, emoji) — one reaction-emoji
 *  per user per target. Toggling a reaction = delete + insert. */
export const qaReactions = sqliteTable(
  "qa_reactions",
  {
    id: text("id").primaryKey(),
    targetType: text("target_type", {
      enum: ["message", "comment", "activity"],
    })
      .notNull()
      .$type<QaReactionTargetType>(),
    /** Points at `ticket_messages.id`, `qa_comments.id`, or
     *  `ticket_events.id` depending on `targetType`. No FK — SQLite can't
     *  enforce polymorphic references and the provider validates target
     *  existence at write time. */
    targetId: text("target_id").notNull(),
    /** Scope reactions to a single evaluation surface so we can list every
     *  reaction for one evaluation in 1 query (no per-target joins). */
    evaluationId: text("evaluation_id")
      .notNull()
      .references(() => evaluations.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => teamMembers.id),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("qa_reactions_evaluation_id_idx").on(t.evaluationId),
    index("qa_reactions_target_idx").on(t.targetType, t.targetId),
    index("qa_reactions_author_id_idx").on(t.authorId),
    uniqueIndex("qa_reactions_unique_per_user_emoji_idx").on(
      t.targetType,
      t.targetId,
      t.authorId,
      t.emoji,
    ),
  ],
);

/** Server-side storage for saved views. Carries `workspace_id` from day one so
 *  the eventual auth cutover is a value-source change, not a schema migration.
 *  Today the column is always the demo constant (see src/lib/workspace.ts).
 *  `position` is reserved for SVP-48 drag-to-reorder; new rows append at
 *  MAX(position)+1. The "All ENTITY" view is hardcoded in the provider and
 *  never written here. */
export const savedViews = sqliteTable(
  "saved_views",
  {
    /** Slug identifier, unique per (workspace_id, entity). Stays human-
     *  readable so it can appear in `?v=<id>` URLs. Cross-entity collisions
     *  are expected (`tickets.detractors` vs `responses.detractors`), which
     *  is why the primary key is composite. */
    id: text("id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    entity: text("entity", {
      enum: ["tickets", "customers", "responses", "team-members", "coaching"],
    }).notNull(),
    name: text("name").notNull(),
    /** JSON-encoded ViewState (sorts, group, filters, layout, columns).
     *  Cast to the ViewState type at the query layer; kept loose here so
     *  schema stays free of feature-layer imports. */
    state: text("state", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    position: integer("position").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.entity, t.id] }),
  ],
);

export type SavedViewRow = typeof savedViews.$inferSelect;
export type NewSavedViewRow = typeof savedViews.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type Response = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;
export type Survey = typeof surveys.$inferSelect;
export type NewSurvey = typeof surveys.$inferInsert;
export type TeamMemberGroup = typeof teamMemberGroups.$inferSelect;
export type NewTeamMemberGroup = typeof teamMemberGroups.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type NewTicketEvent = typeof ticketEvents.$inferInsert;
export type Scorecard = typeof scorecards.$inferSelect;
export type NewScorecard = typeof scorecards.$inferInsert;
export type ScorecardCategory = typeof scorecardCategories.$inferSelect;
export type NewScorecardCategory = typeof scorecardCategories.$inferInsert;
export type ScorecardCriterion = typeof scorecardCriteria.$inferSelect;
export type NewScorecardCriterion = typeof scorecardCriteria.$inferInsert;
export type ScorecardVersion = typeof scorecardVersions.$inferSelect;
export type NewScorecardVersion = typeof scorecardVersions.$inferInsert;
export type ScorecardVersionCategory =
  typeof scorecardVersionCategories.$inferSelect;
export type NewScorecardVersionCategory =
  typeof scorecardVersionCategories.$inferInsert;
export type ScorecardVersionCriterion =
  typeof scorecardVersionCriteria.$inferSelect;
export type NewScorecardVersionCriterion =
  typeof scorecardVersionCriteria.$inferInsert;
export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;
export type EvaluationCategoryScore = typeof evaluationCategoryScores.$inferSelect;
export type NewEvaluationCategoryScore =
  typeof evaluationCategoryScores.$inferInsert;
export type CoachingNote = typeof coachingNotes.$inferSelect;
export type NewCoachingNote = typeof coachingNotes.$inferInsert;
export type QaComment = typeof qaComments.$inferSelect;
export type NewQaComment = typeof qaComments.$inferInsert;
export type QaReaction = typeof qaReactions.$inferSelect;
export type NewQaReaction = typeof qaReactions.$inferInsert;
