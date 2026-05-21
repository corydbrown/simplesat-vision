import type { Aggregation, BaseEntity, DateBucket } from "./types";
import type { DrawerEntity } from "@/components/shared/global-drawer";
import {
  CUSTOMER_CUSTOM_FIELDS,
  TEAM_MEMBER_CUSTOM_FIELDS,
  type CustomFieldDef,
} from "@/lib/properties/custom-fields";

export type FieldDataType = "string" | "number" | "date" | "enum" | "relation";

export type FieldJoin = {
  /** key for deduplicating multiple references to the same join */
  alias: string;
  /** raw SQL fragment producing the join clause */
  sql: string;
};

export type PivotField = {
  id: string;
  label: string;
  /** Entity the field semantically belongs to (used for rail grouping).
   *  e.g. "Ticket", "Customer", "Team member", "Assignee", "Response", "Activity". */
  group: string;
  dataType: FieldDataType;
  aggregations: Aggregation[];
  filterOps: readonly string[];
  bucketable?: boolean;
  enumValues?: string[];
  groupExpr: string;
  labelExpr?: string;
  valueExpr?: string;
  joins?: FieldJoin[];
  /** when true, field can only appear in Values (not Rows/Columns). */
  valueOnly?: boolean;
  /** Set when groupExpr returns an entity id (and labelExpr returns its
   *  display name). Tells the pivot renderer to render the cell as the
   *  matching entity pill — hover popover + click-to-drawer. */
  entity?: DrawerEntity;
};

const COUNT_ONLY: Aggregation[] = ["count"];
const NUMERIC_AGGS: Aggregation[] = ["count", "sum", "avg", "min", "max"];
// Metric-typed values are pre-aggregated via `valueExpr`; the aggregation the
// user picks is ignored at compile time. We still need at least one entry so
// the UI's value-picker accepts them — "avg" reads naturally for a CSAT score.
const METRIC_VALUE_AGGS: Aggregation[] = ["avg"];

const STRING_OPS = ["eq", "neq", "isnull", "notnull", "in", "not-in"] as const;
const NUMERIC_OPS = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "isnull",
  "notnull",
] as const;
const DATE_OPS = ["lt", "lte", "gt", "gte", "isnull", "notnull"] as const;
const ENUM_OPS = ["eq", "neq", "in", "not-in", "isnull", "notnull"] as const;
const RELATION_OPS = ["eq", "neq", "isnull", "notnull"] as const;

const TICKET_STATUS = ["open", "pending", "solved", "closed"];
const CHANNEL = ["email", "chat", "phone", "social"];
const HELPDESK = ["zendesk", "gladly", "gorgias", "intercom"];
const TIER = ["insider", "gold", "elite"];
const SURVEY_TYPE = ["csat", "nps", "ces", "five_star", "custom"];
const SURVEY_METRIC = ["csat", "nps", "ces", "five_star", "custom"];
const SURVEY_CHANNEL = [
  "intercom",
  "zendesk",
  "oneoff_email",
  "web_embed",
  "generic_embed",
];
const SURVEY_STATUS = ["active", "archived", "draft"];
const SURVEY_NOT_SENT = [
  "tag_excluded",
  "suppression_list",
  "channel_disabled",
  "automation_close",
];

const JOIN_CUSTOMERS = (baseFk: string): FieldJoin => ({
  alias: "customers",
  sql: `LEFT JOIN customers c ON c.id = ${baseFk}`,
});

const JOIN_TEAM_MEMBERS = (baseFk: string): FieldJoin => ({
  alias: "team_members",
  sql: `LEFT JOIN team_members tm ON tm.id = ${baseFk}`,
});

const JOIN_TICKETS = (baseFk: string): FieldJoin => ({
  alias: "tickets",
  sql: `LEFT JOIN tickets t ON t.id = ${baseFk}`,
});

const JOIN_RESPONSES_BY_TICKET: FieldJoin = {
  alias: "responses_by_ticket",
  sql: "LEFT JOIN responses r ON r.ticket_id = tickets.id",
};

