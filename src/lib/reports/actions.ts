"use server";

import Anthropic from "@anthropic-ai/sdk";
import { runReport, type ReportResult } from "@/db/queries/reports";
import {
  defaultConfig,
  MAX_COLUMNS,
  MAX_ROWS,
  MAX_VALUES,
  type Aggregation,
  type AxisField,
  type BaseEntity,
  type DateBucket,
  type FilterDef,
  type FilterOp,
  type ReportConfig,
  type ValueDef,
} from "./types";
import {
  getCustomerCustomFields,
  getTeamMemberCustomFields,
} from "@/lib/properties/custom-fields-provider";
import { requireWorkspace } from "@/lib/workspace";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";
import {
  buildPivotFields,
  findField,
  type PivotField,
} from "./pivot-fields";

export async function runReportAction(
  config: ReportConfig,
): Promise<ReportResult | null> {
  return runReport(config);
}

const AGGREGATIONS: Aggregation[] = ["count", "sum", "avg", "min", "max"];
const BUCKETS: DateBucket[] = ["day", "week", "month", "quarter", "year"];
const FILTER_OPS: FilterOp[] = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "between",
  "in",
  "not-in",
  "contains",
  "starts-with",
  "relative",
  "isnull",
  "notnull",
];

const BUILD_REPORT_TOOL: Anthropic.Tool = {
  name: "build_report",
  description:
    "Emit a ReportConfig for the pivot builder. Always call this tool; never reply with text.",
  input_schema: {
    type: "object",
    properties: {
      rows: {
        type: "array",
        maxItems: MAX_ROWS,
        items: {
          type: "object",
          properties: {
            propertyId: { type: "string" },
            bucket: { type: "string", enum: BUCKETS },
          },
          required: ["propertyId"],
          additionalProperties: false,
        },
      },
      columns: {
        type: "array",
        maxItems: MAX_COLUMNS,
        items: {
          type: "object",
          properties: {
            propertyId: { type: "string" },
            bucket: { type: "string", enum: BUCKETS },
          },
          required: ["propertyId"],
          additionalProperties: false,
        },
      },
      values: {
        type: "array",
        maxItems: MAX_VALUES,
        items: {
          type: "object",
          properties: {
            propertyId: {
              type: "string",
              description:
                'A field id from the eligible list, or "*" for count of records.',
            },
            agg: { type: "string", enum: AGGREGATIONS },
            label: { type: "string" },
          },
          required: ["propertyId", "agg"],
          additionalProperties: false,
        },
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            propertyId: { type: "string" },
            op: { type: "string", enum: FILTER_OPS },
            value: {},
          },
          required: ["propertyId", "op"],
          additionalProperties: false,
        },
      },
    },
    required: ["rows", "columns", "values", "filters"],
    additionalProperties: false,
  },
};

function serializeField(f: PivotField): string {
  const parts: string[] = [
    `id=${f.id}`,
    `label="${f.label}"`,
    `entity=${f.group}`,
    `dataType=${f.dataType}`,
    `aggregations=[${f.aggregations.join(",")}]`,
    `filterOps=[${f.filterOps.join(",")}]`,
  ];
  if (f.bucketable) parts.push("bucketable=true");
  if (f.enumValues) parts.push(`enumValues=[${f.enumValues.join(",")}]`);
  if (f.valueOnly) parts.push("valueOnly=true");
  return `- ${parts.join(" ")}`;
}

