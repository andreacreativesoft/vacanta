import type { AirportInfo } from "@/lib/ryanair/types";
import type { DailyFare } from "./pairing";

export const MOCK_DESTINATIONS: AirportInfo[] = [
  // Greece
  { iata: "ATH", city: "Athens", country: "GR" },
  { iata: "SKG", city: "Thessaloniki", country: "GR" },
  { iata: "RHO", city: "Rhodes", country: "GR" },
  { iata: "CHQ", city: "Chania", country: "GR" },
  { iata: "HER", city: "Heraklion", country: "GR" },
  { iata: "JTR", city: "Santorini", country: "GR" },
  { iata: "JMK", city: "Mykonos", country: "GR" },
  { iata: "CFU", city: "Corfu", country: "GR" },
  { iata: "KGS", city: "Kos", country: "GR" },
  { iata: "ZTH", city: "Zakynthos", country: "GR" },
  // Cyprus
  { iata: "PFO", city: "Paphos", country: "CY" },
  { iata: "LCA", city: "Larnaca", country: "CY" },
  // Italy
  { iata: "BRI", city: "Bari", country: "IT" },
  { iata: "BGY", city: "Milan Bergamo", country: "IT" },
  { iata: "BLQ", city: "Bologna", country: "IT" },
  { iata: "CIA", city: "Rome Ciampino", country: "IT" },
  { iata: "NAP", city: "Naples", country: "IT" },
  { iata: "PMO", city: "Palermo", country: "IT" },
  { iata: "CTA", city: "Catania", country: "IT" },
  { iata: "VCE", city: "Venice", country: "IT" },
  { iata: "TSF", city: "Treviso", country: "IT" },
  { iata: "PSA", city: "Pisa", country: "IT" },
  { iata: "VRN", city: "Verona", country: "IT" },
  { iata: "TRN", city: "Turin", country: "IT" },
  // Spain
  { iata: "BCN", city: "Barcelona", country: "ES" },
  { iata: "MAD", city: "Madrid", country: "ES" },
  { iata: "AGP", city: "Málaga", country: "ES" },
  { iata: "PMI", city: "Mallorca", country: "ES" },
  { iata: "VLC", city: "Valencia", country: "ES" },
  { iata: "ALC", city: "Alicante", country: "ES" },
  { iata: "IBZ", city: "Ibiza", country: "ES" },
  { iata: "SVQ", city: "Seville", country: "ES" },
  { iata: "BIO", city: "Bilbao", country: "ES" },
  // Portugal
  { iata: "LIS", city: "Lisbon", country: "PT" },
  { iata: "OPO", city: "Porto", country: "PT" },
  { iata: "FAO", city: "Faro", country: "PT" },
  // Croatia
  { iata: "ZAG", city: "Zagreb", country: "HR" },
  { iata: "SPU", city: "Split", country: "HR" },
  { iata: "DBV", city: "Dubrovnik", country: "HR" },
  { iata: "ZAD", city: "Zadar", country: "HR" },
  { iata: "PUY", city: "Pula", country: "HR" },
  // Malta
  { iata: "MLA", city: "Malta", country: "MT" },
  // France
  { iata: "BVA", city: "Paris Beauvais", country: "FR" },
  { iata: "MRS", city: "Marseille", country: "FR" },
  { iata: "NCE", city: "Nice", country: "FR" },
  { iata: "BOD", city: "Bordeaux", country: "FR" },
  // Germany
  { iata: "HHN", city: "Frankfurt Hahn", country: "DE" },
  { iata: "BER", city: "Berlin", country: "DE" },
  { iata: "CGN", city: "Cologne", country: "DE" },
  { iata: "DTM", city: "Dortmund", country: "DE" },
  { iata: "FMM", city: "Memmingen", country: "DE" },
  { iata: "NRN", city: "Weeze", country: "DE" },
  { iata: "BRE", city: "Bremen", country: "DE" },
  // Belgium
  { iata: "CRL", city: "Brussels Charleroi", country: "BE" },
  // UK + Ireland
  { iata: "STN", city: "London Stansted", country: "GB" },
  { iata: "MAN", city: "Manchester", country: "GB" },
  { iata: "LPL", city: "Liverpool", country: "GB" },
  { iata: "BHX", city: "Birmingham", country: "GB" },
  { iata: "EDI", city: "Edinburgh", country: "GB" },
  { iata: "DUB", city: "Dublin", country: "IE" },
  // Netherlands
  { iata: "EIN", city: "Eindhoven", country: "NL" },
  // Austria
  { iata: "VIE", city: "Vienna", country: "AT" },
  // Poland / Czech / Hungary
  { iata: "WAW", city: "Warsaw", country: "PL" },
  { iata: "KRK", city: "Kraków", country: "PL" },
  { iata: "WRO", city: "Wrocław", country: "PL" },
  { iata: "GDN", city: "Gdańsk", country: "PL" },
  { iata: "PRG", city: "Prague", country: "CZ" },
  { iata: "BUD", city: "Budapest", country: "HU" },
  // Bulgaria
  { iata: "SOF", city: "Sofia", country: "BG" },
  { iata: "BOJ", city: "Burgas", country: "BG" },
  // Scandinavia
  { iata: "BLL", city: "Billund", country: "DK" },
  { iata: "GOT", city: "Gothenburg", country: "SE" },
  { iata: "NYO", city: "Stockholm Skavsta", country: "SE" },
  { iata: "TRF", city: "Oslo Torp", country: "NO" },
  { iata: "HEL", city: "Helsinki", country: "FI" },
  // Morocco
  { iata: "RAK", city: "Marrakech", country: "MA" },
  { iata: "AGA", city: "Agadir", country: "MA" },
  { iata: "FEZ", city: "Fez", country: "MA" },
  { iata: "NDR", city: "Nador", country: "MA" },
  // Israel + Jordan
  { iata: "TLV", city: "Tel Aviv", country: "IL" },
  { iata: "AMM", city: "Amman", country: "JO" },
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
