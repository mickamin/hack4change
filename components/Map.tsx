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
  route?: Array<{ lat: number; lng: number }>;
}

export default function Map({ points, isOnline, focusPoint, route }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current || (mapRef.current as any)._leaflet_id) return;
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
      renderPoints(L, map, points, route);

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
  async function fetchOsrmRoute(pts: Array<{ lat: number; lng: number }>): Promise<[number, number][]> {
    const coords = pts.map(p => `${p.lng},${p.lat}`).join(";");
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    const geom = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!geom) return pts.map(p => [p.lat, p.lng]);
    return geom.map(([lng, lat]) => [lat, lng]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function drawRoute(L: any, map: any, latLngs: [number, number][]) {
    L.polyline(latLngs, { color: "#000", weight: 7, opacity: 0.1, lineJoin: "round" }).addTo(map);
    const main = L.polyline(latLngs, { color: "#2d5a1b", weight: 5, opacity: 0.9, lineJoin: "round" }).addTo(map);
    L.polyline(latLngs, { color: "#7bc64a", weight: 3, dashArray: "14, 10", opacity: 0.85, lineJoin: "round" }).addTo(map);

    // Animate route drawing via stroke-dashoffset
    requestAnimationFrame(() => {
      const el = main.getElement() as SVGPathElement | null;
      if (!el) return;
      const len = el.getTotalLength();
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
      el.style.transition = "none";
      requestAnimationFrame(() => {
        el.style.transition = "stroke-dashoffset 2s ease-in-out";
        el.style.strokeDashoffset = "0";
      });
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderPoints(L: any, map: any, pts: MapPoint[], routePts?: Array<{ lat: number; lng: number }>) {
    const linePts = routePts && routePts.length > 1 ? routePts : pts.length > 1 ? pts : null;
    if (linePts) {
      fetchOsrmRoute(linePts).then(latLngs => drawRoute(L, map, latLngs)).catch(() => {
        drawRoute(L, map, linePts.map(p => [p.lat, p.lng]));
      });
    }

    pts.forEach((pt) => {
      const color = pt.isHub ? "#2d5a1b" : pt.isUser ? "#c8781a" : "#e86a2a";
      const size = pt.isHub ? 22 : pt.isUser ? 20 : 14;
      const label = pt.isHub ? "🏭" : pt.isUser ? "★" : "";

      const icon = L.divIcon({
        html: `<div style="
          background:${color};
          width:${size}px;height:${size}px;
          border-radius:50%;
          border:3px solid rgba(255,255,255,0.95);
          box-shadow:0 0 0 2px ${color}55, 0 3px 8px rgba(0,0,0,0.4);
          display:flex;align-items:center;justify-content:center;
          font-size:${size * 0.55}px;line-height:1;
        ">${label}</div>`,
        className: "",
        iconAnchor: [size / 2, size / 2],
      });

      L.marker([pt.lat, pt.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui;font-size:13px;color:#111;padding:2px 0">
            <b>${pt.name}</b>
            ${pt.isHub ? "<br/><span style='color:#059669;font-size:11px'>🏭 Punkt skupu</span>" : ""}
            ${pt.isUser ? "<br/><span style='color:#c8781a;font-size:11px'>★ Twoje pole</span>" : ""}
          </div>`
        );
    });
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
    renderPoints(L, map, points, route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, route]);

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
