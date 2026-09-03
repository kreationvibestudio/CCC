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
  voting_finished: "#0d9488",
  delayed: "#eab308",
  minor_issue: "#f97316",
  serious_incident: "#ef4444",
  results_uploaded: "#3b82f6",
  not_active: "#94a3b8",
};

const STATUS_LABELS: Record<string, string> = {
  voting_in_progress: "Voting",
  voting_finished: "Voting finished",
  delayed: "Delayed",
  minor_issue: "Minor issue",
  serious_incident: "Incident",
  results_uploaded: "Results",
  not_active: "Not active",
};

const EDO_CENTER: [number, number] = [6.34, 5.63];

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
  emptyHint,
}: {
  markers: MapMarker[];
  height?: number;
  cluster?: boolean;
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
  fitBounds?: boolean;
  emptyHint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    if (!mapRef.current) {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
      mapRef.current = L.map(ref.current).setView(EDO_CENTER, 8);
      L.tileLayer(
        token
          ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: token ? "&copy; Mapbox &copy; OpenStreetMap" : "&copy; OpenStreetMap",
          ...(token ? { tileSize: 512, zoomOffset: -1, maxZoom: 18 } : {}),
        }
      ).addTo(mapRef.current);
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    }

    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (markers.length === 0) {
      mapRef.current.setView(EDO_CENTER, 8);
      return;
    }

    const group = cluster
      ? L.markerClusterGroup({ maxClusterRadius: 40 })
      : L.layerGroup();

    for (const m of markers) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
      const color = STATUS_COLORS[m.status ?? "not_active"] ?? STATUS_COLORS.not_active;
      const marker = L.marker([m.lat, m.lng], { icon: colorIcon(color) });
      const statusLabel = m.status ? STATUS_LABELS[m.status] ?? m.status.replace(/_/g, " ") : "";
      marker.bindPopup(
        `<strong>${m.label}</strong>${m.sublabel ? `<br/>${m.sublabel}` : ""}${statusLabel && !m.sublabel?.includes(statusLabel) ? `<br/><em>${statusLabel}</em>` : ""}`
      );
      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(m.id));
      }
      group.addLayer(marker);
    }

    group.addTo(mapRef.current);
    layerRef.current = group;

    if (fitBounds && markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    } else if (markers.length === 1) {
      mapRef.current.setView([markers[0].lat, markers[0].lng], 13);
    }

    if (selectedId) {
      const sel = markers.find((m) => m.id === selectedId);
      if (sel) mapRef.current.setView([sel.lat, sel.lng], 14);
    }
  }, [markers, cluster, selectedId, onMarkerClick, fitBounds]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <div ref={ref} className="w-full rounded-xl border border-border" style={{ height }} />
      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-background/40 text-sm text-muted-foreground">
          {emptyHint ?? "No mapped polling units in this view."}
        </div>
      )}
    </div>
  );
}

export function statusLegend() {
  return Object.entries(STATUS_COLORS).map(([k, c]) => ({ status: k, color: c }));
}