function buildSystemPrompt(base: BaseEntity, baseFields: PivotField[]): string {
  const fields = baseFields.map(serializeField).join("\n");
  return `You configure a pivot report for Bloom Beauty's customer-feedback product (built on Simplesat).

Always call the \`build_report\` tool with a valid ReportConfig. Never reply with plain text.

ReportConfig shape:
- rows: AxisField[] (max ${MAX_ROWS}) — categorical/date dimensions to group by vertically.
- columns: AxisField[] (max ${MAX_COLUMNS}) — a single dimension to spread horizontally.
- values: ValueDef[] (max ${MAX_VALUES}) — the aggregated metrics that fill the cells.
- filters: FilterDef[] — restrict the input rows.

Each AxisField is { propertyId, bucket? }. \`bucket\` only applies to bucketable date fields (day/week/month/quarter/year).
Each ValueDef is { propertyId, agg, label? }. Use propertyId "*" with agg "count" for count-of-records. For any other propertyId, the agg must be one of the field's listed aggregations.
Each FilterDef is { propertyId, op, value? }. \`value\` is required for ops other than isnull/notnull.

Filter op vocabulary:
- Numeric / date scalar comparisons: eq, neq, lt, lte, gt, gte. \`value\` is a number (or ISO date string).
- Numeric / date range: between. \`value\` is a 2-element array [min, max].
- String: eq, neq, contains, starts-with. For "contains" / "starts-with" the value is a substring (no wildcards).
- Multi-select: in, not-in. \`value\` is an array of allowed (or excluded) strings.
- Date relative: relative. \`value\` is { n: number, unit: "days"|"weeks"|"months", dir: "past"|"next" }. Use this for prompts like "in the last 7 days", "last 30 days", "next 2 weeks".
- Null: isnull, notnull. No value.
Only emit ops that appear in the field's \`filterOps\` list. Pick the op that matches the user's wording most precisely.

Constraints:
- valueOnly=true fields are pre-aggregated (CSAT/CES/NPS scores, correlated subqueries). They may only appear in values or filters, never in rows or columns.
- Pick aggregations only from the field's listed set.
- If the user asks about CSAT or rating quality, the response base is usually right.

Picking the right value for a metric question:
- "CSAT", "satisfaction", "satisfied" → csat_avg
- "CES", "effort", "easy" → ces_avg by default; ces_positive_pct only if the user says "% positive", "percent positive", or "easy-rate".
- "NPS", "recommend", "promoter", "detractor" → nps_score
- Bare "rating" without a metric name on the response base → csat_avg (CSAT is the dominant metric).
- General volume ("how many responses", "response count") → propertyId "*" with agg "count".

Sentiment / quality filters — "low", "poor", "bad", "negative", "detractor", "high", "great", "positive", "promoter":
- Best home is the **response** base: emit BOTH a survey_type filter AND a rating filter at the row level.
  - low/poor/bad/negative CSAT or CES → filters: [{survey_type op:"eq" value:"csat" (or "ces")}, {rating op:"lte" value:2}]
  - high/great/positive CSAT or CES → filters: [{survey_type op:"eq" value:"csat" (or "ces")}, {rating op:"gte" value:4}]
  - NPS detractor → filters: [{survey_type op:"eq" value:"nps"}, {rating op:"lte" value:6}]
  - NPS promoter → filters: [{survey_type op:"eq" value:"nps"}, {rating op:"gte" value:9}]
- On the customer / team_member / ticket bases you may instead filter directly on the metric field (csat_avg, ces_avg, nps_score) with lt/lte/gt/gte. E.g. "team members with low CSAT" on the team_member base → filters: [{csat_avg op:"lt" value:3}].

Axis discipline:
- Do NOT add a date axis unless the prompt explicitly invokes time ("by month", "by quarter", "over time", "trend", "weekly", "monthly", "since 2025", "last 30 days", etc.). Phrases like "top performers", "with low CSAT", "by tier", "by channel" do NOT imply time — leave columns empty.
- When time IS named, default the bucket to "month" unless the user picked a different grain.
- "Top", "best", "worst", "highest", "lowest", "leaders", "ranking" → produce rows + values, no columns. Sort by value isn't supported yet, so adding a column axis just clutters the result.

Base entity for this request: ${base}

Eligible fields:
${fields}`;
}

function sanitizeAxis(
  baseFields: PivotField[],
  axis: unknown,
  max: number,
  allowValueOnly: boolean,
): AxisField[] {
  if (!Array.isArray(axis)) return [];
  const out: AxisField[] = [];
  for (const raw of axis) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { propertyId?: unknown; bucket?: unknown };
    if (typeof candidate.propertyId !== "string") continue;
    const field = findField(baseFields, candidate.propertyId);
    if (!field) continue;
    if (!allowValueOnly && field.valueOnly) continue;
    const entry: AxisField = { propertyId: candidate.propertyId };
    if (
      field.bucketable &&
      typeof candidate.bucket === "string" &&
      (BUCKETS as string[]).includes(candidate.bucket)
    ) {
      entry.bucket = candidate.bucket as DateBucket;
    }
    out.push(entry);
    if (out.length >= max) break;
  }
  return out;
}

