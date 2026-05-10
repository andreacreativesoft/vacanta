import "server-only";

import { createLogger } from "@/lib/logger";
import { fetchWithTimeout, withRetry } from "@/lib/retry";
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
      `Hotellook not configured (TRAVELPAYOUTS_TOKEN missing) — no hotels for ${input.cityName ?? input.cityIata}`,
    );
    return [];
  }
  try {
    return await withRetry(() => fetchHotellook(input), 2, 1500);
  } catch (e) {
    log.error("Hotellook fetch failed", e);
    return [];
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
  const res = await fetchWithTimeout(url, {
    cache: "no-store",
    timeoutMs: 5000,
  });
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
