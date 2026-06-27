import { NextResponse } from "next/server";
import { FARMERS, VIRTUAL_HUB, type Farmer } from "../data/mockData";
import type { PricesResponse } from "../prices/route";

// ── DEFRA 2024 GHG Conversion Factors (kg CO₂e / vehicle-km) ─────────────────
// Source: UK DEFRA/BEIS Greenhouse Gas Reporting: Conversion Factors 2024
// https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting
const DEFRA = {
  // Average diesel van (≤3.5t), market average fleet
  vanKgCo2ePerKm: 0.18852,
  // HGV articulated >34t, average laden (50% load factor)
  hgvKgCo2ePerKm: 0.73778,
  // Diesel price PLN/l for fuel cost estimate
  dieselPlnPerL: 7.2,
  vanLitersPer100km: 10,
  hgvLitersPer100km: 32,
};

export interface OptimizeRouteResponse {
  farmers: Farmer[];
  hub: typeof VIRTUAL_HUB;
  metrics: {
    totalPallets: number;
    co2IndividualKg: number;
    co2ConsolidatedKg: number;
    co2SavedKg: number;
    costIndividualPln: number;
    costConsolidatedPln: number;
    costSavedPln: number;
    cargoValuePln: number;
    milkRunDistanceKm: number;
    priceSource: "ec-agridata" | "fallback";
    co2Source: string;
  };
  milkRunRoute: Array<{ lat: number; lng: number; name: string }>;
}


async function osrmDistanceKm(waypoints: Array<{ lat: number; lng: number }>): Promise<number> {
  const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.routes?.[0]?.distance ?? 0) / 1000;
  } catch { return 0; }
}

// OpenRouteService — HGV profile, falls back to OSRM without key
async function hgvDistanceKm(waypoints: Array<{ lat: number; lng: number }>): Promise<number> {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return osrmDistanceKm(waypoints);
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv", {
      method: "POST",
      headers: { "Authorization": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: waypoints.map(p => [p.lng, p.lat]),
        profile_params: {
          restrictions: { weight: 40, height: 4.0, width: 2.5, length: 18.75 },
        },
      }),
    });
    if (!res.ok) {
      console.error("[ORS]", res.status, await res.text());
      return osrmDistanceKm(waypoints);
    }
    const data = await res.json();
    return (data.routes?.[0]?.summary?.distance ?? 0) / 1000;
  } catch (e) {
    console.error("[ORS] fetch failed", e);
    return osrmDistanceKm(waypoints);
  }
}

export async function GET() {
  const totalPallets = FARMERS.reduce((sum, f) => sum + f.pallets, 0);

  // Fetch live prices from EC Agri-food API
  const pricesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/prices`, {
    next: { revalidate: 3600 },
  }).then(r => r.json() as Promise<PricesResponse>).catch(() => null);

  // Real distances via OSRM
  const hub = { lat: VIRTUAL_HUB.lat, lng: VIRTUAL_HUB.lng };
  const routeOrder = [...FARMERS].sort((a, b) => a.lng - b.lng);

  // Individual: each farmer drives to hub and back (round trip)
  const individualDistances = await Promise.all(
    FARMERS.map(f => osrmDistanceKm([{ lat: f.lat, lng: f.lng }, hub]).then(d => d * 2))
  );

  // Consolidated: HGV route through all farmers → hub (uses ORS HGV profile if key set)
  const milkRunDistanceKm = await hgvDistanceKm([
    ...routeOrder.map(f => ({ lat: f.lat, lng: f.lng })),
    hub,
  ]);

  // CO2 — DEFRA 2024 GHG Conversion Factors (kg CO₂e / vehicle-km)
  const co2Individual = individualDistances.reduce((sum, d) =>
    sum + d * DEFRA.vanKgCo2ePerKm, 0);
  const co2Consolidated = milkRunDistanceKm * DEFRA.hgvKgCo2ePerKm;

  // Fuel cost — diesel liters × price
  const costIndividual = individualDistances.reduce((sum, d) =>
    sum + (d / 100) * DEFRA.vanLitersPer100km * DEFRA.dieselPlnPerL, 0);
  const costConsolidated = (milkRunDistanceKm / 100) * DEFRA.hgvLitersPer100km * DEFRA.dieselPlnPerL;

  // Cargo value from live EC prices
  const cargoValuePln = FARMERS.reduce((sum, f) => {
    const priceData = pricesRes?.prices[f.crop];
    const plnPerPallet = priceData?.plnPerPallet ?? 500;
    return sum + f.pallets * plnPerPallet;
  }, 0);

  const milkRunRoute = [
    ...routeOrder.map((f) => ({ lat: f.lat, lng: f.lng, name: f.name })),
    { lat: VIRTUAL_HUB.lat, lng: VIRTUAL_HUB.lng, name: VIRTUAL_HUB.name },
  ];

  const response: OptimizeRouteResponse = {
    farmers: FARMERS,
    hub: VIRTUAL_HUB,
    metrics: {
      totalPallets,
      co2IndividualKg: Math.round(co2Individual * 10) / 10,
      co2ConsolidatedKg: Math.round(co2Consolidated * 10) / 10,
      co2SavedKg: Math.round((co2Individual - co2Consolidated) * 10) / 10,
      costIndividualPln: Math.round(costIndividual * 100) / 100,
      costConsolidatedPln: Math.round(costConsolidated * 100) / 100,
      costSavedPln: Math.round((costIndividual - costConsolidated) * 100) / 100,
      cargoValuePln: Math.round(cargoValuePln),
      milkRunDistanceKm: Math.round(milkRunDistanceKm),
      priceSource: pricesRes ? "ec-agridata" : "fallback",
      co2Source: process.env.ORS_API_KEY ? "DEFRA-2024+ORS-HGV" : "DEFRA-2024+OSRM",
    },
    milkRunRoute,
  };

  return NextResponse.json(response);
}

export async function POST(request: Request) {
  // Accepts offline-queued farmer registrations synced from localStorage
  const body = await request.json();
  const newFarmer: Farmer = body;

  // In production this would persist to a DB. For MVP, echo back with merged data.
  const merged = [...FARMERS, newFarmer];
  const totalPallets = merged.reduce((sum, f) => sum + f.pallets, 0);

  return NextResponse.json({
    synced: true,
    farmerId: newFarmer.id,
    totalFarmers: merged.length,
    totalPallets,
    message: `Zsynchronizowano dane rolnika ${newFarmer.name}`,
  });
}
