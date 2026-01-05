/**
 * TEST REALE: Sincronizzazione Listini da Spedisci.Online
 * 
 * Questo script testa la sync REALE usando le credenziali nel DB
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { decryptCredential, isEncrypted } from "@/lib/security/encryption";
import { SpedisciOnlineAdapter } from "@/lib/adapters/couriers/spedisci-online";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_USER_ID = "904dc243-e9da-408d-8c0b-5dbe2a48b739";

async function testRealSync() {
  console.log("\n" + "═".repeat(70));
  console.log("🧪 TEST REALE SINCRONIZZAZIONE LISTINI");
  console.log("═".repeat(70));

  // 1. Recupera le config dell'utente
  const { data: configs } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("owner_user_id", TEST_USER_ID)
    .eq("provider_id", "spedisci_online")
    .eq("is_active", true);

  console.log(`\n📋 Trovate ${configs?.length || 0} configurazioni attive\n`);

  if (!configs || configs.length === 0) {
    console.log("❌ Nessuna configurazione trovata");
    return;
  }

  // 2. Per ogni config, testa la chiamata API
  for (const cfg of configs) {
    console.log("─".repeat(70));
    console.log(`📡 Config: ${cfg.name}`);
    console.log(`   ID: ${cfg.id}`);
    console.log(`   Endpoint: ${cfg.base_url}`);

    // Decripta API key
    let apiKey = cfg.api_key;
    if (apiKey && isEncrypted(apiKey)) {
      apiKey = decryptCredential(apiKey);
    }

    try {
      const adapter = new SpedisciOnlineAdapter({
        api_key: apiKey,
        api_secret: cfg.api_secret || "",
        base_url: cfg.base_url || "https://infinity.spedisci.online/api/v2",
        contract_mapping: cfg.contract_mapping || {},
      });

      // Test chiamata rates
      console.log("\n   🔄 Chiamata API /shipping/rates...");
      const result = await adapter.getRates({
        packages: [{ length: 30, width: 20, height: 15, weight: 5 }],
        shipFrom: {
          name: "Test Mittente",
          street1: "Via Roma 1",
          city: "Roma",
          state: "RM",
          postalCode: "00100",
          country: "IT",
        },
        shipTo: {
          name: "Test Destinatario",
          street1: "Via Milano 1",
          city: "Milano",
          state: "MI",
          postalCode: "20100",
          country: "IT",
        },
        notes: "Test sync listini",
      });

      if (result.success && result.rates) {
        console.log(`   ✅ API OK - ${result.rates.length} rates ricevuti`);

        // Estrai corrieri unici
        const carriers = [...new Set(result.rates.map((r: any) => 
          r.carrier_code || r.carrierCode
        ))];
        console.log(`   🚚 Corrieri: ${carriers.join(", ")}`);

        // Mostra prezzi
        console.log("\n   💰 Prezzi ricevuti:");
        for (const rate of result.rates.slice(0, 5)) {
          const r = rate as any;
          const carrier = r.carrier_code || r.carrierCode;
          const contract = r.contract_code || r.contractCode;
          const price = r.total_price;
          console.log(`      - ${carrier} (${contract}): €${price}`);
        }
        if (result.rates.length > 5) {
          console.log(`      ... e altri ${result.rates.length - 5} rates`);
        }
      } else {
        console.log(`   ❌ API Error: ${result.error}`);
      }
    } catch (e: any) {
      console.log(`   💥 Eccezione: ${e.message}`);
    }
  }

  // 3. Verifica listini esistenti nel DB
  console.log("\n" + "═".repeat(70));
  console.log("📊 LISTINI ATTUALI NEL DATABASE");
  console.log("═".repeat(70));

  const { data: priceLists } = await supabase
    .from("price_lists")
    .select("id, name, metadata, updated_at")
    .eq("created_by", TEST_USER_ID)
    .eq("list_type", "supplier")
    .order("updated_at", { ascending: false });

  console.log(`\nTotale listini: ${priceLists?.length || 0}\n`);

  for (const list of priceLists || []) {
    const meta = (list.metadata as any) || {};
    console.log(`📄 ${list.name}`);
    console.log(`   carrier_code: ${meta.carrier_code || "N/A"}`);
    console.log(`   courier_config_id: ${meta.courier_config_id?.substring(0, 8) || "N/A"}...`);
    console.log(`   Ultimo aggiornamento: ${new Date(list.updated_at).toLocaleString("it-IT")}`);
    
    // Conta entries
    const { count } = await supabase
      .from("price_list_entries")
      .select("*", { count: "exact", head: true })
      .eq("price_list_id", list.id);
    
    console.log(`   Entries: ${count || 0}`);
    console.log();
  }

  // 4. Riepilogo
  console.log("═".repeat(70));
  console.log("📈 RIEPILOGO");
  console.log("═".repeat(70));
  console.log(`   Config attive: ${configs.length}`);
  console.log(`   Listini nel DB: ${priceLists?.length || 0}`);
  
  // Verifica che ogni config abbia almeno un listino
  for (const cfg of configs) {
    const listsForConfig = priceLists?.filter(
      (l) => (l.metadata as any)?.courier_config_id === cfg.id
    );
    console.log(`   - ${cfg.name}: ${listsForConfig?.length || 0} listini`);
  }

  console.log("\n" + "═".repeat(70));
}

testRealSync().catch(console.error);
