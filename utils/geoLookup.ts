import {
  TERYT_COMMUNES,
  CROP_AVAILABILITY,
  type TerytCommune,
  type CropKey,
  type CropAvailability,
} from "@/app/api/data/mockData";

export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface CommuneResult {
  commune: TerytCommune;
  availability: CropAvailability;
  availableCrops: CropKey[];
  /** "supabase" = live ARiMR data, "mock" = hardcoded fallback, "gps"/"fallback" = GPS source */
  source: "gps" | "fallback";
  dataSource: "supabase" | "mock";
}

// ---------------------------------------------------------------------------
// GPS acquisition
// ---------------------------------------------------------------------------
export function getCurrentPosition(timeoutMs = 10_000): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolokalizacja niedostępna w tej przeglądarce."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error("Brak zgody na lokalizację. Sprawdź ustawienia przeglądarki."));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error("Pozycja GPS niedostępna."));
            break;
          case err.TIMEOUT:
            reject(new Error("Przekroczono czas oczekiwania na GPS."));
            break;
          default:
            reject(new Error("Nieznany błąd GPS."));
        }
      },
      { timeout: timeoutMs, enableHighAccuracy: true, maximumAge: 60_000 }
    );
  });
}

// ---------------------------------------------------------------------------
// GPS coords → TERYT commune matching
// ---------------------------------------------------------------------------
function communeCentroid(c: TerytCommune) {
  return {
    lat: (c.latMin + c.latMax) / 2,
    lng: (c.lngMin + c.lngMax) / 2,
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function coordsToCommune(lat: number, lng: number): TerytCommune {
  const exact = TERYT_COMMUNES.find(
    (c) => lat >= c.latMin && lat <= c.latMax && lng >= c.lngMin && lng <= c.lngMax
  );
  if (exact) return exact;

  let nearest = TERYT_COMMUNES[0];
  let minDist = Infinity;
  for (const c of TERYT_COMMUNES) {
    const { lat: cLat, lng: cLng } = communeCentroid(c);
    const d = haversineKm(lat, lng, cLat, cLng);
    if (d < minDist) { minDist = d; nearest = c; }
  }
  return nearest;
}

// ---------------------------------------------------------------------------
// Crop availability: fetch from /api/crops (→ Supabase "ARiMR") with
// synchronous mock fallback when offline or the API call fails.
// ---------------------------------------------------------------------------
async function fetchCropAvailability(
  terytCode: number
): Promise<{ availableCrops: CropKey[]; cropMap: Record<CropKey, number>; dataSource: "supabase" | "mock" }> {
  try {
    const res = await fetch(`/api/crops?teryt=${terytCode}`, {
      // Short timeout — if we're offline the fetch will reject quickly
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const json = await res.json();
      return {
        availableCrops: json.availableCrops as CropKey[],
        cropMap: json.cropMap as Record<CropKey, number>,
        dataSource: json.source as "supabase" | "mock",
      };
    }
  } catch {
    // Network error / offline — fall through to mock
  }

  // Synchronous offline fallback
  const fallback: CropAvailability =
    CROP_AVAILABILITY.find((a) => a.terytCode === terytCode) ?? CROP_AVAILABILITY[0];

  const availableCrops = (Object.entries(fallback.crops) as [CropKey, number][])
    .filter(([, qty]) => qty > 0)
    .map(([crop]) => crop);

  return { availableCrops, cropMap: fallback.crops, dataSource: "mock" };
}

// ---------------------------------------------------------------------------
// Public API: resolve commune + live crop list from coords
// ---------------------------------------------------------------------------
export async function resolveCommuneData(
  lat: number,
  lng: number,
  source: "gps" | "fallback" = "gps"
): Promise<CommuneResult> {
  const commune = coordsToCommune(lat, lng);
  const { availableCrops, cropMap, dataSource } = await fetchCropAvailability(commune.code);

  // Reconstruct a CropAvailability shape so the rest of the app doesn't change
  const existing = CROP_AVAILABILITY.find(a => a.terytCode === commune.code);
  const availability: CropAvailability = {
    terytCode: commune.code,
    crops: cropMap,
    ha: existing?.ha ?? Object.fromEntries(Object.keys(cropMap).map(k => [k, 0])) as CropAvailability["ha"],
  };

  return { commune, availability, availableCrops, source, dataSource };
}

// ---------------------------------------------------------------------------
// Offline fallback coords: Kartuzy town centre
// ---------------------------------------------------------------------------
export const OFFLINE_FALLBACK_COORDS = { lat: 54.3284, lng: 18.1543 };

export async function detectCommune(): Promise<CommuneResult> {
  try {
    const pos = await getCurrentPosition();
    return resolveCommuneData(pos.lat, pos.lng, "gps");
  } catch {
    return resolveCommuneData(
      OFFLINE_FALLBACK_COORDS.lat,
      OFFLINE_FALLBACK_COORDS.lng,
      "fallback"
    );
  }
}
