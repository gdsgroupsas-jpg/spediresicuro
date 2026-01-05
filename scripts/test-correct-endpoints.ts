/**
 * Test DIRETTO delle API - USANDO L'ENDPOINT CORRETTO PER OGNI CONFIG
 */

import { decrypt } from "@/lib/security/encryption";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testWithCorrectEndpoints() {
  console.log(
    "\n🔬 TEST DIRETTO API - CON ENDPOINT CORRETTO PER OGNI CONFIG\n"
  );
  console.log("Ogni account Spedisci.Online ha il suo endpoint dedicato!\n");

  // Recupera le config con i loro endpoint
  const { data: configs } = await supabase
    .from("courier_configs")
    .select("name, api_key, base_url")
    .eq("owner_user_id", "904dc243-e9da-408d-8c0b-5dbe2a48b739");

  for (const cfg of configs || []) {
    console.log("═".repeat(60));
    console.log(`📡 Config: ${cfg.name}`);
    console.log(`   Endpoint: ${cfg.base_url}`);

    // Decripta la key
    let apiKey = cfg.api_key;
    if (apiKey?.startsWith("enc:")) {
      apiKey = decrypt(apiKey);
    }
    console.log(`   API Key: ${apiKey?.substring(0, 20)}...`);

    // Costruisci URL completo
    const url = `${cfg.base_url}/shipping/rates`;

    // Payload minimo
    const payload = {
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
    };

    try {
      console.log(`\n   🌐 POST ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      console.log(`   📊 Status: ${response.status} ${response.statusText}`);

      const text = await response.text();

      if (response.ok) {
        const data = JSON.parse(text);
        console.log(
          `   ✅ SUCCESSO! Rates ricevuti: ${data.data?.length || 0}`
        );
        if (data.data?.length > 0) {
          const carriers = [
            ...new Set(
              data.data.map((r: any) => r.carrier_code || r.carrierCode)
            ),
          ];
          console.log(`   📦 Corrieri: ${carriers.join(", ")}`);
        }
      } else {
        console.log(`   ❌ ERRORE: ${text}`);
      }
    } catch (err: any) {
      console.log(`   💥 Eccezione: ${err.message}`);
    }
    console.log();
  }
}

testWithCorrectEndpoints();
