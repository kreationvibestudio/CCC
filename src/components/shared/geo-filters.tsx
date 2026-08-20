"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export interface GeoOption {
  value: string;
  label: string;
}

interface GeoFiltersProps {
  lgas: GeoOption[];
  wards: GeoOption[];
  lga: string;
  ward: string;
  onLgaChange: (lga: string) => void;
  onWardChange: (ward: string) => void;
}

export function GeoFilters({ lgas, wards, lga, ward, onLgaChange, onWardChange }: GeoFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="space-y-1">
        <Label htmlFor="geo-lga">LGA</Label>
        <NativeSelect
          id="geo-lga"
          value={lga}
          onChange={(e) => {
            onLgaChange(e.target.value);
            onWardChange("");
          }}
          className="min-w-[160px]"
        >
          <option value="">All LGAs</option>
          {lgas.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor="geo-ward">Ward</Label>
        <NativeSelect
          id="geo-ward"
          value={ward}
          onChange={(e) => onWardChange(e.target.value)}
          className="min-w-[160px]"
          disabled={!lga && wards.length > 10}
        >
          <option value="">All wards</option>
          {wards.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
