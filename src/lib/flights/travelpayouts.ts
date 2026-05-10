import "server-only";

import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/ryanair/client";
import type { FlightRoundTrip, Currency } from "@/types";

const log = createLogger("travelpayouts-flights");

const BASE = "https://api.travelpayouts.com";

export function isFlightApiConfigured(): boolean {
  return Boolean(process.env.TRAVELPAYOUTS_TOKEN);
}

type MonthMatrixItem = {
  depart_date: string;
  return_date: string;
  value: number;
  trip_class?: number;
  show_to_affiliates?: boolean;
  gate?: string;
  found_at?: string;
  airline?: string;
  number_of_changes?: number;
};

type MonthMatrixResponse = {
  success?: boolean;
  data?: MonthMatrixItem[];
  error?: string;
};

/**
 * Fetch round-trip prices found on Aviasales for a route within a date window.
 * Returns ready-made FlightRoundTrip[] (one per (depart, return) pair seen).
 *
 * Endpoint: /v2/prices/month-matrix
 * Docs: https://support.travelpayouts.com/hc/en-us/articles/203956083
 */
export async function fetchRoundTripsForRoute(args: {
  origin: string;
  destination: string;
  monthIso: string; // 'YYYY-MM-01'
  currency: Currency;
}): Promise<FlightRoundTrip[]> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return [];

  return withRetry(async () => {
    const params = new URLSearchParams({
      origin: args.origin,
      destination: args.destination,
      month: args.monthIso.slice(0, 7),
      currency: args.currency.toLowerCase(),
      token,
      show_to_affiliates: "true",
    });
    const url = `${BASE}/v2/prices/month-matrix?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      log.warn(
        `month-matrix ${args.origin}-${args.destination} ${args.monthIso}: ${res.status}`,
      );
      return [];
    }
    const data = (await res.json()) as MonthMatrixResponse;
    if (!data.success || !Array.isArray(data.data)) return [];

    const trips: FlightRoundTrip[] = data.data
      .filter(
        (item) =>
          item.depart_date &&
          item.return_date &&
          typeof item.value === "number" &&
          item.value > 0,
      )
      .map((item) => ({
        outbound: {
          flightNumber: item.airline ?? "",
          origin: args.origin,
          destination: args.destination,
          departureTime: `${item.depart_date}T08:00:00`,
          arrivalTime: `${item.depart_date}T11:00:00`,
          price: Math.round(item.value / 2),
          currency: args.currency,
        },
        inbound: {
          flightNumber: item.airline ?? "",
          origin: args.destination,
          destination: args.origin,
          departureTime: `${item.return_date}T12:00:00`,
          arrivalTime: `${item.return_date}T15:00:00`,
          price: Math.round(item.value / 2),
          currency: args.currency,
        },
        totalPrice: Math.round(item.value),
        currency: args.currency,
      }));
    return trips;
  });
}

/**
 * Fetch round-trips covering a (start, end) date window across multiple months.
 */
export async function fetchRoundTripsForWindow(args: {
  origin: string;
  destination: string;
  dateStartIso: string;
  dateEndIso: string;
  currency: Currency;
  minDays: number;
  maxDays: number;
}): Promise<FlightRoundTrip[]> {
  const months = enumerateMonths(args.dateStartIso, args.dateEndIso);
  const all: FlightRoundTrip[] = [];
  for (const month of months) {
    try {
      const batch = await fetchRoundTripsForRoute({
        origin: args.origin,
        destination: args.destination,
        monthIso: month,
        currency: args.currency,
      });
      all.push(...batch);
    } catch (e) {
      log.warn(
        `fetchRoundTrips ${args.origin}-${args.destination} ${month} failed`,
        e,
      );
    }
  }
  return all
    .filter((rt) => {
      const out = rt.outbound.departureTime.slice(0, 10);
      const back = rt.inbound.departureTime.slice(0, 10);
      if (out < args.dateStartIso || back > args.dateEndIso) return false;
      const nights = Math.round(
        (new Date(back).getTime() - new Date(out).getTime()) / 86400000,
      );
      return nights >= args.minDays && nights <= args.maxDays;
    })
    .sort((a, b) => a.totalPrice - b.totalPrice);
}

function enumerateMonths(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start.slice(0, 7) + "-01");
  const e = new Date(end.slice(0, 7) + "-01");
  while (s <= e) {
    out.push(s.toISOString().slice(0, 10));
    s.setMonth(s.getMonth() + 1);
  }
  return out;
}
