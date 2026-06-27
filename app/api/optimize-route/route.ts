import { NextResponse } from "next/server";
import {
  FARMERS,
  EMISSIONS,
  WHOLESALE_PRICES,
  VIRTUAL_HUB,
  ROUTE_CONSTANTS,
  type Farmer,
} from "../data/mockData";

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

export async function GET() {
  const totalPallets = FARMERS.reduce((sum, f) => sum + f.pallets, 0);

  // Individual scenario: each farmer drives a small van ~100km
  const co2Individual = FARMERS.reduce(
    (sum) =>
      sum +
      calcCo2Kg(
        ROUTE_CONSTANTS.distancePerFarmerKm,
        EMISSIONS.smallVanLitersPer100km
      ),
    0
  );
  const costIndividual = FARMERS.reduce(
    (sum) =>
      sum +
      calcFuelCostPln(
        ROUTE_CONSTANTS.distancePerFarmerKm,
        EMISSIONS.smallVanLitersPer100km
      ),
    0
  );

  // Consolidated scenario: one truck does a milk run of 120km
  const co2Consolidated = calcCo2Kg(
    ROUTE_CONSTANTS.consolidatedRouteKm,
    EMISSIONS.bigTruckLitersPer100km
  );
  const costConsolidated = calcFuelCostPln(
    ROUTE_CONSTANTS.consolidatedRouteKm,
    EMISSIONS.bigTruckLitersPer100km
  );

  // Cargo value
  const kapustaPrice = WHOLESALE_PRICES.find((p) => p.crop === "Kapusta biała")!;
  const cargoValuePln = totalPallets * kapustaPrice.palletWeightKg * kapustaPrice.pricePlnPerKg;

  // Milk run route: sort farmers by longitude (west→east pickup order), end at hub
  const routeOrder = [...FARMERS].sort((a, b) => a.lng - b.lng);
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
