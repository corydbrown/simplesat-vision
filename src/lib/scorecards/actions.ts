"use server";

import { asc, desc, eq, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { DEFAULT_SCORECARD } from "@/lib/qa/default-scorecard";
import { MockScoringProvider } from "@/lib/qa/scoring";
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
});

export type SaveScorecardInput = z.infer<typeof SaveScorecardSchema>;

export type SaveScorecardResult = {
  ok: true;
  scorecardId: string;
  version: number;
};

/** Persist edits to a scorecard. The rubric (categories + criteria) is
 *  mutated in place by id; `scorecards.version` is bumped so any new
 *  evaluations record the new snapshot integer. Existing evaluations keep
 *  their original `scorecardVersion` value — they are intentionally not
 *  cascade-updated. Promoting the integer `version` into a full
 *  `scorecard_versions` snapshot table is a deferred Phase 2 follow-up. */
export async function saveScorecard(
  input: unknown,
): Promise<SaveScorecardResult> {
  const parsed = SaveScorecardSchema.parse(input);
  validateWeights(parsed);

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
          weightPercent: cat.weightPercent,
          scaleType: cat.scaleType,
          order: cat.order,
        })
        .where(eq(schema.scorecardCategories.id, cat.id));
      for (const crit of cat.criteria) {
        await tx
          .update(schema.scorecardCriteria)
          .set({
            text: crit.text,
            anchor5: crit.anchor5,
            anchor3: crit.anchor3,
            anchor1: crit.anchor1,
          })
          .where(eq(schema.scorecardCriteria.id, crit.id));
      }
    }
    const [updated] = await tx
      .update(schema.scorecards)
      .set({
        version: sql`${schema.scorecards.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.scorecards.id, parsed.scorecardId))
      .returning({ version: schema.scorecards.version });
    if (!updated) throw new Error("Scorecard not found");
    return updated.version;
  });

  revalidatePath("/settings/scorecards");
  revalidatePath(`/settings/scorecards/default`);
  revalidatePath(`/settings/scorecards/${parsed.scorecardId}`);

  return { ok: true, scorecardId: parsed.scorecardId, version: nextVersion };
}

function validateWeights(input: SaveScorecardInput): void {
  const scored = input.categories.filter((c) => !c.isAutofail);
  const sum = scored.reduce((acc, c) => acc + c.weightPercent, 0);
  if (sum !== 100) {
    throw new Error(
      `Category weights must sum to 100 (got ${sum}). Auto-fail categories are excluded.`,
    );
  }
  for (const cat of input.categories) {
    if (cat.isAutofail && cat.weightPercent !== 0) {
      throw new Error(
        `Auto-fail category "${cat.name}" must have weight 0 (got ${cat.weightPercent}).`,
      );
    }
  }
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
    .where(eq(schema.tickets.id, parsed.ticketId))
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
        .where(eq(schema.customers.id, ticket.customerId))
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
  // and (for binary) the per-criterion fail roll.
  const scoringScorecard: ScoringScorecard = {
    id: parsed.scorecard.id,
    name: parsed.scorecard.name,
    version: parsed.scorecard.version,
    autoFailFloor: DEFAULT_SCORECARD.autoFailFloor,
    categories: parsed.scorecard.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weightPercent: cat.weightPercent,
      scaleType: cat.scaleType,
      isAutofail: cat.isAutofail,
      criteria: cat.criteria.map((c) => ({ id: c.id, text: c.text })),
    })),
  };

  const [responseRow] = await db
    .select({ rating: schema.responses.rating, scale: schema.responses.scale })
    .from(schema.responses)
    .where(eq(schema.responses.ticketId, ticket.id))
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
 *  and they're the meaningful surface to preview a scorecard against. */
export async function searchScoredTickets(
  rawQuery: string,
): Promise<TicketPickerRow[]> {
  const q = rawQuery.trim();
  const pattern = q.length === 0
    ? null
    : `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

  const where = pattern
    ? or(
        like(schema.tickets.subject, pattern),
        like(schema.customers.name, pattern),
      )
    : undefined;

  // Pull scored tickets (have at least one evaluation) ordered by most
  // recently scored first. Caps at 20 — enough to scan, not overwhelming.
  const base = db
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
    );

  const rows = await (where ? base.where(where) : base)
    .orderBy(desc(schema.evaluations.scoredAt))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    customerName: r.customerName,
    scoredAt: r.scoredAt instanceof Date ? r.scoredAt.getTime() : r.scoredAt,
  }));
}
