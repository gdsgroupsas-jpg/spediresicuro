import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// 1. Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Dynamic imports
  const { SpedisciOnlineAdapter } = await import(
    "../lib/adapters/couriers/spedisci-online"
  );
  const { createPriceList, addPriceListEntries } = await import(
    "../lib/db/price-lists"
  );
  const { decryptCredential, isEncrypted } = await import(
    "../lib/security/encryption"
  );

  console.log("🚀 REAL FORCE SYNC for:", TEST_EMAIL);

  // 1. Get User
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", TEST_EMAIL)
    .single();

  if (!user) {
    console.error("❌ User not found");
    return;
  }
  console.log("✅ User found:", user.id);

  // 2. Get Real Credentials
  const { data: config } = await supabase
    .from("courier_configs")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("provider_id", "spedisci_online")
    .single();

  if (!config) {
    console.error("❌ Config not found");
    return;
  }

  // 3. Decrypt Key
  const rawKey = config.api_key;
  let apiKey = rawKey;

  if (isEncrypted(rawKey)) {
    console.log("🔐 API Key is encrypted, decrypting...");
    try {
      apiKey = decryptCredential(rawKey);
      console.log("🔓 Decryption successful.");
    } catch (e: any) {
      console.error("❌ Decryption failed:", e.message);
      return;
    }
  } else {
    console.log("⚠️ API Key is NOT encrypted (Plain Text).");
  }

  // 4. Init Adapter (REAL)
  const adapter = new SpedisciOnlineAdapter({
    api_key: apiKey,
    base_url: config.base_url,
  });

  // Verify Connection (Non-blocking for debug)
  const isConnected = await adapter.connect();
  if (!isConnected) {
    console.warn("⚠️ Connection check failed. Proceeding anyway to debug...");
  } else {
    console.log("✅ Connection verified with Spedisci.Online API.");
  }

  // Debug: Manual Fetch to check what's wrong
  const apiUrl = config.base_url.endsWith("/")
    ? config.base_url
    : `${config.base_url}/`;
  console.log("🔍 DEBUG Fetching manually to:", `${apiUrl}shipping/rates`);

  try {
    const response = await fetch(`${apiUrl}shipping/rates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // Empty body to trigger validation error instead of 404
    });
    console.log("   Response Status:", response.status);
    const text = await response.text();
    console.log("   Response Text (First 200 chars):", text.substring(0, 200));
  } catch (e: any) {
    console.error("   Fetch Error:", e.message);
  }

  // 5. Fetch Rates (REAL API CALL)
  console.log("📡 Fetching REAL rates from Spedisci.Online API...");

  const testParams = {
    packages: [{ length: 30, width: 20, height: 15, weight: 2 }],
    shipFrom: {
      name: "Mittente Test",
      street1: "Via Roma 1",
      city: "Roma",
      state: "RM",
      postalCode: "00100",
      country: "IT",
      email: "test@example.com",
    },
    shipTo: {
      name: "Destinatario Test",
      street1: "Via Milano 2",
      city: "Milano",
      state: "MI",
      postalCode: "20100",
      country: "IT",
      email: "dest@example.com",
    },
    notes: "Test Real Sync",
    insuranceValue: 0,
    codValue: 0,
    accessoriServices: [],
  };

  const result = await adapter.getRates(testParams);

  if (!result.success || !result.rates) {
    console.error("❌ Failed to get rates:", result.error);
    return;
  }
  console.log(`✅ Received ${result.rates.length} rates from API.`);

  // 6. Save to DB
  const ratesByCarrier: Record<string, any[]> = {};
  for (const rate of result.rates) {
    if (!ratesByCarrier[rate.carrierCode]) {
      ratesByCarrier[rate.carrierCode] = [];
    }
    ratesByCarrier[rate.carrierCode].push(rate);
  }

  for (const [carrierCode, carrierRates] of Object.entries(ratesByCarrier)) {
    console.log(`\n📦 Syncing Carrier: ${carrierCode}`);

    const priceListName = `REAL SYNC: ${carrierCode.toUpperCase()} (${new Date().toLocaleTimeString()})`;

    // Check existing via local client
    const { data: existing } = await supabase
      .from("price_lists")
      .select("id")
      .eq("created_by", user.id)
      .eq("list_type", "supplier")
      .ilike("name", `%${carrierCode}%`)
      .maybeSingle();

    let listId;
    if (existing) {
      console.log(`   🔄 Updating existing list: ${existing.id}`);
      listId = existing.id;
      // Clean old entries
      await supabase
        .from("price_list_entries")
        .delete()
        .eq("price_list_id", listId);
    } else {
      const priceListData = {
        name: priceListName,
        version: "1.0",
        status: "active",
        courier_id: null,
        list_type: "supplier",
        is_global: false,
        source_type: "api",
        notes: `Real Sync from API`,
      } as any;
      const newList = await createPriceList(priceListData, user.id);
      console.log(`   ✅ Created New List: ${newList.id}`);
      listId = newList.id;
    }

    // Create Entries
    const entries = carrierRates.map((rate: any) => ({
      weight_from: 0,
      weight_to: 999.999,
      zone_code: "IT",
      base_price: parseFloat(rate.total_price),
      service_type: rate.contractCode.includes("fast") ? "express" : "standard",
      fuel_surcharge_percent: 0,
    }));

    // Use direct insert to bypass potential RLS in library
    const entriesWithListId = entries.map((e: any) => ({
      ...e,
      price_list_id: listId,
    }));
    const { error: insertError } = await supabase
      .from("price_list_entries")
      .insert(entriesWithListId);

    if (insertError) {
      console.error("❌ Error adding entries:", insertError.message);
    } else {
      console.log(`   ✅ Added ${entries.length} entries.`);
    }
  }
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(1);
});
