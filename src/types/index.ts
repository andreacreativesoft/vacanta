export type PassengerCategory = "adult" | "teen" | "child" | "infant";

export type Passenger = {
  type: PassengerCategory;
  age?: number;
};

export type RoomConfig = {
  rooms: Array<{
    adults: number;
    children: number;
  }>;
};

export type Currency = "EUR" | "RON" | "USD";

export type SearchInput = {
  origins: string[];
  destinationCountries: string[];
  dateWindowStart: string;
  dateWindowEnd: string;
  minDays: number;
  maxDays: number;
  passengers: Passenger[];
  rooms: RoomConfig;
  filters: {
    pool?: boolean;
    maxDistanceToBeachMeters?: number;
    allInclusive?: boolean;
    minHotelRating?: number;
    maxBudgetTotal?: number;
  };
  currency: Currency;
};

export type FlightLeg = {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  currency: string;
};

export type FlightRoundTrip = {
  outbound: FlightLeg;
  inbound: FlightLeg;
  totalPrice: number;
  currency: string;
};

export type HotelOption = {
  hotelId: string | number;
  name: string;
  stars?: number;
  rating?: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  hasPool: boolean;
  distanceToBeachMeters?: number;
  isAllInclusive?: boolean;
  thumbnailUrl?: string;
  bookingDeepLink: string;
};

export type TripOption = {
  destinationCity: string;
  destinationAirport: string;
  destinationCountry: string;
  flight: FlightRoundTrip;
  hotel: HotelOption;
  alternativeHotels?: HotelOption[];
  nights: number;
  totalPrice: number;
  currency: string;
};

export type ProgressEvent =
  | { type: "phase"; phase: string; message: string }
  | {
      type: "progress";
      phase: string;
      current: number;
      total: number;
      label?: string;
    }
  | { type: "partial"; trips: TripOption[] }
  | { type: "result"; trips: TripOption[] }
  | { type: "done"; searchId: string; snapshotId: string }
  | { type: "error"; message: string };
