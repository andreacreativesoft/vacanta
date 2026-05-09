import "server-only";

import {
  getSearch,
  getSearchInput,
  listSearches,
  listSnapshots,
  snapshotTrips,
} from "@/lib/db/queries";
import { startSnapshot } from "@/lib/search/runner";
import { formatDate, formatPrice } from "@/lib/format";

export const TOOL_DEFINITIONS = [
  {
    name: "list_searches",
    description:
      "List recent saved vacation searches with their inputs and a summary of the latest snapshot.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "How many to return", default: 10 },
      },
    },
  },
  {
    name: "get_search_details",
    description:
      "Get full details and all snapshots for a specific saved search by its id.",
    input_schema: {
      type: "object" as const,
      properties: {
        searchId: { type: "string", description: "ID of the saved search" },
      },
      required: ["searchId"],
    },
  },
  {
    name: "refresh_search",
    description:
      "Queue a new snapshot for an existing saved search. Returns immediately; the user must open the search page to watch progress and see results.",
    input_schema: {
      type: "object" as const,
      properties: {
        searchId: { type: "string" },
      },
      required: ["searchId"],
    },
  },
  {
    name: "compare_trips",
    description:
      "Compare the cheapest trip option across multiple saved searches.",
    input_schema: {
      type: "object" as const,
      properties: {
        searchIds: {
          type: "array",
          items: { type: "string" },
          description: "Search IDs to compare",
        },
      },
      required: ["searchIds"],
    },
  },
];

export type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "list_searches":
      return toolListSearches(typeof input.limit === "number" ? input.limit : 10);
    case "get_search_details":
      return toolGetSearchDetails(String(input.searchId ?? ""));
    case "refresh_search":
      return toolRefreshSearch(String(input.searchId ?? ""));
    case "compare_trips":
      return toolCompareTrips(
        Array.isArray(input.searchIds) ? (input.searchIds as string[]) : [],
      );
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

async function toolListSearches(limit: number): Promise<ToolResult> {
  const rows = await listSearches(limit);
  return {
    ok: true,
    data: rows.map(({ search, latest }) => {
      const params = JSON.parse(search.paramsJson);
      const trips = snapshotTrips(latest);
      return {
        searchId: search.id,
        label: search.label,
        createdAt: search.createdAt.toISOString(),
        countries: params.destinationCountries,
        origins: params.origins,
        dateWindow: {
          start: params.dateWindowStart,
          end: params.dateWindowEnd,
        },
        nightsRange: [params.minDays, params.maxDays],
        passengers: params.passengers.length,
        latestSnapshot: latest
          ? {
              id: latest.id,
              status: latest.status,
              startedAt: latest.startedAt.toISOString(),
              tripCount: trips.length,
              cheapest: trips[0]
                ? {
                    destination: trips[0].destinationCity,
                    totalPrice: trips[0].totalPrice,
                    currency: trips[0].currency,
                    formatted: formatPrice(
                      trips[0].totalPrice,
                      trips[0].currency,
                    ),
                  }
                : null,
            }
          : null,
      };
    }),
  };
}

async function toolGetSearchDetails(searchId: string): Promise<ToolResult> {
  const search = await getSearch(searchId);
  if (!search) return { ok: false, error: "Search not found" };
  const params = JSON.parse(search.paramsJson);
  const snapshotRows = await listSnapshots(searchId);
  const snapshots = snapshotRows.map((s) => ({
    snapshotId: s.id,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    error: s.errorMessage,
    trips: snapshotTrips(s).map((t) => ({
      destination: `${t.destinationCity}, ${t.destinationCountry}`,
      airport: t.destinationAirport,
      dates: `${formatDate(t.flight.outbound.departureTime)} → ${formatDate(t.flight.inbound.departureTime)}`,
      nights: t.nights,
      totalPrice: t.totalPrice,
      currency: t.currency,
      flightTotal: t.flight.totalPrice,
      hotelTotal: t.hotel.totalPrice,
      hotelName: t.hotel.name,
    })),
  }));
  return {
    ok: true,
    data: {
      searchId: search.id,
      label: search.label,
      createdAt: search.createdAt.toISOString(),
      params,
      snapshots,
    },
  };
}

async function toolRefreshSearch(searchId: string): Promise<ToolResult> {
  const input = await getSearchInput(searchId);
  if (!input) return { ok: false, error: "Search not found" };
  const snapshot = await startSnapshot(searchId);
  return {
    ok: true,
    data: {
      snapshotId: snapshot.id,
      message:
        "Refresh queued. Open the search page to see live progress; results stream in over a few seconds.",
    },
  };
}

async function toolCompareTrips(searchIds: string[]): Promise<ToolResult> {
  if (searchIds.length === 0) {
    return { ok: false, error: "Provide at least one searchId" };
  }
  const rows = await Promise.all(
    searchIds.map(async (sid) => {
      const search = await getSearch(sid);
      if (!search) return { searchId: sid, error: "not found" };
      const snapshots = await listSnapshots(sid);
      const latest = snapshots[0];
      const trips = snapshotTrips(latest);
      return {
        searchId: sid,
        label: search.label,
        params: JSON.parse(search.paramsJson),
        latestSnapshotAt: latest?.startedAt.toISOString() ?? null,
        cheapestTrip: trips[0]
          ? {
              destination: `${trips[0].destinationCity}, ${trips[0].destinationCountry}`,
              totalPrice: trips[0].totalPrice,
              currency: trips[0].currency,
              formatted: formatPrice(trips[0].totalPrice, trips[0].currency),
            }
          : null,
      };
    }),
  );
  return { ok: true, data: rows };
}
