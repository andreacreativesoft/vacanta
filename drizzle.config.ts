import fs from "node:fs";
import path from "node:path";
import type { Config } from "drizzle-kit";

// drizzle-kit doesn't read Next.js's .env.local automatically; load it ourselves.
loadEnvFile(".env.local");
loadEnvFile(".env");

const remote = process.env.TURSO_DATABASE_URL;
const dbPath = process.env.DATABASE_URL ?? "./data/vacation-finder.db";

const url = remote
  ? remote
  : `file:${path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath)}`;

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
} satisfies Config;

function loadEnvFile(file: string) {
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) return;
  const text = fs.readFileSync(abs, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
