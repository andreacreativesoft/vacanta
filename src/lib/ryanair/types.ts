export type AirportInfo = {
  iata: string;
  city: string;
  country: string;
  name?: string;
};

export type RouteInfo = {
  origin: string;
  destination: AirportInfo;
};
