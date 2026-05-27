import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  customers,
  responses,
  teamMembers,
  ticketMessages,
  tickets,
  type AvatarSource,
  type SurveyAnswer,
} from "@/db/schema";
import { prefixedId, type IdPrefix } from "@/lib/ids";
import { resolveTeamMember } from "@/lib/ingest/resolve-team-member";
import type {
  CustomerIngest,
  MessageIngest,
  ResponseIngest,
  TeamMemberIngest,
  TicketIngest,
} from "@/lib/ingest/schemas";

const DEFAULT_AVATAR_COLOR = "#6366f1";

// --- avatar re-sync guard ---------------------------------------------------
// Only externally-sourced avatars are stored: an incoming `avatarUrl` is tagged
// `helpdesk` (gravatar/dicebear are derived at render time, never persisted —
// see src/lib/avatar.ts). The precedence rule is `manual > helpdesk`, so a sync
// must NEVER clobber an avatar a user uploaded in-app. `avatarSource: 'manual'`
// is set by the (future) upload path; this ingest path only ever writes
// 'helpdesk'.

/** Avatar columns to write when creating a new row. */
function avatarFieldsForCreate(avatarUrl: string | undefined) {
  if (!avatarUrl) return {} as const;
  return { avatarUrl, avatarSource: "helpdesk" } as const;
}

/** Avatar columns to write when re-syncing an existing row. Returns an empty
 *  patch (leaving the stored avatar untouched) when the row is `manual` or when
 *  the sync carries no avatar — so a helpdesk re-POST without an avatar can't
 *  blank out a previously-synced one, and a manual upload always wins. */
function avatarFieldsForUpdate(
  avatarUrl: string | undefined,
  existingSource: AvatarSource | null,
) {
  if (existingSource === "manual") return {} as const;
  if (!avatarUrl) return {} as const;
  return { avatarUrl, avatarSource: "helpdesk" } as const;
}

export type UpsertResult = { id: string; created: boolean };

/** Thrown when a payload references an `external_id` (customer / team-member /
 *  ticket) that doesn't exist in the authenticated workspace. Routes translate
 *  this to a 422 — we never auto-stub a placeholder row (per the brief: posting
 *  order is n8n's responsibility; referenced entities must land first). */
export class UnknownReferenceError extends Error {
  constructor(
    readonly entity: "customer" | "team-member" | "ticket",
    readonly externalId: string,
  ) {
    super(`Unknown ${entity} external_id "${externalId}" in this workspace`);
    this.name = "UnknownReferenceError";
  }
}

/** Shared find-or-write. Keeps the created/updated branch in one place while
 *  leaving the actual queries to typed per-entity callbacks (so no `any` leaks
 *  in from a generic table parameter).
 *
 *  No explicit transaction: idempotency for the real workload (n8n re-POSTing
 *  the same `external_id`) is a sequential find→update, which this handles
 *  directly. The only thing a transaction would add is guarding a *concurrent*
 *  double-insert of the same new `external_id` — and the partial unique index
 *  on `external_id` already rejects that (the loser gets a constraint error
 *  rather than a duplicate row). Wrapping these libsql calls in
 *  `db.transaction` would also deadlock the outer `db` writes against the
 *  transaction's lock on the local file DB. */
async function findOrWrite<TFound extends { id: string }>(
  idPrefix: IdPrefix,
  find: () => Promise<TFound | undefined>,
  create: (id: string) => Promise<void>,
  update: (id: string, found: TFound) => Promise<void>,
): Promise<UpsertResult> {
  const existing = await find();
  if (existing) {
    await update(existing.id, existing);
    return { id: existing.id, created: false };
  }
  const id = prefixedId(idPrefix);
  await create(id);
  return { id, created: true };
}

// --- reference resolution ---------------------------------------------------

async function resolveCustomerId(
  workspaceId: string,
  externalId: string,
): Promise<string> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.workspaceId, workspaceId),
        eq(customers.externalId, externalId),
      ),
    )
    .limit(1);
  if (!row) throw new UnknownReferenceError("customer", externalId);
  return row.id;
}

async function resolveTicketId(
  workspaceId: string,
  externalId: string,
): Promise<string> {
  const [row] = await db
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      and(
        eq(tickets.workspaceId, workspaceId),
        eq(tickets.externalId, externalId),
      ),
    )
    .limit(1);
  if (!row) throw new UnknownReferenceError("ticket", externalId);
  return row.id;
}

