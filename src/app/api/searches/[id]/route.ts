import { NextResponse } from "next/server";

import {
  getSearch,
  getSearchInput,
  listSnapshots,
  snapshotTrips,
} from "@/lib/db/queries";
import { runSearchInline } from "@/lib/search/runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      errorMessage: s.errorMessage,
      trips: snapshotTrips(s),
    })),
  });
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const input = await getSearchInput(id);
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "Search not found" },
      { status: 404 },
    );
  }
  try {
    const result = await runSearchInline(id, input);
    return NextResponse.json({
      ok: true,
      snapshotId: result.snapshotId,
      tripCount: result.trips.length,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Refresh failed",
      },
      { status: 500 },
    );
  }
}