const JOIN_SURVEYS: FieldJoin = {
  alias: "surveys",
  sql: "LEFT JOIN surveys s ON s.id = responses.survey_id",
};

// ---------------------------------------------------------------------------
// Custom-property pivot fields. Each CustomFieldDef becomes a filterable +
// (where appropriate) groupable pivot field. The SQL extracts via
// json_extract(custom_properties, '$.id'). Importance >= 3 surfaces here —
// lower-importance fields stay out of the rail to keep it manageable. They're
// still accessible via the table column picker.
// ---------------------------------------------------------------------------

function customFieldPivotField(
  table: "customers" | "team_members",
  def: CustomFieldDef,
): PivotField {
  const expr = `json_extract(${table}.custom_properties, '$.${def.id}')`;
  const baseId = `cf_${def.id}`;
  switch (def.dataType) {
    case "number":
      return {
        id: baseId,
        label: def.label,
        group: def.group,
        dataType: "number",
        aggregations: NUMERIC_AGGS,
        filterOps: NUMERIC_OPS,
        groupExpr: expr,
      };
    case "date":
      return {
        id: baseId,
        label: def.label,
        group: def.group,
        dataType: "date",
        aggregations: COUNT_ONLY,
        filterOps: DATE_OPS,
        bucketable: true,
        // Stored as ISO strings, so compare as text. Bucketing works against
        // strftime once we convert to epoch — punt on that for now.
        groupExpr: expr,
      };
    case "boolean":
      return {
        id: baseId,
        label: def.label,
        group: def.group,
        dataType: "enum",
        aggregations: COUNT_ONLY,
        filterOps: ENUM_OPS,
        enumValues: ["true", "false"],
        groupExpr: `CASE WHEN ${expr} = 1 OR ${expr} = 'true' THEN 'true' ELSE 'false' END`,
      };
    case "enum":
      return {
        id: baseId,
        label: def.label,
        group: def.group,
        dataType: "enum",
        aggregations: COUNT_ONLY,
        filterOps: ENUM_OPS,
        enumValues: def.enumValues ? [...def.enumValues] : undefined,
        groupExpr: expr,
      };
    default:
      return {
        id: baseId,
        label: def.label,
        group: def.group,
        dataType: "string",
        aggregations: COUNT_ONLY,
        filterOps: STRING_OPS,
        groupExpr: expr,
      };
  }
}

const CUSTOMER_CUSTOM_PIVOT_FIELDS: PivotField[] = CUSTOMER_CUSTOM_FIELDS
  .filter((f) => f.importance >= 3)
  .map((f) => customFieldPivotField("customers", f));

const TEAM_MEMBER_CUSTOM_PIVOT_FIELDS: PivotField[] = TEAM_MEMBER_CUSTOM_FIELDS
  .filter((f) => f.importance >= 3)
  .map((f) => customFieldPivotField("team_members", f));

// ---------------------------------------------------------------------------
// Metric-typed values.
//
// CSAT/CES/NPS each have distinct math and aren't comparable as raw averages,
// so we expose them as separate value definitions. Each metric is computed
// from `responses.rating` filtered by `responses.survey_type`. The expression
// is built so it works both directly on the responses table (response base)
// and inside a correlated subquery (ticket/customer/team_member bases).
//
// Scale note: a single survey type can have multiple scales over time (e.g.
// CSAT 2-scale vs 5-scale). For this prototype the seed uses scale=5 for
// CSAT/CES and scale=11 for NPS, so AVG/percentage math is coherent. A future
// pass should normalize scores when surveys move between scales.
// ---------------------------------------------------------------------------

type MetricKind =
  | "csat_avg"
  | "ces_avg"
  | "ces_positive_pct"
  | "nps_score"
  | "five_star_avg";

/** Returns the raw SQL formula for a metric, using the provided table
 *  qualifier (e.g. "responses" or "" inside a correlated subquery). */
