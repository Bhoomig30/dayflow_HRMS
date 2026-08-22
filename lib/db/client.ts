// Dayflow — database client
//
// Uses better-sqlite3 (a synchronous, pure-native SQLite binding compiled
// locally at install time — no external binary download required) wrapped
// with drizzle-orm for typed query building.
//
// DATABASE_URL/DATABASE_PATH is configurable so a production deployment can
// point this at a persistent volume. For a real multi-instance production
// deployment, swap the driver for a networked database (Postgres via
// drizzle-orm/node-postgres, etc.) — the schema.ts / service layer above it
// does not need to change meaningfully since all access goes through the
// service layer, not raw SQL scattered across routes.

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "dayflow.db");

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

declare global {
  var __dayflow_sqlite__: Database.Database | undefined;
}

function getRawDb(): Database.Database {
  if (!global.__dayflow_sqlite__) {
    ensureDir(DB_PATH);
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const migrationSql = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "migrations.sql"), "utf-8");
    sqlite.exec(migrationSql);
    global.__dayflow_sqlite__ = sqlite;
  }
  return global.__dayflow_sqlite__;
}

export const rawDb = getRawDb();
export const db = drizzle(rawDb, { schema });
export type DbClient = typeof db;
