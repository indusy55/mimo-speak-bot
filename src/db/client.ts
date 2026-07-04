import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Env } from "../core/env.js";
import * as schema from "./schema.js";

export function createDb(env: Pick<Env, "DATABASE_URL">) {
  mkdirSync(dirname(env.DATABASE_URL), { recursive: true });

  const sqlite = new Database(env.DATABASE_URL);
  sqlite.pragma("journal_mode = WAL");

  const db = drizzle(sqlite, { schema });

  migrate(db, {
    migrationsFolder: join(import.meta.dirname, "migrations"),
  });

  return db;
}

export type Db = ReturnType<typeof createDb>;
