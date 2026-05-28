/**
 * Sanity-check route for the QA scoring provider. Loads a ticket + its
 * messages + the default scorecard from the DB, runs the configured
 * provider, and returns the raw ScoringOutput as JSON.
 *
 * This does NOT persist the evaluation — it's purely for smoke-testing the
 * scoring pipeline end-to-end from app code (proving the provider works
 * outside the seed script). Once the QA UI lands (SVP-54+), real scoring
 * happens via a server action or background job and persists to the DB.
 *
 * Usage: GET /api/qa/score/<ticketId>
 *
 * Returns 404 if the ticket has no messages (i.e. it isn't a conversation-
 * mockup ticket — only the 50 timeline tickets have messages today).
 */

import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { liveResponsesFilter } from "@/db/queries/live-responses";
import { getScoringProvider } from "@/lib/qa/scoring";
import type {
  ScoringInput,
  ScoringMessage,
  ScoringScorecard,
} from "@/lib/qa/scoring";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await params;

  const [ticket] = await db
    .select()
    .from(schema.tickets)
    .where(eq(schema.tickets.id, ticketId))
    .limit(1);
  if (!ticket) {
    return NextResponse.json({ error: "ticket not found" }, { status: 404 });
  }

  const messageRows = await db
    .select()
    .from(schema.ticketMessages)
    .where(eq(schema.ticketMessages.ticketId, ticketId))
    .orderBy(asc(schema.ticketMessages.createdAt));
  if (messageRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "ticket has no messages — only conversation-mockup tickets are scorable in the prototype seed",
      },
      { status: 404 },
    );
  }

  const [scorecard] = await db
    .select()
    .from(schema.scorecards)
    .where(eq(schema.scorecards.isDefault, true))
    .limit(1);
  if (!scorecard) {
    return NextResponse.json(
      { error: "no default scorecard seeded — run db:seed" },
      { status: 500 },
    );
  }

  const categoryRows = await db
    .select()
    .from(schema.scorecardCategories)
    .where(eq(schema.scorecardCategories.scorecardId, scorecard.id))
    .orderBy(asc(schema.scorecardCategories.order));
  const criterionRows = await db
    .select()
    .from(schema.scorecardCriteria)
    .orderBy(asc(schema.scorecardCriteria.order));
  const criteriaByCategoryId = new Map<string, typeof criterionRows>();
  for (const c of criterionRows) {
    const list = criteriaByCategoryId.get(c.categoryId) ?? [];
    list.push(c);
    criteriaByCategoryId.set(c.categoryId, list);
  }

  const scoringScorecard: ScoringScorecard = {
    id: scorecard.id,
    name: scorecard.name,
    version: scorecard.version,
    // Default floor per PRD; surfaced here rather than persisted on the
    // scorecard row because in Phase 1 the floor is global, not per-card.
    autoFailFloor: 30,
    categories: categoryRows.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weightPercent: cat.weightPercent,
      scaleType: cat.scaleType,
      isAutofail: cat.isAutofail,
      criteria: (criteriaByCategoryId.get(cat.id) ?? []).map((c) => ({
        id: c.id,
        text: c.text,
      })),
    })),
  };

  const messages: ScoringMessage[] = messageRows.map((m) => ({
    id: m.id,
    authorRole: m.authorRole,
    authorName: null,
    body: m.body,
    isPublic: m.isPublic,
    createdAt: m.createdAt,
  }));

  const [responseRow] = await db
    .select({ rating: schema.responses.rating, scale: schema.responses.scale })
    .from(schema.responses)
    .where(
      and(
        eq(schema.responses.ticketId, ticketId),
        liveResponsesFilter(),
      ),
    )
    .limit(1);
  const responseRating = responseRow
    ? Math.round((responseRow.rating * 5) / responseRow.scale)
    : null;

  const input: ScoringInput = {
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

  const provider = getScoringProvider();
  const output = await provider.scoreConversation(input);

  return NextResponse.json({
    provider: provider.name,
    ticketId: ticket.id,
    persisted: false,
    output,
  });
}
