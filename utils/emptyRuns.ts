// utils/emptyRuns.ts
// Moduł przewoźnika: dopasowanie "pustego kursu" do nadwyżek leżących po trasie.
// Przewoźnik zgłasza trasę (skąd→dokąd), datę i wolną załadowność (palety);
// dobieramy odbiory (rolników) leżących w korytarzu trasy, do wyczerpania ładowności.
//
// Spójne z modułem kolegi: te same dane (FARMERS) i stałe CO2/cen (EMISSIONS,
// ROUTE_CONSTANTS, WHOLESALE_PRICES_EXTENDED) co w /api/optimize-route.

import {
  FARMERS,
  EMISSIONS,
  ROUTE_CONSTANTS,
  WHOLESALE_PRICES_EXTENDED,
  type Farmer,
  type CropKey,
} from "@/app/api/data/mockData";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface EmptyRunInput {
  carrierName: string;
  from: GeoPoint; // start kursu
  to: GeoPoint; // cel kursu (dokąd jedzie pusty)
  toLabel: string; // czytelna nazwa celu
  date: string; // ISO — kiedy może przyjechać
  capacityPallets: number; // wolne palety
  maxDetourKm?: number; // maks. odchylenie od trasy (domyślnie 12 km)
}

export interface PickupMatch {
  farmer: Farmer;
  detourKm: number; // odległość punktu odbioru od korytarza trasy
}

export interface EmptyRunResult {
  matches: PickupMatch[];
  takenPallets: number;
  capacityPallets: number;
  fillPct: number;
  co2SavedKg: number; // vs. samodzielne dojazdy rolników
  cargoValuePln: number;
  date: string;
  toLabel: string;
}

// ---------- Geometria (km) ----------

const KM_PER_DEG_LAT = 110.574;
function kmPerDegLng(lat: number): number {
  return 111.32 * Math.cos((lat * Math.PI) / 180);
}

/** Rzut lat/lng na lokalny układ km względem punktu odniesienia (equirectangular). */
function toLocalKm(p: GeoPoint, origin: GeoPoint): { x: number; y: number } {
  return {
    x: (p.lng - origin.lng) * kmPerDegLng(origin.lat),
    y: (p.lat - origin.lat) * KM_PER_DEG_LAT,
  };
}

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Najmniejsza odległość (km) punktu p od odcinka trasy from→to. */
export function distanceToRouteKm(p: GeoPoint, from: GeoPoint, to: GeoPoint): number {
  const a = toLocalKm(from, from); // (0,0)
  const b = toLocalKm(to, from);
  const pt = toLocalKm(p, from);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(pt.x, pt.y); // from == to
  let t = (pt.x * abx + pt.y * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * abx;
  const projY = a.y + t * aby;
  return Math.hypot(pt.x - projX, pt.y - projY);
}

// ---------- CO2 / wartość ----------

function calcCo2Kg(distanceKm: number, litersPer100km: number): number {
  return (distanceKm / 100) * litersPer100km * EMISSIONS.co2PerLiterDiesel;
}

function cargoValueForFarmer(f: Farmer): number {
  const price = WHOLESALE_PRICES_EXTENDED[f.crop as CropKey];
  if (!price) return 0;
  return f.pallets * price.palletWeightKg * price.pricePlnPerKg;
}

// ---------- Dopasowanie ----------

/**
 * Dobiera rolników leżących w korytarzu trasy (≤ maxDetourKm), od najbliższych trasie,
 * do wyczerpania wolnej ładowności. CO2 liczone jako uniknięte indywidualne dojazdy.
 */
export function matchEmptyRun(input: EmptyRunInput, farmers: readonly Farmer[] = FARMERS): EmptyRunResult {
  const maxDetour = input.maxDetourKm ?? 12;

  const candidates = farmers
    .map((farmer) => ({ farmer, detourKm: distanceToRouteKm(farmer, input.from, input.to) }))
    .filter((c) => c.detourKm <= maxDetour)
    .sort((a, b) => a.detourKm - b.detourKm);

  const matches: PickupMatch[] = [];
  let takenPallets = 0;
  for (const c of candidates) {
    if (takenPallets + c.farmer.pallets > input.capacityPallets) continue;
    matches.push({ farmer: c.farmer, detourKm: Math.round(c.detourKm * 10) / 10 });
    takenPallets += c.farmer.pallets;
  }

  const co2SavedKg = matches.reduce(
    (sum) => sum + calcCo2Kg(ROUTE_CONSTANTS.distancePerFarmerKm, EMISSIONS.smallVanLitersPer100km),
    0,
  );
  const cargoValuePln = matches.reduce((sum, m) => sum + cargoValueForFarmer(m.farmer), 0);

  return {
    matches,
    takenPallets,
    capacityPallets: input.capacityPallets,
    fillPct: input.capacityPallets > 0 ? Math.min(100, Math.round((takenPallets / input.capacityPallets) * 100)) : 0,
    co2SavedKg: Math.round(co2SavedKg * 10) / 10,
    cargoValuePln: Math.round(cargoValuePln),
    date: input.date,
    toLabel: input.toLabel,
  };
}
