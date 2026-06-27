import { NextResponse } from "next/server";
import { supabase, type FarmerRequestRow } from "@/utils/supabaseClient";
import type { SubmittedEntry } from "@/components/FarmerInputForm";

export async function POST(request: Request) {
  let body: SubmittedEntry;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { farmer, terytCode, communeName } = body;

  if (!farmer?.id || !farmer.crop || !terytCode) {
    return NextResponse.json(
      { error: "Missing required fields: farmer, terytCode." },
      { status: 422 }
    );
  }

  const row: FarmerRequestRow = {
    farmer_name: farmer.name || communeName || "Rolnik (anonim)",
    phone:        farmer.phone ?? "",
    address:      farmer.village ?? communeName ?? "",
    teryt:        terytCode,
    crop_type:    farmer.crop,
    pallet_count: farmer.pallets,
    lat:          farmer.lat,
    lng:          farmer.lng,
    status:       "pending",
  };

  const { data, error } = await supabase
    .from("farmer_requests")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[/api/requests] Supabase insert error:", error.message);
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, id: data.id, message: `Zapisano zgłoszenie dla ${row.farmer_name}` },
    { status: 200 }
  );
}
