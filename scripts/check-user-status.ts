import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function main() {
  console.log(`🔍 Checking status for: ${TEST_EMAIL}`);

  // 1. Get User
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("email", TEST_EMAIL)
    .single();
  if (!user) {
    console.log("❌ User not found!");
    return;
  }
  console.log(`✅ User found (ID: ${user.id}). Reseller: ${user.is_reseller}`);

  // 2. Get Configs
  const { data: configs } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("owner_user_id", user.id);

  console.log(`\n📊 Active Configurations: ${configs?.length || 0}`);
  configs?.forEach((c) => {
    console.log(`   - ${c.name} (${c.provider_id}) [Active: ${c.is_active}]`);
  });

  // 3. Check stats
  const { count: shipmentCount } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  console.log(`\n📦 Total Shipments: ${shipmentCount}`);
}

main().catch(console.error);
