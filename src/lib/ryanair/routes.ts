import "server-only";

import { getActiveAirports, getDestinationsFromOrigin } from "./client";
import type { AirportInfo } from "./types";

export async function resolveAirportsForCountries(
  countryCodes: string[],
): Promise<AirportInfo[]> {
  const all = await getActiveAirports();
  const codes = new Set(countryCodes.map((c) => c.toUpperCase()));
  return all.filter((a) => codes.has(a.country));
}

export async function resolveValidRoutes(
  origins: string[],
  countryCodes: string[],
): Promise<Array<{ origin: string; destination: AirportInfo }>> {
  const destAirports = await resolveAirportsForCountries(countryCodes);
  const out: Array<{ origin: string; destination: AirportInfo }> = [];
  for (const origin of origins) {
    const reachable = new Set(await getDestinationsFromOrigin(origin));
    for (const dest of destAirports) {
      if (reachable.has(dest.iata)) {
        out.push({ origin, destination: dest });
      }
    }
  }
  return out;
}
