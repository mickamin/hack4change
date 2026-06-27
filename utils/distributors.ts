// utils/distributors.ts
// Rola dystrybutora (strona popytu): chce odebrać nadwyżki hurtem.
// Dopasowuje zapotrzebowanie (produkt + ilość + lokalizacja dostawy) do
// dostępności upraw w gminach (CROP_AVAILABILITY z danych kolegi).

import {
  CROP_AVAILABILITY,
  TERYT_COMMUNES,
  WHOLESALE_PRICES_EXTENDED,
  type CropKey,
  type TerytCommune,
} from "@/app/api/data/mockData";
import { haversineKm, type GeoPoint } from "@/utils/emptyRuns";

export interface DistributorDemand {
  distributorName: string;
  crop: CropKey;
  neededPallets: number;
  near: GeoPoint; // lokalizacja dystrybutora / dostawy
  nearLabel: string;
}

export interface SupplyMatch {
  commune: string;
  terytCode: number;
  availablePallets: number;
  distanceKm: number;
  lat: number;
  lng: number;
}

export interface DistributorResult {
  crop: CropKey;
  matches: SupplyMatch[];
  gatheredPallets: number;
  neededPallets: number;
  fillPct: number;
  estValuePln: number;
  nearLabel: string;
}

function communeCentroid(c: TerytCommune): GeoPoint {
  return { lat: (c.latMin + c.latMax) / 2, lng: (c.lngMin + c.lngMax) / 2 };
}

/** Dobiera gminy z dostępną uprawą, od najbliższych dostawie, aż do pokrycia zapotrzebowania. */
export function matchDemand(demand: DistributorDemand): DistributorResult {
  const candidates: SupplyMatch[] = CROP_AVAILABILITY.map((a) => {
    const commune = TERYT_COMMUNES.find((c) => c.code === a.terytCode);
    const pallets = a.crops[demand.crop] ?? 0;
    if (!commune || pallets <= 0) return null;
    const centroid = communeCentroid(commune);
    return {
      commune: commune.name,
      terytCode: a.terytCode,
      availablePallets: pallets,
      distanceKm: Math.round(haversineKm(demand.near, centroid) * 10) / 10,
      lat: centroid.lat,
      lng: centroid.lng,
    };
  })
    .filter((x): x is SupplyMatch => x !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const matches: SupplyMatch[] = [];
  let gathered = 0;
  for (const c of candidates) {
    matches.push(c);
    gathered += c.availablePallets;
    if (gathered >= demand.neededPallets) break;
  }

  const price = WHOLESALE_PRICES_EXTENDED[demand.crop];
  const estValuePln = price ? Math.round(gathered * price.palletWeightKg * price.pricePlnPerKg) : 0;

  return {
    crop: demand.crop,
    matches,
    gatheredPallets: gathered,
    neededPallets: demand.neededPallets,
    fillPct: demand.neededPallets > 0 ? Math.min(100, Math.round((gathered / demand.neededPallets) * 100)) : 0,
    estValuePln,
    nearLabel: demand.nearLabel,
  };
}
