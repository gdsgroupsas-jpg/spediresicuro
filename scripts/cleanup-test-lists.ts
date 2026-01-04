/**
 * Script: Pulizia listini di test
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
  console.log("🗑️ Pulizia listini di test...");
  
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();
    
  if (!user) {
    console.error("❌ Utente non trovato");
    return;
  }
  
  // Trova listini di test
  const { data: testLists } = await supabase
    .from("price_lists")
    .select("id, name")
    .eq("created_by", user.id)
    .eq("list_type", "supplier")
    .ilike("name", "%TestSync%");
    
  if (!testLists || testLists.length === 0) {
    console.log("✅ Nessun listino di test da cancellare");
    return;
  }
  
  console.log(`📋 Trovati ${testLists.length} listini di test da cancellare:`);
  testLists.forEach((l, i) => {
    console.log(`   ${i + 1}. ${l.name}`);
  });
  
  // Cancella entries e listini
  for (const list of testLists) {
    // Cancella entries
    await supabase
      .from("price_list_entries")
      .delete()
      .eq("price_list_id", list.id);
      
    // Cancella listino
    const { error } = await supabase
      .from("price_lists")
      .delete()
      .eq("id", list.id);
      
    if (error) {
      console.error(`   ❌ Errore cancellazione ${list.name}: ${error.message}`);
    } else {
      console.log(`   ✅ Cancellato: ${list.name}`);
    }
  }
  
  console.log("\n✅ Pulizia completata");
  
  // Verifica listini rimanenti
  const { data: remaining } = await supabase
    .from("price_lists")
    .select("id, name")
    .eq("created_by", user.id)
    .eq("list_type", "supplier");
    
  console.log(`\n📋 Listini fornitore rimanenti: ${remaining?.length || 0}`);
  remaining?.forEach((l, i) => {
    console.log(`   ${i + 1}. ${l.name}`);
  });
}

main().catch(console.error);

