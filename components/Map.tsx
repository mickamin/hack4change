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
  fitPadding?: { top: number; right: number; bottom: number; left: number };
}

export default function Map({ points, isOnline, focusPoint, route, fitPadding }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const routeDrawnRef = useRef(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 600);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.map.remove();
        mapInstanceRef.current = null;
        routeDrawnRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers only when points change
  useEffect(() => {
    if (!mapInstanceRef.current || points.length === 0) return;
    const { L, map } = mapInstanceRef.current;
    // Remove only markers, leave route polylines intact
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });
    renderMarkers(L, map, points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Draw route once when it first becomes available
  useEffect(() => {
    if (!mapInstanceRef.current || !route || route.length < 2 || routeDrawnRef.current) return;
    routeDrawnRef.current = true;
    const { L, map } = mapInstanceRef.current;
    fetchAndDrawRoute(L, map, route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Fly to focus point
  useEffect(() => {
    if (!mapInstanceRef.current || !focusPoint) return;
    mapInstanceRef.current.map.setView([focusPoint.lat, focusPoint.lng], 13, { animate: true, duration: 1.5 });
  }, [focusPoint]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderMarkers(L: any, map: any, pts: MapPoint[]) {
    pts.forEach((pt) => {
      const color = pt.isHub ? "#2d5a1b" : pt.isUser ? "#c8781a" : "#e86a2a";
      const size = pt.isHub ? 22 : pt.isUser ? 20 : 14;
      const label = pt.isHub ? "🏭" : pt.isUser ? "★" : "";

      const icon = L.divIcon({
        html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid rgba(255,255,255,0.95);box-shadow:0 0 0 2px ${color}55,0 3px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:${size * 0.55}px;line-height:1">${label}</div>`,
        className: "",
        iconAnchor: [size / 2, size / 2],
      });

      L.marker([pt.lat, pt.lng], { icon })
        .addTo(map)
        .bindPopup(`<div style="font-family:system-ui;font-size:13px;color:#111;padding:2px 0"><b>${pt.name}</b>${pt.isHub ? "<br/><span style='color:#059669;font-size:11px'>🏭 Punkt skupu</span>" : ""}${pt.isUser ? "<br/><span style='color:#c8781a;font-size:11px'>★ Twoje pole</span>" : ""}</div>`);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchAndDrawRoute(L: any, map: any, pts: Array<{ lat: number; lng: number }>) {
    let latLngs: [number, number][];
    try {
      const coords = pts.map(p => `${p.lng},${p.lat}`).join(";");
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      const data = await res.json();
      const geom = data.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
      latLngs = geom ? geom.map(([lng, lat]) => [lat, lng]) : pts.map(p => [p.lat, p.lng]);
    } catch {
      latLngs = pts.map(p => [p.lat, p.lng]);
    }

    // Single blue line + white dash overlay, both animated together
    const blue = L.polyline(latLngs, { color: "#1a6fc4", weight: 6, opacity: 1, lineJoin: "round" }).addTo(map);
    const dash = L.polyline(latLngs, { color: "#fff", weight: 2, dashArray: "12, 10", opacity: 0.7, lineJoin: "round" }).addTo(map);

    // Fit map to show full route, respecting panel offsets
    const bounds = L.latLngBounds(latLngs);
    const p = fitPadding ?? { top: 48, right: 48, bottom: 48, left: 48 };
    map.fitBounds(bounds, {
      paddingTopLeft: [p.left, p.top],
      paddingBottomRight: [p.right, p.bottom],
      animate: true,
      duration: 1.0,
    });

    // Animate both layers via stroke-dashoffset
    [blue, dash].forEach(poly => {
      requestAnimationFrame(() => {
        const el = poly.getElement() as SVGPathElement | null;
        if (!el) return;
        const len = el.getTotalLength();
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len);
        el.style.transition = "none";
        requestAnimationFrame(() => {
          el.style.transition = "stroke-dashoffset 1.6s ease-in-out";
          el.style.strokeDashoffset = "0";
        });
      });
    });
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {!isOnline && (
        <div
          style={{ background: "rgba(30,10,0,0.82)", color: "#fcd580", border: "1px solid #78450a" }}
          className="absolute top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1.5 rounded-full z-[1000] whitespace-nowrap"
        >
          Tryb offline — mapa z pamięci podręcznej
        </div>
      )}
    </div>
  );
}
