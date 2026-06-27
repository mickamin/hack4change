import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Row shape matching the farmer_requests table
export interface FarmerRequestRow {
  farmer_name: string;
  phone: string;
  address: string;
  teryt: number;
  crop_type: string;
  pallet_count: number;
  lat: number;
  lng: number;
  status: "pending" | "confirmed" | "in_transit" | "delivered";
}
