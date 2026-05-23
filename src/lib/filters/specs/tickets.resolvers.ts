"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { MultiEnumValueOption } from "../multi-enum-resolvers";

/** Distinct tag values currently present on tickets, with occurrence counts.
 *  Tags are user-defined strings — the popover displays them verbatim. */
export async function resolveTicketTags(): Promise<MultiEnumValueOption[]> {
  const rows = await db.all<{ value: string; count: number }>(sql`
    SELECT value AS value, COUNT(*) AS count
    FROM tickets, json_each(tickets.tags)
    WHERE value IS NOT NULL
    GROUP BY value
    ORDER BY count DESC, value ASC
  `);
  return rows.map((r) => ({
    value: r.value,
    label: r.value,
    count: Number(r.count),
  }));
}
