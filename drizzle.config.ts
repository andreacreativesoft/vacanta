import path from "node:path";
import type { Config } from "drizzle-kit";

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
