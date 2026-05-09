import path from "node:path";
import type { Config } from "drizzle-kit";

const dbPath = process.env.DATABASE_URL ?? "./data/vacation-finder.db";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath),
  },
  verbose: true,
  strict: true,
} satisfies Config;
