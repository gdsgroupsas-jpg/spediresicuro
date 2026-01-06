/**
 * Test DIRETTO delle API key con fetch raw
 * 
 * ⚠️ SECURITY: Non committare mai API key nel codice!
 * 
 * Uso: npx tsx scripts/test-api-direct.ts
 * 
 * Richiede variabili d'ambiente:
 *   TEST_API_KEY_SPEED=xxx
 *   TEST_API_KEY_PRIME=xxx
 *   TEST_BASE_URL=xxx (opzionale)
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

// ⚠️ SECURITY: Leggi API keys da variabili d'ambiente, mai hardcoded!
const API_KEYS: Record<string, string> = {};

if (process.env.TEST_API_KEY_SPEED) {
  API_KEYS["speed go"] = process.env.TEST_API_KEY_SPEED;
}

if (process.env.TEST_API_KEY_PRIME) {
  API_KEYS["spedizioni prime"] = process.env.TEST_API_KEY_PRIME;
}

const BASE_URL = process.env.TEST_BASE_URL || "https://infinity.spedisci.online/api/v2";

async function testDirectCall(name: string, apiKey: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🔑 Testing: ${name}`);
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`   Length: ${apiKey.length}`);

  const payload = {
    packages: [{ length: 30, width: 20, height: 15, weight: 2 }],
    shipFrom: {
      name: "Test Mittente",
      company: "Test Company",
      street1: "Via Roma 1",
      street2: "",
      city: "Roma",
      state: "RM",
      postalCode: "00100",
      country: "IT",
      phone: null,
      email: "test@example.com",
    },
    shipTo: {
      name: "Test Destinatario",
      company: "",
      street1: "Via Milano 1",
      street2: "",
      city: "Milano",
      state: "MI",
      postalCode: "20100",
      country: "IT",
      phone: null,
      email: "test@example.com",
    },
    notes: "Test",
  };

  const url = `${BASE_URL}/shipping/rates`;

  console.log(`\n   📡 URL: ${url}`);
  console.log(`   📡 Method: POST`);
  console.log(
    `   📡 Header: Authorization: Bearer ${apiKey.substring(0, 10)}...`
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(
      `\n   📊 Response Status: ${response.status} ${response.statusText}`
    );

    const text = await response.text();

    if (response.ok) {
      const data = JSON.parse(text);
      console.log(`   ✅ SUCCESS! Rates count: ${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) {
        const carriers = [...new Set(data.data.map((r: any) => r.carrierCode))];
        console.log(`   🚚 Carriers: ${carriers.join(", ")}`);
      }
    } else {
      console.log(`   ❌ ERROR Response:`);
      console.log(`   ${text.substring(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`   ❌ FETCH ERROR: ${e.message}`);
  }
}

async function main() {
  console.log("🔍 TEST DIRETTO API SPEDISCI.ONLINE");
  console.log("Bypassing all our code, calling API directly with fetch");

  if (Object.keys(API_KEYS).length === 0) {
    console.error("\n❌ Nessuna API key configurata!");
    console.error("\n💡 Imposta le variabili d'ambiente:");
    console.error("   TEST_API_KEY_SPEED=xxx");
    console.error("   TEST_API_KEY_PRIME=xxx");
    console.error("   TEST_BASE_URL=xxx (opzionale)");
    process.exit(1);
  }

  for (const [name, key] of Object.entries(API_KEYS)) {
    await testDirectCall(name, key);
  }

  console.log(`\n${"═".repeat(60)}`);
}

main();
