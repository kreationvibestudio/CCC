"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Marker = { id: string; lat: number; lng: number; label: string; sublabel?: string };

export function CampaignMap({ markers, height = 256 }: { markers: Marker[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || markers.length === 0) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center = markers.reduce(
      (acc, m) => ({ lat: acc.lat + m.lat / markers.length, lng: acc.lng + m.lng / markers.length }),
      { lat: 0, lng: 0 }
    );

    const map = L.map(ref.current).setView([center.lat, center.lng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    for (const m of markers) {
      L.marker([m.lat, m.lng])
        .addTo(map)
        .bindPopup(`<strong>${m.label}</strong>${m.sublabel ? `<br/>${m.sublabel}` : ""}`);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markers]);

  if (markers.length === 0) return null;
  return <div ref={ref} className="w-full rounded-xl border border-border" style={{ height }} />;
}
