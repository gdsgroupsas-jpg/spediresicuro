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
  const { SpedisciOnlineAdapter } = await import(
    "../lib/adapters/couriers/spedisci-online"
  );
  const { decryptCredential, isEncrypted } = await import(
    "../lib/security/encryption"
  );
  // Import the NEW High-Fidelity Matrix
  const { PRICING_MATRIX } = await import("../lib/constants/pricing-matrix");

  console.log("🚀 VERIFY HIGH-FIDELITY MATRIX SYNC for:", TEST_EMAIL);

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

  // 2. Get Config & Decrypt
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

  let apiKey = config.api_key;
  if (isEncrypted(apiKey)) apiKey = decryptCredential(apiKey);

  // 3. INIT ADAPTER
  const adapter = new SpedisciOnlineAdapter({
    api_key: apiKey,
    base_url: config.base_url,
  });

  // 4. RUN SPREAD CHECK
  // We check ALL Zones defined in the Matrix, but only a few Sample Weights to be fast.
  const SAMPLE_WEIGHTS = [1, 10, 50, 105]; // Low, Mid, High, Over100
  const ZONES_TO_TEST = PRICING_MATRIX.ZONES;

  console.log(
    `ℹ️ [SCRIPT] FINAL CHECK: ${
      ZONES_TO_TEST.length
    } Zones @ Sample Weights [${SAMPLE_WEIGHTS.join(", ")}kg]`
  );

  const allRates: any[] = [];

  for (const zone of ZONES_TO_TEST) {
    for (const weight of SAMPLE_WEIGHTS) {
      process.stdout.write(`   📡 Probing: ${zone.name} @ ${weight}kg... `);

      const testParams = {
        packages: [{ length: 20, width: 20, height: 20, weight }],
        shipFrom: {
          name: "Mittente Probe",
          street1: "Via Roma 1",
          city: "Roma",
          state: "RM",
          postalCode: "00100",
          country: "IT",
          email: "probe@test.com",
        },
        shipTo: {
          name: "Destinatario Probe",
          street1: "Via Test 1",
          city: zone.sampleAddress.city,
          state: zone.sampleAddress.state,
          postalCode: zone.sampleAddress.postalCode,
          country: zone.sampleAddress.country,
          email: "receiver@probe.com",
        },
        notes: "High-Fi Probe",
        insuranceValue: 0,
        codValue: 0,
        accessoriServices: [],
      };

      try {
        const result = await adapter.getRates(testParams);
        if (result.success && result.rates) {
          console.log(`✅ Found: ${result.rates.length} rates`);
          allRates.push(
            ...result.rates.map((r) => ({
              ...r,
              _probe_zone: zone.code,
              _probe_city: zone.sampleAddress.city,
              _probe_weight: weight,
            }))
          );
        } else {
          console.log(`⚠️ No rates`);
        }
      } catch (e: any) {
        console.log(`❌ Error: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 200)); // fast pace
    }
  }

  // 5. Verification Output
  console.log(
    `\n🎉 Scan Complete. Captured ${allRates.length} total rate points.`
  );

  const ratesByCarrier: Record<string, any[]> = {};
  for (const rate of allRates) {
    if (!ratesByCarrier[rate.carrierCode]) {
      ratesByCarrier[rate.carrierCode] = [];
    }
    ratesByCarrier[rate.carrierCode].push(rate);
  }

  for (const [carrier, rates] of Object.entries(ratesByCarrier)) {
    console.log(`\n📦 Carrier: ${carrier.toUpperCase()}`);
    console.table(
      rates.map((r) => ({
        Zone: r._probe_zone,
        City: r._probe_city,
        Weight: `${r._probe_weight}kg`,
        Service: r.contractCode,
        Price: r.total_price,
      }))
    );
  }
}

main().catch(console.error);
