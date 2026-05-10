import "server-only";

import { searchHotels } from "@/lib/hotels/hotellook";
import { pickBestHotel } from "@/lib/hotels/filters";
import { fetchRoundTripsForWindow } from "@/lib/flights/travelpayouts";
import { fetchRyanairRoundTrips } from "@/lib/flights/ryanair-direct";
import { getDestinationsFromOrigin } from "@/lib/ryanair/client";
import { createLogger } from "@/lib/logger";
import { airportsForCountries } from "./airports";
import { pickTopTrips, type RouteCandidate } from "./pairing";
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
  candidatesPool: SerializedTopCandidate[]; // running top-N, bounded
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

const ROUTES_PER_CHUNK = 2; // tight; per-fetch timeouts also bound chunk time
const HOTELS_PER_CHUNK = 1;
const MAX_TRIPS_PER_ROUTE = 6;
const MAX_TOTAL_TRIPS = 10;
const MAX_TRIPS_PER_DESTINATION = 3;
const POOL_BUFFER = 200; // running pool overall cap (price-sorted)

export function initialState(): SnapshotState {
  return {
    phase: "init",
    routes: [],
    routeCursor: 0,
    candidatesPool: [],
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
  // Candidate destinations in the requested countries, then intersect with
  // each origin's actual reachable set from Ryanair so we never probe routes
  // the airline doesn't fly.
  const destAirports = airportsForCountries(input.destinationCountries);
  const validRoutes: SerializedRoute[] = [];
  for (const origin of input.origins) {
    let reachable: Set<string>;
    try {
      reachable = new Set(await getDestinationsFromOrigin(origin));
    } catch (e) {
      log.warn(`getDestinations(${origin}) failed; dropping origin`, e);
      continue;
    }
    for (const d of destAirports) {
      if (reachable.has(d.iata)) {
        validRoutes.push({
          origin,
          iata: d.iata,
          city: d.city,
          country: d.country,
        });
      }
    }
  }

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

      // 1. Try Ryanair's own fare-finder API first.
      try {
        const adults = input.passengers.filter(
          (p) => p.type === "adult",
        ).length;
        const teens = input.passengers.filter((p) => p.type === "teen").length;
        const children = input.passengers.filter(
          (p) => p.type === "child",
        ).length;
        const infants = input.passengers.filter(
          (p) => p.type === "infant",
        ).length;
        rts = await fetchRyanairRoundTrips({
          origin: route.origin,
          destination: route.iata,
          outboundFrom: input.dateWindowStart,
          outboundTo: input.dateWindowEnd,
          durationFrom: input.minDays,
          durationTo: input.maxDays,
          adults: Math.max(1, adults),
          teens,
          children,
          infants,
          currency: input.currency,
        });
      } catch (e) {
        log.warn(`ryanair direct ${key} failed`, e);
      }

      // 2. Fall back to Travelpayouts (Ryanair + Wizz, sometimes cached older prices).
      if (rts.length === 0) {
        try {
          rts = await fetchRoundTripsForWindow({
            origin: route.origin,
            destination: route.iata,
            dateStartIso: input.dateWindowStart,
            dateEndIso: input.dateWindowEnd,
            currency: input.currency,
            minDays: input.minDays,
            maxDays: input.maxDays,
            airlineWhitelist: ["FR", "W6"],
          });
        } catch (e) {
          log.warn(`travelpayouts ${key} failed`, e);
        }
      }

      // No real data → drop the route. We never fabricate fares.
      if (rts.length === 0) return;

      const limited = rts.slice(0, MAX_TRIPS_PER_ROUTE);
      for (const rt of limited) {
        state.candidatesPool.push({
          origin: route.origin,
          destinationIata: route.iata,
          destinationCity: route.city,
          destinationCountry: route.country,
          rt,
        });
      }
    }),
  );

  // Bound the running pool: top 5 trips per destination, capped overall.
  // Preserves diversity so the final picker can still surface distinct cities.
  state.candidatesPool = trimPool(state.candidatesPool, 5, POOL_BUFFER);

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

  const top = pickTopTrips(
    state.candidatesPool as RouteCandidate[],
    MAX_TOTAL_TRIPS,
    MAX_TRIPS_PER_DESTINATION,
  );
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

function trimPool(
  pool: SerializedTopCandidate[],
  maxPerDest: number,
  maxTotal: number,
): SerializedTopCandidate[] {
  const byDest = new Map<string, SerializedTopCandidate[]>();
  for (const c of pool) {
    const arr = byDest.get(c.destinationIata) ?? [];
    arr.push(c);
    byDest.set(c.destinationIata, arr);
  }
  const trimmed: SerializedTopCandidate[] = [];
  for (const [, arr] of byDest) {
    arr.sort((a, b) => a.rt.totalPrice - b.rt.totalPrice);
    trimmed.push(...arr.slice(0, maxPerDest));
  }
  trimmed.sort((a, b) => a.rt.totalPrice - b.rt.totalPrice);
  return trimmed.slice(0, maxTotal);
}
