export interface EmissionConstants {
  co2PerLiterDiesel: number;
  smallVanLitersPer100km: number;
  bigTruckLitersPer100km: number;
}

export interface WholesalePrice {
  crop: string;
  pricePlnPerKg: number;
  palletWeightKg: number;
}

export interface Farmer {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  crop: string;
  pallets: number;
  village: string;
  isPoolCreator?: boolean;
}

export const FARMERS: Farmer[] = [
  {
    id: "f1",
    name: "Jan Kaszubski",
    phone: "+48 501 123 456",
    lat: 54.3284,
    lng: 18.1543,
    crop: "Kapusta biała",
    pallets: 5,
    village: "Kartuzy",
    isPoolCreator: true,
  },
  {
    id: "f2",
    name: "Marek Wiśniewski",
    phone: "+48 502 234 567",
    lat: 54.2951,
    lng: 18.0872,
    crop: "Ziemniaki",
    pallets: 7,
    village: "Sierakowice",
  },
  {
    id: "f3",
    name: "Anna Kowalczyk",
    phone: "+48 503 345 678",
    lat: 54.3621,
    lng: 18.2104,
    crop: "Marchew",
    pallets: 3,
    village: "Stężyca",
  },
  {
    id: "f4",
    name: "Piotr Dąbrowski",
    phone: "+48 504 456 789",
    lat: 54.3102,
    lng: 18.1287,
    crop: "Kapusta biała",
    pallets: 4,
    village: "Żukowo",
  },
  {
    id: "f5",
    name: "Zofia Lewandowska",
    phone: "+48 505 567 890",
    lat: 54.3489,
    lng: 18.0654,
    crop: "Buraki ćwikłowe",
    pallets: 2,
    village: "Somonino",
  },
];

export const EMISSIONS: EmissionConstants = {
  co2PerLiterDiesel: 2.68,
  smallVanLitersPer100km: 10,
  bigTruckLitersPer100km: 30,
};

// Bronisze wholesale market prices (approximate current season)
export const WHOLESALE_PRICES: WholesalePrice[] = [
  {
    crop: "Kapusta biała",
    pricePlnPerKg: 0.85,
    palletWeightKg: 600,
  },
];

// Renk — Pomorskie Centrum Hurtowe, ul. Wodnika 50, Gdańsk
export const VIRTUAL_HUB = {
  name: "Renk Gdańsk",
  lat: 54.413333,
  lng: 18.479376,
  description: "Pomorskie Centrum Hurtowe, ul. Wodnika 50 — główny rynek hurtowy Trójmiasta",
};

// Route simulation constants
export const ROUTE_CONSTANTS = {
  distancePerFarmerKm: 100,   // avg round-trip each farmer drives individually
  consolidatedRouteKm: 120,   // single truck milk-run route
  dieselPricePerLiter: 7.2,   // PLN
};

