import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

async function main() {
  console.log("🔍 Checking Config for:", TEST_EMAIL);

  const { data: user } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", TEST_EMAIL)
    .single();

  if (!user) {
    console.error("❌ User not found");
    return;
  }
  console.log("✅ User ID:", user.id);

  const { data: configs, error } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("provider_id", "spedisci_online");

  if (error) {
    console.error("❌ Error fetching configs:", error.message);
    return;
  }

  console.log(`📊 Found ${configs.length} configs for spedisci_online`);

  configs.forEach((c) => {
    console.log(`   - ID: ${c.id}`);
    console.log(`     Active: ${c.is_active}`);
    console.log(`     API Key Column Present: ${!!c.api_key}`);
    console.log(`     Base URL Column Present: ${!!c.base_url}`);

    if (c.api_key) {
      console.log(`     API Key (Start): ${c.api_key.substring(0, 10)}...`);
    } else {
      console.log(`     ❌ API Key is EMPTY/NULL`);
    }
  });

  const validConfig = configs.find((c) => c.api_key && c.api_key.length > 0);
  if (validConfig) {
    console.log("\n✅ Configuration exists and has API KEY! No bug.");
  } else {
    console.log(
      "\n⚠️ Configuration exists but API KEY IS MISSING. Possible bug?"
    );
  }
}

main().catch(console.error);
