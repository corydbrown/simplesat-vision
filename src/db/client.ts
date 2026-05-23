import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __simplesatDb: DrizzleDb | undefined;
}

// `||` (not `??`) so an empty-string env var falls through to the local file.
// Vercel preview deploys set TURSO_DATABASE_URL to "" intentionally to keep
// previews from touching production data; `??` would let the empty string
// reach libsql and throw URL_INVALID during page-data collection.
const url = process.env.TURSO_DATABASE_URL || "file:db/simplesat.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

function createDb(): DrizzleDb {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export const db: DrizzleDb =
  globalThis.__simplesatDb ?? (globalThis.__simplesatDb = createDb());
export { schema };
