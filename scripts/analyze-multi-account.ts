/**
 * Script: Analisi COMPLETA multi-account/multi-contratto
 *
 * Questo script analizza:
 * 1. Quante configurazioni Spedisci.Online ha l'utente
 * 2. Quanti contratti corriere ha CIASCUNA configurazione
 * 3. Come sono mappati i listini
 * 4. Identifica problemi di sovrapposizione (stesso corriere su più account)
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

interface ContractInfo {
  configId: string;
  configName: string;
  contractCode: string;
  carrierCode: string;
  carrierName: string;
}

async function main() {
  console.log("═".repeat(70));
  console.log("🔍 ANALISI MULTI-ACCOUNT / MULTI-CONTRATTO");
  console.log("═".repeat(70));

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

  console.log(`\n👤 UTENTE: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Reseller: ${user.is_reseller ? "✅ SÌ" : "❌ NO"}`);

  // 2. Trova TUTTE le configurazioni Spedisci.Online
  const { data: configs } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("provider_id", "spedisci_online");

  console.log(`\n${"═".repeat(70)}`);
  console.log(`📡 CONFIGURAZIONI SPEDISCI.ONLINE: ${configs?.length || 0}`);
  console.log("═".repeat(70));

  const allContracts: ContractInfo[] = [];
  const carriersByConfig: Map<string, string[]> = new Map();

  for (const cfg of configs || []) {
    console.log(`\n┌─ 📦 CONFIG: ${cfg.name}`);
    console.log(`│  ID: ${cfg.id}`);
    console.log(`│  Attivo: ${cfg.is_active ? "✅" : "❌"}`);

    // Decripta le credenziali se necessario
    let creds = cfg.credentials || {};

    // Controlla il contract_mapping
    const contractMapping = creds.contract_mapping || {};
    const contracts = Object.keys(contractMapping);

    console.log(`│  🚚 Contratti corriere: ${contracts.length}`);

    const carriersInThisConfig: string[] = [];

    for (const contractCode of contracts) {
      const carrierName = contractMapping[contractCode];
      // Estrai il carrierCode dal contractCode (prima parte prima del -)
      const carrierCode = contractCode.split("-")[0].toLowerCase();

      console.log(`│     ├─ ${contractCode}`);
      console.log(`│     │     Corriere: ${carrierName} (${carrierCode})`);

      allContracts.push({
        configId: cfg.id,
        configName: cfg.name,
        contractCode,
        carrierCode,
        carrierName,
      });

      if (!carriersInThisConfig.includes(carrierCode)) {
        carriersInThisConfig.push(carrierCode);
      }
    }

    carriersByConfig.set(cfg.id, carriersInThisConfig);
    console.log(`└─────────────────────────────────────────────`);
  }

  // 3. Analisi sovrapposizioni
  console.log(`\n${"═".repeat(70)}`);
  console.log("🔄 ANALISI SOVRAPPOSIZIONI (stesso corriere su più account)");
  console.log("═".repeat(70));

  // Raggruppa per carrierCode
  const carrierToConfigs: Map<string, ContractInfo[]> = new Map();
  for (const contract of allContracts) {
    const existing = carrierToConfigs.get(contract.carrierCode) || [];
    existing.push(contract);
    carrierToConfigs.set(contract.carrierCode, existing);
  }

  let hasOverlaps = false;
  for (const [carrierCode, contracts] of carrierToConfigs.entries()) {
    const uniqueConfigs = [...new Set(contracts.map((c) => c.configId))];

    if (uniqueConfigs.length > 1) {
      hasOverlaps = true;
      console.log(
        `\n⚠️  CORRIERE "${carrierCode.toUpperCase()}" presente in ${
          uniqueConfigs.length
        } configurazioni:`
      );
      for (const contract of contracts) {
        console.log(
          `   - Config: ${contract.configName} (${contract.configId.substring(
            0,
            8
          )})`
        );
        console.log(`     Contratto: ${contract.contractCode}`);
      }
    }
  }

  if (!hasOverlaps) {
    console.log(
      "\n✅ Nessuna sovrapposizione: ogni corriere è in una sola configurazione"
    );
  }

  // 4. Trova TUTTI i listini dell'utente
  console.log(`\n${"═".repeat(70)}`);
  console.log("📋 LISTINI SINCRONIZZATI NEL DATABASE");
  console.log("═".repeat(70));

  const { data: lists } = await supabase
    .from("price_lists")
    .select("id, name, metadata, source_metadata, created_at, updated_at")
    .eq("created_by", user.id)
    .eq("list_type", "supplier")
    .order("created_at", { ascending: false });

  console.log(`\nTotale listini: ${lists?.length || 0}`);

  // Mappa listini per config_id
  const listsByConfig: Map<string, any[]> = new Map();
  const orphanLists: any[] = [];

  for (const list of lists || []) {
    const meta = list.metadata || list.source_metadata || {};
    const configId = (meta as any).courier_config_id;

    if (configId) {
      const existing = listsByConfig.get(configId) || [];
      existing.push({ ...list, meta });
      listsByConfig.set(configId, existing);
    } else {
      orphanLists.push({ ...list, meta });
    }
  }

  // Mostra listini per configurazione
  for (const cfg of configs || []) {
    const cfgLists = listsByConfig.get(cfg.id) || [];
    console.log(`\n┌─ Config: ${cfg.name} (${cfg.id.substring(0, 8)})`);
    console.log(`│  Listini: ${cfgLists.length}`);

    for (const list of cfgLists) {
      console.log(`│  ├─ ${list.name}`);
      console.log(`│  │     carrier_code: ${list.meta.carrier_code || "N/A"}`);
    }

    // Controlla se mancano listini per qualche corriere
    const expectedCarriers = carriersByConfig.get(cfg.id) || [];
    const actualCarriers = cfgLists
      .map((l: any) => l.meta.carrier_code?.toLowerCase())
      .filter(Boolean);
    const missingCarriers = expectedCarriers.filter(
      (c) => !actualCarriers.includes(c)
    );

    if (missingCarriers.length > 0) {
      console.log(`│  ⚠️  CORRIERI MANCANTI: ${missingCarriers.join(", ")}`);
    }

    console.log(`└─────────────────────────────────────────────`);
  }

  if (orphanLists.length > 0) {
    console.log(
      `\n⚠️  LISTINI ORFANI (senza courier_config_id): ${orphanLists.length}`
    );
    for (const list of orphanLists) {
      console.log(`   - ${list.name}`);
    }
  }

  // 5. Riepilogo finale
  console.log(`\n${"═".repeat(70)}`);
  console.log("📊 RIEPILOGO");
  console.log("═".repeat(70));
  console.log(`   Configurazioni Spedisci.Online: ${configs?.length || 0}`);
  console.log(`   Totale contratti corriere: ${allContracts.length}`);
  console.log(`   Corrieri unici: ${carrierToConfigs.size}`);
  console.log(`   Listini sincronizzati: ${lists?.length || 0}`);
  console.log(`   Listini orfani: ${orphanLists.length}`);

  // Verifica copertura
  const expectedListCount = allContracts.length; // Un listino per contratto? O per corriere per config?
  // In realtà dovrebbe essere: un listino per CORRIERE per CONFIG
  const expectedByCarrierPerConfig = new Set(
    allContracts.map((c) => `${c.configId}:${c.carrierCode}`)
  ).size;

  console.log(
    `\n   📌 Listini attesi (1 per corriere per config): ${expectedByCarrierPerConfig}`
  );
  console.log(`   📌 Listini effettivi: ${lists?.length || 0}`);

  if ((lists?.length || 0) < expectedByCarrierPerConfig) {
    console.log(
      `\n   ⚠️  ATTENZIONE: Mancano ${
        expectedByCarrierPerConfig - (lists?.length || 0)
      } listini!`
    );
    console.log(`   💡 Esegui la sincronizzazione per ogni configurazione.`);
  } else if ((lists?.length || 0) === expectedByCarrierPerConfig) {
    console.log(
      `\n   ✅ COPERTURA COMPLETA: tutti i corrieri hanno il loro listino`
    );
  }

  console.log("\n" + "═".repeat(70));
}

main().catch(console.error);
