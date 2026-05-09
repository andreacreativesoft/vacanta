import type { FlightLeg, FlightRoundTrip } from "@/types";

export type DailyFare = {
  date: string;
  price: number;
  currency: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(a: string, b: string): number {
  const ad = new Date(a).getTime();
  const bd = new Date(b).getTime();
  return Math.round((bd - ad) / MS_PER_DAY);
}

export function generateValidPairs(
  origin: string,
  destination: string,
  outbound: DailyFare[],
  inbound: DailyFare[],
  minDays: number,
  maxDays: number,
): FlightRoundTrip[] {
  const pairs: FlightRoundTrip[] = [];
  const sortedInbound = [...inbound].sort((a, b) => a.date.localeCompare(b.date));

  for (const out of outbound) {
    for (const back of sortedInbound) {
      const nights = daysBetween(out.date, back.date);
      if (nights < minDays) continue;
      if (nights > maxDays) break;

      const outboundLeg: FlightLeg = {
        flightNumber: out.flightNumber ?? `FR-${origin}-${destination}`,
        origin,
        destination,
        departureTime: out.departureTime ?? `${out.date}T08:00:00`,
        arrivalTime: out.arrivalTime ?? `${out.date}T11:00:00`,
        price: out.price,
        currency: out.currency,
      };
      const inboundLeg: FlightLeg = {
        flightNumber: back.flightNumber ?? `FR-${destination}-${origin}`,
        origin: destination,
        destination: origin,
        departureTime: back.departureTime ?? `${back.date}T12:00:00`,
        arrivalTime: back.arrivalTime ?? `${back.date}T15:00:00`,
        price: back.price,
        currency: back.currency,
      };
      pairs.push({
        outbound: outboundLeg,
        inbound: inboundLeg,
        totalPrice: out.price + back.price,
        currency: out.currency,
      });
    }
  }
  pairs.sort((a, b) => a.totalPrice - b.totalPrice);
  return pairs;
}

export type RouteCandidate = {
  origin: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  rt: FlightRoundTrip;
};

export function pickTop5DistinctDestinations(
  candidates: RouteCandidate[],
): RouteCandidate[] {
  const seen = new Set<string>();
  const out: RouteCandidate[] = [];
  const sorted = [...candidates].sort(
    (a, b) => a.rt.totalPrice - b.rt.totalPrice,
  );
  for (const c of sorted) {
    if (seen.has(c.destinationIata)) continue;
    seen.add(c.destinationIata);
    out.push(c);
    if (out.length >= 5) break;
  }
  return out;
}
