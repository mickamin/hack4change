"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

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

export default function LocationPicker({ defaultLat, defaultLng, onPick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#2d5a1b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);transform:rotate(-45deg);margin-top:-24px;margin-left:-14px"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([defaultLat, defaultLng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;

      async function reverseGeocode(lat: number, lng: number) {
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
        onPick({ lat, lng, address });
      }

      setTimeout(() => map.invalidateSize(), 200);
      setTimeout(() => map.invalidateSize(), 600);

      // fire on initial load
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
  // run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center when commune changes
  useEffect(() => {
    if (!instanceRef.current || !markerRef.current) return;
    instanceRef.current.setView([defaultLat, defaultLng], 13, { animate: true });
    markerRef.current.setLatLng([defaultLat, defaultLng]);
  }, [defaultLat, defaultLng]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "200px", borderRadius: "0.875rem", overflow: "hidden", border: "1.5px solid #ddd4b8" }}
    />
  );
}
