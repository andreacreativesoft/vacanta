import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  __db?: DrizzleDb;
  __libsql?: Client;
  __migrated?: boolean;
};

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function resolveConnection(): { url: string; authToken?: string } {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) {
    return { url: remote, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  const raw = process.env.DATABASE_URL ?? "./data/vacation-finder.db";
  if (raw.startsWith("libsql://") || raw.startsWith("http")) {
    return { url: raw, authToken: process.env.TURSO_AUTH_TOKEN };
  }
  if (raw.startsWith("file:")) {
    const filePath = raw.replace(/^file:/, "");
    if (!path.isAbsolute(filePath)) ensureDir(path.resolve(process.cwd(), filePath));
    return { url: raw };
  }
  // Plain path — treat as a local SQLite file
  const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  ensureDir(abs);
  return { url: `file:${abs}` };
}

function init(): { db: DrizzleDb; client: Client } {
  const { url, authToken } = resolveConnection();
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { db, client };
}

if (!globalForDb.__db) {
  const { db, client } = init();
  globalForDb.__db = db;
  globalForDb.__libsql = client;
}

export const db = globalForDb.__db!;
export const libsqlClient = globalForDb.__libsql!;
export { schema };

let migrationPromise: Promise<void> | null = null;

export function ensureMigrated(): Promise<void> {
  if (globalForDb.__migrated) return Promise.resolve();
  if (migrationPromise) return migrationPromise;

  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    globalForDb.__migrated = true;
    return Promise.resolve();
  }

  migrationPromise = migrate(db, { migrationsFolder })
    .then(() => {
      globalForDb.__migrated = true;
    })
    .catch((err) => {
      migrationPromise = null;
      console.error("[db] migration failed", err);
      throw err;
    });
  return migrationPromise;
}