function metricFormula(kind: MetricKind, t: string): string {
  const p = t ? `${t}.` : "";
  switch (kind) {
    case "csat_avg":
      return `AVG(CASE WHEN ${p}survey_type = 'csat' THEN ${p}rating END)`;
    case "ces_avg":
      return `AVG(CASE WHEN ${p}survey_type = 'ces' THEN ${p}rating END)`;
    case "ces_positive_pct":
      // % of CES responses with rating >= 4 (top-2-box on a 5-scale).
      return (
        `100.0 * SUM(CASE WHEN ${p}survey_type = 'ces' AND ${p}rating >= 4 THEN 1 ELSE 0 END) ` +
        `/ NULLIF(SUM(CASE WHEN ${p}survey_type = 'ces' THEN 1 ELSE 0 END), 0)`
      );
    case "nps_score":
      // NPS = % promoters (9-10) - % detractors (0-6), expressed as a score.
      return (
        `100.0 * (` +
        `SUM(CASE WHEN ${p}survey_type = 'nps' AND ${p}rating >= 9 THEN 1 ELSE 0 END) ` +
        `- SUM(CASE WHEN ${p}survey_type = 'nps' AND ${p}rating <= 6 THEN 1 ELSE 0 END)` +
        `) / NULLIF(SUM(CASE WHEN ${p}survey_type = 'nps' THEN 1 ELSE 0 END), 0)`
      );
    case "five_star_avg":
      return `AVG(CASE WHEN ${p}survey_type = 'five_star' THEN ${p}rating END)`;
  }
}

const METRIC_LABEL: Record<MetricKind, string> = {
  csat_avg: "CSAT (avg)",
  ces_avg: "CES (avg)",
  ces_positive_pct: "CES (% positive)",
  nps_score: "NPS score",
  five_star_avg: "5-Star (avg)",
};

const METRIC_KINDS: MetricKind[] = [
  "csat_avg",
  "ces_avg",
  "ces_positive_pct",
  "nps_score",
  "five_star_avg",
];

/** Metric fields computed directly on the responses table. */
function directMetricFields(): PivotField[] {
  return METRIC_KINDS.map((kind) => ({
    id: kind,
    label: METRIC_LABEL[kind],
    group: "Metrics",
    dataType: "number" as const,
    aggregations: METRIC_VALUE_AGGS,
    filterOps: [] as const,
    groupExpr: metricFormula(kind, "responses"),
    valueExpr: metricFormula(kind, "responses"),
    valueOnly: true,
  }));
}

/** Metric fields exposed on a joined base (ticket / customer / team_member)
 *  via a correlated subquery against responses. `joinClause` is the WHERE
 *  fragment, e.g. "responses.ticket_id = tickets.id". */
function correlatedMetricFields(joinClause: string): PivotField[] {
  return METRIC_KINDS.map((kind) => {
    const inner = metricFormula(kind, "");
    const expr = `(SELECT ${inner} FROM responses WHERE ${joinClause})`;
    return {
      id: kind,
      label: METRIC_LABEL[kind],
      group: "Metrics",
      dataType: "number" as const,
      aggregations: METRIC_VALUE_AGGS,
      // Correlated subqueries resolve per row, so they're filterable in WHERE
      // ("customers with CSAT < 3", "team members with NPS >= 50").
      filterOps: NUMERIC_OPS,
      groupExpr: expr,
      valueExpr: expr,
      valueOnly: true,
    };
  });
}

/**
 * Registry of pivotable fields per base entity. `group` names the source
 * entity (e.g. "Ticket", "Customer", "Assignee") so the rail can render
 * properties grouped by their origin. propertyId matches the visual
 * Property<T>.id in src/lib/properties/<entity>.tsx.
 */
