/**
 * Script: Verifica colonna metadata in price_lists
 * 
 * Verifica se la colonna metadata esiste nella tabella price_lists
 * (migration 059)
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
  console.error("   Verifica che .env.local contenga:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyMetadataColumn() {
  console.log("🔍 Verifica colonna metadata in price_lists");
  console.log("─".repeat(50));

  try {
    // Prova a selezionare metadata (se esiste, funziona; se non esiste, errore)
    const { data, error } = await supabase
      .from("price_lists")
      .select("metadata")
      .limit(1);

    if (error) {
      if (error.message.includes("metadata") || error.code === "PGRST204") {
        console.error("❌ Colonna metadata NON esiste in price_lists");
        console.error("   Applica la migration 059:");
        console.error("   - Via Supabase Dashboard: SQL Editor → copia/incolla 059_add_metadata_to_price_lists.sql");
        console.error("   - Via CLI: npx supabase db push");
        return false;
      } else {
        console.error("❌ Errore verifica:", error.message);
        return false;
      }
    }

    console.log("✅ Colonna metadata esiste in price_lists");
    console.log("   Sample data:", data?.[0]?.metadata || "null/empty");
    return true;
  } catch (error: any) {
    console.error("❌ Errore:", error.message);
    return false;
  }
}

// Esegui verifica
verifyMetadataColumn()
  .then((success) => {
    if (success) {
      console.log("\n✅ Verifica completata: colonna metadata presente");
      process.exit(0);
    } else {
      console.log("\n❌ Verifica fallita: colonna metadata mancante");
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("❌ Errore fatale:", error);
    process.exit(1);
  });


