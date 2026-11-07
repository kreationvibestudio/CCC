"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLatLngPaste } from "@/lib/maps/coordinates";

type Props = {
  latitude?: number | null;
  longitude?: number | null;
  disabled?: boolean;
};

/**
 * Map pins must accept a Google Maps paste (`6.33, 5.62`). HTML `type="number"`
 * rejects that comma-separated string and blocks the whole Save — which is how
 * HQ ends up stuck with a wrong pin while standing on the real unit.
 */
export function CoordinateFields({ latitude, longitude, disabled }: Props) {
  const [lat, setLat] = useState(latitude != null ? String(latitude) : "");
  const [lng, setLng] = useState(longitude != null ? String(longitude) : "");
  const [paste, setPaste] = useState("");
  const [hint, setHint] = useState("");

  function applyPaste(value: string) {
    setPaste(value);
    const parsed = parseLatLngPaste(value);
    if (!parsed) {
      setHint(value.trim() ? "Paste looks like: 6.3346, 5.6234 or a Google Maps link" : "");
      return;
    }
    setLat(String(parsed.latitude));
    setLng(String(parsed.longitude));
    setHint(`Loaded ${parsed.latitude}, ${parsed.longitude}`);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="coordinates_paste">Paste Google Maps coordinates</Label>
        <Input
          id="coordinates_paste"
          name="coordinates_paste"
          value={paste}
          disabled={disabled}
          placeholder="6.3346325, 5.6233922"
          onChange={(e) => applyPaste(e.target.value)}
          autoComplete="off"
        />
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            name="latitude"
            inputMode="decimal"
            value={lat}
            disabled={disabled}
            onChange={(e) => setLat(e.target.value)}
            placeholder="6.3346325"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            name="longitude"
            inputMode="decimal"
            value={lng}
            disabled={disabled}
            onChange={(e) => setLng(e.target.value)}
            placeholder="5.6233922"
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
