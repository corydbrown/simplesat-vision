/**
 * Smoke-test route for the QA coaching comments + reactions server actions.
 * Exercises all five operations end-to-end against the seeded DB and reports
 * pass/fail per step. NOT a UI surface — purely a sanity check for Batch 1.
 *
 * Usage: GET /api/qa/coaching-smoke
 *
 * Steps:
 *  1. Pick the first evaluation + its first message.
 *  2. createComment (top-level)
 *  3. addReaction (on the just-created comment)
 *  4. editComment (own-comment → pass)
 *  5. editComment as a different team member (→ should throw)
 *  6. removeReaction
 *  7. deleteComment as a different team member (→ should throw)
 *  8. deleteComment as author (→ pass)
 */

import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { MockCommentProvider } from "@/lib/qa/coaching";

export const dynamic = "force-dynamic";

type Step = { name: string; ok: boolean; detail?: string };

export async function GET(): Promise<Response> {
  const steps: Step[] = [];
  const provider = new MockCommentProvider();

  const [evaluation] = await db
    .select({ id: schema.evaluations.id, ticketId: schema.evaluations.ticketId })
    .from(schema.evaluations)
    .orderBy(asc(schema.evaluations.scoredAt))
    .limit(1);
  if (!evaluation) {
    return NextResponse.json(
      { ok: false, error: "no evaluations seeded — run db:reset" },
      { status: 500 },
    );
  }

  const [firstMessage] = await db
    .select({ id: schema.ticketMessages.id })
    .from(schema.ticketMessages)
    .where(eq(schema.ticketMessages.ticketId, evaluation.ticketId))
    .orderBy(asc(schema.ticketMessages.createdAt))
    .limit(1);
  if (!firstMessage) {
    return NextResponse.json(
      { ok: false, error: "evaluation's ticket has no messages" },
      { status: 500 },
    );
  }

  const members = await db
    .select({ id: schema.teamMembers.id })
    .from(schema.teamMembers)
    .limit(2);
  if (members.length < 2) {
    return NextResponse.json(
      { ok: false, error: "need at least 2 team members" },
      { status: 500 },
    );
  }
  const [author, other] = members;

  let createdId = "";
  try {
    const created = await provider.createComment({
      evaluationId: evaluation.id,
      messageId: firstMessage.id,
      authorId: author.id,
      body: "Smoke test: this comment was created via MockCommentProvider.",
    });
    createdId = created.id;
    steps.push({ name: "createComment", ok: true, detail: created.id });
  } catch (err) {
    steps.push({ name: "createComment", ok: false, detail: String(err) });
    return NextResponse.json({ ok: false, steps }, { status: 500 });
  }

  try {
    const reaction = await provider.addReaction({
      targetType: "comment",
      targetId: createdId,
      evaluationId: evaluation.id,
      authorId: author.id,
      emoji: "\u{1F525}", // 🔥
    });
    steps.push({ name: "addReaction", ok: true, detail: reaction.id });
  } catch (err) {
    steps.push({ name: "addReaction", ok: false, detail: String(err) });
  }

  try {
    const edited = await provider.editComment(
      createdId,
      "Smoke test edit: same author, body updated.",
      author.id,
    );
    steps.push({
      name: "editComment (own)",
      ok: edited.body.includes("Smoke test edit"),
    });
  } catch (err) {
    steps.push({ name: "editComment (own)", ok: false, detail: String(err) });
  }

  try {
    await provider.editComment(createdId, "should fail", other.id);
    steps.push({
      name: "editComment (other → must throw)",
      ok: false,
      detail: "did NOT throw",
    });
  } catch (err) {
    steps.push({
      name: "editComment (other → must throw)",
      ok: true,
      detail: String(err).slice(0, 100),
    });
  }

  try {
    await provider.removeReaction({
      targetType: "comment",
      targetId: createdId,
      authorId: author.id,
      emoji: "\u{1F525}", // 🔥
    });
    steps.push({ name: "removeReaction", ok: true });
  } catch (err) {
    steps.push({ name: "removeReaction", ok: false, detail: String(err) });
  }

  try {
    await provider.deleteComment(createdId, other.id);
    steps.push({
      name: "deleteComment (other → must throw)",
      ok: false,
      detail: "did NOT throw",
    });
  } catch (err) {
    steps.push({
      name: "deleteComment (other → must throw)",
      ok: true,
      detail: String(err).slice(0, 100),
    });
  }

  try {
    await provider.deleteComment(createdId, author.id);
    steps.push({ name: "deleteComment (own)", ok: true });
  } catch (err) {
    steps.push({ name: "deleteComment (own)", ok: false, detail: String(err) });
  }

  const allOk = steps.every((s) => s.ok);
  return NextResponse.json(
    { ok: allOk, steps },
    { status: allOk ? 200 : 500 },
  );
}
