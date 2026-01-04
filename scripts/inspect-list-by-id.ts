import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const priceListId = process.argv[2];
  if (!priceListId) {
    console.error("❌ Please provide a Price List ID");
    process.exit(1);
  }

  console.log(`🔍 Inspecting Price List: ${priceListId}`);

  // Get List Details
  const { data: list, error: listError } = await supabase
    .from("price_lists")
    .select("*")
    .eq("id", priceListId)
    .single();

  if (listError) {
    console.error("❌ Error fetching list:", listError.message);
    return;
  }
  console.log(`📋 Name: ${list.name}`);
  console.log(`🕒 Created: ${list.created_at}`);
  console.log(`📝 Note: ${list.notes}`);

  // Get Entries Count
  const { count, error: countError } = await supabase
    .from("price_list_entries")
    .select("*", { count: "exact", head: true })
    .eq("price_list_id", priceListId);

  if (countError) {
    console.error("❌ Error counting entries:", countError.message);
    return;
  }
  console.log(`📊 Total Entries: ${count}`);

  // Get Unique Zones
  const { data: entries } = await supabase
    .from("price_list_entries")
    .select("zone_code, weight_from, weight_to, base_price")
    .eq("price_list_id", priceListId)
    .order("zone_code")
    .order("weight_from");

  if (entries) {
    const zones = [...new Set(entries.map((e) => e.zone_code))];
    console.log(`🌍 Zones Found (${zones.length}):`, zones.join(", "));

    // Sample Data
    console.log("\n🔎 Sample Rows (First 5):");
    console.table(entries.slice(0, 5));

    // Check coverage
    const weights = [...new Set(entries.map((e) => e.weight_to))];
    console.log(
      `⚖️  Weight Breakpoints Found (${weights.length}):`,
      weights.slice(0, 10).join(", ") + "..."
    );
  }
}

main().catch(console.error);
