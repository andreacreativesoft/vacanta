import "server-only";

import {
  completeSnapshot,
  createSnapshot,
  failSnapshot,
} from "@/lib/db/queries";
import { runSearch } from "./orchestrator";
import type { ProgressEvent, SearchInput, TripOption } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("runner");

type Subscriber = (event: ProgressEvent) => void;

type RunState = {
  snapshotId: string;
  searchId: string;
  events: ProgressEvent[];
  subscribers: Set<Subscriber>;
  done: boolean;
  trips: TripOption[];
  error?: string;
};

const globalForRuns = globalThis as unknown as {
  __runs?: Map<string, RunState>;
};
if (!globalForRuns.__runs) {
  globalForRuns.__runs = new Map<string, RunState>();
}
const runs = globalForRuns.__runs!;

export function getRun(snapshotId: string): RunState | undefined {
  return runs.get(snapshotId);
}

export function startRun(searchId: string, input: SearchInput): RunState {
  const snapshot = createSnapshot(searchId);
  const state: RunState = {
    snapshotId: snapshot.id,
    searchId,
    events: [],
    subscribers: new Set(),
    done: false,
    trips: [],
  };
  runs.set(snapshot.id, state);

  const emit = (event: ProgressEvent) => {
    state.events.push(event);
    for (const sub of state.subscribers) {
      try {
        sub(event);
      } catch (err) {
        log.warn("subscriber failed", err);
      }
    }
  };

  // fire-and-forget background execution
  void (async () => {
    try {
      const trips = await runSearch(input, emit);
      state.trips = trips;
      completeSnapshot(snapshot.id, trips);
      emit({
        type: "done",
        searchId,
        snapshotId: snapshot.id,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error("run failed", e);
      state.error = message;
      failSnapshot(snapshot.id, message);
      emit({ type: "error", message });
    } finally {
      state.done = true;
      // Keep state around briefly so late subscribers can read final events
      setTimeout(() => {
        runs.delete(snapshot.id);
      }, 60_000);
    }
  })();

  return state;
}

export function subscribe(snapshotId: string, sub: Subscriber): () => void {
  const state = runs.get(snapshotId);
  if (!state) return () => {};
  for (const evt of state.events) {
    sub(evt);
  }
  if (state.done) return () => {};
  state.subscribers.add(sub);
  return () => state.subscribers.delete(sub);
}
