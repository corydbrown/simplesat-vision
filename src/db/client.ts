import { createClient, type Client, type InStatement } from "@libsql/client";
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

// SVP-162 diagnostic: env-gated query logger. Set SIMPLESAT_QUERY_LOG=1 to
// emit `[db] {duration}ms {sql preview}` for every libsql call. Remove this
// wrapper once perf work lands.
function previewSql(stmt: InStatement): string {
  const raw = typeof stmt === "string" ? stmt : stmt.sql;
  return raw.replace(/\s+/g, " ").trim().slice(0, 120);
}

function wrapWithLogger(client: Client): Client {
  if (process.env.SIMPLESAT_QUERY_LOG !== "1") return client;
  const origExecute = client.execute.bind(client);
  const origBatch = client.batch.bind(client);
  // Cast: the libsql Client.execute has two overload shapes; we forward the
  // single arg untouched and let the runtime sort it out.
  client.execute = (async (...args: unknown[]) => {
    const t0 = performance.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (origExecute as any)(...args);
    } finally {
      const dt = (performance.now() - t0).toFixed(1);
      const stmt = args[0] as InStatement;
      console.log(`[db] ${dt}ms execute :: ${previewSql(stmt)}`);
    }
  }) as Client["execute"];
  client.batch = (async (...args: unknown[]) => {
    const t0 = performance.now();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (origBatch as any)(...args);
    } finally {
      const dt = (performance.now() - t0).toFixed(1);
      const stmts = (args[0] as InStatement[]) ?? [];
      console.log(
        `[db] ${dt}ms batch(${stmts.length}) :: ${stmts
          .map(previewSql)
          .join(" | ")
          .slice(0, 200)}`,
      );
    }
  }) as Client["batch"];
  return client;
}

function createDb(): DrizzleDb {
  const client = wrapWithLogger(createClient({ url, authToken }));
  return drizzle(client, { schema });
}

export const db: DrizzleDb =
  globalThis.__simplesatDb ?? (globalThis.__simplesatDb = createDb());
export { schema };
