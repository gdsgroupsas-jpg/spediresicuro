/**
 * Script: Corregge il Base URL della configurazione "spedizioni prime"
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Carica variabili d'ambiente
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variabili d'ambiente mancanti");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CONFIG_ID = "c2db42fe-6679-4ce8-8a34-7ea694404f2f"; // ID configurazione "spedizioni prime"
const CORRECT_BASE_URL = "https://ecommerceitalia.spedisci.online/api/v2";

async function main() {
  console.log("🔧 Correzione Base URL Configurazione");
  console.log("=".repeat(60));
  console.log(`📋 Config ID: ${CONFIG_ID}`);
  console.log(`🌐 Base URL corretto: ${CORRECT_BASE_URL}\n`);

  // 1. Recupera configurazione attuale
  console.log("📋 STEP 1: Recupero configurazione...");
  const { data: config, error: fetchError } = await supabase
    .from("courier_configs")
    .select("id, name, base_url")
    .eq("id", CONFIG_ID)
    .single();

  if (fetchError || !config) {
    console.error("❌ Configurazione non trovata:", fetchError?.message);
    process.exit(1);
  }

  console.log(`✅ Configurazione trovata: ${config.name}`);
  console.log(`   Base URL attuale: ${config.base_url || "N/A"}\n`);

  if (config.base_url === CORRECT_BASE_URL) {
    console.log("✅ Base URL già corretto! Nessuna modifica necessaria.");
    process.exit(0);
  }

  // 2. Aggiorna Base URL
  console.log("📝 STEP 2: Aggiornamento Base URL...");
  const { data: updated, error: updateError } = await supabase
    .from("courier_configs")
    .update({
      base_url: CORRECT_BASE_URL,
      updated_at: new Date().toISOString(),
    })
    .eq("id", CONFIG_ID)
    .select()
    .single();

  if (updateError) {
    console.error("❌ Errore aggiornamento:", updateError.message);
    process.exit(1);
  }

  console.log(`✅ Base URL aggiornato con successo!`);
  console.log(`   Nuovo Base URL: ${updated.base_url}\n`);

  // 3. Verifica finale
  console.log("🧪 STEP 3: Verifica finale...");
  const { data: verify } = await supabase
    .from("courier_configs")
    .select("id, name, base_url")
    .eq("id", CONFIG_ID)
    .single();

  if (verify?.base_url === CORRECT_BASE_URL) {
    console.log("✅ Verifica completata: Base URL corretto nel database!");
    console.log("\n💡 Prossimi passi:");
    console.log("   1. Prova a sincronizzare i listini dalla dashboard");
    console.log("   2. La configurazione 'spedizioni prime' dovrebbe ora funzionare");
  } else {
    console.log("⚠️ Attenzione: Verifica fallita");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("💥 Errore fatale:", error);
  process.exit(1);
});
