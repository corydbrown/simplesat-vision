import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../client";
import { responsesViewWhere } from "@/lib/view-predicates";

export type ResponseListRow = {
  id: string;
  rating: number;
  scale: number;
  comment: string | null;
  respondedAt: Date;
  ticketId: string | null;
  ticketSubject: string | null;
  customerId: string | null;
  customerName: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  teamMemberAvatarColor: string | null;
};

export async function listResponses({
  view,
  limit = 200,
}: { view?: string; limit?: number } = {}): Promise<{
  rows: ResponseListRow[];
  total: number;
}> {
  const where = view ? responsesViewWhere(view) : undefined;

  const baseQuery = db
    .select({
      id: schema.responses.id,
      rating: schema.responses.rating,
      scale: schema.responses.scale,
      comment: schema.responses.comment,
      respondedAt: schema.responses.respondedAt,
      ticketId: schema.tickets.id,
      ticketSubject: schema.tickets.subject,
      customerId: schema.customers.id,
      customerName: schema.customers.name,
      teamMemberId: schema.teamMembers.id,
      teamMemberName: schema.teamMembers.name,
      teamMemberAvatarColor: schema.teamMembers.avatarColor,
    })
    .from(schema.responses)
    .leftJoin(
      schema.tickets,
      eq(schema.tickets.id, schema.responses.ticketId),
    )
    .leftJoin(
      schema.customers,
      eq(schema.customers.id, schema.responses.customerId),
    )
    .leftJoin(
      schema.teamMembers,
      eq(schema.teamMembers.id, schema.responses.teamMemberId),
    );

  const [rows, total] = await Promise.all([
    (where ? baseQuery.where(where) : baseQuery)
      .orderBy(desc(schema.responses.respondedAt))
      .limit(limit),
    db.$count(schema.responses, where),
  ]);

  return { rows, total };
}
