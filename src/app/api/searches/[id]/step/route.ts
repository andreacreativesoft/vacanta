import { NextResponse } from "next/server";

import { failSnapshot, getSearchInput } from "@/lib/db/queries";
import { advanceSnapshot } from "@/lib/search/runner";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 10;

const log = createLogger("api:step");

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const url = new URL(request.url);
    const snapshotId = url.searchParams.get("snapshot");
    if (!snapshotId) {
      return NextResponse.json(
        { ok: false, error: "snapshot id required" },
        { status: 400 },
      );
    }
    const input = await getSearchInput(id);
    if (!input) {
      return NextResponse.json(
        { ok: false, error: "Search not found" },
        { status: 404 },
      );
    }

    const result = await advanceSnapshot(snapshotId, input);
    return NextResponse.json({ ok: true, snapshotId, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("step handler crashed", err);
    // Best-effort: mark the snapshot as errored so polling stops.
    try {
      const url = new URL(request.url);
      const snapshotId = url.searchParams.get("snapshot");
      if (snapshotId) await failSnapshot(snapshotId, message);
    } catch {
      /* ignore */
    }
    return NextResponse.json(
      { ok: false, error: message, done: true, status: "error" },
      { status: 200 },
    );
  }
}