async function resolveTeamMemberId(
  workspaceId: string,
  externalId: string,
): Promise<string> {
  const [row] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.externalId, externalId),
      ),
    )
    .limit(1);
  if (!row) throw new UnknownReferenceError("team-member", externalId);
  return row.id;
}

/** Best-effort team-member lookup: returns the internal id, or null if the
 *  source agent isn't synced yet. Used where crediting is non-blocking (the
 *  resolved assignee on a ticket): a missing agent must not 422 an otherwise
 *  valid ticket — it just leaves `teamMemberId` unresolved until the agent
 *  syncs and the ticket is re-posted. */
async function resolveTeamMemberIdOrNull(
  workspaceId: string,
  externalId: string | null,
): Promise<string | null> {
  if (!externalId) return null;
  const [row] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.externalId, externalId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

// --- custom-properties merge ------------------------------------------------

/** Merge customer-level custom attributes with the resolved org's custom
 *  fields (prefixed `org_`) into one flat bag — there is no separate org
 *  entity, so org attributes live on the customer (per the brief). */
function mergeCustomProperties(
  customProperties: Record<string, unknown> | undefined,
  organizationCustomFields: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(customProperties ?? {}) };
  if (organizationCustomFields) {
    for (const [key, value] of Object.entries(organizationCustomFields)) {
      out[`org_${key}`] = value;
    }
  }
  return out;
}

// --- per-entity upserts -----------------------------------------------------

export function upsertCustomer(
  workspaceId: string,
  input: CustomerIngest,
): Promise<UpsertResult> {
  const customProperties = mergeCustomProperties(
    input.customProperties,
    input.organizationCustomFields,
  );
  const shared = {
    name: input.name,
    email: input.email,
    tier: input.tier ?? "insider",
    language: input.language ?? null,
    organization: input.organization ?? null,
    organizationExternalId: input.organizationExternalId ?? null,
    organizationDomain: input.organizationDomain ?? null,
    customProperties,
    updatedAt: new Date(),
  } as const;

  return findOrWrite(
    "cus",
    () =>
      db
        .select({ id: customers.id, avatarSource: customers.avatarSource })
        .from(customers)
        .where(
          and(
            eq(customers.workspaceId, workspaceId),
            eq(customers.externalId, input.externalId),
          ),
        )
        .limit(1)
        .then((r) => r[0]),
    async (id) => {
      await db.insert(customers).values({
        id,
        workspaceId,
        externalId: input.externalId,
        ...shared,
        ...avatarFieldsForCreate(input.avatarUrl),
      });
    },
    async (id, found) => {
      await db
        .update(customers)
        .set({ ...shared, ...avatarFieldsForUpdate(input.avatarUrl, found.avatarSource) })
        .where(eq(customers.id, id));
    },
  );
}

export function upsertTeamMember(
  workspaceId: string,
  input: TeamMemberIngest,
): Promise<UpsertResult> {
  const shared = {
    name: input.name,
    email: input.email,
    role: input.role ?? "Agent",
    team: input.team ?? "Support",
    region: input.region ?? null,
    language: input.language ?? null,
    avatarColor: input.avatarColor ?? DEFAULT_AVATAR_COLOR,
    customProperties: input.customProperties ?? {},
    updatedAt: new Date(),
  } as const;

  return findOrWrite(
    "tm",
    () =>
      db
        .select({ id: teamMembers.id, avatarSource: teamMembers.avatarSource })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.workspaceId, workspaceId),
            eq(teamMembers.externalId, input.externalId),
          ),
        )
        .limit(1)
        .then((r) => r[0]),
    async (id) => {
      await db.insert(teamMembers).values({
        id,
        workspaceId,
        externalId: input.externalId,
        ...shared,
        ...avatarFieldsForCreate(input.avatarUrl),
      });
    },
    async (id, found) => {
      await db
        .update(teamMembers)
        .set({ ...shared, ...avatarFieldsForUpdate(input.avatarUrl, found.avatarSource) })
        .where(eq(teamMembers.id, id));
    },
  );
}

