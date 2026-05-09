import "server-only";

import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/ryanair/client";
import { daysBetween } from "@/lib/search/pairing";
import type { HotelOption } from "@/types";
import type { HotelSearchInput } from "./types";

const log = createLogger("hotels");

export class HotellookError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "HotellookError";
  }
}

export function isHotellookConfigured(): boolean {
  return Boolean(process.env.TRAVELPAYOUTS_TOKEN);
}

const HOTELLOOK_BASE = "https://engine.hotellook.com/api/v2";

type HotellookCacheItem = {
  hotelId: number;
  hotelName?: string;
  stars?: number;
  rating?: number;
  priceFrom?: number;
  priceAvg?: number;
  pricePercentile?: Record<string, number>;
  location?: { name?: string };
  distance?: number;
  thumbnailUrl?: string;
  amenities?: string[];
};

export async function searchHotels(
  input: HotelSearchInput,
): Promise<HotelOption[]> {
  if (!isHotellookConfigured()) {
    log.warn(
      `Hotellook not configured (TRAVELPAYOUTS_TOKEN missing) — using mock data for ${input.cityName ?? input.cityIata}`,
    );
    return mockHotels(input);
  }
  try {
    return await withRetry(() => fetchHotellook(input), 2, 1500);
  } catch (e) {
    log.error("Hotellook fetch failed, falling back to mock", e);
    return mockHotels(input);
  }
}

async function fetchHotellook(input: HotelSearchInput): Promise<HotelOption[]> {
  const { cityIata, cityName, checkIn, checkOut, rooms, currency } = input;
  const totalAdults = rooms.rooms.reduce((s, r) => s + r.adults, 0);
  const totalChildren = rooms.rooms.reduce((s, r) => s + r.children, 0);

  const params = new URLSearchParams({
    location: cityName || cityIata,
    checkIn,
    checkOut,
    adults: String(totalAdults),
    children: String(totalChildren),
    currency: currency.toLowerCase(),
    limit: "30",
    token: process.env.TRAVELPAYOUTS_TOKEN ?? "",
  });

  const url = `${HOTELLOOK_BASE}/cache.json?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new HotellookError(
      `Hotellook returned ${res.status} ${res.statusText}`,
    );
  }
  const data = (await res.json()) as HotellookCacheItem[];
  const nights = Math.max(1, daysBetween(checkIn, checkOut));
  const marker = process.env.TRAVELPAYOUTS_MARKER ?? "";

  return data
    .map((item) => {
      const pricePerNight =
        item.priceFrom && nights > 0 ? item.priceFrom / nights : (item.priceAvg ?? 0);
      const totalPrice = item.priceFrom ?? pricePerNight * nights;
      const amenities = (item.amenities ?? []).map((a) => a.toLowerCase());
      const hasPool = amenities.some((a) => a.includes("pool"));
      const isAllInclusive = amenities.some((a) =>
        a.includes("all_inclusive") || a.includes("all-inclusive"),
      );

      const opt: HotelOption = {
        hotelId: item.hotelId,
        name: item.hotelName ?? `Hotel ${item.hotelId}`,
        stars: item.stars,
        rating: item.rating,
        pricePerNight: Math.round(pricePerNight),
        totalPrice: Math.round(totalPrice),
        currency: currency,
        hasPool,
        distanceToBeachMeters:
          typeof item.distance === "number" ? item.distance * 1000 : undefined,
        isAllInclusive,
        thumbnailUrl: item.thumbnailUrl,
        bookingDeepLink: buildHotellookLink({
          hotelId: item.hotelId,
          checkIn,
          checkOut,
          marker,
          adults: totalAdults,
          children: totalChildren,
        }),
      };
      return opt;
    })
    .filter((h) => h.totalPrice > 0);
}

function buildHotellookLink(args: {
  hotelId: number;
  checkIn: string;
  checkOut: string;
  marker: string;
  adults: number;
  children: number;
}): string {
  const params = new URLSearchParams({
    hotelId: String(args.hotelId),
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    adults: String(args.adults),
    children: String(args.children),
    marker: args.marker,
  });
  return `https://search.hotellook.com/hotels?${params.toString()}`;
}

function mockHotels(input: HotelSearchInput): HotelOption[] {
  const nights = Math.max(1, daysBetween(input.checkIn, input.checkOut));
  const seed = hashString(input.cityIata + input.checkIn);
  const rng = makeRng(seed);

  const templates = [
    { suffix: "Beach Resort", stars: 4, ai: true, pool: true, beach: 80 },
    { suffix: "Bay Hotel", stars: 4, ai: false, pool: true, beach: 250 },
    { suffix: "Boutique", stars: 3, ai: false, pool: false, beach: 600 },
    { suffix: "Garden Suites", stars: 4, ai: true, pool: true, beach: 400 },
    { suffix: "Seaview", stars: 5, ai: true, pool: true, beach: 50 },
    { suffix: "Family Inn", stars: 3, ai: false, pool: true, beach: 800 },
  ];

  const cityWord = (input.cityName || input.cityIata).split(/[\s-]/)[0];

  return templates.map((t, i) => {
    const baseNight = 60 + Math.floor(rng() * 120);
    const pricePerNight = baseNight + i * 15;
    const totalPrice = pricePerNight * nights;
    return {
      hotelId: `mock-${input.cityIata}-${i}`,
      name: `${cityWord} ${t.suffix}`,
      stars: t.stars,
      rating: 7 + Math.round(rng() * 30) / 10,
      pricePerNight,
      totalPrice,
      currency: input.currency,
      hasPool: t.pool,
      distanceToBeachMeters: t.beach,
      isAllInclusive: t.ai,
      thumbnailUrl: undefined,
      bookingDeepLink: `https://www.google.com/search?q=${encodeURIComponent(
        `${cityWord} ${t.suffix} hotel`,
      )}`,
    };
  });
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
