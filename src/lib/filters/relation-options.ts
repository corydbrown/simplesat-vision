"use server";

import { inArray, like, or } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { RelationEntity } from "./descriptor";

export type RelationOption = {
  value: string;
  label: string;
  /** Background color for the avatar circle (team members + customers).
   *  Empty string when the entity has no avatar (surveys, tickets). */
  avatarColor?: string;
};

const SEARCH_LIMIT = 50;

/** Search a relation entity by name/identifier. Empty query returns the first
 *  N rows (ordered by name) so the dropdown isn't blank on first open. */
export async function searchRelationOptions(
  entity: RelationEntity,
  query: string,
): Promise<RelationOption[]> {
  const q = query.trim();
  switch (entity) {
    case "customer": {
      const rows = await db
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          email: schema.customers.email,
        })
        .from(schema.customers)
        .where(
          q
            ? or(
                like(schema.customers.name, `%${q}%`),
                like(schema.customers.email, `%${q}%`),
              )
            : undefined,
        )
        .orderBy(schema.customers.name)
        .limit(SEARCH_LIMIT);
      // Customer avatar color is derived from name client-side (see CustomerPill).
      return rows.map((r) => ({ value: r.id, label: r.name || r.email }));
    }
    case "team_member": {
      const rows = await db
        .select({
          id: schema.teamMembers.id,
          name: schema.teamMembers.name,
          avatarColor: schema.teamMembers.avatarColor,
        })
        .from(schema.teamMembers)
        .where(q ? like(schema.teamMembers.name, `%${q}%`) : undefined)
        .orderBy(schema.teamMembers.name)
        .limit(SEARCH_LIMIT);
      return rows.map((r) => ({
        value: r.id,
        label: r.name,
        avatarColor: r.avatarColor ?? undefined,
      }));
    }
    case "survey": {
      const rows = await db
        .select({ id: schema.surveys.id, name: schema.surveys.name })
        .from(schema.surveys)
        .where(q ? like(schema.surveys.name, `%${q}%`) : undefined)
        .orderBy(schema.surveys.name)
        .limit(SEARCH_LIMIT);
      return rows.map((r) => ({ value: r.id, label: r.name }));
    }
    case "ticket": {
      const rows = await db
        .select({
          id: schema.tickets.id,
          subject: schema.tickets.subject,
          externalId: schema.tickets.helpdeskExternalId,
        })
        .from(schema.tickets)
        .where(
          q
            ? or(
                like(schema.tickets.subject, `%${q}%`),
                like(schema.tickets.helpdeskExternalId, `%${q}%`),
              )
            : undefined,
        )
        .orderBy(schema.tickets.createdAt)
        .limit(SEARCH_LIMIT);
      return rows.map((r) => ({
        value: r.id,
        label: r.externalId ? `#${r.externalId} ${r.subject}` : r.subject,
      }));
    }
  }
}

/** Resolve a batch of IDs to their human-readable labels. Used by chips
 *  rendered from URL state where only the ID is known. */
export async function resolveRelationLabels(
  entity: RelationEntity,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  switch (entity) {
    case "customer": {
      const rows = await db
        .select({
          id: schema.customers.id,
          name: schema.customers.name,
          email: schema.customers.email,
        })
        .from(schema.customers)
        .where(inArray(schema.customers.id, ids));
      return Object.fromEntries(
        rows.map((r) => [r.id, r.name || r.email] as const),
      );
    }
    case "team_member": {
      const rows = await db
        .select({ id: schema.teamMembers.id, name: schema.teamMembers.name })
        .from(schema.teamMembers)
        .where(inArray(schema.teamMembers.id, ids));
      return Object.fromEntries(rows.map((r) => [r.id, r.name] as const));
    }
    case "survey": {
      const rows = await db
        .select({ id: schema.surveys.id, name: schema.surveys.name })
        .from(schema.surveys)
        .where(inArray(schema.surveys.id, ids));
      return Object.fromEntries(rows.map((r) => [r.id, r.name] as const));
    }
    case "ticket": {
      const rows = await db
        .select({
          id: schema.tickets.id,
          subject: schema.tickets.subject,
          externalId: schema.tickets.helpdeskExternalId,
        })
        .from(schema.tickets)
        .where(inArray(schema.tickets.id, ids));
      return Object.fromEntries(
        rows.map(
          (r) =>
            [
              r.id,
              r.externalId ? `#${r.externalId} ${r.subject}` : r.subject,
            ] as const,
        ),
      );
    }
  }
}
