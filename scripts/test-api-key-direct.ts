/**
 * Test diretto API Key Spedisci.Online
 * Testa una chiave API specifica per verificare se funziona
 * 
 * ⚠️ SECURITY: Non committare mai API key nel codice!
 * 
 * Uso: npx tsx scripts/test-api-key-direct.ts <api_key> [base_url]
 * Oppure: TEST_API_KEY=xxx BASE_URL=xxx npx tsx scripts/test-api-key-direct.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Carica variabili d'ambiente
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// API Key da parametri command line o variabile d'ambiente
const API_KEY = process.argv[2] || process.env.TEST_API_KEY || process.env.SPEDISCI_ONLINE_API_KEY;
const BASE_URL = process.argv[3] || process.env.TEST_BASE_URL || process.env.SPEDISCI_ONLINE_BASE_URL || "https://api.spedisci.online/api/v2";

if (!API_KEY) {
  console.error("❌ API Key mancante!");
  console.error("\n💡 Uso:");
  console.error("   npx tsx scripts/test-api-key-direct.ts <api_key> [base_url]");
  console.error("\n   Oppure imposta variabili d'ambiente:");
  console.error("   TEST_API_KEY=xxx TEST_BASE_URL=xxx npx tsx scripts/test-api-key-direct.ts");
  process.exit(1);
}

async function testAPIKey() {
  console.log("🧪 Test Diretto API Key Spedisci.Online");
  console.log("=".repeat(60));
  console.log(
    `🔑 API Key: ${API_KEY.substring(0, 20)}...${API_KEY.substring(
      API_KEY.length - 10
    )}`
  );
  console.log(`🌐 Base URL: ${BASE_URL}\n`);

  // Payload di test
  const testPayload = {
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
    notes: "Test connessione API",
    insuranceValue: 0,
    codValue: 0,
    accessoriServices: [],
  };

  const apiUrl = `${BASE_URL}/shipping/rates`;

  console.log(`📤 Invio richiesta a: ${apiUrl}`);
  console.log(
    `📦 Payload:`,
    JSON.stringify(testPayload, null, 2).substring(0, 200) + "...\n"
  );

  try {
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    const responseTime = Date.now() - startTime;

    console.log(`⏱️ Tempo risposta: ${responseTime}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`\n❌ ERRORE HTTP ${response.status}:`);

      try {
        const errorJson = JSON.parse(errorText);
        console.log(JSON.stringify(errorJson, null, 2));
      } catch {
        console.log(errorText.substring(0, 500));
      }

      // Analisi errori comuni
      if (response.status === 401) {
        console.log("\n💡 Analisi: API Key non valida o scaduta");
      } else if (response.status === 403) {
        console.log("\n💡 Analisi: Accesso negato - verifica permessi API Key");
      } else if (response.status === 404) {
        console.log("\n💡 Analisi: Endpoint non trovato - verifica Base URL");
      } else if (response.status >= 500) {
        console.log("\n💡 Analisi: Errore server Spedisci.Online");
      }

      process.exit(1);
    }

    const data = await response.json();

    console.log(`\n✅ SUCCESSO!`);
    console.log(
      `📦 Rates ottenuti: ${Array.isArray(data) ? data.length : "N/A"}`
    );

    if (Array.isArray(data) && data.length > 0) {
      const carriers = [
        ...new Set(data.map((r: any) => r.carrierCode || r.carrier)),
      ];
      const contracts = [
        ...new Set(
          data.map((r: any) => r.contractCode || r.contract).filter(Boolean)
        ),
      ];

      console.log(`🚚 Corrieri trovati: ${carriers.join(", ") || "Nessuno"}`);
      if (contracts.length > 0) {
        console.log(`📄 Contratti: ${contracts.join(", ")}`);
      }

      console.log(`\n📋 Dettagli rates (primi 3):`);
      data.slice(0, 3).forEach((rate: any, idx: number) => {
        console.log(
          `\n   ${idx + 1}. ${rate.carrierCode || rate.carrier || "N/A"}`
        );
        console.log(
          `      Prezzo: €${rate.total_price || rate.price || "N/A"}`
        );
        console.log(
          `      Contratto: ${rate.contractCode || rate.contract || "N/A"}`
        );
      });
    } else {
      console.log(`\n⚠️ Risposta ricevuta ma nessun rate trovato`);
      console.log(
        `📄 Dati ricevuti:`,
        JSON.stringify(data, null, 2).substring(0, 300)
      );
    }

    process.exit(0);
  } catch (error: any) {
    console.log(`\n❌ ERRORE durante la richiesta:`);
    console.log(`   Tipo: ${error.name || "Unknown"}`);
    console.log(`   Messaggio: ${error.message}`);

    if (error.cause) {
      console.log(`   Causa: ${error.cause}`);
    }

    // Analisi errori di rete
    if (
      error.message.includes("fetch failed") ||
      error.message.includes("ECONNREFUSED")
    ) {
      console.log(`\n💡 Analisi: Errore di connessione di rete`);
      console.log(`   → Verifica che il Base URL sia raggiungibile`);
      console.log(`   → Controlla firewall/proxy`);
      console.log(`   → Verifica DNS (il dominio potrebbe non esistere)`);
    } else if (error.message.includes("ENOTFOUND")) {
      console.log(`\n💡 Analisi: Dominio non trovato (DNS)`);
      console.log(`   → Il Base URL potrebbe essere errato`);
    } else if (error.message.includes("CERT")) {
      console.log(`\n💡 Analisi: Problema certificato SSL`);
      console.log(
        `   → Il certificato del server potrebbe essere scaduto o non valido`
      );
    }

    process.exit(1);
  }
}

testAPIKey();
