"use server";

import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { liveResponsesFilter } from "@/db/queries/live-responses";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import { MockScoringProvider } from "@/lib/qa/scoring";
import { requireWorkspace } from "@/lib/workspace";
import { snapshotScorecard } from "@/lib/scorecards/snapshot";
import {
  mintScorecardFromTemplate,
  type ScorecardMintTemplate,
} from "@/lib/scorecards/mint";
import {
  normalizeCriterionWeights,
  validateWeights,
} from "@/lib/scorecards/weights";
import type {
  ScoringInput,
  ScoringMessage,
  ScoringOutput,
  ScoringScorecard,
} from "@/lib/qa/scoring";

const ScaleEnum = z.enum(["likert_5", "binary", "three_state"]);

const CriterionInput = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(1000),
  anchor5: z.string().max(2000),
  anchor3: z.string().max(2000),
  anchor1: z.string().max(2000),
  /** Authoritative per-criterion weight (SVP-228). SVP-229's editor sends
   *  this explicitly; legacy callers may omit it and fall back to
   *  `normalizeCriterionWeights`'s even-split shim. */
  weightPercent: z.number().int().min(0).max(100).optional(),
});

const CategoryInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000),
  weightPercent: z.number().int().min(0).max(100),
  scaleType: ScaleEnum,
  isAutofail: z.boolean(),
  order: z.number().int().min(0),
  criteria: z.array(CriterionInput).min(1),
});

const SaveScorecardSchema = z.object({
  scorecardId: z.string().min(1),
  categories: z.array(CategoryInput).min(1),
  /** SVP-228 LLM-context fields. The editor either passes them through
   *  (SVP-229 onward) or omits the property entirely (legacy callers); a
   *  property present as `null` clears the field, an absent property leaves
   *  the persisted value untouched. */
  scoringPhilosophy: z.string().max(8000).nullable().optional(),
  bandDescriptors: z
    .array(z.string().max(1000))
    .length(5)
    .nullable()
    .optional(),
  domainContext: z.string().max(8000).nullable().optional(),
  toneExpectations: z.string().max(8000).nullable().optional(),
});

export type SaveScorecardInput = z.infer<typeof SaveScorecardSchema>;

export type SaveScorecardResult = {
  ok: true;
  scorecardId: string;
  version: number;
};

/** Persist edits to a scorecard. The rubric (categories + criteria) is
 *  mutated in place by id; `scorecards.version` is bumped and an immutable
 *  `scorecard_versions` snapshot is captured so any new evaluations can FK
 *  into the rubric as it stood at save time. Existing evaluations stay
 *  pinned to the snapshot they were scored against — when the editor
 *  changes a criterion's text, old coaching pages keep showing the
 *  pre-edit text. */
