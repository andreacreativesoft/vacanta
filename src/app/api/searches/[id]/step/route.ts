import { NextResponse } from "next/server";

import { getSearchInput } from "@/lib/db/queries";
import { advanceSnapshot } from "@/lib/search/runner";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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
}
