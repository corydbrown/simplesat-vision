import { z } from "zod";

/** Zod schemas for the ingest API. n8n posts already-normalized helpdesk data
 *  shaped to these contracts (it owns Zendesk-field-id → readable-key mapping,
 *  Unix → ISO timestamp conversion, and picking the single resolved org). The
 *  schemas are intentionally flat — no `z.record(z.any())` bloat — because the
 *  payloads ARE flat by the time they reach us. Unknown keys are stripped (the
 *  Zod object default), so an over-eager n8n field doesn't 400 a whole batch.
 *
 *  `externalId` is the upsert key everywhere; always a string (Zendesk integer
 *  ids are stringified upstream). Timestamps accept ISO 8601 strings or epoch
 *  ms and coerce to `Date` for the `timestamp_ms` columns. */

const externalId = z.string().min(1, "externalId is required");
/** ISO 8601 string (n8n's format) or epoch-ms number → Date. */
const timestamp = z.coerce.date();
/** A flat key→value bag (org custom fields, source metrics). */
const jsonRecord = z.record(z.string(), z.unknown());

export const customerIngestSchema = z.object({
  externalId,
  name: z.string().min(1),
  email: z.email(),
  /** Loyalty tier is a Simplesat-native concept a helpdesk won't carry. Default
   *  `insider` (entry tier) when absent so ingested customers stay valid
   *  against the NOT-NULL enum. */
  tier: z.enum(["insider", "gold", "elite"]).optional(),
  language: z.string().optional(),
  organization: z.string().optional(),
  organizationExternalId: z.string().optional(),
  organizationDomain: z.string().optional(),
  /** Helpdesk/CRM avatar URL (e.g. Intercom Contact `avatar.image_url`). When
   *  present, stored with `avatarSource: 'helpdesk'`. The upsert never lets a
   *  sync overwrite a `manual` avatar — see `upsertCustomer`. */
  avatarUrl: z.url().optional(),
  /** Customer-level custom attributes — merged into `customProperties` as-is. */
  customProperties: jsonRecord.optional(),
  /** The resolved org's custom fields — flattened into `customProperties` with
   *  an `org_` prefix (e.g. `plan_type` → `org_plan_type`). */
  organizationCustomFields: jsonRecord.optional(),
});

export const teamMemberIngestSchema = z.object({
  externalId,
  name: z.string().min(1),
  email: z.email(),
  /** Job title. Defaults to "Agent" — helpdesks expose roles inconsistently. */
  role: z.string().optional(),
  /** High-level grouping. Defaults to "Support". */
  team: z.string().optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  avatarColor: z.string().optional(),
  /** Helpdesk/CRM avatar URL (e.g. Intercom Admin `avatar`). Stored with
   *  `avatarSource: 'helpdesk'`; a `manual` avatar is never overwritten. */
  avatarUrl: z.url().optional(),
  customProperties: jsonRecord.optional(),
});

export const ticketIngestSchema = z.object({
  externalId,
  subject: z.string().min(1),
  /** Raw, source-verbatim status — stored as-is (`is_resolved` is derived). */
  status: z.string().min(1),
  channel: z.enum(["email", "chat", "phone", "social"]).optional(),
  /** Originating system (zendesk / intercom / …) — free text. */
  source: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  /** Resolved to an internal customerId; 422 if unknown in this workspace. */
  customerExternalId: externalId,
  /** Lossless agent-role → raw external id map. The credited teamMemberId is
   *  resolved from this via `resolveTeamMember` (never set directly). */
  sourceAgents: z.record(z.string(), z.string()).optional(),
  /** Raw metrics bag (Intercom `statistics` / Zendesk metrics) — stored verbatim. */
  sourceMetrics: jsonRecord.optional(),
  /** Helpdesk tags → `sourceTags` (read-only). Native `tags` is never ingested. */
  sourceTags: z.array(z.string()).optional(),
  createdAt: timestamp,
  firstResponseAt: timestamp.optional(),
  solvedAt: timestamp.optional(),
  closedAt: timestamp.optional(),
  messageCount: z.number().int().nonnegative().optional(),
  agentMessageCount: z.number().int().nonnegative().optional(),
  surveyEligible: z.boolean().optional(),
  surveySentAt: timestamp.optional(),
  surveyNotSentReason: z
    .enum([
      "tag_excluded",
      "suppression_list",
      "channel_disabled",
      "automation_close",
    ])
    .optional(),
});

