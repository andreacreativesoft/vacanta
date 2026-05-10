import "server-only";

import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";
import type { Currency, FlightRoundTrip } from "@/types";

const log = createLogger("ryanair-direct");

const FARES_BASE = "https://services-api.ryanair.com/farfnd/v4/roundTripFares";

type RyanairFareLeg = {
  flightNumber?: string;
  departureDate?: string;
  arrivalDate?: string;
  price?: { value?: number; currencyCode?: string };
};
type RyanairFare = {
  outbound?: RyanairFareLeg;
  inbound?: RyanairFareLeg;
  summary?: { price?: { value?: number; currencyCode?: string } };
};
type RyanairResponse = {
  fares?: RyanairFare[];
};

/**
 * Call Ryanair's public fare-finder API directly.
 * Endpoint behind https://www.ryanair.com/.../fare-finder.
 * Returns one FlightRoundTrip per (depart, return) pair found.
 */
export async function fetchRyanairRoundTrips(args: {
  origin: string;
  destination: string;
  outboundFrom: string; // YYYY-MM-DD
  outboundTo: string;
  durationFrom: number;
  durationTo: number;
  adults: number;
  teens?: number;
  children?: number;
  infants?: number;
  currency: Currency;
}): Promise<FlightRoundTrip[]> {
  const params = new URLSearchParams({
    departureAirportIataCode: args.origin,
    arrivalAirportIataCode: args.destination,
    outboundDepartureDateFrom: args.outboundFrom,
    outboundDepartureDateTo: args.outboundTo,
    inboundDepartureDateFrom: args.outboundFrom,
    inboundDepartureDateTo: addDays(args.outboundTo, args.durationTo + 7),
    durationFrom: String(args.durationFrom),
    durationTo: String(args.durationTo),
    adults: String(args.adults),
    teens: String(args.teens ?? 0),
    children: String(args.children ?? 0),
    infants: String(args.infants ?? 0),
    offset: "0",
    limit: "30",
    market: "en-gb",
  });
  const url = `${FARES_BASE}?${params.toString()}`;

  return withRetry(async () => {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      log.warn(`ryanair ${args.origin}-${args.destination}: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as RyanairResponse;
    const fares = Array.isArray(data.fares) ? data.fares : [];
    const trips: FlightRoundTrip[] = [];
    for (const fare of fares) {
      const out = fare.outbound;
      const back = fare.inbound;
      if (!out?.departureDate || !back?.departureDate) continue;
      const outPrice = out.price?.value ?? 0;
      const backPrice = back.price?.value ?? 0;
      const total =
        fare.summary?.price?.value ?? outPrice + backPrice;
      if (total <= 0) continue;
      const currency = (fare.summary?.price?.currencyCode ??
        out.price?.currencyCode ??
        args.currency) as string;
      trips.push({
        outbound: {
          flightNumber: out.flightNumber ?? "FR",
          origin: args.origin,
          destination: args.destination,
          departureTime: out.departureDate,
          arrivalTime: out.arrivalDate ?? out.departureDate,
          price: outPrice,
          currency,
        },
        inbound: {
          flightNumber: back.flightNumber ?? "FR",
          origin: args.destination,
          destination: args.origin,
          departureTime: back.departureDate,
          arrivalTime: back.arrivalDate ?? back.departureDate,
          price: backPrice,
          currency,
        },
        totalPrice: total,
        currency,
      });
    }
    return trips;
  });
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Build a deep link to Ryanair's fare-finder page (date-range search view).
 */
export function buildFareFinderUrl(args: {
  origin: string;
  destination: string;
  dateOut: string;
  dateIn: string;
  durationFrom: number;
  durationTo: number;
  adults: number;
  teens?: number;
  children?: number;
  infants?: number;
}): string {
  const params = new URLSearchParams({
    originIata: args.origin,
    destinationIata: args.destination,
    isReturn: "true",
    isMacDestination: "false",
    promoCode: "null",
    adults: String(args.adults),
    teens: String(args.teens ?? 0),
    children: String(args.children ?? 0),
    infants: String(args.infants ?? 0),
    dateOut: args.dateOut,
    dateIn: args.dateIn,
    daysTrip: String(args.durationFrom),
    nightsFrom: String(args.durationFrom),
    nightsTo: String(args.durationTo),
    dayOfWeek: "",
    isExactDate: "false",
  });
  return `https://www.ryanair.com/en/en/fare-finder?${params.toString()}`;
}
