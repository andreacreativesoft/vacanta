import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { searchInputSchema } from "@/lib/validation";
import { createSearch } from "@/lib/db/queries";
import { startRun } from "@/lib/search/runner";
import type { SearchInput } from "@/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = searchInputSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation failed", issues: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }

  const { label, ...rest } = parsed;
  const input: SearchInput = rest;
  const search = createSearch(input, label);
  const run = startRun(search.id, input);

  return NextResponse.json({
    ok: true,
    searchId: search.id,
    snapshotId: run.snapshotId,
  });
}
