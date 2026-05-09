import type { HotelOption, RoomConfig, Currency } from "@/types";

export type HotelSearchInput = {
  cityIata: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  rooms: RoomConfig;
  filters: {
    pool?: boolean;
    maxDistanceToBeachMeters?: number;
    allInclusive?: boolean;
    minHotelRating?: number;
  };
  currency: Currency;
};

export type { HotelOption };
