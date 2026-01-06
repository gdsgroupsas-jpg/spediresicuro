/**
 * Script di Diagnostica: Verifica Configurazioni API Corriere di un Utente
 * 
 * Questo script:
 * 1. Trova tutte le configurazioni API corriere di un utente specifico
 * 2. Testa ciascuna configurazione chiamando l'API Spedisci.Online
 * 3. Mostra risultati dettagliati per identificare problemi
 * 
 * Uso: npx tsx scripts/diagnose-user-api-configs.ts <email>
 */

// Carica variabili d'ambiente
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Carica .env.local se esiste
config({ path: resolve(process.cwd(), ".env.local") });
// Carica anche .env come fallback
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variabili d'ambiente mancanti:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "OK" : "MISSING");
  console.error("   SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_KEY ? "OK" : "MISSING");
  console.error("\n💡 Aggiungi queste variabili al file .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

import { decryptCredential, isEncrypted } from "@/lib/security/encryption";
import { SpedisciOnlineAdapter } from "@/lib/adapters/couriers/spedisci-online";

const USER_EMAIL = process.argv[2] || "testspediresicuro+postaexpress@gmail.com";

interface TestResult {
  configId: string;
  configName: string;
  success: boolean;
  error?: string;
  details?: {
    url?: string;
    responseTime?: number;
    carriersFound?: string[];
    contractsFound?: string[];
    ratesCount?: number;
  };
}

async function main() {
  console.log("🔍 Diagnostica Configurazioni API Corriere");
  console.log("=" .repeat(60));
  console.log(`📧 Utente: ${USER_EMAIL}\n`);

  // 1. Trova l'utente
  console.log("📋 STEP 1: Recupero dati utente...");
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email, account_type, is_reseller")
    .eq("email", USER_EMAIL)
    .maybeSingle();

  if (userError || !user) {
    console.error("❌ Utente non trovato:", userError?.message);
    process.exit(1);
  }

  console.log(`✅ Utente trovato: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Tipo: ${user.account_type || "standard"}`);
  console.log(`   Reseller: ${user.is_reseller ? "Sì" : "No"}\n`);

  // 2. Trova tutte le configurazioni Spedisci.Online dell'utente
  console.log("📋 STEP 2: Recupero configurazioni API corriere...");
  const { data: configs, error: configsError } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("provider_id", "spedisci_online")
    .or(`owner_user_id.eq.${user.id},created_by.eq.${USER_EMAIL}`)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (configsError) {
    console.error("❌ Errore recupero configurazioni:", configsError.message);
    process.exit(1);
  }

  if (!configs || configs.length === 0) {
    console.log("⚠️ Nessuna configurazione attiva trovata per questo utente");
    process.exit(0);
  }

  console.log(`✅ Trovate ${configs.length} configurazione/i:\n`);
  configs.forEach((config, idx) => {
    console.log(`   ${idx + 1}. ${config.name || `Config ${config.id.substring(0, 8)}`}`);
    console.log(`      ID: ${config.id}`);
    console.log(`      Base URL: ${config.base_url || "N/A"}`);
    console.log(`      Default: ${config.is_default ? "Sì" : "No"}`);
    console.log(`      Status: ${config.status || "active"}`);
    console.log(`      Creato: ${config.created_at}`);
    console.log("");
  });

  // 3. Testa ciascuna configurazione
  console.log("🧪 STEP 3: Test connessioni API...\n");
  const results: TestResult[] = [];

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const configName = config.name || `Config ${config.id.substring(0, 8)}`;
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📡 Test ${i + 1}/${configs.length}: ${configName}`);
    console.log(`${"=".repeat(60)}`);

    // Decripta credenziali
    let apiKey: string | null = null;
    let apiSecret: string | null = null;

    try {
      if (!config.api_key) {
        results.push({
          configId: config.id,
          configName,
          success: false,
          error: "API Key mancante",
        });
        console.log("❌ API Key mancante");
        continue;
      }

      apiKey = config.api_key;
      if (isEncrypted(apiKey)) {
        apiKey = decryptCredential(apiKey);
        console.log("✅ API Key decriptata");
      } else {
        console.log("ℹ️ API Key in chiaro (non criptata)");
      }

      if (config.api_secret) {
        apiSecret = config.api_secret;
        if (isEncrypted(apiSecret)) {
          apiSecret = decryptCredential(apiSecret);
          console.log("✅ API Secret decriptato");
        }
      }
    } catch (error: any) {
      results.push({
        configId: config.id,
        configName,
        success: false,
        error: `Errore decriptazione: ${error.message}`,
      });
      console.log(`❌ Errore decriptazione: ${error.message}`);
      continue;
    }

    // Testa connessione API
    try {
      const baseUrl = config.base_url || "https://api.spedisci.online/api/v2";
      console.log(`🌐 Base URL: ${baseUrl}`);

      const adapter = new SpedisciOnlineAdapter({
        api_key: apiKey!,
        api_secret: apiSecret || undefined,
        base_url: baseUrl,
        contract_mapping: (config.contract_mapping as Record<string, string>) || {},
      });

      // Parametri di test
      const testParams = {
        packages: [
          {
            length: 30,
            width: 20,
            height: 15,
            weight: 2,
          },
        ],
        shipFrom: {
          name: "Mittente Test",
          company: "Azienda Test",
          street1: "Via Roma 1",
          street2: "",
          city: "Roma",
          state: "RM",
          postalCode: "00100",
          country: "IT",
          email: "mittente@example.com",
        },
        shipTo: {
          name: "Destinatario Test",
          company: "",
          street1: "Via Milano 2",
          street2: "",
          city: "Milano",
          state: "MI",
          postalCode: "20100",
          country: "IT",
          email: "destinatario@example.com",
        },
        notes: "Test diagnostica configurazione",
        insuranceValue: 0,
        codValue: 0,
        accessoriServices: [],
      };

      console.log("📤 Invio richiesta API...");
      const startTime = Date.now();
      const result = await adapter.getRates(testParams);
      const responseTime = Date.now() - startTime;

      if (result.success && result.rates && result.rates.length > 0) {
        const carriers = [...new Set(result.rates.map((r: any) => r.carrierCode))];
        const contracts = [...new Set(result.rates.map((r: any) => r.contractCode).filter(Boolean))];

        results.push({
          configId: config.id,
          configName,
          success: true,
          details: {
            url: baseUrl,
            responseTime,
            carriersFound: carriers,
            contractsFound: contracts,
            ratesCount: result.rates.length,
          },
        });

        console.log("✅ Connessione riuscita!");
        console.log(`   ⏱️ Tempo risposta: ${responseTime}ms`);
        console.log(`   📦 Rates trovati: ${result.rates.length}`);
        console.log(`   🚚 Corrieri: ${carriers.join(", ") || "Nessuno"}`);
        if (contracts.length > 0) {
          console.log(`   📄 Contratti: ${contracts.join(", ")}`);
        }
      } else {
        results.push({
          configId: config.id,
          configName,
          success: false,
          error: result.error || "Nessun rate ottenuto",
          details: {
            url: baseUrl,
            responseTime,
          },
        });

        console.log("❌ Connessione fallita");
        console.log(`   ⏱️ Tempo risposta: ${responseTime}ms`);
        console.log(`   ❌ Errore: ${result.error || "Nessun rate ottenuto"}`);
      }
    } catch (error: any) {
      results.push({
        configId: config.id,
        configName,
        success: false,
        error: error.message || "Errore sconosciuto",
      });

      console.log(`❌ Errore durante il test: ${error.message}`);
    }
  }

  // 4. Riepilogo finale
  console.log("\n\n" + "=".repeat(60));
  console.log("📊 RIEPILOGO FINALE");
  console.log("=".repeat(60));

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  console.log(`\n✅ Configurazioni funzionanti: ${successCount}/${results.length}`);
  console.log(`❌ Configurazioni con errori: ${failCount}/${results.length}\n`);

  results.forEach((result, idx) => {
    console.log(`\n${idx + 1}. ${result.configName}`);
    if (result.success) {
      console.log(`   ✅ SUCCESSO`);
      if (result.details) {
        console.log(`   ⏱️ Tempo: ${result.details.responseTime}ms`);
        console.log(`   📦 Rates: ${result.details.ratesCount}`);
        if (result.details.carriersFound && result.details.carriersFound.length > 0) {
          console.log(`   🚚 Corrieri: ${result.details.carriersFound.join(", ")}`);
        }
      }
    } else {
      console.log(`   ❌ ERRORE: ${result.error}`);
      if (result.details?.responseTime) {
        console.log(`   ⏱️ Tempo: ${result.details.responseTime}ms`);
      }
    }
  });

  // 5. Raccomandazioni
  console.log("\n\n" + "=".repeat(60));
  console.log("💡 RACCOMANDAZIONI");
  console.log("=".repeat(60));

  if (failCount > 0) {
    console.log("\n⚠️ Configurazioni con problemi:");
    results
      .filter((r) => !r.success)
      .forEach((result) => {
        console.log(`\n   • ${result.configName}:`);
        if (result.error?.includes("401") || result.error?.includes("non valida")) {
          console.log("     → Verifica che l'API Key sia corretta e non scaduta");
        } else if (result.error?.includes("404") || result.error?.includes("Endpoint")) {
          console.log("     → Verifica che il Base URL sia corretto");
        } else if (result.error?.includes("Nessun rate")) {
          console.log("     → Verifica che l'account abbia contratti attivi");
          console.log("     → Verifica che i contratti coprano le zone testate");
        } else {
          console.log(`     → ${result.error}`);
        }
      });
  }

  if (successCount === results.length) {
    console.log("\n✅ Tutte le configurazioni funzionano correttamente!");
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("💥 Errore fatale:", error);
  process.exit(1);
});
