/**
 * Script: Verifica mismatch tra nome listino e courier_id
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variabili d'ambiente mancanti");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

async function main() {
  console.log("🔍 Verifica Mismatch Courier per:", TEST_EMAIL);

  // 1. Recupera User ID
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();

  if (!user) {
    console.error("❌ Utente non trovato");
    return;
  }

  // 2. Recupera Listini con courier info
  const { data: priceLists, error: plError } = await supabase
    .from("price_lists")
    .select(`
      id,
      name,
      courier_id,
      notes,
      metadata,
      source_metadata,
      created_by,
      list_type
    `)
    .eq("created_by", user.id)
    .eq("list_type", "supplier")
    .order("created_at", { ascending: false });
    
  if (plError) {
    console.error("❌ Errore recupero listini:", plError);
    return;
  }
  
  // 3. Per ogni listino, recupera courier se presente
  const priceListsWithCourier = await Promise.all(
    (priceLists || []).map(async (list) => {
      if (list.courier_id) {
        const { data: courier } = await supabase
          .from("couriers")
          .select("id, name, code")
          .eq("id", list.courier_id)
          .single();
        return { ...list, courier };
      }
      return { ...list, courier: null };
    })
  );

  if (!priceListsWithCourier || priceListsWithCourier.length === 0) {
    console.log("⚠️ Nessun listino trovato");
    return;
  }

  console.log(`\n📊 Trovati ${priceListsWithCourier.length} listini:\n`);

  for (const list of priceListsWithCourier) {
    console.log(`📦 Listino: ${list.name}`);
    console.log(`   ID: ${list.id}`);
    console.log(`   Courier ID: ${list.courier_id || "null"}`);
    
    // Estrai carrierCode dal nome
    const nameParts = list.name.split("_");
    const carrierCodeFromName = nameParts[0]?.toLowerCase() || "unknown";
    console.log(`   CarrierCode dal nome: ${carrierCodeFromName}`);
    
    // Estrai carrierCode dalle notes
    const notesMatch = list.notes?.match(/Corriere:\s*(\w+)/i);
    const carrierCodeFromNotes = notesMatch?.[1]?.toLowerCase() || "unknown";
    console.log(`   CarrierCode dalle notes: ${carrierCodeFromNotes}`);
    
    // Verifica courier associato
    if (list.courier_id && list.courier) {
      const courier = list.courier;
      console.log(`   Courier DB: ${courier.name} (code: ${courier.code})`);
      
      // Verifica mismatch
      if (courier.code?.toLowerCase() !== carrierCodeFromName) {
        console.warn(`   ⚠️ MISMATCH: Nome ha "${carrierCodeFromName}" ma courier DB ha "${courier.code}"`);
      }
    } else {
      console.log(`   Courier DB: null (listino senza courier_id)`);
    }
    
    // Verifica metadata
    if (list.metadata || list.source_metadata) {
      const metadata = list.metadata || list.source_metadata;
      const metadataCarrier = (metadata as any)?.carrierCode || (metadata as any)?.carrier_code;
      if (metadataCarrier) {
        console.log(`   CarrierCode da metadata: ${metadataCarrier}`);
        if (metadataCarrier.toLowerCase() !== carrierCodeFromName) {
          console.warn(`   ⚠️ MISMATCH: Nome ha "${carrierCodeFromName}" ma metadata ha "${metadataCarrier}"`);
        }
      }
    }
    
    console.log("");
  }
}

main().catch(console.error);

