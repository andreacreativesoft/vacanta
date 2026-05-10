import "server-only";

import { searchHotels } from "@/lib/hotels/hotellook";
import { pickBestHotel } from "@/lib/hotels/filters";
import { fetchRoundTripsForWindow } from "@/lib/flights/travelpayouts";
import { createLogger } from "@/lib/logger";
import { mockDestinationsForCountries, mockCheapestPerDay } from "./mock";
import {
  generateValidPairs,
  pickTop5DistinctDestinations,
  type RouteCandidate,
} from "./pairing";
import { countryName } from "@/lib/airports/countries";
import type {
  FlightRoundTrip,
  HotelOption,
  SearchInput,
  TripOption,
} from "@/types";

const log = createLogger("step");

export type Phase =
  | "init"
  | "routes"
  | "pricing"
  | "hotels"
  | "complete"
  | "error";

export type SnapshotState = {
  phase: Phase;
  routes: SerializedRoute[];
  routeCursor: number; // next route index to price
  routeRoundTrips: Record<string, SerializedRoundTrip[]>;
  topCandidates: SerializedTopCandidate[];
  hotelCursor: number; // next top-candidate index to fetch hotels for
  trips: TripOption[];
  message?: string;
  hadRealFlightData?: boolean;
};

type SerializedRoute = {
  origin: string;
  iata: string;
  city: string;
  country: string;
};
type SerializedRoundTrip = FlightRoundTrip;
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

const ROUTES_PER_CHUNK = 6; // ~5-8s per chunk
const HOTELS_PER_CHUNK = 2;
const MAX_TRIPS_PER_ROUTE = 6;

function forceMock(): boolean {
  return process.env.MOCK_SEARCH === "1";
}

export function initialState(): SnapshotState {
  return {
    phase: "init",
    routes: [],
    routeCursor: 0,
    routeRoundTrips: {},
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
  // We always start from the static destination list filtered by countries.
  // Travelpayouts probes will tell us per-route whether Aviasales has data.
  const destAirports = mockDestinationsForCountries(input.destinationCountries);
  const validRoutes: SerializedRoute[] = input.origins.flatMap((origin) =>
    destAirports.map((d) => ({
      origin,
      iata: d.iata,
      city: d.city,
      country: d.country,
    })),
  );

  state.routes = validRoutes;
  state.routeCursor = 0;
  state.phase = validRoutes.length > 0 ? "pricing" : "complete";
  state.message = `Probing ${validRoutes.length} routes`;

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
      let rts: FlightRoundTrip[] = [];

      if (!forceMock()) {
        try {
          rts = await fetchRoundTripsForWindow({
            origin: route.origin,
            destination: route.iata,
            dateStartIso: input.dateWindowStart,
            dateEndIso: input.dateWindowEnd,
            currency: input.currency,
            minDays: input.minDays,
            maxDays: input.maxDays,
          });
          if (rts.length > 0) state.hadRealFlightData = true;
        } catch (e) {
          log.warn(`travelpayouts ${key} failed, using mock`, e);
        }
      }

      if (rts.length === 0) {
        // Mock fallback per-route: synthesize using out/back daily fares + pairing.
        const outFares = mockCheapestPerDay(
          route.origin,
          route.iata,
          input.dateWindowStart,
          input.dateWindowEnd,
          input.currency,
        );
        const backFares = mockCheapestPerDay(
          route.iata,
          route.origin,
          input.dateWindowStart,
          input.dateWindowEnd,
          input.currency,
        );
        rts = generateValidPairs(
          route.origin,
          route.iata,
          outFares,
          backFares,
          input.minDays,
          input.maxDays,
        );
      }

      // Keep only the cheapest few per route to bound state size.
      state.routeRoundTrips[key] = rts.slice(0, MAX_TRIPS_PER_ROUTE);
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

  // Pricing finished — pick top 5 distinct cheapest destinations
  const candidates: RouteCandidate[] = [];
  for (const route of state.routes) {
    const key = `${route.origin}-${route.iata}`;
    for (const rt of state.routeRoundTrips[key] ?? []) {
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
  state.topCandidates = top;
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
