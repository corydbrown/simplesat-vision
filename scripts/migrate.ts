/**
 * Apply pending Drizzle migrations through the app's own libsql client.
 *
 *   set -a && source .env.local && set +a   # so it targets the right DB
 *   npx tsx scripts/migrate.ts
 *
 * Why this exists alongside `npm run db:migrate` (drizzle-kit): the drizzle-kit
 * CLI errors under Node 25 (the version this worktree runs). This programmatic
 * migrator uses the same libsql path the running app does and works on any Node
 * version. CI / Vercel (Node 20) keep using `drizzle-kit migrate` via the build
 * script; this is the local escape hatch. Same `drizzle/` folder + journal, so
 * the two are interchangeable.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL || "file:db/simplesat.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

async function main() {
  const db = drizzle(createClient({ url, authToken }));
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log(`migrations applied → ${url}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
