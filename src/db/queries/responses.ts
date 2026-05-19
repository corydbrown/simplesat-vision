import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "../client";
import { responsesViewWhere } from "@/lib/view-predicates";
import type { Response, SurveyAnswer } from "../schema";

export type ResponseListRow = {
  id: string;
  rating: number;
  scale: number;
  comment: string | null;
  respondedAt: Date;
  answers: SurveyAnswer[];
  ticketId: string | null;
  ticketSubject: string | null;
  ticketExternalId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerCompany: string | null;
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
      answers: schema.responses.answers,
      ticketId: schema.tickets.id,
      ticketSubject: schema.tickets.subject,
      ticketExternalId: schema.tickets.helpdeskExternalId,
      customerId: schema.customers.id,
      customerName: schema.customers.name,
      customerCompany: schema.customers.company,
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

export type ResponseDetail = Response & {
  ticket: {
    id: string;
    subject: string;
    externalId: string | null;
    status: string;
    channel: string;
  } | null;
  customer: {
    id: string;
    name: string;
    company: string | null;
  } | null;
  teamMember: {
    id: string;
    name: string;
    avatarColor: string;
    team: string;
  } | null;
};

export async function getResponseById(
  id: string,
): Promise<ResponseDetail | null> {
  const [row] = await db
    .select({
      response: schema.responses,
      ticketId: schema.tickets.id,
      ticketSubject: schema.tickets.subject,
      ticketExternalId: schema.tickets.helpdeskExternalId,
      ticketStatus: schema.tickets.status,
      ticketChannel: schema.tickets.channel,
      customerId: schema.customers.id,
      customerName: schema.customers.name,
      customerCompany: schema.customers.company,
      teamMemberId: schema.teamMembers.id,
      teamMemberName: schema.teamMembers.name,
      teamMemberAvatarColor: schema.teamMembers.avatarColor,
      teamMemberTeam: schema.teamMembers.team,
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
    )
    .where(eq(schema.responses.id, id))
    .limit(1);

  if (!row) return null;

  return {
    ...row.response,
    ticket: row.ticketId
      ? {
          id: row.ticketId,
          subject: row.ticketSubject!,
          externalId: row.ticketExternalId,
          status: row.ticketStatus!,
          channel: row.ticketChannel!,
        }
      : null,
    customer: row.customerId
      ? {
          id: row.customerId,
          name: row.customerName!,
          company: row.customerCompany,
        }
      : null,
    teamMember: row.teamMemberId
      ? {
          id: row.teamMemberId,
          name: row.teamMemberName!,
          avatarColor: row.teamMemberAvatarColor!,
          team: row.teamMemberTeam!,
        }
      : null,
  };
}
