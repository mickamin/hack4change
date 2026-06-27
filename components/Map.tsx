"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapPoint {
  lat: number;
  lng: number;
  name: string;
  isHub?: boolean;
  isUser?: boolean;
}

interface MapProps {
  points: MapPoint[];
  isOnline: boolean;
  focusPoint?: { lat: number; lng: number } | null;
}

export default function Map({ points, isOnline, focusPoint }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!mapRef.current || mapInstanceRef.current || (mapRef.current as any)._leaflet_id) return;

    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!).setView([54.32, 18.15], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = { map, L };
      renderPoints(L, map, points);

      // Fix broken tile layout after the flex/grid container settles
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 600);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderPoints(L: any, map: any, pts: MapPoint[]) {
    pts.forEach((pt) => {
      const color = pt.isHub ? "#10b981" : pt.isUser ? "#f59e0b" : "#e86a2a";
      const size = pt.isHub ? 20 : pt.isUser ? 18 : 14;

      const icon = L.divIcon({
        html: `<div style="
          background:${color};
          width:${size}px;height:${size}px;
          border-radius:50%;
          border:2.5px solid rgba(255,255,255,0.95);
          box-shadow:0 0 10px ${color}88, 0 2px 6px rgba(0,0,0,0.35)
        "></div>`,
        className: "",
        iconAnchor: [size / 2, size / 2],
      });

      L.marker([pt.lat, pt.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;font-size:13px;color:#111;padding:2px 0">
            <b>${pt.name}</b>
            ${pt.isHub ? "<br/><span style='color:#059669;font-size:11px'>🏭 Wirtualny Hub</span>" : ""}
            ${pt.isUser ? "<br/><span style='color:#d97706;font-size:11px'>📍 Twoja lokalizacja</span>" : ""}
          </div>`
        );
    });

    if (pts.length > 1) {
      const latLngs = pts.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(latLngs, {
        color: "#10b981",
        weight: 3,
        dashArray: "10, 7",
        opacity: 0.75,
      }).addTo(map);
    }
  }

  // Re-render markers when points list changes
  useEffect(() => {
    if (!mapInstanceRef.current || points.length === 0) return;
    const { L, map } = mapInstanceRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    renderPoints(L, map, points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Fly to new farmer location after registration
  useEffect(() => {
    if (!mapInstanceRef.current || !focusPoint) return;
    mapInstanceRef.current.map.setView(
      [focusPoint.lat, focusPoint.lng],
      13,
      { animate: true, duration: 1.5 }
    );
  }, [focusPoint]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {!isOnline && (
        <div
          style={{
            background: "rgba(30,10,0,0.82)",
            color: "#fcd580",
            border: "1px solid #78450a",
          }}
          className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1.5 rounded-full z-[1000] whitespace-nowrap"
        >
          Tryb offline — mapa z pamięci podręcznej
        </div>
      )}
    </div>
  );
}
