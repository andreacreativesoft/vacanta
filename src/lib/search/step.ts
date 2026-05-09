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
import { countryName } from "@/lib/airports/countries";
import type { AirportInfo } from "@/lib/ryanair/types";
import type {
  FlightRoundTrip,
  HotelOption,
  SearchInput,
  TripOption,
} from "@/types";

const log = createLogger("step");

type Mode = "real" | "mock";

export type Phase =
  | "init"
  | "routes"
  | "pricing"
  | "hotels"
  | "complete"
  | "error";

export type SnapshotState = {
  mode: Mode;
  phase: Phase;
  routes: SerializedRoute[];
  routeCursor: number; // next route index to price
  fareMap: Record<string, FareEntry>;
  topCandidates: SerializedTopCandidate[];
  hotelCursor: number; // next top-candidate index to fetch hotels for
  trips: TripOption[];
  message?: string;
};

type SerializedRoute = {
  origin: string;
  iata: string;
  city: string;
  country: string;
};
type FareEntry = { out: DailyFareLite[]; back: DailyFareLite[] };
type DailyFareLite = { date: string; price: number; currency: string };
type SerializedTopCandidate = {
  origin: string;
  destinationIata: string;
  destinationCity: string;
  destinationCountry: string;
  rt: FlightRoundTrip;
};

export type StepResult = {
  state: SnapshotState;
  done: boolean;
  current: number;
  total: number;
  label: string;
};

const ROUTES_PER_CHUNK = 6; // ~5-8s per chunk in real mode
const HOTELS_PER_CHUNK = 2;

function shouldUseMock(): boolean {
  if (process.env.MOCK_SEARCH === "1") return true;
  if (process.env.MOCK_SEARCH === "0") return false;
  return false;
}

export function initialState(): SnapshotState {
  return {
    mode: shouldUseMock() ? "mock" : "real",
    phase: "init",
    routes: [],
    routeCursor: 0,
    fareMap: {},
    topCandidates: [],
    hotelCursor: 0,
    trips: [],
  };
}

export async function step(
  input: SearchInput,
  prev: SnapshotState,
): Promise<StepResult> {
  const state = { ...prev };

  switch (state.phase) {
    case "init":
    case "routes":
      return await stepResolveRoutes(input, state);
    case "pricing":
      return await stepPriceRoutes(input, state);
    case "hotels":
      return await stepFetchHotels(input, state);
    default:
      return { state, done: true, current: 1, total: 1, label: "done" };
  }
}

async function stepResolveRoutes(
  input: SearchInput,
  state: SnapshotState,
): Promise<StepResult> {
  let destAirports: AirportInfo[];
  let validRoutes: SerializedRoute[];

  try {
    if (state.mode === "mock") {
      destAirports = mockDestinationsForCountries(input.destinationCountries);
      validRoutes = input.origins.flatMap((o) =>
        destAirports.map((d) => ({
          origin: o,
          iata: d.iata,
          city: d.city,
          country: d.country,
        })),
      );
    } else {
      destAirports = await resolveAirportsForCountries(
        input.destinationCountries,
      );
      validRoutes = [];
      for (const origin of input.origins) {
        const reachable = new Set(await getDestinationsFromOrigin(origin));
        for (const dest of destAirports) {
          if (reachable.has(dest.iata)) {
            validRoutes.push({
              origin,
              iata: dest.iata,
              city: dest.city,
              country: dest.country,
            });
          }
        }
      }
    }
  } catch (e) {
    log.warn("real route resolution failed, falling back to mock", e);
    destAirports = mockDestinationsForCountries(input.destinationCountries);
    validRoutes = input.origins.flatMap((o) =>
      destAirports.map((d) => ({
        origin: o,
        iata: d.iata,
        city: d.city,
        country: d.country,
      })),
    );
    state.mode = "mock";
  }

  state.routes = validRoutes;
  state.routeCursor = 0;
  state.phase = validRoutes.length > 0 ? "pricing" : "complete";
  state.message = `Found ${validRoutes.length} routes`;

  return {
    state,
    done: state.phase === "complete",
    current: 0,
    total: validRoutes.length,
    label: state.message,
  };
}