export async function saveScorecard(
  input: unknown,
): Promise<SaveScorecardResult> {
  const workspaceId = await requireWorkspace();
  const parsed = SaveScorecardSchema.parse(input);
  validateWeights(parsed);

  const [existingCard] = await db
    .select({ id: schema.scorecards.id })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.id, parsed.scorecardId),
        eq(schema.scorecards.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existingCard) throw new Error("Scorecard not found");

  // Confirm every id in the payload still belongs to this scorecard. Prevents
  // a stale client from writing across scorecards.
  const [existingCategories, existingCriteria] = await Promise.all([
    db
      .select({
        id: schema.scorecardCategories.id,
      })
      .from(schema.scorecardCategories)
      .where(eq(schema.scorecardCategories.scorecardId, parsed.scorecardId)),
    db
      .select({
        id: schema.scorecardCriteria.id,
        categoryId: schema.scorecardCriteria.categoryId,
      })
      .from(schema.scorecardCriteria)
      .innerJoin(
        schema.scorecardCategories,
        eq(
          schema.scorecardCategories.id,
          schema.scorecardCriteria.categoryId,
        ),
      )
      .where(eq(schema.scorecardCategories.scorecardId, parsed.scorecardId)),
  ]);
  const knownCategoryIds = new Set(existingCategories.map((c) => c.id));
  const knownCriterionByCategory = new Map(
    existingCriteria.map((c) => [c.id, c.categoryId]),
  );
  for (const cat of parsed.categories) {
    if (!knownCategoryIds.has(cat.id)) {
      throw new Error(`Unknown category id: ${cat.id}`);
    }
    for (const crit of cat.criteria) {
      const owner = knownCriterionByCategory.get(crit.id);
      if (!owner) throw new Error(`Unknown criterion id: ${crit.id}`);
      if (owner !== cat.id) {
        throw new Error(
          `Criterion ${crit.id} does not belong to category ${cat.id}`,
        );
      }
    }
  }

  const nextVersion = await db.transaction(async (tx) => {
    for (const cat of parsed.categories) {
      await tx
        .update(schema.scorecardCategories)
        .set({
          name: cat.name,
          description: cat.description,
          scaleType: cat.scaleType,
          order: cat.order,
        })
        .where(eq(schema.scorecardCategories.id, cat.id));
      const criterionWeights = normalizeCriterionWeights(cat);
      for (let i = 0; i < cat.criteria.length; i++) {
        const crit = cat.criteria[i];
        await tx
          .update(schema.scorecardCriteria)
          .set({
            text: crit.text,
            anchor5: crit.anchor5,
            anchor3: crit.anchor3,
            anchor1: crit.anchor1,
            weightPercent: criterionWeights[i],
          })
          .where(eq(schema.scorecardCriteria.id, crit.id));
      }
    }
    // LLM-context fields are optional on the wire: an absent property leaves
    // the persisted value alone (so legacy callers don't blow away curated
    // context); a property present as `null` clears it.
    const llmContextPatch: Partial<{
      scoringPhilosophy: string | null;
      bandDescriptors: string[] | null;
      domainContext: string | null;
      toneExpectations: string | null;
    }> = {};
    if ("scoringPhilosophy" in parsed) {
      llmContextPatch.scoringPhilosophy = parsed.scoringPhilosophy ?? null;
    }
    if ("bandDescriptors" in parsed) {
      llmContextPatch.bandDescriptors = parsed.bandDescriptors ?? null;
    }
    if ("domainContext" in parsed) {
      llmContextPatch.domainContext = parsed.domainContext ?? null;
    }
    if ("toneExpectations" in parsed) {
      llmContextPatch.toneExpectations = parsed.toneExpectations ?? null;
    }

    const [updated] = await tx
      .update(schema.scorecards)
      .set({
        ...llmContextPatch,
        version: sql`${schema.scorecards.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.scorecards.id, parsed.scorecardId))
      .returning({ version: schema.scorecards.version });
    if (!updated) throw new Error("Scorecard not found");
    await snapshotScorecard(tx, {
      scorecardId: parsed.scorecardId,
      version: updated.version,
    });
    return updated.version;
  });

  revalidatePath("/settings/scorecards");
  revalidatePath(`/settings/scorecards/default`);
  revalidatePath(`/settings/scorecards/${parsed.scorecardId}`);

  return { ok: true, scorecardId: parsed.scorecardId, version: nextVersion };
}

// ---------------------------------------------------------------------------
// Preview — score a ticket against the in-progress (unsaved) scorecard config
// ---------------------------------------------------------------------------

const PreviewInputSchema = z.object({
  ticketId: z.string().min(1),
  scorecard: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.number().int(),
    categories: z.array(CategoryInput).min(1),
  }),
});

export type PreviewScorecardResult = {
  ok: true;
  ticket: {
    id: string;
    subject: string;
    customerName: string | null;
  };
  output: ScoringOutput;
};

/** Mock-score a ticket against an unsaved scorecard config. Used by the
 *  "Test on a conversation" preview in the editor — confidence builder
 *  before save. Per CLAUDE.md, scoring goes through MockScoringProvider; the
 *  real LLM provider is not wired into this surface yet. Does not persist. */
export async function previewScoreWithDraft(
  input: unknown,
): Promise<PreviewScorecardResult> {
  const parsed = PreviewInputSchema.parse(input);
  // Workspace-scope the lookup: a user must not be able to preview-score a
  // ticket from another workspace by passing its id. The ticket SELECT is the
  // load-bearing predicate — once `ticket` is workspace-validated, all the
  // downstream lookups key off its FK ids.
  const workspaceId = await requireWorkspace();

  const [ticket] = await db
    .select({
      id: schema.tickets.id,
      subject: schema.tickets.subject,
      channel: schema.tickets.channel,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      createdAt: schema.tickets.createdAt,
      solvedAt: schema.tickets.solvedAt,
      tags: schema.tickets.tags,
      customerId: schema.tickets.customerId,
    })
    .from(schema.tickets)
    .where(
      and(
        eq(schema.tickets.id, parsed.ticketId),
        eq(schema.tickets.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!ticket) throw new Error("Ticket not found");

  const messageRows = await db
    .select()
    .from(schema.ticketMessages)
    .where(eq(schema.ticketMessages.ticketId, parsed.ticketId))
    .orderBy(asc(schema.ticketMessages.createdAt));
  if (messageRows.length === 0) {
    throw new Error(
      "This ticket has no messages — pick a scored ticket to preview.",
    );
  }

  const [customer] = ticket.customerId
    ? await db
        .select({ name: schema.customers.name })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.id, ticket.customerId),
            eq(schema.customers.workspaceId, workspaceId),
          ),
        )
        .limit(1)
    : [];

  const messages: ScoringMessage[] = messageRows.map((m) => ({
    id: m.id,
    authorRole: m.authorRole,
    authorName: null,
    body: m.body,
    isPublic: m.isPublic,
    createdAt: m.createdAt,
  }));

  // Map the draft into the provider's scorecard shape. The provider doesn't
  // care about description / anchors / order — it scores against categories
  // and (for binary) the per-criterion fail roll. SVP-228: pass criterion-
  // level weights through (resolved via the same shared normaliser the save
  // path uses) so the preview's overall-score formula matches a real save.
  // LLM-context fields aren't part of the editor payload yet (SVP-229) — pull
  // them from the live scorecard row instead so the live LLM preview sees the
  // same framing the runtime sees.
  const [liveScorecardContext] = await db
    .select({
      scoringPhilosophy: schema.scorecards.scoringPhilosophy,
      bandDescriptors: schema.scorecards.bandDescriptors,
      domainContext: schema.scorecards.domainContext,
      toneExpectations: schema.scorecards.toneExpectations,
    })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.id, parsed.scorecard.id),
        eq(schema.scorecards.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  const scoringScorecard: ScoringScorecard = {
    id: parsed.scorecard.id,
    name: parsed.scorecard.name,
    version: parsed.scorecard.version,
    autoFailFloor: DEFAULT_SCORECARD.autoFailFloor,
    scoringPhilosophy: liveScorecardContext?.scoringPhilosophy ?? null,
    bandDescriptors: liveScorecardContext?.bandDescriptors ?? null,
    domainContext: liveScorecardContext?.domainContext ?? null,
    toneExpectations: liveScorecardContext?.toneExpectations ?? null,
    categories: parsed.scorecard.categories.map((cat) => {
      const criterionWeights = normalizeCriterionWeights(cat);
      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        weightPercent: cat.weightPercent,
        scaleType: cat.scaleType,
        isAutofail: cat.isAutofail,
        criteria: cat.criteria.map((c, i) => ({
          id: c.id,
          text: c.text,
          weightPercent: criterionWeights[i],
        })),
      };
    }),
  };

  const [responseRow] = await db
    .select({ rating: schema.responses.rating, scale: schema.responses.scale })
    .from(schema.responses)
    .where(
      and(
        eq(schema.responses.ticketId, ticket.id),
        eq(schema.responses.workspaceId, workspaceId),
        liveResponsesFilter(),
      ),
    )
    .limit(1);
  const responseRating = responseRow
    ? Math.round((responseRow.rating * 5) / responseRow.scale)
    : null;

  const scoringInput: ScoringInput = {
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      channel: ticket.channel,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt,
      solvedAt: ticket.solvedAt,
      tags: ticket.tags,
      responseRating,
    },
    messages,
    scorecard: scoringScorecard,
  };

  const provider = new MockScoringProvider();
  const output = await provider.scoreConversation(scoringInput);

  return {
    ok: true,
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      customerName: customer?.name ?? null,
    },
    output,
  };
}

// ---------------------------------------------------------------------------
// Ticket search — for the preview picker
// ---------------------------------------------------------------------------

export type TicketPickerRow = {
  id: string;
  subject: string;
  customerName: string | null;
  scoredAt: number | null;
};

/** Returns recent scored tickets matching the query, for the picker in
 *  the "Test on a conversation" panel. Only tickets that have an evaluation
 *  qualify — those are the only ones with messages in the prototype seed,
 *  and they're the meaningful surface to preview a scorecard against.
 *
 *  Workspace-scoped: predicates BOTH tickets.workspaceId AND
 *  evaluations.workspaceId (defense in depth — a mis-keyed FK shouldn't
 *  leak across workspaces). */
export async function searchScoredTickets(
  rawQuery: string,
): Promise<TicketPickerRow[]> {
  const workspaceId = await requireWorkspace();
  const q = rawQuery.trim();
  const pattern = q.length === 0
    ? null
    : `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

  const where = and(
    eq(schema.tickets.workspaceId, workspaceId),
    eq(schema.evaluations.workspaceId, workspaceId),
    pattern
      ? or(
          like(schema.tickets.subject, pattern),
          like(schema.customers.name, pattern),
        )
      : undefined,
  );

  // Pull scored tickets (have at least one evaluation) ordered by most
  // recently scored first. Caps at 20 — enough to scan, not overwhelming.
  const rows = await db
    .select({
      id: schema.tickets.id,
      subject: schema.tickets.subject,
      customerName: schema.customers.name,
      scoredAt: schema.evaluations.scoredAt,
    })
    .from(schema.tickets)
    .innerJoin(
      schema.evaluations,
      eq(schema.evaluations.ticketId, schema.tickets.id),
    )
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.tickets.customerId),
    )
    .where(where)
    .orderBy(desc(schema.evaluations.scoredAt))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    customerName: r.customerName,
    scoredAt: r.scoredAt instanceof Date ? r.scoredAt.getTime() : r.scoredAt,
  }));
}

