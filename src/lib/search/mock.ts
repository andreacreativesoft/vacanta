import type { AirportInfo } from "@/lib/ryanair/types";
import type { DailyFare } from "./pairing";

export const MOCK_DESTINATIONS: AirportInfo[] = [
  { iata: "ATH", city: "Athens", country: "GR" },
  { iata: "SKG", city: "Thessaloniki", country: "GR" },
  { iata: "RHO", city: "Rhodes", country: "GR" },
  { iata: "CHQ", city: "Chania", country: "GR" },
  { iata: "HER", city: "Heraklion", country: "GR" },
  { iata: "JTR", city: "Santorini", country: "GR" },
  { iata: "JMK", city: "Mykonos", country: "GR" },
  { iata: "CFU", city: "Corfu", country: "GR" },
  { iata: "PFO", city: "Paphos", country: "CY" },
  { iata: "LCA", city: "Larnaca", country: "CY" },
  { iata: "BRI", city: "Bari", country: "IT" },
  { iata: "NAP", city: "Naples", country: "IT" },
  { iata: "PMO", city: "Palermo", country: "IT" },
  { iata: "AGP", city: "Málaga", country: "ES" },
  { iata: "PMI", city: "Mallorca", country: "ES" },
  { iata: "VLC", city: "Valencia", country: "ES" },
  { iata: "FAO", city: "Faro", country: "PT" },
  { iata: "OPO", city: "Porto", country: "PT" },
  { iata: "SPU", city: "Split", country: "HR" },
  { iata: "DBV", city: "Dubrovnik", country: "HR" },
  { iata: "MLA", city: "Malta", country: "MT" },
];

export function mockDestinationsForCountries(
  codes: string[],
): AirportInfo[] {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  return MOCK_DESTINATIONS.filter((d) => set.has(d.country));
}

export function mockCheapestPerDay(
  origin: string,
  destination: string,
  fromIso: string,
  toIso: string,
  currency = "EUR",
): DailyFare[] {
  const out: DailyFare[] = [];
  const start = new Date(fromIso);
  const end = new Date(toIso);
  const seed = hash(`${origin}-${destination}`);
  let s = seed || 1;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    if (next() < 0.4) continue;
    const dow = d.getDay();
    const weekendBump = dow === 5 || dow === 6 || dow === 0 ? 25 : 0;
    const price = 25 + Math.floor(next() * 80) + weekendBump;
    out.push({
      date: d.toISOString().slice(0, 10),
      price,
      currency,
    });
  }
  return out;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