export const PIVOT_FIELDS: Record<BaseEntity, PivotField[]> = {
  ticket: [
    // Ticket's own properties
    {
      id: "status",
      label: "Status",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: TICKET_STATUS,
      groupExpr: "tickets.status",
    },
    {
      id: "priority",
      label: "Priority",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["low", "normal", "high", "urgent"],
      groupExpr: "tickets.priority",
    },
    {
      id: "channel",
      label: "Channel",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: CHANNEL,
      groupExpr: "tickets.channel",
    },
    {
      id: "helpdesk",
      label: "Helpdesk",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: HELPDESK,
      groupExpr: "tickets.helpdesk",
    },
    {
      id: "survey_eligible",
      label: "Survey eligible",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["yes", "no"],
      groupExpr:
        "CASE WHEN tickets.survey_eligible = 1 THEN 'yes' ELSE 'no' END",
    },
    {
      id: "survey_sent",
      label: "Survey sent",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["yes", "no"],
      groupExpr:
        "CASE WHEN tickets.survey_sent_at IS NOT NULL THEN 'yes' ELSE 'no' END",
    },
    {
      id: "survey_not_sent_reason",
      label: "Survey not sent",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: SURVEY_NOT_SENT,
      groupExpr: "tickets.survey_not_sent_reason",
    },
    {
      id: "message_count",
      label: "Message count",
      group: "Ticket",
      dataType: "number",
      aggregations: NUMERIC_AGGS,
      filterOps: NUMERIC_OPS,
      groupExpr: "tickets.message_count",
    },
    {
      id: "agent_message_count",
      label: "Team member messages",
      group: "Ticket",
      dataType: "number",
      aggregations: NUMERIC_AGGS,
      filterOps: NUMERIC_OPS,
      groupExpr: "tickets.agent_message_count",
    },
    {
      id: "created_at",
      label: "Created",
      group: "Ticket",
      dataType: "date",
      aggregations: COUNT_ONLY,
      filterOps: DATE_OPS,
      bucketable: true,
      groupExpr: "tickets.created_at",
    },
    {
      id: "first_response_at",
      label: "First response",
      group: "Ticket",
      dataType: "date",
      aggregations: COUNT_ONLY,
      filterOps: DATE_OPS,
      bucketable: true,
      groupExpr: "tickets.first_response_at",
    },
    {
      id: "solved_at",
      label: "Solved",
      group: "Ticket",
      dataType: "date",
      aggregations: COUNT_ONLY,
      filterOps: DATE_OPS,
      bucketable: true,
      groupExpr: "tickets.solved_at",
    },
    {
      id: "closed_at",
      label: "Closed",
      group: "Ticket",
      dataType: "date",
      aggregations: COUNT_ONLY,
      filterOps: DATE_OPS,
      bucketable: true,
      groupExpr: "tickets.closed_at",
    },
    {
      id: "resolution_minutes",
      label: "Resolution (min)",
      group: "Ticket",
      dataType: "number",
      aggregations: NUMERIC_AGGS,
      filterOps: NUMERIC_OPS,
      groupExpr:
        "CAST((tickets.solved_at - tickets.created_at) / 60000 AS INTEGER)",
    },
    // Customer (joined)
    {
      id: "customer",
      label: "Customer",
      group: "Customer",
      dataType: "relation",
      aggregations: COUNT_ONLY,
      filterOps: RELATION_OPS,
      groupExpr: "tickets.customer_id",
      labelExpr: "c.name",
      joins: [JOIN_CUSTOMERS("tickets.customer_id")],
      entity: "customer",
    },
    {
      id: "company",
      label: "Company",
      group: "Customer",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "c.company",
      joins: [JOIN_CUSTOMERS("tickets.customer_id")],
    },
    {
      id: "tier",
      label: "Tier",
      group: "Customer",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: TIER,
      groupExpr: "c.tier",
      joins: [JOIN_CUSTOMERS("tickets.customer_id")],
    },
    // Assignee (joined team_members) — separate label per user spec
    {
      id: "assignee",
      label: "Assignee",
      group: "Assignee",
      dataType: "relation",
      aggregations: COUNT_ONLY,
      filterOps: RELATION_OPS,
      groupExpr: "tickets.assigned_team_member_id",
      labelExpr: "tm.name",
      joins: [JOIN_TEAM_MEMBERS("tickets.assigned_team_member_id")],
      entity: "team-member",
    },
    {
      id: "team",
      label: "Team",
      group: "Assignee",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "tm.team",
      joins: [JOIN_TEAM_MEMBERS("tickets.assigned_team_member_id")],
    },
    // Response (joined responses) — raw rating + scale for filtering.
    {
      id: "response_rating",
      label: "Rating",
      group: "Response",
      dataType: "number",
      aggregations: NUMERIC_AGGS,
      filterOps: NUMERIC_OPS,
      groupExpr: "r.rating",
      joins: [JOIN_RESPONSES_BY_TICKET],
    },
    // Metric-typed values (CSAT/CES/NPS) computed per ticket via correlated
    // subqueries against responses. valueOnly — these only make sense aggregated.
    ...correlatedMetricFields("responses.ticket_id = tickets.id"),
  ],

  customer: [
    {
      id: "tier",
      label: "Tier",
      group: "Customer",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: TIER,
      groupExpr: "customers.tier",
    },
    {
      id: "company",
      label: "Company",
      group: "Customer",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "customers.company",
    },
    {
      id: "created_at",
      label: "Created",
      group: "Customer",
      dataType: "date",
      aggregations: COUNT_ONLY,
      filterOps: DATE_OPS,
      bucketable: true,
      groupExpr: "customers.created_at",
    },
    {
      id: "total_tickets",
      label: "Total tickets",
      group: "Activity",
      dataType: "number",
      aggregations: ["sum", "avg", "min", "max"],
      filterOps: NUMERIC_OPS,
      groupExpr:
        "(SELECT count(*) FROM tickets WHERE tickets.customer_id = customers.id)",
      valueOnly: true,
    },
    {
      id: "total_responses",
      label: "Total responses",
      group: "Activity",
      dataType: "number",
      aggregations: ["sum", "avg", "min", "max"],
      filterOps: NUMERIC_OPS,
      groupExpr:
        "(SELECT count(*) FROM responses WHERE responses.customer_id = customers.id)",
      valueOnly: true,
    },
    {
      id: "avg_rating",
      label: "Avg rating",
      group: "Activity",
      dataType: "number",
      aggregations: ["avg", "min", "max"],
      filterOps: NUMERIC_OPS,
      groupExpr:
        "(SELECT avg(rating) FROM responses WHERE responses.customer_id = customers.id)",
      valueOnly: true,
    },
    // Metric-typed values per customer.
    ...correlatedMetricFields("responses.customer_id = customers.id"),
    // Synced-from-external-system custom properties (importance >= 3).
    ...CUSTOMER_CUSTOM_PIVOT_FIELDS,
  ],

  team_member: [
    {
      id: "team",
      label: "Team",
      group: "Team member",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["Front line", "Senior", "Specialist"],
      groupExpr: "team_members.team",
    },
    {
      id: "role",
      label: "Role",
      group: "Team member",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "team_members.role",
    },
    {
      id: "region",
      label: "Region",
      group: "Team member",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["North America", "EMEA", "APAC", "LATAM"],
      groupExpr: "team_members.region",
    },
    {
      id: "language",
      label: "Language",
      group: "Team member",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["en", "es", "fr", "de", "pt", "ja"],
      groupExpr: "team_members.language",
    },
    {
      id: "group",
      label: "Group",
      group: "Team member",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: [
        "Customer Care",
        "Returns & Exchanges",
        "Online Orders",
        "Stores & BOPIS",
        "Loyalty & VIP",
        "Escalations",
      ],
      groupExpr: "tmg.name",
      labelExpr: "tmg.name",
      joins: [
        {
          alias: "team_member_groups",
          sql: "LEFT JOIN team_member_groups tmg ON tmg.id = team_members.group_id",
        },
      ],
    },
    {
      id: "total_tickets",
      label: "Total tickets",
      group: "Activity",
      dataType: "number",
      aggregations: ["sum", "avg", "min", "max"],
      filterOps: NUMERIC_OPS,
      groupExpr:
        "(SELECT count(*) FROM tickets WHERE tickets.assigned_team_member_id = team_members.id)",
      valueOnly: true,
    },
    {
      id: "total_responses",
      label: "Total responses",
      group: "Activity",
      dataType: "number",
      aggregations: ["sum", "avg", "min", "max"],
      filterOps: NUMERIC_OPS,
      groupExpr:
        "(SELECT count(*) FROM responses WHERE responses.team_member_id = team_members.id)",
      valueOnly: true,
    },
    {
      id: "avg_rating",
      label: "Avg rating",
      group: "Activity",
      dataType: "number",
      aggregations: ["avg", "min", "max"],
      filterOps: NUMERIC_OPS,
      groupExpr:
        "(SELECT avg(rating) FROM responses WHERE responses.team_member_id = team_members.id)",
      valueOnly: true,
    },
    // Metric-typed values per team member.
    ...correlatedMetricFields("responses.team_member_id = team_members.id"),
    // Synced-from-external-system custom properties.
    ...TEAM_MEMBER_CUSTOM_PIVOT_FIELDS,
  ],

  response: [
    // Response's own properties
    {
      id: "rating",
      label: "Rating",
      group: "Response",
      dataType: "number",
      aggregations: NUMERIC_AGGS,
      filterOps: NUMERIC_OPS,
      groupExpr: "responses.rating",
    },
    {
      id: "scale",
      label: "Scale",
      group: "Response",
      dataType: "number",
      aggregations: NUMERIC_AGGS,
      filterOps: NUMERIC_OPS,
      groupExpr: "responses.scale",
    },
    {
      id: "comment_present",
      label: "Has comment",
      group: "Response",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["yes", "no"],
      groupExpr:
        "CASE WHEN responses.comment IS NOT NULL AND responses.comment <> '' THEN 'yes' ELSE 'no' END",
    },
    {
      id: "survey_type",
      label: "Survey type",
      group: "Response",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: SURVEY_TYPE,
      groupExpr: "responses.survey_type",
    },
    {
      id: "responded_at",
      label: "Responded",
      group: "Response",
      dataType: "date",
      aggregations: COUNT_ONLY,
      filterOps: DATE_OPS,
      bucketable: true,
      groupExpr: "responses.responded_at",
    },
    // Survey (joined). survey_type stays on Response above because it's the
    // denormalized metric — fast indexed filters. Survey-name + channel come
    // from the joined surveys row.
    {
      id: "survey",
      label: "Survey",
      group: "Survey",
      dataType: "relation",
      aggregations: COUNT_ONLY,
      filterOps: RELATION_OPS,
      groupExpr: "responses.survey_id",
      labelExpr: "s.name",
      joins: [JOIN_SURVEYS],
      entity: "survey",
    },
    {
      id: "survey_name",
      label: "Survey name",
      group: "Survey",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "s.name",
      joins: [JOIN_SURVEYS],
    },
    {
      id: "survey_channel",
      label: "Survey channel",
      group: "Survey",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: SURVEY_CHANNEL,
      groupExpr: "s.channel",
      joins: [JOIN_SURVEYS],
    },
    {
      id: "survey_status",
      label: "Survey status",
      group: "Survey",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: SURVEY_STATUS,
      groupExpr: "s.status",
      joins: [JOIN_SURVEYS],
    },
    {
      id: "survey_metric",
      label: "Survey metric",
      group: "Survey",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: SURVEY_METRIC,
      groupExpr: "s.metric",
      joins: [JOIN_SURVEYS],
    },
    // Customer (joined)
    {
      id: "customer",
      label: "Customer",
      group: "Customer",
      dataType: "relation",
      aggregations: COUNT_ONLY,
      filterOps: RELATION_OPS,
      groupExpr: "responses.customer_id",
      labelExpr: "c.name",
      joins: [JOIN_CUSTOMERS("responses.customer_id")],
      entity: "customer",
    },
    {
      id: "company",
      label: "Company",
      group: "Customer",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "c.company",
      joins: [JOIN_CUSTOMERS("responses.customer_id")],
    },
    {
      id: "tier",
      label: "Tier",
      group: "Customer",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: TIER,
      groupExpr: "c.tier",
      joins: [JOIN_CUSTOMERS("responses.customer_id")],
    },
    // Team member (joined)
    {
      id: "team_member",
      label: "Team member",
      group: "Team member",
      dataType: "relation",
      aggregations: COUNT_ONLY,
      filterOps: RELATION_OPS,
      groupExpr: "responses.team_member_id",
      labelExpr: "tm.name",
      joins: [JOIN_TEAM_MEMBERS("responses.team_member_id")],
      entity: "team-member",
    },
    {
      id: "team",
      label: "Team",
      group: "Team member",
      dataType: "string",
      aggregations: COUNT_ONLY,
      filterOps: STRING_OPS,
      groupExpr: "tm.team",
      joins: [JOIN_TEAM_MEMBERS("responses.team_member_id")],
    },
    // Ticket (joined)
    {
      id: "ticket_channel",
      label: "Channel",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: CHANNEL,
      groupExpr: "t.channel",
      joins: [JOIN_TICKETS("responses.ticket_id")],
    },
    {
      id: "ticket_priority",
      label: "Priority",
      group: "Ticket",
      dataType: "enum",
      aggregations: COUNT_ONLY,
      filterOps: ENUM_OPS,
      enumValues: ["low", "normal", "high", "urgent"],
      groupExpr: "t.priority",
      joins: [JOIN_TICKETS("responses.ticket_id")],
    },
    // Metric-typed values computed directly on responses. valueOnly — these
    // are pre-aggregated formulas, so they can only appear in Values.
    ...directMetricFields(),
  ],
};