export async function upsertTicket(
  workspaceId: string,
  input: TicketIngest,
): Promise<UpsertResult> {
  const customerId = await resolveCustomerId(
    workspaceId,
    input.customerExternalId,
  );
  const sourceAgents = input.sourceAgents ?? {};
  // Credit a single team member via the resolution rule (default: assignee).
  // Soft-resolve: an unsynced agent leaves teamMemberId null, not a 422.
  const teamMemberId = await resolveTeamMemberIdOrNull(
    workspaceId,
    resolveTeamMember(sourceAgents),
  );

  const shared = {
    subject: input.subject,
    status: input.status,
    channel: input.channel ?? "email",
    source: input.source,
    priority: input.priority ?? "normal",
    customerId,
    sourceAgents,
    teamMemberId,
    sourceMetrics: input.sourceMetrics ?? {},
    sourceTags: input.sourceTags ?? [],
    createdAt: input.createdAt,
    firstResponseAt: input.firstResponseAt ?? null,
    solvedAt: input.solvedAt ?? null,
    closedAt: input.closedAt ?? null,
    messageCount: input.messageCount ?? 0,
    agentMessageCount: input.agentMessageCount ?? 0,
    surveyEligible: input.surveyEligible ?? true,
    surveySentAt: input.surveySentAt ?? null,
    surveyNotSentReason: input.surveyNotSentReason ?? null,
  } as const;

  return findOrWrite(
    "tkt",
    () =>
      db
        .select({ id: tickets.id })
        .from(tickets)
        .where(
          and(
            eq(tickets.workspaceId, workspaceId),
            eq(tickets.externalId, input.externalId),
          ),
        )
        .limit(1)
        .then((r) => r[0]),
    async (id) => {
      await db
        .insert(tickets)
        .values({ id, workspaceId, externalId: input.externalId, ...shared });
    },
    async (id) => {
      await db.update(tickets).set(shared).where(eq(tickets.id, id));
    },
  );
}

export async function upsertMessage(
  workspaceId: string,
  input: MessageIngest,
): Promise<UpsertResult> {
  const ticketId = await resolveTicketId(workspaceId, input.ticketExternalId);
  const customerId = input.customerExternalId
    ? await resolveCustomerId(workspaceId, input.customerExternalId)
    : null;
  const teamMemberId = input.teamMemberExternalId
    ? await resolveTeamMemberId(workspaceId, input.teamMemberExternalId)
    : null;

  const channel = input.channel ?? "email";
  const shared = {
    ticketId,
    authorRole: input.authorRole,
    customerId,
    teamMemberId,
    channel,
    isPublic: input.isPublic ?? channel !== "internal",
    type: input.type ?? "comment",
    body: input.body,
    createdAt: input.createdAt,
  } as const;

  return findOrWrite(
    "tkm",
    () =>
      db
        .select({ id: ticketMessages.id })
        .from(ticketMessages)
        .where(eq(ticketMessages.externalId, input.externalId))
        .limit(1)
        .then((r) => r[0]),
    async (id) => {
      await db
        .insert(ticketMessages)
        .values({ id, externalId: input.externalId, ...shared });
    },
    async (id) => {
      await db
        .update(ticketMessages)
        .set(shared)
        .where(eq(ticketMessages.id, id));
    },
  );
}

export async function upsertResponse(
  workspaceId: string,
  input: ResponseIngest,
): Promise<UpsertResult> {
  const ticketId = await resolveTicketId(workspaceId, input.ticketExternalId);
  const customerId = await resolveCustomerId(
    workspaceId,
    input.customerExternalId,
  );
  const teamMemberId = await resolveTeamMemberIdOrNull(
    workspaceId,
    input.teamMemberExternalId ?? null,
  );

  const shared = {
    ticketId,
    customerId,
    teamMemberId,
    surveyId: input.surveyId ?? null,
    // Helpdesk-native CSAT has no Simplesat survey → default the denormalized
    // metric to csat. The centered 1-5 rating mapping is a separate task; we
    // store rating + scale exactly as received here.
    surveyType: input.surveyType ?? "csat",
    rating: input.rating,
    scale: input.scale,
    comment: input.comment ?? null,
    source: input.source,
    respondedAt: (input.respondedAt ?? input.createdAt) as Date,
    answers: (input.answers ?? []) as SurveyAnswer[],
  } as const;

  return findOrWrite(
    "rsp",
    () =>
      db
        .select({ id: responses.id })
        .from(responses)
        .where(
          and(
            eq(responses.workspaceId, workspaceId),
            eq(responses.externalId, input.externalId),
          ),
        )
        .limit(1)
        .then((r) => r[0]),
    async (id) => {
      await db
        .insert(responses)
        .values({ id, workspaceId, externalId: input.externalId, ...shared });
    },
    async (id) => {
      await db.update(responses).set(shared).where(eq(responses.id, id));
    },
  );
}
