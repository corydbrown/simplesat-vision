import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { DEMO_WORKSPACE_ID } from "@/lib/workspace-id";
import {
  CUSTOMER_CUSTOM_FIELDS,
  TEAM_MEMBER_CUSTOM_FIELDS,
  type CustomFieldDataType,
  type CustomFieldDef,
  type SeedCustomFieldDef,
} from "./custom-fields";

/**
 * Workspace-aware source of custom-attribute definitions.
 *
 * - Bloom Beauty (`DEMO_WORKSPACE_ID`) keeps its hand-curated array verbatim —
 *   importance + sample values are deliberately tuned for the demo narrative
 *   (per CLAUDE.md / DECISIONS). We only strip the non-serializable `sample`
 *   fn so the defs can cross the RSC → Client boundary.
 * - Every other workspace derives its defs from the actual `custom_properties`
 *   keys present in that workspace's data (SQLite `json_each`). Nothing
 *   fictional shows: a real Simplesat/Intercom workspace surfaces only the
 *   attributes its own customers actually carry.
 *
 * Provider-shaped on purpose: when custom-field defs eventually move to a real
 * per-workspace store, only these two functions change — every call site keeps
 * consuming `CustomFieldDef[]`.
 */

/** Drop the seed-only `sample` fn, leaving a serializable descriptor. */
function toSerializable(defs: SeedCustomFieldDef[]): CustomFieldDef[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return defs.map(({ sample, ...rest }) => rest);
}

const BLOOM_CUSTOMER_FIELDS: CustomFieldDef[] = toSerializable(
  CUSTOMER_CUSTOM_FIELDS,
);
const BLOOM_TEAM_MEMBER_FIELDS: CustomFieldDef[] = toSerializable(
  TEAM_MEMBER_CUSTOM_FIELDS,
);

/** "loyalty_points_balance" → "Loyalty points balance". */
function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Matches a leading ISO-8601 date (with or without a time component) so
// string-typed values that are really timestamps render as dates.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

/** Map a SQLite `json_each.type` (+ a sample value) to our data type. */
function inferDataType(
  jsonType: string,
  sampleValue: string | null,
): CustomFieldDataType {
  switch (jsonType) {
    case "integer":
    case "real":
      return "number";
    case "true":
    case "false":
      return "boolean";
    default:
      if (sampleValue && ISO_DATE_RE.test(sampleValue)) return "date";
      return "string";
  }
}

type KeyRow = { k: string; t: string; sample: string | null };

/**
 * Derive defs from the distinct top-level `custom_properties` keys present in
 * a workspace's rows. Field ids are the bare JSON keys, so the `cf_<key>`
 * property ids stay stable across loads — EntityTable's localStorage column
 * visibility/order (keyed by property id) survives.
 */
async function deriveFields(
  table: "customers" | "team_members",
  workspaceId: string,
): Promise<CustomFieldDef[]> {
  const rows = await db.all<KeyRow>(sql`
    SELECT je.key AS k,
           MAX(je.type) AS t,
           MIN(CAST(je.value AS TEXT)) AS sample
    FROM ${sql.raw(table)}, json_each(${sql.raw(table)}.custom_properties) je
    WHERE ${sql.raw(table)}.workspace_id = ${workspaceId}
    GROUP BY je.key
    ORDER BY je.key
  `);

  return rows.map((r) => ({
    id: r.k,
    label: humanizeKey(r.k),
    dataType: inferDataType(r.t, r.sample),
    // Derived fields get a neutral importance and hide by default — the table
    // shows core fields only, and the user opts into custom columns via the
    // column picker. "Nothing fictional shows" by default.
    importance: 3,
    defaultVisible: false,
  }));
}

export async function getCustomerCustomFields(
  workspaceId: string,
): Promise<CustomFieldDef[]> {
  if (workspaceId === DEMO_WORKSPACE_ID) return BLOOM_CUSTOMER_FIELDS;
  return deriveFields("customers", workspaceId);
}

export async function getTeamMemberCustomFields(
  workspaceId: string,
): Promise<CustomFieldDef[]> {
  if (workspaceId === DEMO_WORKSPACE_ID) return BLOOM_TEAM_MEMBER_FIELDS;
  return deriveFields("team_members", workspaceId);
}