export const messageIngestSchema = z.object({
  externalId,
  /** Parent ticket; resolved to an internal ticketId (422 if unknown). */
  ticketExternalId: externalId,
  authorRole: z.enum(["customer", "agent", "system"]),
  /** Set when authorRole is "customer"; resolved to an internal customerId. */
  customerExternalId: z.string().optional(),
  /** Set when authorRole is "agent"; resolved to an internal teamMemberId. */
  teamMemberExternalId: z.string().optional(),
  channel: z.enum(["email", "chat", "phone", "social", "internal"]).optional(),
  isPublic: z.boolean().optional(),
  type: z.enum(["comment", "voice_comment", "chat_message"]).optional(),
  body: z.string(),
  createdAt: timestamp,
});

export const responseIngestSchema = z
  .object({
    externalId,
    ticketExternalId: externalId,
    customerExternalId: externalId,
    teamMemberExternalId: z.string().optional(),
    /** Provenance: `simplesat` (native survey) or `zendesk` / `intercom` (imported CSAT). */
    source: z.string().min(1),
    /** Required only when `source` is `simplesat`; null for helpdesk-native CSAT. */
    surveyId: z.string().optional(),
    /** Defaults to `csat` for helpdesk-native CSAT (no Simplesat survey). */
    surveyType: z
      .enum(["csat", "nps", "ces", "five_star", "custom"])
      .optional(),
    rating: z.number().int(),
    scale: z.number().int().positive(),
    comment: z.string().optional(),
    /** When the customer rated. Accepts `respondedAt` or `createdAt`. */
    respondedAt: timestamp.optional(),
    createdAt: timestamp.optional(),
    answers: z.array(jsonRecord).optional(),
  })
  .refine((d) => d.source !== "simplesat" || !!d.surveyId, {
    message: "surveyId is required when source is 'simplesat'",
    path: ["surveyId"],
  })
  .refine((d) => !!d.respondedAt || !!d.createdAt, {
    message: "respondedAt (or createdAt) is required",
    path: ["respondedAt"],
  });

export type CustomerIngest = z.infer<typeof customerIngestSchema>;
export type TeamMemberIngest = z.infer<typeof teamMemberIngestSchema>;
export type TicketIngest = z.infer<typeof ticketIngestSchema>;
export type MessageIngest = z.infer<typeof messageIngestSchema>;
export type ResponseIngest = z.infer<typeof responseIngestSchema>;

/** Normalized parse result: always an array of items plus whether the caller
 *  sent the bulk `{ items: [...] }` shape (drives the response shape). */
export type ParsedIngestBody<T> = { items: T[]; bulk: boolean };

export type ParseOutcome<T> =
  | { ok: true; data: ParsedIngestBody<T> }
  | { ok: false; error: z.ZodError };

/** Accept either a single object or `{ items: [...] }`. Each item is validated
 *  by `schema`; a bad item fails the whole parse with a path-prefixed issue so
 *  the 400 points at the offending index. */
export function parseIngestBody<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): ParseOutcome<T> {
  if (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "items" in raw
  ) {
    const parsed = z.object({ items: z.array(schema) }).safeParse(raw);
    return parsed.success
      ? { ok: true, data: { items: parsed.data.items, bulk: true } }
      : { ok: false, error: parsed.error };
  }

  const parsed = schema.safeParse(raw);
  return parsed.success
    ? { ok: true, data: { items: [parsed.data], bulk: false } }
    : { ok: false, error: parsed.error };
}
