/**
 * Fallback city data for Indonesian provinces where the country-state-city
 * library returns no results (e.g. Kalimantan Barat).
 *
 * Re-used by /order/checkout, /order/details, admin create, onboarding, etc.
 */

import { City } from "country-state-city";

export const KALIMANTAN_BARAT_CITIES = [
  "Kabupaten Bengkayang",
  "Kabupaten Kapuas Hulu",
  "Kabupaten Kayong Utara",
  "Kabupaten Ketapang",
  "Kabupaten Kubu Raya",
  "Kabupaten Landak",
  "Kabupaten Melawi",
  "Kabupaten Mempawah",
  "Kabupaten Sambas",
  "Kabupaten Sanggau",
  "Kabupaten Sekadau",
  "Kabupaten Sintang",
  "Kota Pontianak",
  "Kota Singkawang",
];

/**
 * Resolve cities for a given Indonesian province ISO code (e.g. "KB", "JB").
 * Falls back to filtering all ID cities and hardcoded data for Kalimantan Barat.
 */
export function getIndonesianCities(provinceIsoCode: string, provinceName?: string): string[] {
  if (!provinceIsoCode) return [];

  const normalize = (code: unknown) => {
    const s = String(code ?? "").trim();
    if (!s) return "";
    const parts = s.split("-");
    return parts[parts.length - 1].toLowerCase();
  };

  // Try direct lookup
  const byState = City.getCitiesOfState("ID", provinceIsoCode) || [];
  if (byState.length > 0) return byState.map((c) => c.name);

  // Try filtering all cities by stateCode
  const target = normalize(provinceIsoCode);
  const all = City.getCitiesOfCountry("ID") || [];
  const filtered = all
    .filter((c) => normalize((c as any).stateCode) === target)
    .map((c) => c.name);
  if (filtered.length > 0) return filtered;

  // Hardcoded fallback for Kalimantan Barat
  const isKalbar =
    provinceIsoCode.toUpperCase() === "KB" ||
    (provinceName && /kalimantan\s+barat/i.test(provinceName));
  if (isKalbar) return KALIMANTAN_BARAT_CITIES.slice();

  return [];
}

/**
 * Fetch cities from external API as a last resort.
 * Returns city names sorted alphabetically.
 */
export async function fetchIndonesianCitiesFromApi(
  provinceName: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  try {
    const provRes = await fetch(
      "https://emsifa.github.io/api-wilayah-indonesia/api/provinces.json",
      { signal },
    );
    const provJson = (await provRes.json()) as Array<{ id: string; name: string }>;
    const targetName = norm(provinceName);
    const matched = provJson.find((p) => norm(p.name) === targetName);
    if (!matched) return [];

    const regRes = await fetch(
      `https://emsifa.github.io/api-wilayah-indonesia/api/regencies/${matched.id}.json`,
      { signal },
    );
    const regJson = (await regRes.json()) as Array<{ id: string; name: string }>;
    return regJson.map((r) => r.name).sort((a, b) => a.localeCompare(b, "id"));
  } catch (e) {
    if ((e as any)?.name === "AbortError") return [];
    return [];
  }
}
