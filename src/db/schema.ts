import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export type CustomerTier = "starter" | "pro" | "enterprise";
export type TicketStatus = "open" | "pending" | "solved" | "closed";
export type Channel = "email" | "chat" | "phone" | "social";
export type Helpdesk = "zendesk" | "gladly" | "gorgias" | "intercom";
export type SurveyType = "csat" | "nps" | "ces";
export type SurveyNotSentReason =
  | "tag_excluded"
  | "suppression_list"
  | "channel_disabled"
  | "automation_close";
export type QaEvaluationType = "predictive" | "final" | "re_evaluation";

export type ConversationMessage = {
  author: string;
  role: "customer" | "agent";
  time: string;
  body: string;
};

export type SurveyAnswer =
  | {
      type: "rating";
      question: string;
      value: number;
      scale: number;
    }
  | {
      type: "multi-choice";
      question: string;
      options: string[];
      value: string;
    }
  | {
      type: "multi-select";
      question: string;
      options: string[];
      value: string[];
    }
  | {
      type: "comment";
      question: string;
      value: string;
    };

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company").notNull(),
    tier: text("tier", { enum: ["starter", "pro", "enterprise"] })
      .notNull()
      .$type<CustomerTier>(),
    helpdeskExternalId: text("helpdesk_external_id"),
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
  ],
);

export const teamMembers = sqliteTable(
  "team_members",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    team: text("team").notNull(),
    helpdeskExternalId: text("helpdesk_external_id"),
    avatarColor: text("avatar_color").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("team_members_team_idx").on(t.team)],
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
    conversation: text("conversation", { mode: "json" })
      .$type<ConversationMessage[]>()
      .notNull()
      .default(sql`'[]'`),
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
    surveyType: text("survey_type", { enum: ["csat", "nps", "ces"] })
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
  },
  (t) => [
    index("responses_ticket_id_idx").on(t.ticketId),
    index("responses_customer_id_idx").on(t.customerId),
    index("responses_team_member_id_idx").on(t.teamMemberId),
    index("responses_rating_idx").on(t.rating),
    index("responses_responded_at_idx").on(t.respondedAt),
  ],
);

export const qaEvaluations = sqliteTable(
  "qa_evaluations",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id),
    teamMemberId: text("team_member_id")
      .notNull()
      .references(() => teamMembers.id),
    score: integer("score").notNull(),
    modelUsed: text("model_used").notNull(),
    evaluatedAt: integer("evaluated_at", { mode: "timestamp_ms" }).notNull(),
    evaluationType: text("evaluation_type", {
      enum: ["predictive", "final", "re_evaluation"],
    })
      .notNull()
      .$type<QaEvaluationType>(),
    rubricVersion: text("rubric_version").notNull(),
    breakdown: text("breakdown", { mode: "json" })
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [
    index("qa_evaluations_ticket_id_idx").on(t.ticketId),
    index("qa_evaluations_team_member_id_idx").on(t.teamMemberId),
    index("qa_evaluations_evaluated_at_idx").on(t.evaluatedAt),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type Response = typeof responses.$inferSelect;
export type NewResponse = typeof responses.$inferInsert;
export type QaEvaluation = typeof qaEvaluations.$inferSelect;
export type NewQaEvaluation = typeof qaEvaluations.$inferInsert;
