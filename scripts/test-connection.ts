/**
 * Simple connection test to Supabase
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log("🔍 Testing Supabase connection...");
console.log("URL:", SUPABASE_URL);
console.log("Key:", SUPABASE_SERVICE_KEY ? `${SUPABASE_SERVICE_KEY.substring(0, 20)}...` : "MISSING");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function test() {
  try {
    console.log("\n📡 Attempting to query users table...");
    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", "testspediresicuro+postaexpress@gmail.com")
      .single();

    if (error) {
      console.error("❌ Query error:", error);
      return;
    }

    if (!data) {
      console.log("⚠️ No user found with that email");
      return;
    }

    console.log("✅ Connection successful!");
    console.log("User:", data.email);
    console.log("ID:", data.id);
  } catch (err: any) {
    console.error("❌ Exception:", err.message);
    console.error("Stack:", err.stack);
  }
}

test().catch(console.error);
