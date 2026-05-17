import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __simplesatDb: Database.Database | undefined;
}

const dbPath = path.join(process.cwd(), "db", "simplesat.db");

function createSqliteConnection() {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

const sqlite =
  globalThis.__simplesatDb ?? (globalThis.__simplesatDb = createSqliteConnection());

export const db = drizzle(sqlite, { schema });
export { schema };