function sanitizeValues(
  baseFields: PivotField[],
  values: unknown,
): ValueDef[] {
  if (!Array.isArray(values)) return [];
  const out: ValueDef[] = [];
  for (const raw of values) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as {
      propertyId?: unknown;
      agg?: unknown;
      label?: unknown;
    };
    if (typeof candidate.propertyId !== "string") continue;
    if (typeof candidate.agg !== "string") continue;
    if (!(AGGREGATIONS as string[]).includes(candidate.agg)) continue;

    if (candidate.propertyId === "*") {
      if (candidate.agg !== "count") continue;
      out.push({
        propertyId: "*",
        agg: "count",
        ...(typeof candidate.label === "string"
          ? { label: candidate.label }
          : {}),
      });
    } else {
      const field = findField(baseFields, candidate.propertyId);
      if (!field) continue;
      if (!field.aggregations.includes(candidate.agg as Aggregation)) continue;
      out.push({
        propertyId: candidate.propertyId,
        agg: candidate.agg as Aggregation,
        ...(typeof candidate.label === "string"
          ? { label: candidate.label }
          : {}),
      });
    }
    if (out.length >= MAX_VALUES) break;
  }
  return out;
}

function sanitizeFilters(
  baseFields: PivotField[],
  filters: unknown,
): FilterDef[] {
  if (!Array.isArray(filters)) return [];
  const out: FilterDef[] = [];
  for (const raw of filters) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as {
      propertyId?: unknown;
      op?: unknown;
      value?: unknown;
    };
    if (typeof candidate.propertyId !== "string") continue;
    if (typeof candidate.op !== "string") continue;
    if (!(FILTER_OPS as string[]).includes(candidate.op)) continue;
    const field = findField(baseFields, candidate.propertyId);
    if (!field) continue;
    // The field's filterOps lists which ops make sense for it; an empty list
    // means "this field is not filterable" (e.g. response-base metric values,
    // which are pre-aggregated and can't go into a WHERE clause).
    if (!field.filterOps.includes(candidate.op)) continue;
    out.push({
      propertyId: candidate.propertyId,
      op: candidate.op as FilterOp,
      ...(candidate.value !== undefined
        ? { value: candidate.value as FilterDef["value"] }
        : {}),
    });
  }
  return out;
}

function sanitize(
  base: BaseEntity,
  baseFields: PivotField[],
  candidate: unknown,
): ReportConfig {
  const obj = (candidate && typeof candidate === "object" ? candidate : {}) as {
    rows?: unknown;
    columns?: unknown;
    values?: unknown;
    filters?: unknown;
  };
  const config: ReportConfig = {
    base,
    rows: sanitizeAxis(baseFields, obj.rows, MAX_ROWS, false),
    columns: sanitizeAxis(baseFields, obj.columns, MAX_COLUMNS, false),
    values: sanitizeValues(baseFields, obj.values),
    filters: sanitizeFilters(baseFields, obj.filters),
  };
  if (
    config.rows.length === 0 &&
    config.columns.length === 0 &&
    config.values.length === 0
  ) {
    return defaultConfig(base);
  }
  return config;
}

export async function buildReportFromPrompt(
  prompt: string,
  base: BaseEntity,
): Promise<ReportConfig> {
  // Same workspace-scoped registry the rail + SQL compiler use, so the AI only
  // ever sees (and can emit) fields that actually exist for this workspace —
  // Bloom's curated set + tier, or another workspace's data-derived fields.
  const workspaceId = await requireWorkspace();
  const [customerCustomFields, teamMemberCustomFields] = await Promise.all([
    getCustomerCustomFields(workspaceId),
    getTeamMemberCustomFields(workspaceId),
  ]);
  const baseFields = buildPivotFields({
    customerCustomFields,
    teamMemberCustomFields,
    showTier: workspaceId === DEMO_WORKSPACE_ID,
  })[base];

  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(base, baseFields),
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [BUILD_REPORT_TOOL],
    tool_choice: { type: "tool", name: "build_report" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return defaultConfig(base);
  }
  return sanitize(base, baseFields, toolUse.input);
}
