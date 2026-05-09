"use client";

import { TripCard } from "@/components/trip-card";
import { Card, CardContent } from "@/components/ui/card";
import type { TripOption } from "@/types";

export function ResultsList({ trips }: { trips: TripOption[] }) {
  if (trips.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No trips found yet — try widening your dates or filters.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {trips.map((trip, i) => (
        <TripCard
          key={`${trip.destinationAirport}-${trip.flight.outbound.departureTime}`}
          trip={trip}
          rank={i + 1}
        />
      ))}
    </div>
  );
}
