import { NextResponse } from "next/server";

import { listSearches, snapshotTrips } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  const rows = await listSearches();
  return NextResponse.json({
    ok: true,
    searches: rows.map(({ search, latest }) => ({
      id: search.id,
      label: search.label,
      createdAt: search.createdAt,
      params: JSON.parse(search.paramsJson),
      latestSnapshot: latest
        ? {
            id: latest.id,
            status: latest.status,
            startedAt: latest.startedAt,
            completedAt: latest.completedAt,
            tripCount: snapshotTrips(latest).length,
            cheapest: snapshotTrips(latest)[0]?.totalPrice ?? null,
          }
        : null,
    })),
  });
}
