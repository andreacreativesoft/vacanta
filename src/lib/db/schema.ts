import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const searches = sqliteTable("searches", {
  id: text("id").primaryKey(),
  label: text("label"),
  paramsJson: text("params_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const searchResults = sqliteTable("search_results", {
  id: text("id").primaryKey(),
  searchId: text("search_id")
    .notNull()
    .references(() => searches.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["running", "complete", "error"] }).notNull(),
  resultsJson: text("results_json"),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  searchId: text("search_id").references(() => searches.id, {
    onDelete: "cascade",
  }),
  role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
  contentJson: text("content_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;
export type SearchResult = typeof searchResults.$inferSelect;
export type NewSearchResult = typeof searchResults.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
