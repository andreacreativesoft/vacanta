import "server-only";

import { sleep } from "@/lib/search/progress";
import { createLogger } from "@/lib/logger";
import type { AirportInfo } from "./types";
import type { DailyFare } from "@/lib/search/pairing";

const log = createLogger("ryanair");

export class RyanairError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "RyanairError";
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseMs = 1000,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      const wait = 2 ** i * baseMs;
      log.warn(`retry ${i + 1}/${retries} after ${wait}ms:`, (e as Error).message);
      await sleep(wait);
    }
  }
  throw new RyanairError("Ryanair call failed after retries", lastErr);
}

type RyanairAirport = {
  IATA?: string;
  iataCode?: string;
  code?: string;
  name?: string;
  base?: string;
  country?: { code?: string; name?: string };
  city?: { code?: string; name?: string; country?: { code?: string } };
  countryCode?: string;
  cityName?: string;
};

type RyanairFare = {
  day?: string;
  date?: string;
  price?: { value?: number; currencyCode?: string } | number;
  currency?: string;
  arrivalDate?: string;
};

let cachedAirports: AirportInfo[] | null = null;

async function loadRyanair() {
  // dynamic import keeps the dep out of the client bundle and shields hot reload
  const mod = await import("@2bad/ryanair");
  return mod;
}

export async function getActiveAirports(): Promise<AirportInfo[]> {
  if (cachedAirports) return cachedAirports;
  return withRetry(async () => {
    const ryanair = await loadRyanair();
    const raw: unknown = await ryanair.airports.getActive();
    const list = Array.isArray(raw) ? (raw as RyanairAirport[]) : [];
    const mapped: AirportInfo[] = list
      .map((a) => {
        const iata = a.IATA ?? a.iataCode ?? a.code;
        const country =
          a.country?.code ??
          a.city?.country?.code ??
          a.countryCode ??
          "";
        const city = a.city?.name ?? a.cityName ?? a.name ?? "";
        if (!iata || !country) return null;
        return {
          iata: String(iata).toUpperCase(),
          city: String(city),
          country: String(country).toUpperCase(),
          name: a.name,
        } as AirportInfo;
      })
      .filter((a): a is AirportInfo => a !== null);
    cachedAirports = mapped;
    return mapped;
  });
}

export async function getDestinationsFromOrigin(
  origin: string,
): Promise<string[]> {
  return withRetry(async () => {
    const ryanair = await loadRyanair();
    const raw: unknown = await ryanair.airports.getDestinations(origin);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((a) => {
        const r = a as RyanairAirport;
        return r.IATA ?? r.iataCode ?? r.code;
      })
      .filter((x): x is string => Boolean(x))
      .map((x) => x.toUpperCase());
  });
}

export async function getCheapestPerDay(
  origin: string,
  destination: string,
  fromIso: string,
  toIso: string,
): Promise<DailyFare[]> {
  return withRetry(async () => {
    const ryanair = await loadRyanair();
    const startMonth = fromIso.slice(0, 7) + "-01";
    const endMonth = toIso.slice(0, 7) + "-01";

    const months = monthsBetween(startMonth, endMonth);
    const all: DailyFare[] = [];
    for (const month of months) {
      try {
        const raw: unknown = await ryanair.fares.getCheapestPerDay(
          origin,
          destination,
          month,
        );
        const list = Array.isArray(raw)
          ? (raw as RyanairFare[])
          : ((raw as { outbound?: { fares?: RyanairFare[] } })?.outbound
              ?.fares ?? []);
        for (const fare of list) {
          const date = fare.day ?? fare.date;
          if (!date) continue;
          if (date < fromIso || date > toIso) continue;
          const priceObj =
            typeof fare.price === "number"
              ? { value: fare.price, currencyCode: fare.currency ?? "EUR" }
              : (fare.price ?? {});
          if (typeof priceObj.value !== "number") continue;
          all.push({
            date,
            price: priceObj.value,
            currency: priceObj.currencyCode ?? fare.currency ?? "EUR",
            arrivalTime: fare.arrivalDate,
          });
        }
      } catch (e) {
        log.warn(
          `cheapest-per-day failed for ${origin}-${destination} ${month}:`,
          (e as Error).message,
        );
      }
    }
    return all;
  });
}

function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  while (s <= e) {
    out.push(s.toISOString().slice(0, 10));
    s.setMonth(s.getMonth() + 1);
  }
  return out;
}
