import "server-only";

import {
  getCheapestPerDay,
  getDestinationsFromOrigin,
} from "@/lib/ryanair/client";
import { resolveAirportsForCountries } from "@/lib/ryanair/routes";
import { searchHotels } from "@/lib/hotels/hotellook";
import { pickBestHotel } from "@/lib/hotels/filters";
import { createLogger } from "@/lib/logger";
import {
  mockDestinationsForCountries,
  mockCheapestPerDay,
} from "./mock";
import {
  generateValidPairs,
  pickTop5DistinctDestinations,
  type RouteCandidate,
} from "./pairing";
import { chunk, sleep, randomBetween } from "./progress";
import { countryName } from "@/lib/airports/countries";
import type { ProgressEmitter } from "./progress";
import type { AirportInfo } from "@/lib/ryanair/types";
import type { SearchInput, TripOption } from "@/types";

const log = createLogger("orchestrator");

type Mode = "real" | "mock";

export type RunSearchOptions = {
  signal?: AbortSignal;
};

function shouldUseMock(): boolean {
  if (process.env.MOCK_SEARCH === "1") return true;
  if (process.env.MOCK_SEARCH === "0") return false;
  return false;
}

export async function runSearch(
  input: SearchInput,
  emit: ProgressEmitter,
  opts: RunSearchOptions = {},
): Promise<TripOption[]> {
  const useMock = shouldUseMock();
  const mode: Mode = useMock ? "mock" : "real";

  emit({
    type: "phase",
    phase: "init",
    message:
      mode === "mock"
        ? "Running in mock mode (set MOCK_SEARCH=0 in .env.local for real APIs)"
        : "Resolving destination airports…",
  });

  let destAirports: AirportInfo[];
  let validRoutes: Array<{ origin: string; destination: AirportInfo }>;

  try {
    if (mode === "mock") {
      destAirports = mockDestinationsForCountries(input.destinationCountries);
      validRoutes = input.origins.flatMap((o) =>
        destAirports.map((d) => ({ origin: o, destination: d })),
      );
    } else {
      destAirports = await resolveAirportsForCountries(
        input.destinationCountries,
      );
      emit({
        type: "phase",
        phase: "routes",
        message: `Found ${destAirports.length} airports in target countries`,
      });
      validRoutes = [];
      for (const origin of input.origins) {
        const reachable = new Set(await getDestinationsFromOrigin(origin));
        for (const dest of destAirports) {
          if (reachable.has(dest.iata)) {
            validRoutes.push({ origin, destination: dest });
          }
        }
      }
    }
  } catch (e) {
    log.error("route resolution failed, falling back to mock", e);
    destAirports = mockDestinationsForCountries(input.destinationCountries);
    validRoutes = input.origins.flatMap((o) =>
      destAirports.map((d) => ({ origin: o, destination: d })),
    );
  }

  emit({
    type: "phase",
    phase: "routes",
    message: `${validRoutes.length} viable routes`,
  });

  if (validRoutes.length === 0) {
    emit({ type: "result", trips: [] });
    return [];
  }

  const fareMap = new Map<
    string,
    { route: (typeof validRoutes)[number]; out: ReturnType<typeof mockCheapestPerDay>; back: ReturnType<typeof mockCheapestPerDay> }
  >();

  let processed = 0;
  for (const batch of chunk(validRoutes, 5)) {
    if (opts.signal?.aborted) throw new Error("Aborted");
    await Promise.all(
      batch.map(async (route) => {
        const key = `${route.origin}-${route.destination.iata}`;
        try {
          const [out, back] =
            mode === "mock"
              ? [
                  mockCheapestPerDay(
                    route.origin,
                    route.destination.iata,
                    input.dateWindowStart,
                    input.dateWindowEnd,
                    input.currency,
                  ),
                  mockCheapestPerDay(
                    route.destination.iata,
                    route.origin,
                    input.dateWindowStart,
                    input.dateWindowEnd,
                    input.currency,
                  ),
                ]
              : await Promise.all([
                  getCheapestPerDay(
                    route.origin,
                    route.destination.iata,
                    input.dateWindowStart,
                    input.dateWindowEnd,
                  ),
                  getCheapestPerDay(
                    route.destination.iata,
                    route.origin,
                    input.dateWindowStart,
                    input.dateWindowEnd,
                  ),
                ]);
          fareMap.set(key, { route, out, back });
        } catch (e) {
          log.warn(`fares ${key} failed:`, (e as Error).message);
        } finally {
          processed += 1;
          emit({
            type: "progress",
            phase: "pricing",
            current: processed,
            total: validRoutes.length,
            label: `${route.origin} → ${route.destination.iata}`,
          });
        }
      }),
    );
    if (mode === "real") {
      await sleep(randomBetween(800, 2000));
    }
  }

  const candidates: RouteCandidate[] = [];
  for (const [, entry] of fareMap) {
    const pairs = generateValidPairs(
      entry.route.origin,
      entry.route.destination.iata,
      entry.out,
      entry.back,
      input.minDays,
      input.maxDays,
    );
    for (const rt of pairs.slice(0, 6)) {
      candidates.push({
        origin: entry.route.origin,
        destinationIata: entry.route.destination.iata,
        destinationCity: entry.route.destination.city,
        destinationCountry: entry.route.destination.country,
        rt,
      });
    }
  }

  const top5 = pickTop5DistinctDestinations(candidates);
  emit({
    type: "phase",
    phase: "flights-done",
    message: `${top5.length} flight options selected`,
  });

  if (top5.length === 0) {
    emit({ type: "result", trips: [] });
    return [];
  }

  const trips: TripOption[] = [];
  for (let i = 0; i < top5.length; i++) {
    if (opts.signal?.aborted) throw new Error("Aborted");
    const c = top5[i];
    emit({
      type: "progress",
      phase: "hotels",
      current: i + 1,
      total: top5.length,
      label: c.destinationCity,
    });
    const checkIn = c.rt.outbound.departureTime.slice(0, 10);
    const checkOut = c.rt.inbound.departureTime.slice(0, 10);
    const hotels = await searchHotels({
      cityIata: c.destinationIata,
      cityName: c.destinationCity,
      checkIn,
      checkOut,
      rooms: input.rooms,
      filters: input.filters,
      currency: input.currency,
    });
    const best = pickBestHotel(hotels, input.filters);
    if (!best) continue;
    const nights = nightsBetween(checkIn, checkOut);
    const trip: TripOption = {
      destinationCity: c.destinationCity,
      destinationAirport: c.destinationIata,
      destinationCountry: countryName(c.destinationCountry),
      flight: c.rt,
      hotel: best,
      alternativeHotels: hotels
        .filter((h) => h.hotelId !== best.hotelId)
        .slice(0, 3),
      nights,
      totalPrice: c.rt.totalPrice + best.totalPrice,
      currency: input.currency,
    };
    trips.push(trip);
    emit({ type: "partial", trips: [...trips] });
    if (mode === "real") {
      await sleep(randomBetween(600, 1500));
    }
  }

  trips.sort((a, b) => a.totalPrice - b.totalPrice);
  const filtered = input.filters.maxBudgetTotal
    ? trips.filter((t) => t.totalPrice <= input.filters.maxBudgetTotal!)
    : trips;

  emit({ type: "result", trips: filtered });
  return filtered;
}

function nightsBetween(a: string, b: string): number {
  const ad = new Date(a).getTime();
  const bd = new Date(b).getTime();
  return Math.max(1, Math.round((bd - ad) / 86400000));
}
