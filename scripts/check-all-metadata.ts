/**
 * Script: Verifica metadata di tutti i listini dell'utente di test
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

async function main() {
  console.log("🔍 Verifica metadata di tutti i listini...\n");
  
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();
    
  if (!user) {
    console.log("❌ Utente non trovato");
    return;
  }
  
  const { data: lists } = await supabase
    .from("price_lists")
    .select("id, name, metadata, source_metadata")
    .eq("created_by", user.id)
    .eq("list_type", "supplier")
    .order("created_at", { ascending: false });
    
  if (!lists || lists.length === 0) {
    console.log("❌ Nessun listino trovato");
    return;
  }
  
  console.log(`📊 Trovati ${lists.length} listini:\n`);
  
  for (const list of lists) {
    console.log("═".repeat(60));
    console.log(`📦 ${list.name}`);
    console.log(`   ID: ${list.id}`);
    console.log(`   metadata: ${JSON.stringify(list.metadata, null, 2)}`);
    console.log(`   source_metadata: ${JSON.stringify(list.source_metadata, null, 2)}`);
    
    // Verifica campi critici
    const meta = list.metadata || list.source_metadata || {};
    const hasCarrierCode = !!(meta as any).carrier_code;
    const hasCourierConfigId = !!(meta as any).courier_config_id;
    
    console.log(`   ✓ carrier_code: ${hasCarrierCode ? "✅ " + (meta as any).carrier_code : "❌ MANCANTE"}`);
    console.log(`   ✓ courier_config_id: ${hasCourierConfigId ? "✅ " + (meta as any).courier_config_id?.substring(0, 8) + "..." : "❌ MANCANTE"}`);
  }
  
  console.log("\n" + "═".repeat(60));
}

main().catch(console.error);