// ---------------------------------------------------------------------------
// TERYT commune registry — Powiat Kartuski + neighbouring Pomorskie communes
// ---------------------------------------------------------------------------
export interface TerytCommune {
  code: number;       // 6-digit TERYT code
  name: string;
  powiat: string;
  // bounding box for GPS-to-commune matching (approx, sufficient for MVP)
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export const TERYT_COMMUNES: TerytCommune[] = [
  { code: 220503, name: "Kartuzy",     powiat: "kartuski",  latMin: 54.30, latMax: 54.42, lngMin: 18.09, lngMax: 18.23 },
  { code: 220509, name: "Żukowo",      powiat: "kartuski",  latMin: 54.26, latMax: 54.36, lngMin: 18.08, lngMax: 18.23 },
  { code: 220506, name: "Sierakowice", powiat: "kartuski",  latMin: 54.25, latMax: 54.37, lngMin: 17.98, lngMax: 18.12 },
  { code: 220504, name: "Somonino",    powiat: "kartuski",  latMin: 54.32, latMax: 54.42, lngMin: 18.01, lngMax: 18.14 },
  { code: 220501, name: "Chmielno",    powiat: "kartuski",  latMin: 54.24, latMax: 54.36, lngMin: 17.99, lngMax: 18.10 },
  { code: 220502, name: "Stężyca",     powiat: "kartuski",  latMin: 54.31, latMax: 54.44, lngMin: 18.13, lngMax: 18.26 },
  { code: 220102, name: "Bytów",       powiat: "bytowski",  latMin: 54.14, latMax: 54.25, lngMin: 17.48, lngMax: 17.62 },
  { code: 221401, name: "Starogard",   powiat: "starogardzki", latMin: 53.95, latMax: 54.05, lngMin: 18.48, lngMax: 18.60 },
  { code: 226201, name: "Gdańsk",      powiat: "Gdańsk",    latMin: 54.27, latMax: 54.44, lngMin: 18.47, lngMax: 18.81 },
];

// ---------------------------------------------------------------------------
// Crop availability per commune — mock of uprawy_2026_supabase.csv
// Values are estimated pallet totals available in the commune this season.
// 0 = crop not grown / not available for pooling.
// ---------------------------------------------------------------------------
export type CropKey =
  | "Kapusta biała"
  | "Kapusta kiszona"
  | "Ziemniaki"
  | "Marchew"
  | "Buraki ćwikłowe"
  | "Cebula"
  | "Jabłka";

export interface CropAvailability {
  terytCode: number;
  crops: Record<CropKey, number>;
}

export const CROP_AVAILABILITY: CropAvailability[] = [
  {
    terytCode: 220503, // Kartuzy
    crops: {
      "Kapusta biała":   120,
      "Kapusta kiszona":  40,
      "Ziemniaki":        85,
      "Marchew":          30,
      "Buraki ćwikłowe":  20,
      "Cebula":            0,
      "Jabłka":            0,
    },
  },
  {
    terytCode: 220509, // Żukowo
    crops: {
      "Kapusta biała":   60,
      "Kapusta kiszona":  0,
      "Ziemniaki":       45,
      "Marchew":         55,
      "Buraki ćwikłowe": 15,
      "Cebula":          10,
      "Jabłka":           0,
    },
  },
  {
    terytCode: 220506, // Sierakowice
    crops: {
      "Kapusta biała":   90,
      "Kapusta kiszona": 25,
      "Ziemniaki":       70,
      "Marchew":          0,
      "Buraki ćwikłowe":  0,
      "Cebula":           0,
      "Jabłka":          35,
    },
  },
  {
    terytCode: 220504, // Somonino
    crops: {
      "Kapusta biała":   50,
      "Kapusta kiszona":  0,
      "Ziemniaki":       60,
      "Marchew":         20,
      "Buraki ćwikłowe": 10,
      "Cebula":           0,
      "Jabłka":          20,
    },
  },
  {
    terytCode: 220501, // Chmielno
    crops: {
      "Kapusta biała":   35,
      "Kapusta kiszona":  0,
      "Ziemniaki":       40,
      "Marchew":          0,
      "Buraki ćwikłowe":  0,
      "Cebula":           0,
      "Jabłka":          50,
    },
  },
  {
    terytCode: 220502, // Stężyca
    crops: {
      "Kapusta biała":   75,
      "Kapusta kiszona": 20,
      "Ziemniaki":       55,
      "Marchew":         40,
      "Buraki ćwikłowe": 25,
      "Cebula":           0,
      "Jabłka":          15,
    },
  },
  {
    terytCode: 220102, // Bytów
    crops: {
      "Kapusta biała":   30,
      "Kapusta kiszona":  0,
      "Ziemniaki":       80,
      "Marchew":         25,
      "Buraki ćwikłowe":  0,
      "Cebula":          45,
      "Jabłka":           0,
    },
  },
];

// Bronisze prices extended to cover all crops
export const WHOLESALE_PRICES_EXTENDED: Record<CropKey, { pricePlnPerKg: number; palletWeightKg: number }> = {
  "Kapusta biała":   { pricePlnPerKg: 0.85, palletWeightKg: 600 },
  "Kapusta kiszona": { pricePlnPerKg: 1.20, palletWeightKg: 500 },
  "Ziemniaki":       { pricePlnPerKg: 0.65, palletWeightKg: 700 },
  "Marchew":         { pricePlnPerKg: 0.75, palletWeightKg: 650 },
  "Buraki ćwikłowe": { pricePlnPerKg: 0.55, palletWeightKg: 680 },
  "Cebula":          { pricePlnPerKg: 1.10, palletWeightKg: 600 },
  "Jabłka":          { pricePlnPerKg: 1.40, palletWeightKg: 400 },
};
