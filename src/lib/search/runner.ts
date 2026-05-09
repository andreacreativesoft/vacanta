import "server-only";

import {
  completeSnapshot,
  createSnapshot,
  failSnapshot,
} from "@/lib/db/queries";
import { runSearch } from "./orchestrator";
import type { SearchInput, TripOption } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("runner");

export type RunInlineResult = {
  searchId: string;
  snapshotId: string;
  trips: TripOption[];
};

/**
 * Run a search synchronously: create a snapshot, execute, persist results, return.
 * Designed to fit inside a single serverless invocation (≤ Vercel maxDuration).
 * Live progress streaming is intentionally dropped for serverless compatibility.
 */
export async function runSearchInline(
  searchId: string,
  input: SearchInput,
): Promise<RunInlineResult> {
  const snapshot = await createSnapshot(searchId);

  // Discard progress events; we only persist the final snapshot.
  const emit = () => {};

  try {
    const trips = await runSearch(input, emit);
    await completeSnapshot(snapshot.id, trips);
    return { searchId, snapshotId: snapshot.id, trips };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("inline run failed", e);
    await failSnapshot(snapshot.id, message);
    throw e;
  }
}
