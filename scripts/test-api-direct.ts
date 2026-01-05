/**
 * Test DIRETTO delle API key con fetch raw
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const API_KEYS = {
  "speed go": "QIhMonA1fTY7J8nUsKHCrnClbrmXtvZ976gfoWhPZYHyMgIvESxwfYYCE0gj",
  "spedizioni prime":
    "c6HEnYYgJhxENVa0fd5CbG5evFZJXaS75GqnjGiEID7mgWIyJybX6wTwXFMc",
};

const BASE_URL = "https://infinity.spedisci.online/api/v2";

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

  for (const [name, key] of Object.entries(API_KEYS)) {
    await testDirectCall(name, key);
  }

  console.log(`\n${"═".repeat(60)}`);
}

main();
