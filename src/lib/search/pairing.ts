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

/**
 * Pick a varied set of trip candidates so the user can compare
 * different (destination, duration) combinations side-by-side.
 *
 * Per destination: keep up to maxPerDest cheapest trips, each with a
 * distinct night count (so 7n + 10n + 14n, not three 7n trips).
 * Globally: cap at maxTotal, ordered by total price.
 */
export function pickTopTrips(
  candidates: RouteCandidate[],
  maxTotal = 10,
  maxPerDest = 3,
): RouteCandidate[] {
  const byDest = new Map<string, RouteCandidate[]>();
  for (const c of candidates) {
    if (!byDest.has(c.destinationIata)) byDest.set(c.destinationIata, []);
    byDest.get(c.destinationIata)!.push(c);
  }

  const perDestPicked: RouteCandidate[] = [];
  for (const [, arr] of byDest) {
    arr.sort((a, b) => a.rt.totalPrice - b.rt.totalPrice);
    const seenNights = new Set<number>();
    let kept = 0;
    for (const c of arr) {
      const n = nightsOfCandidate(c);
      if (seenNights.has(n)) continue;
      seenNights.add(n);
      perDestPicked.push(c);
      kept += 1;
      if (kept >= maxPerDest) break;
    }
  }

  return perDestPicked
    .sort((a, b) => a.rt.totalPrice - b.rt.totalPrice)
    .slice(0, maxTotal);
}

function nightsOfCandidate(c: RouteCandidate): number {
  const a = c.rt.outbound.departureTime.slice(0, 10);
  const b = c.rt.inbound.departureTime.slice(0, 10);
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000,
  );
}
