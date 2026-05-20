import { NextResponse } from "next/server";
import { or, like, sql, desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { SearchResponse } from "@/lib/search-types";

export const dynamic = "force-dynamic";

const PER_CATEGORY_LIMIT = 8;

function emptyResponse(): SearchResponse {
  return {
    customers: [],
    tickets: [],
    surveys: [],
    teamMembers: [],
    responses: [],
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 1) {
    return NextResponse.json(emptyResponse());
  }

  const pattern = `%${q.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;

  const [customers, tickets, surveys, teamMembers, responses] =
    await Promise.all([
      db
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          email: schema.customers.email,
          company: schema.customers.company,
        })
        .from(schema.customers)
        .where(
          or(
            like(schema.customers.name, pattern),
            like(schema.customers.email, pattern),
            like(schema.customers.company, pattern),
          ),
        )
        .limit(PER_CATEGORY_LIMIT),

      db
        .select({
          id: schema.tickets.id,
          subject: schema.tickets.subject,
          status: schema.tickets.status,
        })
        .from(schema.tickets)
        .where(
          or(
            like(schema.tickets.subject, pattern),
            like(schema.tickets.id, pattern),
          ),
        )
        .orderBy(desc(schema.tickets.createdAt))
        .limit(PER_CATEGORY_LIMIT),

      db
        .select({
          id: schema.surveys.id,
          name: schema.surveys.name,
          metric: schema.surveys.metric,
          status: schema.surveys.status,
        })
        .from(schema.surveys)
        .where(like(schema.surveys.name, pattern))
        .limit(PER_CATEGORY_LIMIT),

      db
        .select({
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          email: schema.teamMembers.email,
          role: schema.teamMembers.role,
        })
        .from(schema.teamMembers)
        .where(
          or(
            like(schema.teamMembers.name, pattern),
            like(schema.teamMembers.email, pattern),
            like(schema.teamMembers.role, pattern),
          ),
        )
        .limit(PER_CATEGORY_LIMIT),

      db
        .select({
          id: schema.responses.id,
          comment: schema.responses.comment,
          rating: schema.responses.rating,
          scale: schema.responses.scale,
          customerName: schema.customers.name,
        })
        .from(schema.responses)
        .innerJoin(
          schema.customers,
          sql`${schema.responses.customerId} = ${schema.customers.id}`,
        )
        .where(
          or(
            like(schema.responses.comment, pattern),
            like(schema.customers.name, pattern),
          ),
        )
        .orderBy(desc(schema.responses.respondedAt))
        .limit(PER_CATEGORY_LIMIT),
    ]);

  const body: SearchResponse = {
    customers: customers.map((c) => ({
      id: c.id,
      label: c.name,
      secondary: c.company ? `${c.email} · ${c.company}` : c.email,
      href: `/customers/${c.id}`,
    })),
    tickets: tickets.map((t) => ({
      id: t.id,
      label: t.subject,
      secondary: `${t.status} · ${t.id}`,
      href: `/tickets/${t.id}`,
    })),
    surveys: surveys.map((s) => ({
      id: s.id,
      label: s.name,
      secondary: `${s.metric.toUpperCase()} · ${s.status}`,
      href: `/surveys/${s.id}`,
    })),
    teamMembers: teamMembers.map((m) => ({
      id: m.id,
      label: m.name,
      secondary: m.role ? `${m.email} · ${m.role}` : m.email,
      href: `/team-members/${m.id}`,
    })),
    responses: responses.map((r) => {
      const preview = r.comment
        ? r.comment.length > 80
          ? `${r.comment.slice(0, 80)}…`
          : r.comment
        : `Rating ${r.rating}/${r.scale}`;
      return {
        id: r.id,
        label: preview,
        secondary: `${r.customerName} · ${r.rating}/${r.scale}`,
        href: `/responses/${r.id}`,
      };
    }),
  };

  return NextResponse.json(body);
}
