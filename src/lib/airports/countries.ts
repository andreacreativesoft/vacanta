export type CountryDef = {
  code: string;
  name: string;
};

export const SUPPORTED_COUNTRIES: CountryDef[] = [
  { code: "GR", name: "Greece" },
  { code: "CY", name: "Cyprus" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "HR", name: "Croatia" },
  { code: "MT", name: "Malta" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "NL", name: "Netherlands" },
  { code: "IE", name: "Ireland" },
  { code: "GB", name: "United Kingdom" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "HU", name: "Hungary" },
  { code: "BG", name: "Bulgaria" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "FI", name: "Finland" },
  { code: "NO", name: "Norway" },
  { code: "MA", name: "Morocco" },
  { code: "IL", name: "Israel" },
  { code: "TR", name: "Turkey" },
  { code: "JO", name: "Jordan" },
];

export const SUPPORTED_ORIGINS = [
  { iata: "OTP", city: "Bucharest" },
  { iata: "GHV", city: "Brașov" },
  { iata: "SBZ", city: "Sibiu" },
];

export function countryName(code: string): string {
  return (
    SUPPORTED_COUNTRIES.find((c) => c.code === code)?.name ?? code.toUpperCase()
  );
}
