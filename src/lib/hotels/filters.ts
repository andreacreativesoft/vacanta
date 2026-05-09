import type { HotelOption } from "@/types";

export function meetsFilters(
  hotel: HotelOption,
  filters: {
    pool?: boolean;
    maxDistanceToBeachMeters?: number;
    allInclusive?: boolean;
    minHotelRating?: number;
  },
): boolean {
  if (filters.pool && !hotel.hasPool) return false;
  if (
    filters.maxDistanceToBeachMeters !== undefined &&
    hotel.distanceToBeachMeters !== undefined &&
    hotel.distanceToBeachMeters > filters.maxDistanceToBeachMeters
  )
    return false;
  if (filters.allInclusive && !hotel.isAllInclusive) return false;
  if (
    filters.minHotelRating !== undefined &&
    hotel.rating !== undefined &&
    hotel.rating < filters.minHotelRating
  )
    return false;
  return true;
}

export function pickBestHotel(
  hotels: HotelOption[],
  filters: {
    pool?: boolean;
    maxDistanceToBeachMeters?: number;
    allInclusive?: boolean;
    minHotelRating?: number;
  },
): HotelOption | null {
  const eligible = hotels.filter((h) => meetsFilters(h, filters));
  const pool = eligible.length > 0 ? eligible : hotels;
  if (pool.length === 0) return null;
  return pool.slice().sort((a, b) => a.totalPrice - b.totalPrice)[0];
}
