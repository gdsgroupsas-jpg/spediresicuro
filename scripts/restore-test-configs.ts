import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const CONFIGS_TO_RESTORE = [
  {
    name: "spedizioni prime",
    provider_id: "spedisci_online",
    api_key: "c6HEnYYgJhxENVa0fd5CbG5evFZJXaS75GqnjGiEID7mgWIyJybX6wTwXFMc",
    base_url: "https://ecommercetalia.spedisci.online/api/v2",
    is_active: true,
  },
  {
    name: "speed go",
    provider_id: "spedisci_online",
    api_key: "QIhMonA1fTY7J8nUsKHCrnClbrmXtvZ976gfoWhPZYHyMgIvESxwfYYCE0gj",
    base_url: "https://infinity.spedisci.online/api/v2",
    is_active: true,
  },
];

async function main() {
  console.log(`🔧 Restoring configs for: ${TEST_EMAIL}`);

  // 1. Get User
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();
  if (!user) {
    console.log("❌ User not found!");
    return;
  }

  // 2. Restore
  for (const cfg of CONFIGS_TO_RESTORE) {
    const { error } = await supabase.from("courier_configs").insert({
      ...cfg,
      owner_user_id: user.id,
      created_by: TEST_EMAIL,
    });

    if (error) {
      console.log(`❌ Error restoring ${cfg.name}: ${error.message}`);
    } else {
      console.log(`✅ Restored: ${cfg.name}`);
    }
  }
}

main().catch(console.error);
