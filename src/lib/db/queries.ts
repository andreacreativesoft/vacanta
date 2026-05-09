import "server-only";

import { ulid } from "ulid";
import { desc, eq } from "drizzle-orm";

import { db, ensureMigrated } from "./client";
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

export async function createSearch(
  input: SearchInput,
  label?: string,
): Promise<Search> {
  await ensureMigrated();
  const row: NewSearch = {
    id: ulid(),
    label: label ?? null,
    paramsJson: JSON.stringify(input),
  };
  await db.insert(searches).values(row);
  const inserted = await db
    .select()
    .from(searches)
    .where(eq(searches.id, row.id))
    .get();
  if (!inserted) throw new Error("Failed to create search");
  return inserted;
}

export async function listSearches(limit = 50): Promise<
  Array<{
    search: Search;
    latest: SearchResult | null;
  }>
> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(searches)
    .orderBy(desc(searches.createdAt))
    .limit(limit);

  const out: Array<{ search: Search; latest: SearchResult | null }> = [];
  for (const row of rows) {
    const latest =
      (await db
        .select()
        .from(searchResults)
        .where(eq(searchResults.searchId, row.id))
        .orderBy(desc(searchResults.startedAt))
        .limit(1)
        .get()) ?? null;
    out.push({ search: row, latest });
  }
  return out;
}

export async function getSearch(id: string): Promise<Search | null> {
  await ensureMigrated();
  return (
    (await db.select().from(searches).where(eq(searches.id, id)).get()) ?? null
  );
}

export async function getSearchInput(id: string): Promise<SearchInput | null> {
  const row = await getSearch(id);
  if (!row) return null;
  return JSON.parse(row.paramsJson) as SearchInput;
}

export async function listSnapshots(
  searchId: string,
): Promise<SearchResult[]> {
  await ensureMigrated();
  return await db
    .select()
    .from(searchResults)
    .where(eq(searchResults.searchId, searchId))
    .orderBy(desc(searchResults.startedAt));
}

export async function getSnapshot(
  snapshotId: string,
): Promise<SearchResult | null> {
  await ensureMigrated();
  return (
    (await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.id, snapshotId))
      .get()) ?? null
  );
}

export async function createSnapshot(
  searchId: string,
  initialState: object,
): Promise<SearchResult> {
  await ensureMigrated();
  const row: NewSearchResult = {
    id: ulid(),
    searchId,
    status: "running",
    phase: "init",
    progressJson: JSON.stringify(initialState),
  };
  await db.insert(searchResults).values(row);
  const inserted = await getSnapshot(row.id);
  if (!inserted) throw new Error("Failed to create snapshot");
  return inserted;
}

export async function updateSnapshotProgress(
  snapshotId: string,
  phase: string,
  progress: object,
): Promise<void> {
  await db
    .update(searchResults)
    .set({
      phase,
      progressJson: JSON.stringify(progress),
    })
    .where(eq(searchResults.id, snapshotId));
}

export async function completeSnapshot(
  snapshotId: string,
  trips: TripOption[],
): Promise<void> {
  await db
    .update(searchResults)
    .set({
      status: "complete",
      phase: "complete",
      resultsJson: JSON.stringify(trips),
      completedAt: new Date(),
    })
    .where(eq(searchResults.id, snapshotId));
}

export async function failSnapshot(
  snapshotId: string,
  message: string,
): Promise<void> {
  await db
    .update(searchResults)
    .set({
      status: "error",
      phase: "error",
      errorMessage: message,
      completedAt: new Date(),
    })
    .where(eq(searchResults.id, snapshotId));
}

export function snapshotTrips(snapshot: SearchResult | null): TripOption[] {
  if (!snapshot?.resultsJson) return [];
  try {
    return JSON.parse(snapshot.resultsJson) as TripOption[];
  } catch {
    return [];
  }
}

export async function appendChatMessage(
  input: NewChatMessage,
): Promise<ChatMessage> {
  await ensureMigrated();
  const id = input.id ?? ulid();
  const row: NewChatMessage = { ...input, id };
  await db.insert(chatMessages).values(row);
  const inserted = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id))
    .get();
  if (!inserted) throw new Error("Failed to append chat message");
  return inserted;
}

export async function listChatMessages(
  searchId: string | null,
): Promise<ChatMessage[]> {
  await ensureMigrated();
  const rows = searchId
    ? await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.searchId, searchId))
    : await db.select().from(chatMessages);
  rows.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return rows;
}

export async function deleteSearch(searchId: string): Promise<void> {
  await db.delete(searches).where(eq(searches.id, searchId));
}
