import { Plane, Bed, MapPin, Star, Waves, Utensils } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/format";
import type { TripOption } from "@/types";

type Carrier = "ryanair" | "wizzair" | "unknown";

function detectCarrier(flightNumber: string): Carrier {
  const code = flightNumber.toUpperCase().trim();
  if (code === "FR" || code.startsWith("FR")) return "ryanair";
  if (code === "W6" || code.startsWith("W6")) return "wizzair";
  return "unknown";
}

function carrierLabel(c: Carrier): string {
  if (c === "ryanair") return "Ryanair";
  if (c === "wizzair") return "Wizz Air";
  return "airline";
}

export function TripCard({
  trip,
  rank,
}: {
  trip: TripOption;
  rank: number;
}) {
  const checkIn = trip.flight.outbound.departureTime.slice(0, 10);
  const checkOut = trip.flight.inbound.departureTime.slice(0, 10);
  const carrier = detectCarrier(trip.flight.outbound.flightNumber);
  const bookingLink = buildBookingLink(trip, carrier);
  const carrierName = carrierLabel(carrier);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">#{rank}</Badge>
              <MapPin className="size-3.5" />
              <span>
                {trip.destinationCity}, {trip.destinationCountry} ·{" "}
                {trip.destinationAirport}
              </span>
            </div>
            <h3 className="mt-1 text-lg font-semibold">
              {formatDate(checkIn)} → {formatDate(checkOut)}
              <span className="ml-2 text-muted-foreground text-sm font-normal">
                {trip.nights} {trip.nights === 1 ? "night" : "nights"}
              </span>
            </h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatPrice(trip.totalPrice, trip.currency)}
            </div>
            <div className="text-xs text-muted-foreground">total</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatPrice(
                Math.round(trip.totalPrice / Math.max(1, trip.nights)),
                trip.currency,
              )}
              /night
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plane className="size-4 text-primary" /> Flight
              {carrier !== "unknown" && (
                <Badge variant="outline" className="ml-1">
                  {carrierName}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <div>
                {trip.flight.outbound.origin} →{" "}
                {trip.flight.outbound.destination}
              </div>
              <div>
                {trip.flight.inbound.origin} → {trip.flight.inbound.destination}
              </div>
              <div className="mt-1 font-medium text-foreground">
                {formatPrice(trip.flight.totalPrice, trip.flight.currency)}{" "}
                round-trip
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={bookingLink} target="_blank" rel="noreferrer">
                Book on {carrierName === "airline" ? "Ryanair" : carrierName}
              </a>
            </Button>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bed className="size-4 text-primary" /> {trip.hotel.name}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {typeof trip.hotel.stars === "number" && (
                <Badge variant="outline" className="gap-1">
                  <Star className="size-3" /> {trip.hotel.stars}
                </Badge>
              )}
              {typeof trip.hotel.rating === "number" && (
                <Badge variant="outline">{trip.hotel.rating.toFixed(1)}/10</Badge>
              )}
              {trip.hotel.hasPool && (
                <Badge variant="outline" className="gap-1">
                  <Waves className="size-3" /> Pool
                </Badge>
              )}
              {trip.hotel.isAllInclusive && (
                <Badge variant="outline" className="gap-1">
                  <Utensils className="size-3" /> All-inclusive
                </Badge>
              )}
              {typeof trip.hotel.distanceToBeachMeters === "number" && (
                <Badge variant="outline">
                  {trip.hotel.distanceToBeachMeters}m to beach
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatPrice(trip.hotel.pricePerNight, trip.hotel.currency)}{" "}
              /night ·{" "}
              <span className="text-foreground font-medium">
                {formatPrice(trip.hotel.totalPrice, trip.hotel.currency)} total
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a
                href={trip.hotel.bookingDeepLink}
                target="_blank"
                rel="noreferrer"
              >
                Book hotel
              </a>
            </Button>
          </div>
        </div>

        {trip.alternativeHotels && trip.alternativeHotels.length > 0 && (
          <>
            <Separator />
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {trip.alternativeHotels.length} alternative hotels
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {trip.alternativeHotels.map((h) => (
                  <li
                    key={String(h.hotelId)}
                    className="flex items-center justify-between"
                  >
                    <span>{h.name}</span>
                    <span>{formatPrice(h.totalPrice, h.currency)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function buildRyanairLink(trip: TripOption): string {
  const params = new URLSearchParams({
    originIata: trip.flight.outbound.origin,
    destinationIata: trip.flight.outbound.destination,
    isReturn: "true",
    isMacDestination: "false",
    promoCode: "null",
    adults: "1",
    teens: "0",
    children: "0",
    infants: "0",
    dateOut: trip.flight.outbound.departureTime.slice(0, 10),
    dateIn: trip.flight.inbound.departureTime.slice(0, 10),
    daysTrip: String(trip.nights),
    nightsFrom: String(trip.nights),
    nightsTo: String(trip.nights),
    dayOfWeek: "",
    isExactDate: "true",
  });
  return `https://www.ryanair.com/en/en/fare-finder?${params.toString()}`;
}

function buildWizzairLink(trip: TripOption): string {
  const params = new URLSearchParams({
    departureStation: trip.flight.outbound.origin,
    arrivalStation: trip.flight.outbound.destination,
    departureDate: trip.flight.outbound.departureTime.slice(0, 10),
    returnDate: trip.flight.inbound.departureTime.slice(0, 10),
    adults: "1",
    children: "0",
    infants: "0",
  });
  return `https://wizzair.com/en-gb/flights/fare-finder?${params.toString()}`;
}

function buildBookingLink(trip: TripOption, carrier: Carrier): string {
  if (carrier === "wizzair") return buildWizzairLink(trip);
  return buildRyanairLink(trip);
}