async function stepPriceRoutes(
  input: SearchInput,
  state: SnapshotState,
): Promise<StepResult> {
  const slice = state.routes.slice(
    state.routeCursor,
    state.routeCursor + ROUTES_PER_CHUNK,
  );

  await Promise.all(
    slice.map(async (route) => {
      const key = `${route.origin}-${route.iata}`;
      try {
        if (state.mode === "mock") {
          state.fareMap[key] = {
            out: mockCheapestPerDay(
              route.origin,
              route.iata,
              input.dateWindowStart,
              input.dateWindowEnd,
              input.currency,
            ),
            back: mockCheapestPerDay(
              route.iata,
              route.origin,
              input.dateWindowStart,
              input.dateWindowEnd,
              input.currency,
            ),
          };
        } else {
          const [out, back] = await Promise.all([
            getCheapestPerDay(
              route.origin,
              route.iata,
              input.dateWindowStart,
              input.dateWindowEnd,
            ),
            getCheapestPerDay(
              route.iata,
              route.origin,
              input.dateWindowStart,
              input.dateWindowEnd,
            ),
          ]);
          state.fareMap[key] = { out, back };
        }
      } catch (e) {
        log.warn(`fares ${key} failed`, e);
        state.fareMap[key] = { out: [], back: [] };
      }
    }),
  );

  state.routeCursor += slice.length;

  if (state.routeCursor < state.routes.length) {
    state.message = `Pricing ${state.routeCursor}/${state.routes.length}`;
    return {
      state,
      done: false,
      current: state.routeCursor,
      total: state.routes.length,
      label: state.message,
    };
  }

  // Pricing finished — compute top 5 candidates and move to hotels
  const candidates: RouteCandidate[] = [];
  for (const route of state.routes) {
    const key = `${route.origin}-${route.iata}`;
    const fare = state.fareMap[key];
    if (!fare) continue;
    const pairs = generateValidPairs(
      route.origin,
      route.iata,
      fare.out,
      fare.back,
      input.minDays,
      input.maxDays,
    );
    for (const rt of pairs.slice(0, 6)) {
      candidates.push({
        origin: route.origin,
        destinationIata: route.iata,
        destinationCity: route.city,
        destinationCountry: route.country,
        rt,
      });
    }
  }

  const top = pickTop5DistinctDestinations(candidates);
  state.topCandidates = top.map((c) => ({
    origin: c.origin,
    destinationIata: c.destinationIata,
    destinationCity: c.destinationCity,
    destinationCountry: c.destinationCountry,
    rt: c.rt,
  }));
  state.hotelCursor = 0;
  state.phase = state.topCandidates.length > 0 ? "hotels" : "complete";
  state.message = `${state.topCandidates.length} top destinations`;
  return {
    state,
    done: state.phase === "complete",
    current: state.routes.length,
    total: state.routes.length,
    label: state.message,
  };
}

async function stepFetchHotels(
  input: SearchInput,
  state: SnapshotState,
): Promise<StepResult> {
  const slice = state.topCandidates.slice(
    state.hotelCursor,
    state.hotelCursor + HOTELS_PER_CHUNK,
  );

  for (const c of slice) {
    const checkIn = c.rt.outbound.departureTime.slice(0, 10);
    const checkOut = c.rt.inbound.departureTime.slice(0, 10);
    let hotels: HotelOption[] = [];
    try {
      hotels = await searchHotels({
        cityIata: c.destinationIata,
        cityName: c.destinationCity,
        checkIn,
        checkOut,
        rooms: input.rooms,
        filters: input.filters,
        currency: input.currency,
      });
    } catch (e) {
      log.warn(`hotels ${c.destinationCity} failed`, e);
    }
    const best = pickBestHotel(hotels, input.filters);
    if (best) {
      const nights = Math.max(1, daysBetween(checkIn, checkOut));
      state.trips.push({
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
      });
    }
  }

  state.hotelCursor += slice.length;

  if (state.hotelCursor < state.topCandidates.length) {
    state.message = `Hotels ${state.hotelCursor}/${state.topCandidates.length}`;
    return {
      state,
      done: false,
      current: state.hotelCursor,
      total: state.topCandidates.length,
      label: state.message,
    };
  }

  // All hotels done — finalize
  state.trips.sort((a, b) => a.totalPrice - b.totalPrice);
  if (input.filters.maxBudgetTotal) {
    state.trips = state.trips.filter(
      (t) => t.totalPrice <= input.filters.maxBudgetTotal!,
    );
  }
  state.phase = "complete";
  state.message = `Done: ${state.trips.length} trips`;
  return {
    state,
    done: true,
    current: state.topCandidates.length,
    total: state.topCandidates.length,
    label: state.message,
  };
}

function daysBetween(a: string, b: string): number {
  const ad = new Date(a).getTime();
  const bd = new Date(b).getTime();
  return Math.round((bd - ad) / 86400000);
}
