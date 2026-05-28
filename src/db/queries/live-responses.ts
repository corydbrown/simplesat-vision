import { isNull, sql, type SQL } from "drizzle-orm";

import { responses } from "@/db/schema";

/** Filter applied to every aggregation / list site that reads `responses`.
 *  Hides rows that were marked superseded by `dedupeTicketResponses` (a
 *  helpdesk-native CSAT row that lost to a Simplesat-native one on the same
 *  ticket — see SVP-181 in DECISIONS.md).
 *
 *  Two flavors so every site stays greppable:
 *    - `liveResponsesFilter()` for Drizzle-typed queries (drop into `and(...)`)
 *    - `LIVE_RESPONSES_SQL` (raw, qualified) for inline `sql\`...\`` aggregates
 *    - `LIVE_RESPONSES_SQL_UNQUALIFIED` for inner SELECTs that aren't already
 *      ambiguous (e.g. `SELECT ... FROM responses WHERE ...`).
 *
 *  Detail surfaces (`getResponseById`, drawer, /responses/[id]) intentionally
 *  do NOT apply this filter — a direct link to a superseded row should still
 *  render, with a "superseded by →" banner as a separate UI follow-up. */
export const liveResponsesFilter = (): SQL =>
  isNull(responses.supersededBy);

export const LIVE_RESPONSES_SQL = sql`responses.superseded_by IS NULL`;

export const LIVE_RESPONSES_SQL_UNQUALIFIED = sql`superseded_by IS NULL`;
