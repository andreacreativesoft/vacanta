import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __db?: DrizzleDb;
  __sqlite?: Database.Database;
};

function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "./data/vacation-finder.db";
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createConnection() {
  const dbPath = resolveDbPath();
  ensureDir(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (fs.existsSync(migrationsFolder)) {
    try {
      migrate(db, { migrationsFolder });
    } catch (err) {
      console.error("[db] migration failed", err);
      throw err;
    }
  }

  return { sqlite, db };
}

if (!globalForDb.__db) {
  const { sqlite, db } = createConnection();
  globalForDb.__db = db;
  globalForDb.__sqlite = sqlite;
}

export const db = globalForDb.__db!;
export const sqlite = globalForDb.__sqlite!;
export { schema };
