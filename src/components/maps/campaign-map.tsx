"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
  status?: string;
};

const STATUS_COLORS: Record<string, string> = {
  voting_in_progress: "#22c55e",
  delayed: "#eab308",
  minor_issue: "#f97316",
  serious_incident: "#ef4444",
  results_uploaded: "#3b82f6",
  not_active: "#94a3b8",
};

function colorIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function CampaignMap({
  markers,
  height = 256,
  cluster = false,
  selectedId,
  onMarkerClick,
  fitBounds = true,
}: {
  markers: MapMarker[];
  height?: number;
  cluster?: boolean;
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
  fitBounds?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!ref.current || markers.length === 0) return;

    if (!mapRef.current) {
      const center = markers.reduce(
        (acc, m) => ({ lat: acc.lat + m.lat / markers.length, lng: acc.lng + m.lng / markers.length }),
        { lat: 0, lng: 0 }
      );
      mapRef.current = L.map(ref.current).setView([center.lat, center.lng], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(mapRef.current);
    }

    if (layerRef.current) {
      mapRef.current!.removeLayer(layerRef.current);
    }

    const group = cluster
      ? L.markerClusterGroup({ maxClusterRadius: 40 })
      : L.layerGroup();

    for (const m of markers) {
      const color = STATUS_COLORS[m.status ?? "not_active"] ?? STATUS_COLORS.not_active;
      const marker = L.marker([m.lat, m.lng], { icon: colorIcon(color) });
      marker.bindPopup(
        `<strong>${m.label}</strong>${m.sublabel ? `<br/>${m.sublabel}` : ""}${m.status ? `<br/><em>${m.status.replace(/_/g, " ")}</em>` : ""}`
      );
      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(m.id));
      }
      group.addLayer(marker);
    }

    group.addTo(mapRef.current!);
    layerRef.current = group;

    if (fitBounds && markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      mapRef.current!.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    }

    if (selectedId) {
      const sel = markers.find((m) => m.id === selectedId);
      if (sel) mapRef.current!.setView([sel.lat, sel.lng], 14);
    }

    return () => {};
  }, [markers, cluster, selectedId, onMarkerClick, fitBounds]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  if (markers.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        No mapped polling units yet. Import Edo/Esan data or add coordinates.
      </div>
    );
  }

  return <div ref={ref} className="w-full rounded-xl border border-border" style={{ height }} />;
}

export function statusLegend() {
  return Object.entries(STATUS_COLORS).map(([k, c]) => ({ status: k, color: c }));
}
