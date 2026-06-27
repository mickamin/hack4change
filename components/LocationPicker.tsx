"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface Props {
  defaultLat: number;
  defaultLng: number;
  onPick: (loc: PickedLocation) => void;
}

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const T = {
  surface: "#f5f0e4",
  border:  "#ddd4b8",
  text:    "#2a1a08",
  muted:   "#7a6a48",
  subtle:  "#9a8a60",
  accent:  "#2d5a1b",
};

export default function LocationPicker({ defaultLat, defaultLng, onPick }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const markerRef  = useRef<any>(null);

  const [query, setQuery]           = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen]             = useState(false);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return;

    import("leaflet").then(L => {
      if (!mapRef.current || (mapRef.current as any)._leaflet_id) return;
      const map = L.map(mapRef.current!, {
        center: [defaultLat, defaultLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false,
      });
      instanceRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#2d5a1b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);transform:rotate(-45deg)"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      const marker = L.marker([defaultLat, defaultLng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;

      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 600);

      handleMove(defaultLat, defaultLng);

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        handleMove(lat, lng);
      });

      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        handleMove(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!instanceRef.current || !markerRef.current) return;
    instanceRef.current.setView([defaultLat, defaultLng], 13, { animate: true });
    markerRef.current.setLatLng([defaultLat, defaultLng]);
  }, [defaultLat, defaultLng]);

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pl`,
        { headers: { "User-Agent": "AgroPool/1.0" } }
      );
      const data = await res.json();
      const a = data.address ?? {};
      const parts = [a.road, a.house_number, a.village ?? a.town ?? a.city ?? a.suburb].filter(Boolean);
      return parts.join(" ") || data.display_name?.split(",").slice(0, 2).join(",").trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  async function handleMove(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    setQuery(address);
    onPick({ lat, lng, address });
  }

  function onQueryChange(val: string) {
    setQuery(val);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) { setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&addressdetails=1&limit=5&accept-language=pl&countrycodes=pl`,
          { headers: { "User-Agent": "AgroPool/1.0" } }
        );
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { /* ignore */ }
    }, 350);
  }

  function selectSuggestion(s: Suggestion) {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    const label = s.display_name.split(",").slice(0, 3).join(",").trim();
    setQuery(label);
    setSuggestions([]);
    setOpen(false);
    if (instanceRef.current && markerRef.current) {
      instanceRef.current.setView([lat, lng], 15, { animate: true });
      markerRef.current.setLatLng([lat, lng]);
    }
    onPick({ lat, lng, address: label });
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Wpisz adres lub nazwę miejsca…"
        style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: open ? "0.875rem 0.875rem 0 0" : "0.875rem", color: T.text, width: "100%", padding: "0.875rem 1rem", fontSize: "1rem", outline: "none", boxSizing: "border-box", borderBottom: open ? `1px solid ${T.border}` : undefined }}
      />

      {/* Suggestions dropdown */}
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1.5px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 0.875rem 0.875rem", zIndex: 1000, overflow: "hidden" }}>
          {suggestions.map(s => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={() => selectSuggestion(s)}
              style={{ width: "100%", textAlign: "left", padding: "0.625rem 1rem", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontSize: "0.85rem", color: T.text, display: "block" }}
            >
              {s.display_name.split(",").slice(0, 3).join(",")}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} style={{ width: "100%", height: "180px", marginTop: "0.5rem", borderRadius: "0.875rem", overflow: "hidden" }} />
    </div>
  );
}