// ---------------------------------------------------------------------------
// SVP-229 — create / duplicate / archive
// ---------------------------------------------------------------------------

const NewScorecardNameSchema = z
  .string()
  .trim()
  .min(1, "Name required")
  .max(120, "Name too long");

export type CreatedScorecard = {
  ok: true;
  scorecardId: string;
};

/** Mint a fresh scorecard for the active workspace using the IQS default as
 *  the template (the editor has no add/remove-category UI yet, so a truly
 *  empty scorecard would be useless). The user-supplied name overrides the
 *  template name; everything else copies from `DEFAULT_SCORECARD`. */
export async function createScorecard(input: {
  name: string;
}): Promise<CreatedScorecard> {
  const workspaceId = await requireWorkspace();
  const name = NewScorecardNameSchema.parse(input.name);

  const minted = await mintScorecardFromTemplate({
    workspaceId,
    template: {
      name,
      enabled: DEFAULT_SCORECARD.enabled,
      version: DEFAULT_SCORECARD.version,
      scoringPhilosophy: DEFAULT_SCORECARD.scoringPhilosophy,
      bandDescriptors: DEFAULT_SCORECARD.bandDescriptors,
      domainContext: DEFAULT_SCORECARD.domainContext,
      toneExpectations: DEFAULT_SCORECARD.toneExpectations,
      categories: DEFAULT_SCORECARD.categories.map((c) => ({
        name: c.name,
        description: c.description,
        weightPercent: c.weightPercent,
        scaleType: c.scaleType,
        isAutofail: c.isAutofail,
        criteria: c.criteria.map((cr) => ({
          text: cr.text,
          anchor5: cr.anchor5,
          anchor3: cr.anchor3,
          anchor1: cr.anchor1,
          weightPercent: cr.weightPercent,
        })),
      })),
    },
  });

  revalidatePath("/settings/scorecards");
  return { ok: true, scorecardId: minted.scorecardId };
}

