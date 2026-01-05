/**
 * Script: Test COMPLETO Multi-Account Multi-Contratto
 * 
 * Verifica:
 * 1. Tutte le configurazioni Spedisci.Online dell'utente
 * 2. I corrieri disponibili su CIASCUNA configurazione (via API)
 * 3. Come il sistema gestisce corrieri duplicati tra configurazioni
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

async function main() {
  console.log("═".repeat(70));
  console.log("🔍 TEST MULTI-ACCOUNT / MULTI-CONTRATTO");
  console.log("═".repeat(70));
  
  // Dynamic imports
  const { decryptCredential, isEncrypted } = await import("../lib/security/encryption");
  const { SpedisciOnlineAdapter } = await import("../lib/adapters/couriers/spedisci-online");
  
  // 1. Trova l'utente
  const { data: user } = await supabase
    .from("users")
    .select("id, email, is_reseller")
    .eq("email", TEST_EMAIL)
    .single();
    
  if (!user) {
    console.log("❌ Utente non trovato");
    return;
  }
  
  console.log("\n👤 UTENTE:", user.email);
  console.log("   ID:", user.id);
  console.log("   Reseller:", user.is_reseller ? "✅ SÌ" : "❌ NO");
  
  // 2. Trova TUTTE le configurazioni Spedisci.Online
  const { data: configs, error: configError } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("provider_id", "spedisci_online");
    
  if (configError) {
    console.log("❌ Errore query configs:", configError.message);
    return;
  }
    
  console.log("\n" + "═".repeat(70));
  console.log("📡 CONFIGURAZIONI SPEDISCI.ONLINE:", configs?.length || 0);
  console.log("═".repeat(70));
  
  if (!configs || configs.length === 0) {
    console.log("⚠️ Nessuna configurazione trovata per questo utente");
    return;
  }
  
  // Struttura per tracciare tutti i corrieri trovati
  interface CarrierInfo {
    configId: string;
    configName: string;
    carrierCode: string;
    contractCode: string;
    price: number;
  }
  
  const allCarriers: CarrierInfo[] = [];
  
  // 3. Per ogni configurazione, chiama l'API e ottieni i corrieri
  for (const cfg of configs) {
    console.log("\n┌" + "─".repeat(68) + "┐");
    console.log("│ 📦 CONFIG:", cfg.name.padEnd(55) + "│");
    console.log("│    ID:", cfg.id.substring(0, 8) + "...".padEnd(52) + "│");
    console.log("│    Attivo:", (cfg.is_active ? "✅" : "❌").padEnd(53) + "│");
    
    const creds = cfg.credentials || {};
    
    // L'API key può essere in diversi posti
    let apiKey: string | null = null;
    
    // 1. Prova api_key diretto nella config
    if ((cfg as any).api_key) {
      apiKey = (cfg as any).api_key;
    }
    // 2. Prova credentials.api_key
    else if (creds.api_key) {
      apiKey = creds.api_key;
    }
    // 3. Prova credentials_encrypted
    else if (cfg.credentials_encrypted) {
      try {
        const decryptedStr = decryptCredential(cfg.credentials_encrypted);
        const decrypted = JSON.parse(decryptedStr);
        apiKey = decrypted.api_key;
      } catch {}
    }
    
    if (!apiKey) {
      console.log("│    ❌ API Key mancante".padEnd(68) + "│");
      console.log("└" + "─".repeat(68) + "┘");
      continue;
    }
    
    // Decripta se necessario
    if (isEncrypted(apiKey)) {
      apiKey = decryptCredential(apiKey);
      console.log("│    🔐 API Key decriptata".padEnd(68) + "│");
    }
    
    try {
      const adapter = new SpedisciOnlineAdapter({
        api_key: apiKey,
        api_secret: creds.api_secret || "",
        base_url: creds.base_url || "https://infinity.spedisci.online/api/v2",
        contract_mapping: creds.contract_mapping || {},
      });
      
      // Fai una chiamata di test
      const result = await adapter.getRates({
        packages: [{ length: 30, width: 20, height: 15, weight: 2 }],
        shipFrom: {
          name: "Test",
          street1: "Via Roma 1",
          city: "Roma",
          state: "RM",
          postalCode: "00100",
          country: "IT",
        },
        shipTo: {
          name: "Test",
          street1: "Via Milano 1",
          city: "Milano",
          state: "MI",
          postalCode: "20100",
          country: "IT",
        },
        notes: "Test",
      });
      
      if (!result.success || !result.rates) {
        console.log("│    ❌ API Error: " + (result.error || "unknown").substring(0, 45).padEnd(48) + "│");
        console.log("└" + "─".repeat(68) + "┘");
        continue;
      }
      
      const rates = result.rates;
      console.log("│    ✅ API OK - " + rates.length + " rates trovati".padEnd(53) + "│");
      console.log("├" + "─".repeat(68) + "┤");
      console.log("│    🚚 CORRIERI DISPONIBILI:".padEnd(68) + "│");
      
      // Estrai e mostra i corrieri
      const seenCarriers = new Map<string, any>();
      for (const rate of rates) {
        const carrierCode = (rate as any).carrier_code || (rate as any).carrierCode || "unknown";
        const contractCode = (rate as any).contract_code || (rate as any).contractCode || "N/A";
        const price = parseFloat((rate as any).total_price) || 0;
        
        if (!seenCarriers.has(carrierCode)) {
          seenCarriers.set(carrierCode, { contractCode, price });
          
          allCarriers.push({
            configId: cfg.id,
            configName: cfg.name,
            carrierCode,
            contractCode,
            price,
          });
        }
      }
      
      for (const [carrier, info] of seenCarriers) {
        console.log(`│       - ${carrier.toUpperCase().padEnd(25)} ${info.contractCode.substring(0, 30)}`.padEnd(68) + "│");
      }
      
    } catch (e: any) {
      console.log("│    ❌ Errore API: " + e.message.substring(0, 45).padEnd(48) + "│");
    }
    
    console.log("└" + "─".repeat(68) + "┘");
  }
  
  // 4. Analisi sovrapposizioni
  console.log("\n" + "═".repeat(70));
  console.log("🔄 ANALISI SOVRAPPOSIZIONI");
  console.log("═".repeat(70));
  
  // Raggruppa per corriere
  const carrierToConfigs = new Map<string, CarrierInfo[]>();
  for (const carrier of allCarriers) {
    const existing = carrierToConfigs.get(carrier.carrierCode) || [];
    existing.push(carrier);
    carrierToConfigs.set(carrier.carrierCode, existing);
  }
  
  let hasOverlaps = false;
  for (const [carrierCode, carriers] of carrierToConfigs) {
    const uniqueConfigs = [...new Set(carriers.map(c => c.configId))];
    
    if (uniqueConfigs.length > 1) {
      hasOverlaps = true;
      console.log("\n⚠️  CORRIERE '" + carrierCode.toUpperCase() + "' presente in " + uniqueConfigs.length + " configurazioni:");
      for (const carrier of carriers) {
        console.log("   - Config: " + carrier.configName + " → Contratto: " + carrier.contractCode);
      }
      console.log("\n   💡 IL SISTEMA DEVE CREARE LISTINI SEPARATI PER OGNI CONFIG!");
    }
  }
  
  if (!hasOverlaps) {
    console.log("\n✅ Nessuna sovrapposizione: ogni corriere è in una sola configurazione");
  }
  
  // 5. Verifica listini esistenti
  console.log("\n" + "═".repeat(70));
  console.log("📋 LISTINI ATTUALMENTE NEL DATABASE");
  console.log("═".repeat(70));
  
  const { data: lists } = await supabase
    .from("price_lists")
    .select("id, name, metadata")
    .eq("created_by", user.id)
    .eq("list_type", "supplier");
    
  console.log("\nTotale listini:", lists?.length || 0);
  
  for (const list of lists || []) {
    const meta = (list.metadata as any) || {};
    console.log("\n📄 " + list.name);
    console.log("   carrier_code: " + (meta.carrier_code || "N/A"));
    console.log("   courier_config_id: " + (meta.courier_config_id?.substring(0, 8) || "N/A"));
  }
  
  // 6. Confronto atteso vs reale
  console.log("\n" + "═".repeat(70));
  console.log("📊 CONFRONTO ATTESO VS REALE");
  console.log("═".repeat(70));
  
  const expectedListings = allCarriers.length;
  const actualListings = lists?.length || 0;
  
  console.log("\n   Listini attesi (1 per corriere per config):", expectedListings);
  console.log("   Listini effettivi:", actualListings);
  
  if (actualListings < expectedListings) {
    console.log("\n   ⚠️  MANCANO " + (expectedListings - actualListings) + " LISTINI!");
    
    // Trova quali mancano
    for (const carrier of allCarriers) {
      const found = lists?.find(l => {
        const meta = (l.metadata as any) || {};
        return meta.carrier_code === carrier.carrierCode && 
               meta.courier_config_id === carrier.configId;
      });
      
      if (!found) {
        console.log("   ❌ Manca: " + carrier.carrierCode.toUpperCase() + " per config " + carrier.configName);
      }
    }
  } else if (actualListings === expectedListings) {
    console.log("\n   ✅ COPERTURA COMPLETA!");
  }
  
  console.log("\n" + "═".repeat(70));
}

main().catch(console.error);
