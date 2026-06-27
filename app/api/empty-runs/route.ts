import { NextResponse } from "next/server";
import { matchEmptyRun, type EmptyRunInput, type EmptyRunResult } from "@/utils/emptyRuns";

// POST /api/empty-runs
// Body: EmptyRunInput (zgłoszenie pustego kursu przewoźnika)
// Zwraca: EmptyRunResult — nadwyżki leżące po trasie + metryki CO2/wartość.
export async function POST(request: Request) {
  let body: Partial<EmptyRunInput>;
  try {
    body = (await request.json()) as Partial<EmptyRunInput>;
  } catch {
    return NextResponse.json({ error: "Niepoprawny JSON" }, { status: 400 });
  }

  if (
    !body.from ||
    !body.to ||
    typeof body.capacityPallets !== "number" ||
    typeof body.toLabel !== "string" ||
    typeof body.date !== "string"
  ) {
    return NextResponse.json(
      { error: "Wymagane pola: from, to, toLabel, date, capacityPallets" },
      { status: 400 },
    );
  }

  const input: EmptyRunInput = {
    carrierName: body.carrierName?.trim() || "Przewoźnik",
    from: body.from,
    to: body.to,
    toLabel: body.toLabel,
    date: body.date,
    capacityPallets: body.capacityPallets,
    maxDetourKm: body.maxDetourKm,
  };

  const result: EmptyRunResult = matchEmptyRun(input);
  return NextResponse.json(result);
}
