"use client";

import * as React from "react";

import { TripCard } from "@/components/trip-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TripOption } from "@/types";

type SortKey =
  | "price-asc"
  | "price-desc"
  | "date-asc"
  | "date-desc"
  | "nights-asc"
  | "nights-desc"
  | "per-night";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "price-asc", label: "Total: low → high" },
  { value: "price-desc", label: "Total: high → low" },
  { value: "per-night", label: "Per night: low → high" },
  { value: "nights-asc", label: "Nights: short → long" },
  { value: "nights-desc", label: "Nights: long → short" },
  { value: "date-asc", label: "Departure: earliest" },
  { value: "date-desc", label: "Departure: latest" },
];

function sortTrips(trips: TripOption[], key: SortKey): TripOption[] {
  const out = [...trips];
  switch (key) {
    case "price-asc":
      return out.sort((a, b) => a.totalPrice - b.totalPrice);
    case "price-desc":
      return out.sort((a, b) => b.totalPrice - a.totalPrice);
    case "date-asc":
      return out.sort((a, b) =>
        a.flight.outbound.departureTime.localeCompare(
          b.flight.outbound.departureTime,
        ),
      );
    case "date-desc":
      return out.sort((a, b) =>
        b.flight.outbound.departureTime.localeCompare(
          a.flight.outbound.departureTime,
        ),
      );
    case "nights-asc":
      return out.sort((a, b) => a.nights - b.nights);
    case "nights-desc":
      return out.sort((a, b) => b.nights - a.nights);
    case "per-night":
      return out.sort(
        (a, b) => a.totalPrice / a.nights - b.totalPrice / b.nights,
      );
  }
}

export function ResultsList({ trips }: { trips: TripOption[] }) {
  const [sort, setSort] = React.useState<SortKey>("price-asc");

  if (trips.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No trips found yet — try widening your dates or filters.
        </CardContent>
      </Card>
    );
  }

  const sorted = sortTrips(trips, sort);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {trips.length} {trips.length === 1 ? "trip" : "trips"}
        </p>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger size="sm" className="w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sorted.map((trip, i) => (
        <TripCard
          key={`${trip.destinationAirport}-${trip.flight.outbound.departureTime}`}
          trip={trip}
          rank={i + 1}
        />
      ))}
    </div>
  );
}
