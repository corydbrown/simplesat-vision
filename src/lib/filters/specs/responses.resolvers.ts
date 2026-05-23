"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { TOPIC_BY_ID } from "@/lib/topics";
import type { MultiEnumValueOption } from "../multi-enum-resolvers";

/** Distinct topic slugs currently present on responses, with occurrence counts.
 *  Topics are stored as `[{ topic, sentiment }, ...]`, so we json_extract the
 *  topic slug and resolve it to a display label via the static taxonomy. */
export async function resolveResponseTopics(): Promise<MultiEnumValueOption[]> {
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
