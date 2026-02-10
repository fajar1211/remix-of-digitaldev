import {
  Country as CscCountry,
  State as CscState,
  City as CscCity,
} from "country-state-city";

export type LocationCountry = {
  isoCode: string;
  name: string;
  phoneCode?: string;
};

export type LocationState = {
  isoCode: string;
  name: string;
};

export type LocationCity = {
  name: string;
};

export function getAllCountries(): LocationCountry[] {
  return (CscCountry.getAllCountries() as unknown as any[])
    .map((c) => ({
      isoCode: String(c.isoCode),
      name: String(c.name),
      phoneCode: c.phonecode ? `+${String(c.phonecode).replace(/^\+/, "")}` : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findCountryByName(name: string): LocationCountry | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return getAllCountries().find((c) => c.name.toLowerCase() === n);
}

export function getStatesOfCountry(countryIso: string): LocationState[] {
  if (!countryIso) return [];
  return (CscState.getStatesOfCountry(countryIso) as unknown as any[])
    .map((s) => ({ isoCode: String(s.isoCode), name: String(s.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findStateByName(countryIso: string, stateName: string): LocationState | undefined {
  const n = stateName.trim().toLowerCase();
  if (!countryIso || !n) return undefined;
  return getStatesOfCountry(countryIso).find((s) => s.name.toLowerCase() === n);
}

export function getCitiesOfState(countryIso: string, stateIso: string): LocationCity[] {
  if (!countryIso || !stateIso) return [];
  return (CscCity.getCitiesOfState(countryIso, stateIso) as unknown as any[])
    .map((c) => ({ name: String(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