/** Clone an existing scorecard into a new row with a user-supplied name. Pulls
 *  the live (current-version) shape of the source — categories + criteria +
 *  LLM-context fields — and re-mints as a fresh `scorecards` row at version 1
 *  with its own v1 snapshot. Evaluations on the source stay pinned to the
 *  source's version snapshots; the new scorecard starts clean. */
export async function duplicateScorecard(input: {
  scorecardId: string;
  name: string;
}): Promise<CreatedScorecard> {
  const workspaceId = await requireWorkspace();
  const name = NewScorecardNameSchema.parse(input.name);
  const sourceId = z.string().min(1).parse(input.scorecardId);

  const [source] = await db
    .select()
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.id, sourceId),
        eq(schema.scorecards.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!source) throw new Error("Source scorecard not found");

  const sourceCategories = await db
    .select()
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, sourceId))
    .orderBy(asc(schema.scorecardCategories.order));

  const sourceCriteria = await db
    .select({
      id: schema.scorecardCriteria.id,
      categoryId: schema.scorecardCriteria.categoryId,
      text: schema.scorecardCriteria.text,
      anchor5: schema.scorecardCriteria.anchor5,
      anchor3: schema.scorecardCriteria.anchor3,
      anchor1: schema.scorecardCriteria.anchor1,
      weightPercent: schema.scorecardCriteria.weightPercent,
      order: schema.scorecardCriteria.order,
    })
    .from(schema.scorecardCriteria)
    .innerJoin(
      schema.scorecardCategories,
      eq(schema.scorecardCategories.id, schema.scorecardCriteria.categoryId),
    )
    .where(eq(schema.scorecardCategories.scorecardId, sourceId))
    .orderBy(asc(schema.scorecardCriteria.order));

  const criteriaByCategory = new Map<string, typeof sourceCriteria>();
  for (const c of sourceCriteria) {
    const bucket = criteriaByCategory.get(c.categoryId) ?? [];
    bucket.push(c);
    criteriaByCategory.set(c.categoryId, bucket);
  }

  const template: ScorecardMintTemplate = {
    name,
    enabled: source.enabled,
    version: 1,
    scoringPhilosophy: source.scoringPhilosophy,
    bandDescriptors: source.bandDescriptors,
    domainContext: source.domainContext,
    toneExpectations: source.toneExpectations,
    categories: sourceCategories.map((cat) => {
      const catCriteria = criteriaByCategory.get(cat.id) ?? [];
      return {
        name: cat.name,
        description: cat.description,
        weightPercent: catCriteria.reduce(
          (acc, cr) => acc + cr.weightPercent,
          0,
        ),
        scaleType: cat.scaleType,
        isAutofail: cat.isAutofail,
        criteria: catCriteria.map((cr) => ({
          text: cr.text,
          anchor5: cr.anchor5,
          anchor3: cr.anchor3,
          anchor1: cr.anchor1,
          weightPercent: cr.weightPercent,
        })),
      };
    }),
  };

  const minted = await mintScorecardFromTemplate({ workspaceId, template });

  revalidatePath("/settings/scorecards");
  return { ok: true, scorecardId: minted.scorecardId };
}

