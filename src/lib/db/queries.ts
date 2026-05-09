import "server-only";

import { ulid } from "ulid";
import { desc, eq } from "drizzle-orm";

import { db } from "./client";
import { searches, searchResults, chatMessages } from "./schema";
import type {
  ChatMessage,
  NewChatMessage,
  NewSearch,
  NewSearchResult,
  Search,
  SearchResult,
} from "./schema";
import type { SearchInput, TripOption } from "@/types";

export function createSearch(input: SearchInput, label?: string): Search {
  const row: NewSearch = {
    id: ulid(),
    label: label ?? null,
    paramsJson: JSON.stringify(input),
  };
  db.insert(searches).values(row).run();
  const inserted = db
    .select()
    .from(searches)
    .where(eq(searches.id, row.id))
    .get();
  if (!inserted) throw new Error("Failed to create search");
  return inserted;
}

export function listSearches(limit = 50): Array<{
  search: Search;
  latest: SearchResult | null;
}> {
  const rows = db
    .select()
    .from(searches)
    .orderBy(desc(searches.createdAt))
    .limit(limit)
    .all();

  return rows.map((row) => {
    const latest =
      db
        .select()
        .from(searchResults)
        .where(eq(searchResults.searchId, row.id))
        .orderBy(desc(searchResults.startedAt))
        .limit(1)
        .get() ?? null;
    return { search: row, latest };
  });
}

export function getSearch(id: string): Search | null {
  return db.select().from(searches).where(eq(searches.id, id)).get() ?? null;
}

export function getSearchInput(id: string): SearchInput | null {
  const row = getSearch(id);
  if (!row) return null;
  return JSON.parse(row.paramsJson) as SearchInput;
}

export function listSnapshots(searchId: string): SearchResult[] {
  return db
    .select()
    .from(searchResults)
    .where(eq(searchResults.searchId, searchId))
    .orderBy(desc(searchResults.startedAt))
    .all();
}

export function getSnapshot(snapshotId: string): SearchResult | null {
  return (
    db
      .select()
      .from(searchResults)
      .where(eq(searchResults.id, snapshotId))
      .get() ?? null
  );
}

export function createSnapshot(searchId: string): SearchResult {
  const row: NewSearchResult = {
    id: ulid(),
    searchId,
    status: "running",
  };
  db.insert(searchResults).values(row).run();
  const inserted = getSnapshot(row.id);
  if (!inserted) throw new Error("Failed to create snapshot");
  return inserted;
}

export function completeSnapshot(snapshotId: string, trips: TripOption[]) {
  db.update(searchResults)
    .set({
      status: "complete",
      resultsJson: JSON.stringify(trips),
      completedAt: new Date(),
    })
    .where(eq(searchResults.id, snapshotId))
    .run();
}

export function failSnapshot(snapshotId: string, message: string) {
  db.update(searchResults)
    .set({
      status: "error",
      errorMessage: message,
      completedAt: new Date(),
    })
    .where(eq(searchResults.id, snapshotId))
    .run();
}

export function snapshotTrips(snapshot: SearchResult | null): TripOption[] {
  if (!snapshot?.resultsJson) return [];
  try {
    return JSON.parse(snapshot.resultsJson) as TripOption[];
  } catch {
    return [];
  }
}

export function appendChatMessage(input: NewChatMessage): ChatMessage {
  const id = input.id ?? ulid();
  const row: NewChatMessage = { ...input, id };
  db.insert(chatMessages).values(row).run();
  const inserted = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id))
    .get();
  if (!inserted) throw new Error("Failed to append chat message");
  return inserted;
}

export function listChatMessages(searchId: string | null): ChatMessage[] {
  const rows = searchId
    ? db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.searchId, searchId))
        .all()
    : db.select().from(chatMessages).all();
  rows.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return rows;
}

export function deleteSearch(searchId: string) {
  db.delete(searches).where(eq(searches.id, searchId)).run();
}
