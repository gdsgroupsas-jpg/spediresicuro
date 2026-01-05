/**
 * Script: Verifica dettagliata delle credenziali e contratti
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

// Dynamic import per encryption
async function getEncryption() {
  return await import("../lib/security/encryption");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_USER_ID = "904dc243-e9da-408d-8c0b-5dbe2a48b739";

async function main() {
  console.log("🔍 Verifica credenziali e contratti...\\n");

  const { decryptCredential, isEncrypted } = await getEncryption();

  const { data: configs } = await supabase
    .from("courier_configs")
    .select("id, name, credentials")
    .eq("owner_user_id", TEST_USER_ID)
    .eq("provider_id", "spedisci_online");

  for (const cfg of configs || []) {
    console.log("═".repeat(60));
    console.log("📦 Config:", cfg.name);
    console.log("   ID:", cfg.id);

    const creds = cfg.credentials || {};
    console.log("\\n   Chiavi credentials:", Object.keys(creds));

    // Verifica se api_key è criptata
    if (creds.api_key) {
      const isCrypted = isEncrypted(creds.api_key);
      console.log("   API Key criptata:", isCrypted ? "✅ SÌ" : "❌ NO");

      if (isCrypted) {
        try {
          const decrypted = decryptCredential(creds.api_key);
          console.log(
            "   API Key (primi 10):",
            decrypted?.substring(0, 10) + "..."
          );
        } catch (e) {
          console.log("   ❌ Errore decrypt API key");
        }
      }
    }

    // Contract mapping
    console.log("\\n   📋 Contract Mapping:");
    const contractMapping = creds.contract_mapping || {};
    const contracts = Object.keys(contractMapping);

    if (contracts.length === 0) {
      console.log("      ⚠️ VUOTO - Nessun contratto mappato!");
      console.log(
        "      💡 Il contract_mapping viene popolato quando si fa la PRIMA sincronizzazione"
      );
    } else {
      for (const contractCode of contracts) {
        console.log(
          `      - ${contractCode} → ${contractMapping[contractCode]}`
        );
      }
    }

    console.log("");
  }

  // Ora testa l'API per vedere quali corrieri sono disponibili
  console.log("\\n" + "═".repeat(60));
  console.log("🌐 TEST API - Corrieri disponibili per ciascuna config");
  console.log("═".repeat(60));

  // Importa dinamicamente l'adapter
  const { SpedisciOnlineAdapter } = await import(
    "../lib/adapters/couriers/spedisci-online"
  );

  for (const cfg of configs || []) {
    console.log(`\\n📦 Config: ${cfg.name}`);

    const creds = cfg.credentials || {};
    if (!creds.api_key) {
      console.log("   ❌ API Key mancante");
      continue;
    }

    try {
      // Decripta la chiave se necessario
      let apiKey = creds.api_key;
      if (isEncrypted(apiKey)) {
        apiKey = decryptCredential(apiKey);
      }

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
        notes: "Test contratti",
      });

      // Estrai i corrieri unici
      const rates = result.rates || [];
      const carriers = [
        ...new Set(rates.map((r: any) => r.carrier_code || r.carrierCode)),
      ];
      const contractCodes = [
        ...new Set(rates.map((r: any) => r.contract_code || r.contractCode)),
      ];

      console.log(`   ✅ API risponde - ${rates.length} rates`);
      console.log(`   🚚 Corrieri: ${carriers.join(", ")}`);
      console.log(`   📄 Contratti: ${contractCodes.join(", ")}`);
    } catch (e: any) {
      console.log(`   ❌ Errore API: ${e.message}`);
    }
  }
}

main().catch(console.error);
