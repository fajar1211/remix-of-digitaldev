import { useEffect, useMemo } from "react";

import {
  findCountryByName,
  findStateByName,
  getAllCountries,
  getCitiesOfState,
  getStatesOfCountry,
} from "@/lib/locations";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  country: string;
  state: string;
  city: string;
  onCountryChange: (next: string) => void;
  onStateChange: (next: string) => void;
  onCityChange: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

export function LocationSelectFields({
  country,
  state,
  city,
  onCountryChange,
  onStateChange,
  onCityChange,
  disabled,
  required,
  className,
}: Props) {
  const allCountries = useMemo(() => getAllCountries(), []);
  const selectedCountry = useMemo(() => (country ? findCountryByName(country) : undefined), [country]);

  const availableStates = useMemo(
    () => (selectedCountry ? getStatesOfCountry(selectedCountry.isoCode) : []),
    [selectedCountry],
  );

  const selectedState = useMemo(
    () => (selectedCountry && state ? findStateByName(selectedCountry.isoCode, state) : undefined),
    [selectedCountry, state],
  );

  const availableCities = useMemo(
    () =>
      selectedCountry && selectedState
        ? getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode).map((c) => c.name)
        : [],
    [selectedCountry, selectedState],
  );

  // Keep dependent values consistent even if saved values become invalid.
  useEffect(() => {
    if (!selectedCountry) {
      if (state) onStateChange("");
      if (city) onCityChange("");
      return;
    }

    if (state && !selectedState) {
      onStateChange("");
      if (city) onCityChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  useEffect(() => {
    if (!selectedCountry || !selectedState) {
      if (city) onCityChange("");
      return;
    }

    if (city && !availableCities.includes(city)) onCityChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, state]);

  return (
    <div className={className ?? "grid gap-6 md:grid-cols-3"}>
      <div className="space-y-2">
        <Label>
          Country {required ? <span className="text-destructive">*</span> : null}
        </Label>
        <Select
          value={country}
          onValueChange={(value) => {
            onCountryChange(value);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent className="bg-popover border z-50 max-h-[300px]">
            {allCountries.map((c) => (
              <SelectItem key={c.isoCode} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          State {required ? <span className="text-destructive">*</span> : null}
        </Label>
        <Select
          value={state}
          onValueChange={(value) => {
            onStateChange(value);
          }}
          disabled={disabled || !country}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={country ? "Select state" : "Select country first"} />
          </SelectTrigger>
          <SelectContent className="bg-popover border z-50 max-h-[300px]">
            {availableStates.map((s) => (
              <SelectItem key={s.isoCode} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>
          City {required ? <span className="text-destructive">*</span> : null}
        </Label>
        <Select
          value={city}
          onValueChange={(value) => {
            onCityChange(value);
          }}
          disabled={disabled || !state}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={state ? "Select city" : "Select state first"} />
          </SelectTrigger>
          <SelectContent className="bg-popover border z-50 max-h-[300px]">
            {availableCities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
