import { NextResponse } from "next/server";
import {
  FARMERS,
  EMISSIONS,
  VIRTUAL_HUB,
  ROUTE_CONSTANTS,
  type Farmer,
} from "../data/mockData";
import type { PricesResponse } from "../prices/route";

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
  };
  milkRunRoute: Array<{ lat: number; lng: number; name: string }>;
}

function calcCo2Kg(distanceKm: number, litersPer100km: number): number {
  const liters = (distanceKm / 100) * litersPer100km;
  return liters * EMISSIONS.co2PerLiterDiesel;
}

function calcFuelCostPln(distanceKm: number, litersPer100km: number): number {
  const liters = (distanceKm / 100) * litersPer100km;
  return liters * ROUTE_CONSTANTS.dieselPricePerLiter;
}

// Fetch real distances from OSRM for a list of waypoints, returns total km
async function osrmDistanceKm(waypoints: Array<{ lat: number; lng: number }>): Promise<number> {
  const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const meters: number = data.routes?.[0]?.distance ?? 0;
    return meters / 1000;
  } catch {
    return 0;
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

  // Consolidated: one truck picks up all farmers in order, ends at hub
  const milkRunDistanceKm = await osrmDistanceKm([
    ...routeOrder.map(f => ({ lat: f.lat, lng: f.lng })),
    hub,
  ]);

  // CO2 and cost calculations using real distances
  const co2Individual = individualDistances.reduce((sum, d) =>
    sum + calcCo2Kg(d, EMISSIONS.smallVanLitersPer100km), 0);
  const costIndividual = individualDistances.reduce((sum, d) =>
    sum + calcFuelCostPln(d, EMISSIONS.smallVanLitersPer100km), 0);

  const co2Consolidated = calcCo2Kg(milkRunDistanceKm, EMISSIONS.bigTruckLitersPer100km);
  const costConsolidated = calcFuelCostPln(milkRunDistanceKm, EMISSIONS.bigTruckLitersPer100km);

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
