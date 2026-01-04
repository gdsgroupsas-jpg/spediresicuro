/**
 * Script: Verifica metadata del listino GLS esistente
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
  console.log("🔍 Verifica metadata listino GLS...");
  
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();
    
  if (!user) return;
  
  const { data: glsList } = await supabase
    .from("price_lists")
    .select("*")
    .eq("created_by", user.id)
    .eq("list_type", "supplier")
    .ilike("name", "GLS%")
    .single();
    
  if (!glsList) {
    console.log("❌ Listino GLS non trovato");
    return;
  }
  
  console.log("\n📦 Listino GLS trovato:");
  console.log(`   ID: ${glsList.id}`);
  console.log(`   Name: ${glsList.name}`);
  console.log(`   Metadata: ${JSON.stringify(glsList.metadata, null, 2)}`);
  console.log(`   Source Metadata: ${JSON.stringify(glsList.source_metadata, null, 2)}`);
  console.log(`   Notes: ${glsList.notes}`);
  
  // Aggiorna metadata per aggiungere carrier_code se mancante
  const currentMetadata = glsList.metadata || glsList.source_metadata || {};
  
  if (!(currentMetadata as any).carrier_code) {
    console.log("\n⚠️ carrier_code mancante nei metadata, lo aggiungo...");
    
    const newMetadata = {
      ...currentMetadata,
      carrier_code: "gls",
    };
    
    const { error } = await supabase
      .from("price_lists")
      .update({ 
        metadata: newMetadata,
        source_metadata: newMetadata,
      })
      .eq("id", glsList.id);
      
    if (error) {
      console.error("❌ Errore aggiornamento:", error.message);
    } else {
      console.log("✅ Metadata aggiornati con carrier_code=gls");
    }
  } else {
    console.log("\n✅ carrier_code già presente nei metadata");
  }
}

main().catch(console.error);

