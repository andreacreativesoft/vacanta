import { NextResponse } from "next/server";

import {
  getSearch,
  getSearchInput,
  listSnapshots,
  snapshotTrips,
} from "@/lib/db/queries";
import { startSnapshot } from "@/lib/search/runner";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 10;

const log = createLogger("api:searches:id");

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const search = await getSearch(id);
    if (!search) {
      return NextResponse.json(
        { ok: false, error: "Search not found" },
        { status: 404 },
      );
    }
    const input = JSON.parse(search.paramsJson);
    const snapshots = await listSnapshots(id);
    return NextResponse.json({
      ok: true,
      search: {
        id: search.id,
        label: search.label,
        createdAt: search.createdAt,
        params: input,
      },
      snapshots: snapshots.map((s) => ({
        id: s.id,
        status: s.status,
        phase: s.phase,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        errorMessage: s.errorMessage,
        trips: snapshotTrips(s),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("GET crashed", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const input = await getSearchInput(id);
    if (!input) {
      return NextResponse.json(
        { ok: false, error: "Search not found" },
        { status: 404 },
      );
    }
    const snapshot = await startSnapshot(id);
    return NextResponse.json({ ok: true, snapshotId: snapshot.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("POST crashed", err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
