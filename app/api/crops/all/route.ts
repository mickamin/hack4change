import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabaseClient";
import { CROP_AVAILABILITY } from "@/app/api/data/mockData";

const META_COLS = new Set(["id", "rok", "wojewodztwo", "powiat", "gmina", "teryt", "uzytki_rolne"]);

export async function GET() {
  const { data, error } = await supabase.from("ARiMR").select("*");

  if (!error && data && data.length > 0) {
    const cropSet = new Set<string>();
    for (const row of data) {
      for (const [col, val] of Object.entries(row)) {
        if (META_COLS.has(col)) continue;
        const ha = parseFloat(val as string);
        if (!isNaN(ha) && ha > 0) {
          cropSet.add(col.replace(/_/g, " "));
        }
      }
    }
    const allCrops = [...cropSet].sort();
    return NextResponse.json({ availableCrops: allCrops, source: "supabase" });
  }

  const cropSet = new Set<string>();
  for (const ca of CROP_AVAILABILITY) {
    for (const [crop, qty] of Object.entries(ca.crops)) {
      if (qty > 0) cropSet.add(crop);
    }
  }
  const allCrops = [...cropSet].sort();
  return NextResponse.json({
    availableCrops: allCrops,
    source: "mock",
    ...(error ? { supabaseError: error.message } : {}),
  });
}
