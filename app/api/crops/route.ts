import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabaseClient";
import { CROP_AVAILABILITY, type CropAvailability } from "@/app/api/data/mockData";

// Metadata columns to skip — everything else is a crop with hectares as value
const META_COLS = new Set(["id", "rok", "wojewodztwo", "powiat", "gmina", "teryt", "uzytki_rolne"]);

// 1 ha ≈ 2 pallets (rough: ~3t/ha yield avg, 600kg/pallet → 5 pal/ha; conservative /2 for small farms)
const HA_TO_PALLETS = 2;

// GET /api/crops?teryt=220503
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const terytParam = searchParams.get("teryt");

  if (!terytParam) {
    return NextResponse.json({ error: "Missing ?teryt= query param" }, { status: 400 });
  }

  // teryt is stored as text in ARiMR, zero-padded to 6 chars
  const terytStr = terytParam.padStart(6, "0");

  const { data, error } = await supabase
    .from("ARiMR")
    .select("*")
    .eq("teryt", terytStr)
    .limit(1)
    .single();

  if (!error && data) {
    const cropMap: Record<string, number> = {};

    for (const [col, val] of Object.entries(data)) {
      if (META_COLS.has(col)) continue;
      const ha = parseFloat(val as string);
      if (!isNaN(ha) && ha > 0) {
        // Convert snake_case column name to display name
        const name = col.replace(/_/g, " ");
        cropMap[name] = Math.max(1, Math.round(ha * HA_TO_PALLETS));
      }
    }

    const availableCrops = Object.keys(cropMap).sort();
    const haMap: Record<string, number> = {};
    for (const [col, val] of Object.entries(data)) {
      if (META_COLS.has(col)) continue;
      const ha = parseFloat(val as string);
      if (!isNaN(ha) && ha > 0) haMap[col.replace(/_/g, " ")] = ha;
    }

    return NextResponse.json({ terytCode: terytStr, availableCrops, cropMap, haMap, source: "supabase" });
  }

  // Fallback to mock data
  const fallback: CropAvailability =
    CROP_AVAILABILITY.find((a) => String(a.terytCode) === terytStr) ?? CROP_AVAILABILITY[0];

  const availableCrops = Object.entries(fallback.crops)
    .filter(([, qty]) => qty > 0)
    .map(([crop]) => crop)
    .sort();

  const fallbackHaMap: Record<string, number> = Object.fromEntries(
    Object.entries(fallback.ha).filter(([, v]) => v > 0)
  );

  return NextResponse.json({
    terytCode: terytStr,
    availableCrops,
    cropMap: fallback.crops,
    haMap: fallbackHaMap,
    source: "mock",
    ...(error ? { supabaseError: error.message } : {}),
  });
}
