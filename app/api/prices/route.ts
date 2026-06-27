import { NextResponse } from "next/server";

// EU Agri-food Data Portal — public, no auth required
// Methodology: ex-packaging station price = closest to wholesale/farmgate reality
const EC_BASE = "https://api.tech.ec.europa.eu/agrifood/api/fruitAndVegetable/pricesSupplyChain";

// Map our crop names → EC product variety search strings
const CROP_MAP: Record<string, { ecProduct: string; palletWeightKg: number }> = {
  "Kapusta biała":   { ecProduct: "Cabbage",  palletWeightKg: 600 },
  "Ziemniaki":       { ecProduct: "Potatoes", palletWeightKg: 700 },
  "Marchew":         { ecProduct: "Carrots",  palletWeightKg: 650 },
  "Cebula":          { ecProduct: "Onions",   palletWeightKg: 600 },
  "Buraki ćwikłowe": { ecProduct: "Beets",    palletWeightKg: 680 },
  "Jabłka":          { ecProduct: "Apples",   palletWeightKg: 400 },
};

// Fallback prices EUR/100kg if API unavailable
const FALLBACK_EUR_PER_100KG: Record<string, number> = {
  "Kapusta biała":   28,
  "Ziemniaki":       18,
  "Marchew":         32,
  "Cebula":          45,
  "Buraki ćwikłowe": 22,
  "Jabłka":          55,
};

const EUR_PLN = 4.27; // approximate — could fetch from NBP API in production

interface EcPriceRecord {
  variety: string;
  price: string;      // e.g. "€67.09"
  unit: string;       // "€/100Kg"
  productStage: string;
  beginDate: string;
  memberStateCode: string;
}

async function fetchEcPrice(ecProduct: string): Promise<number | null> {
  // Get last 8 weeks of data for PL, ex-packaging stage
  const params = new URLSearchParams({
    memberStateCodes: "PL",
    years: new Date().getFullYear().toString(),
    products: ecProduct,
    productStages: "Ex-packaging station price",
  });

  try {
    const res = await fetch(`${EC_BASE}?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // cache 1h
    });
    if (!res.ok) return null;

    const data: EcPriceRecord[] = await res.json();
    if (!data.length) return null;

    // Take the most recent record
    const sorted = data.sort((a, b) =>
      new Date(b.beginDate.split("/").reverse().join("-")).getTime() -
      new Date(a.beginDate.split("/").reverse().join("-")).getTime()
    );

    const raw = sorted[0].price.replace("€", "").trim();
    const eurPer100kg = parseFloat(raw);
    if (isNaN(eurPer100kg)) return null;

    return eurPer100kg;
  } catch {
    return null;
  }
}

export interface CropPrice {
  crop: string;
  eurPer100kg: number;
  plnPerKg: number;
  plnPerPallet: number;
  palletWeightKg: number;
  source: "ec-agridata" | "fallback";
  asOf?: string;
}

export interface PricesResponse {
  prices: Record<string, CropPrice>;
  eurPlnRate: number;
  fetchedAt: string;
}

export async function GET() {
  const prices: Record<string, CropPrice> = {};

  await Promise.all(
    Object.entries(CROP_MAP).map(async ([crop, { ecProduct, palletWeightKg }]) => {
      const eurPer100kg = await fetchEcPrice(ecProduct);
      const fallback = FALLBACK_EUR_PER_100KG[crop] ?? 30;
      const eur = eurPer100kg ?? fallback;
      const plnPerKg = (eur / 100) * EUR_PLN;

      prices[crop] = {
        crop,
        eurPer100kg: Math.round(eur * 100) / 100,
        plnPerKg:    Math.round(plnPerKg * 100) / 100,
        plnPerPallet: Math.round(plnPerKg * palletWeightKg),
        palletWeightKg,
        source: eurPer100kg !== null ? "ec-agridata" : "fallback",
      };
    })
  );

  return NextResponse.json({
    prices,
    eurPlnRate: EUR_PLN,
    fetchedAt: new Date().toISOString(),
  } satisfies PricesResponse);
}