/** Soft-delete (archive) or restore a scorecard. Archived scorecards are
 *  hidden from picker UIs but existing evaluations remain renderable (their
 *  `scorecard_versions` snapshot is untouched). Hard delete is intentionally
 *  not exposed — once any evaluation FKs into a scorecard, the row stays. */
export async function archiveScorecard(input: {
  scorecardId: string;
  archived: boolean;
}): Promise<{ ok: true }> {
  const workspaceId = await requireWorkspace();
  const scorecardId = z.string().min(1).parse(input.scorecardId);

  const [existing] = await db
    .select({ id: schema.scorecards.id })
    .from(schema.scorecards)
    .where(
      and(
        eq(schema.scorecards.id, scorecardId),
        eq(schema.scorecards.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Scorecard not found");

  if (input.archived) {
    // Don't let the workspace archive its last live scorecard — re-score and
    // future auto-scoring need at least one to land on. The auto-init path in
    // `scoreAndPersistTicket` *would* mint a fresh IQS, but that surprises the
    // user; better to refuse explicitly here.
    const liveCount = await db
      .select({ id: schema.scorecards.id })
      .from(schema.scorecards)
      .where(
        and(
          eq(schema.scorecards.workspaceId, workspaceId),
          isNull(schema.scorecards.archivedAt),
        ),
      );
    if (liveCount.length <= 1) {
      throw new Error(
        "Can't archive the workspace's only live scorecard. Create another first.",
      );
    }
  }

  await db
    .update(schema.scorecards)
    .set({
      archivedAt: input.archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.scorecards.id, scorecardId));

  // SVP-242: archiving the workspace default scorecard nulls the FK so the
  // resolution path falls through cleanly to "oldest live scorecard" rather
  // than silently pointing at an archived row. Safe to run unconditionally —
  // the WHERE constrains to the workspace + this specific scorecard.
  if (input.archived) {
    await db
      .update(schema.workspaces)
      .set({ defaultScorecardId: null })
      .where(
        and(
          eq(schema.workspaces.id, workspaceId),
          eq(schema.workspaces.defaultScorecardId, scorecardId),
        ),
      );
  }

  revalidatePath("/settings/scorecards");
  revalidatePath(`/settings/scorecards/${scorecardId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SVP-242 — workspace default scorecard
// ---------------------------------------------------------------------------

const SetDefaultScorecardSchema = z.object({
  scorecardId: z.string().min(1).nullable(),
});

/** Set (or clear, when `scorecardId` is null) the workspace's default
 *  scorecard. Manual Evaluate / Re-evaluate clicks on a ticket use this
 *  scorecard as the main-face action when no explicit override is passed
 *  (see `scoreAndPersistTicket`'s resolution path). Validates that the
 *  scorecard is live (not archived) and workspace-scoped before persisting. */
export async function setDefaultScorecard(
  input: unknown,
): Promise<{ ok: true }> {
  const workspaceId = await requireWorkspace();
  const { scorecardId } = SetDefaultScorecardSchema.parse(input);

  if (scorecardId) {
    const [existing] = await db
      .select({ id: schema.scorecards.id })
      .from(schema.scorecards)
      .where(
        and(
          eq(schema.scorecards.id, scorecardId),
          eq(schema.scorecards.workspaceId, workspaceId),
          isNull(schema.scorecards.archivedAt),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error("Scorecard not found or archived");
    }
  }

  await db
    .update(schema.workspaces)
    .set({ defaultScorecardId: scorecardId })
    .where(eq(schema.workspaces.id, workspaceId));

  revalidatePath("/settings/scorecards");
  revalidatePath("/", "layout");
  return { ok: true };
}
