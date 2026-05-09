import "server-only";

import {
  completeSnapshot,
  createSnapshot,
  failSnapshot,
  getSnapshot,
  updateSnapshotProgress,
} from "@/lib/db/queries";
import { initialState, step, type SnapshotState } from "./step";
import type { SearchInput } from "@/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("runner");

export async function startSnapshot(searchId: string) {
  const state = initialState();
  return await createSnapshot(searchId, state);
}

export async function advanceSnapshot(
  snapshotId: string,
  input: SearchInput,
): Promise<{
  done: boolean;
  phase: string;
  current: number;
  total: number;
  label: string;
  status: "running" | "complete" | "error";
  errorMessage?: string;
}> {
  const snapshot = await getSnapshot(snapshotId);
  if (!snapshot) throw new Error("Snapshot not found");
  if (snapshot.status !== "running") {
    return {
      done: true,
      phase: snapshot.phase ?? "complete",
      current: 1,
      total: 1,
      label: snapshot.phase ?? "complete",
      status: snapshot.status,
      errorMessage: snapshot.errorMessage ?? undefined,
    };
  }

  let state: SnapshotState;
  try {
    state = JSON.parse(snapshot.progressJson ?? "{}") as SnapshotState;
    if (!state.phase) state = initialState();
  } catch {
    state = initialState();
  }

  try {
    const result = await step(input, state);
    if (result.done) {
      await completeSnapshot(snapshotId, result.state.trips);
      return {
        done: true,
        phase: "complete",
        current: result.current,
        total: result.total,
        label: result.label,
        status: "complete",
      };
    }
    await updateSnapshotProgress(
      snapshotId,
      result.state.phase,
      result.state,
    );
    return {
      done: false,
      phase: result.state.phase,
      current: result.current,
      total: result.total,
      label: result.label,
      status: "running",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("step failed", e);
    await failSnapshot(snapshotId, message);
    return {
      done: true,
      phase: "error",
      current: 0,
      total: 0,
      label: message,
      status: "error",
      errorMessage: message,
    };
  }
}