/**
 * Order of entity groups for rendering in the rail. Per-base because the
 * primary entity comes first (Response for responses base, Ticket for
 * tickets base, etc.).
 */
export const GROUP_ORDER: Record<BaseEntity, string[]> = {
  response: ["Metrics", "Response", "Survey", "Customer", "Team member", "Ticket"],
  customer: [
    "Customer",
    "Activity",
    "Metrics",
    "Profile",
    "Beauty profile",
    "Loyalty",
    "Engagement",
    "Purchase behavior",
    "B2B",
  ],
  team_member: [
    "Team member",
    "Activity",
    "Metrics",
    "Profile",
    "Schedule",
    "Skills",
    "Performance",
  ],
  ticket: ["Ticket", "Customer", "Assignee", "Response", "Metrics"],
};

export const BASE_TABLE: Record<BaseEntity, string> = {
  ticket: "tickets",
  customer: "customers",
  team_member: "team_members",
  response: "responses",
};

export function findField(
  base: BaseEntity,
  propertyId: string,
): PivotField | undefined {
  return PIVOT_FIELDS[base].find((f) => f.id === propertyId);
}

export function bucketSql(column: string, bucket: DateBucket): string {
  // SQLite timestamps are ms (integer); strftime needs seconds + 'unixepoch'.
  const seconds = `${column} / 1000`;
  switch (bucket) {
    case "day":
      return `strftime('%Y-%m-%d', ${seconds}, 'unixepoch')`;
    case "week":
      return `strftime('%Y-W%W', ${seconds}, 'unixepoch')`;
    case "month":
      return `strftime('%Y-%m', ${seconds}, 'unixepoch')`;
    case "quarter":
      return `strftime('%Y', ${seconds}, 'unixepoch') || '-Q' || ((cast(strftime('%m', ${seconds}, 'unixepoch') as integer) - 1) / 3 + 1)`;
    case "year":
      return `strftime('%Y', ${seconds}, 'unixepoch')`;
  }
}
