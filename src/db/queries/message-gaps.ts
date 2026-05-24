import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../client";

export type CadenceBucket = "fast" | "medium" | "slow";

/** Default cadence thresholds for inter-message gaps. Channel-agnostic for V1
 *  — a future task may want per-channel thresholds (chat tighter than email).
 *  Exported so callers can compare/recompute against the same constants. */
export const CADENCE_THRESHOLDS_SECONDS = {
  fastMax: 5 * 60,
  mediumMax: 30 * 60,
} as const;

export type MessageGap = {
  messageId: string;
  prevMessageId: string | null;
  /** Seconds between this message and the previous one, ordered by createdAt
   *  ASC. `0` for the first message in the ticket. */
  gapSeconds: number;
  /** Who was waiting during the gap *before* this message. If this message is
   *  from the agent, the customer was waiting (for the agent reply). If from
   *  the customer, the agent was waiting. `null` for the first message and
   *  for system messages (no one is "waiting" on an automated event). */
  waitingRole: "customer" | "agent" | null;
  /** Bucketed cadence label for the gap (green/yellow/red equivalent). */
  cadenceBucket: CadenceBucket;
};

function bucketFor(gapSeconds: number): CadenceBucket {
  if (gapSeconds <= CADENCE_THRESHOLDS_SECONDS.fastMax) return "fast";
  if (gapSeconds <= CADENCE_THRESHOLDS_SECONDS.mediumMax) return "medium";
  return "slow";
}

function waitingRoleFor(
  authorRole: "customer" | "agent" | "system",
  hasPrev: boolean,
): "customer" | "agent" | null {
  if (!hasPrev) return null;
  if (authorRole === "agent") return "customer";
  if (authorRole === "customer") return "agent";
  return null;
}

export async function getMessageGaps(ticketId: string): Promise<MessageGap[]> {
  const rows = await db
    .select({
      id: schema.ticketMessages.id,
      authorRole: schema.ticketMessages.authorRole,
      createdAt: schema.ticketMessages.createdAt,
    })
    .from(schema.ticketMessages)
    .where(eq(schema.ticketMessages.ticketId, ticketId))
    .orderBy(asc(schema.ticketMessages.createdAt));

  const out: MessageGap[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const prev = i > 0 ? rows[i - 1] : null;
    const gapSeconds = prev
      ? Math.max(
          0,
          Math.round(
            (row.createdAt.getTime() - prev.createdAt.getTime()) / 1000,
          ),
        )
      : 0;
    out.push({
      messageId: row.id,
      prevMessageId: prev?.id ?? null,
      gapSeconds,
      waitingRole: waitingRoleFor(row.authorRole, prev !== null),
      cadenceBucket: bucketFor(gapSeconds),
    });
  }
  return out;
}
