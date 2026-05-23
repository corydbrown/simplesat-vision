"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { TOPIC_BY_ID } from "@/lib/topics";

export type MultiEnumValueOption = {
  value: string;
  /** Human-readable label. Equals `value` unless a registry overrides
   *  it (e.g. topics resolve slugs → display labels). */
  label: string;
  /** Occurrence count across all rows of the source table. */
  count: number;
};

/** Fetch the distinct values currently present in a JSON-array column, with
 *  occurrence counts. Sorted by count desc, then value asc. Keyed by the
 *  `dynamicValuesKey` declared on the property filter spec. */
export async function fetchMultiEnumValues(
  key: string,
): Promise<MultiEnumValueOption[]> {
  switch (key) {
    case "ticket.tags": {
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
    case "response.topics": {
      const rows = await db.all<{ value: string; count: number }>(sql`
        SELECT json_extract(value, '$.topic') AS value, COUNT(*) AS count
        FROM responses, json_each(responses.topics)
        WHERE json_extract(value, '$.topic') IS NOT NULL
        GROUP BY value
        ORDER BY count DESC, value ASC
      `);
      return rows.map((r) => ({
        value: r.value,
        label: TOPIC_BY_ID[r.value]?.label ?? r.value,
        count: Number(r.count),
      }));
    }
    default:
      return [];
  }
}
