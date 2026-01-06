/**
 * Script: Verifica entries listino per verificare mismatch carrierCode
 *
 * Verifica se le entries di un listino corrispondono al carrierCode del nome
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
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
  console.log("🔍 Verifica Entries Listini per:", TEST_EMAIL);

  // 1. Recupera User ID
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();

  if (userError || !user) {
    console.error("❌ Utente test non trovato:", userError?.message);
    return;
  }

  const userId = user.id;
  console.log("✅ User ID trovato:", userId);

  // 2. Recupera Listini
  const { data: priceLists, error: plError } = await supabase
    .from("price_lists")
    .select("id, name, courier_id, metadata, source_metadata, notes")
    .eq("created_by", userId)
    .eq("list_type", "supplier")
    .order("created_at", { ascending: false });

  if (plError) {
    console.error("❌ Errore recupero listini:", plError.message);
    return;
  }

  console.log(`\n📊 Trovati ${priceLists.length} listini fornitore:\n`);

  for (const list of priceLists) {
    console.log(`📦 Listino: ${list.name}`);
    console.log(`   ID: ${list.id}`);
    console.log(`   Courier ID: ${list.courier_id || "null"}`);
    console.log(`   Notes: ${list.notes?.substring(0, 100) || "null"}`);

    // Estrai carrierCode dal nome (formato: CARRIER_CONFIGNAME)
    const nameParts = list.name.split("_");
    const carrierCodeFromName = nameParts[0]?.toLowerCase() || "unknown";
    console.log(`   CarrierCode dal nome: ${carrierCodeFromName}`);

    // 3. Recupera Entries
    const { data: entries, error: entriesError } = await supabase
      .from("price_list_entries")
      .select("zone_code, weight_from, weight_to, base_price, service_type")
      .eq("price_list_id", list.id)
      .limit(10); // Prime 10 entries per verifica

    if (entriesError) {
      console.error("   ❌ Errore recupero entries:", entriesError.message);
      continue;
    }

    console.log(`   📊 Entries trovate: ${entries.length} (mostro prime 10)`);

    // Verifica se ci sono zone che suggeriscono un corriere specifico
    // GLS tipicamente ha zone IT-STD, IT-CAL, etc.
    // Poste ha zone diverse
    const zones = [...new Set(entries.map((e) => e.zone_code))];
    console.log(`   🌍 Zone trovate: ${zones.join(", ")}`);

    // Verifica prezzi (GLS e Poste hanno range diversi)
    const prices = entries.map((e) => e.base_price).filter((p) => p > 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    console.log(
      `   💰 Range prezzi: €${minPrice.toFixed(2)} - €${maxPrice.toFixed(2)}`
    );

    // Estrai carrierCode dalle notes se presente
    const notesMatch = list.notes?.match(/Corriere:\s*(\w+)/i);
    const carrierCodeFromNotes = notesMatch?.[1]?.toLowerCase() || "unknown";
    console.log(`   CarrierCode dalle notes: ${carrierCodeFromNotes}`);

    // Verifica mismatch
    if (
      carrierCodeFromName !== carrierCodeFromNotes &&
      carrierCodeFromNotes !== "unknown"
    ) {
      console.warn(
        `   ⚠️ MISMATCH: Nome ha "${carrierCodeFromName}" ma notes ha "${carrierCodeFromNotes}"`
      );
    }

    console.log("");
  }
}

main().catch(console.error);


