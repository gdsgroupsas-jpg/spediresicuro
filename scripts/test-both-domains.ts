/**
 * Test entrambi i domini per verificare quale è corretto
 * 
 * Uso: npx tsx scripts/test-both-domains.ts <api_key> [domain1] [domain2]
 * Oppure: TEST_API_KEY=xxx npx tsx scripts/test-both-domains.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Carica variabili d'ambiente
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// API Key da parametri command line o variabile d'ambiente
const API_KEY = process.argv[2] || process.env.TEST_API_KEY || process.env.SPEDISCI_ONLINE_API_KEY;

// Domini da testare (da parametri o default)
const DOMAINS_TO_TEST = [
  process.argv[3] || "https://ecommercetalia.spedisci.online/api/v2",  // Con "s" (quello salvato)
  process.argv[4] || "https://ecommerceitalia.spedisci.online/api/v2", // Senza "s" (quello nel placeholder)
];

if (!API_KEY) {
  console.error("❌ API Key mancante!");
  console.error("\n💡 Uso:");
  console.error("   npx tsx scripts/test-both-domains.ts <api_key> [domain1] [domain2]");
  console.error("\n   Oppure imposta variabili d'ambiente:");
  console.error("   TEST_API_KEY=xxx npx tsx scripts/test-both-domains.ts");
  process.exit(1);
}

// TypeScript: dopo il check, API_KEY è garantito essere string
const apiKey: string = API_KEY;

async function testDomain(baseUrl: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🧪 Test: ${baseUrl}`);
  console.log("=".repeat(60));

  const apiUrl = `${baseUrl}/shipping/rates`;

  const testPayload = {
    packages: [{
      length: 30,
      width: 20,
      height: 15,
      weight: 2
    }],
    shipFrom: {
      name: "Mittente Test",
      company: "Azienda Test",
      street1: "Via Roma 1",
      city: "Roma",
      state: "RM",
      postalCode: "00100",
      country: "IT",
      email: "mittente@example.com"
    },
    shipTo: {
      name: "Destinatario Test",
      street1: "Via Milano 2",
      city: "Milano",
      state: "MI",
      postalCode: "20100",
      country: "IT",
      email: "destinatario@example.com"
    },
    notes: "Test connessione API",
    insuranceValue: 0,
    codValue: 0,
    accessoriServices: []
  };

  try {
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESSO! (${responseTime}ms)`);
      console.log(`📦 Rates: ${Array.isArray(data) ? data.length : 'N/A'}`);
      
      if (Array.isArray(data) && data.length > 0) {
        const carriers = [...new Set(data.map((r: any) => r.carrierCode || r.carrier))];
        console.log(`🚚 Corrieri: ${carriers.join(", ")}`);
      }
      return { success: true, baseUrl };
    } else {
      const errorText = await response.text();
      console.log(`❌ ERRORE HTTP ${response.status}: ${response.statusText}`);
      try {
        const errorJson = JSON.parse(errorText);
        console.log(`   Messaggio: ${errorJson.message || errorJson.error || 'N/A'}`);
      } catch {
        console.log(`   Risposta: ${errorText.substring(0, 200)}`);
      }
      return { success: false, baseUrl, error: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    console.log(`❌ ERRORE: ${error.message}`);
    if (error.message.includes("ENOTFOUND")) {
      console.log(`   → Dominio non trovato (DNS)`);
    } else if (error.message.includes("ECONNREFUSED")) {
      console.log(`   → Connessione rifiutata`);
    } else if (error.message.includes("CERT")) {
      console.log(`   → Problema certificato SSL`);
    }
    return { success: false, baseUrl, error: error.message };
  }
}

async function main() {
  console.log("🔍 Test Domini Alternativi");
  console.log("=".repeat(60));
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);
  console.log(`\n📋 Domini da testare:`);
  DOMAINS_TO_TEST.forEach((url, idx) => {
    console.log(`   ${idx + 1}. ${url}`);
  });

  const results = [];
  for (const domain of DOMAINS_TO_TEST) {
    const result = await testDomain(domain);
    results.push(result);
    // Pausa tra i test
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n\n${"=".repeat(60)}`);
  console.log("📊 RIEPILOGO");
  console.log("=".repeat(60));

  const successResults = results.filter(r => r.success);
  if (successResults.length > 0) {
    console.log(`\n✅ Dominio/i funzionante/i:`);
    successResults.forEach(r => {
      console.log(`   → ${r.baseUrl}`);
    });
    console.log(`\n💡 RACCOMANDAZIONE: Aggiorna il Base URL nel database con quello funzionante!`);
  } else {
    console.log(`\n❌ Nessun dominio funzionante trovato`);
    console.log(`\n💡 Possibili cause:`);
    console.log(`   1. L'API Key potrebbe essere errata o scaduta`);
    console.log(`   2. Il dominio potrebbe non esistere più`);
    console.log(`   3. Problema di rete/firewall`);
  }

  process.exit(successResults.length > 0 ? 0 : 1);
}

main();
