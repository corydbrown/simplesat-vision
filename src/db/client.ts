import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __simplesatDb: DrizzleDb | undefined;
}

const url = process.env.TURSO_DATABASE_URL ?? "file:db/simplesat.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

function createDb(): DrizzleDb {
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export const db: DrizzleDb =
  globalThis.__simplesatDb ?? (globalThis.__simplesatDb = createDb());
export { schema };
