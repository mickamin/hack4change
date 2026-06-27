import { NextResponse } from "next/server";
import { matchDemand, type DistributorDemand, type DistributorResult } from "@/utils/distributors";

// POST /api/distributors
// Body: DistributorDemand — zapotrzebowanie dystrybutora (produkt + ilość + lokalizacja)
// Zwraca: DistributorResult — gminy z dostępną uprawą, posortowane wg odległości.
export async function POST(request: Request) {
  let body: Partial<DistributorDemand>;
  try {
    body = (await request.json()) as Partial<DistributorDemand>;
  } catch {
    return NextResponse.json({ error: "Niepoprawny JSON" }, { status: 400 });
  }

  if (!body.crop || !body.near || typeof body.neededPallets !== "number" || typeof body.nearLabel !== "string") {
    return NextResponse.json(
      { error: "Wymagane pola: crop, near, nearLabel, neededPallets" },
      { status: 400 },
    );
  }

  const demand: DistributorDemand = {
    distributorName: body.distributorName?.trim() || "Dystrybutor",
    crop: body.crop,
    neededPallets: body.neededPallets,
    near: body.near,
    nearLabel: body.nearLabel,
  };

  const result: DistributorResult = matchDemand(demand);
  return NextResponse.json(result);
}
