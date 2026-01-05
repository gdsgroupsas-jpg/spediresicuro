import dotenv from "dotenv";
import path from "path";

// 1. Load envs FIRST
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Helper to check env
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

// 2. Wrap verification in async function to use dynamic imports
async function runTest() {
  console.log(
    "🧪 Starting Multi-Account Logic Verification (Dynamic Import Mode)..."
  );

  // Dynamic imports ensure env vars are present before client.ts is evaluated
  const { supabaseAdmin } = await import("@/lib/db/client");
  const { getShippingProvider, getCourierConfigForUser } = await import(
    "@/lib/couriers/factory"
  );
  const { SpedisciOnlineAdapter } = await import(
    "@/lib/adapters/couriers/spedisci-online"
  );

  // 1. Get the test user (reseller account)
  const TEST_EMAIL = "testspediresicuro+postaexpress@gmail.com";
  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("email", TEST_EMAIL)
    .single();

  if (userError || !user) {
    console.error("❌ Could not find a test user:", userError);
    process.exit(1);
  }
  console.log(`👤 Test User: ${user.email} (${user.id})`);

  // 2. Get a real courier config for this user (or any valid config)
  const { data: config, error: configError } = await supabaseAdmin
    .from("courier_configs")
    .select("*")
    .eq("provider_id", "spedisci_online")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (configError || !config) {
    console.error("❌ No Spedisci.Online config found to test with.");
    console.log("Skipping verification as no data available.");
    process.exit(0);
  }

  console.log(`📝 Using Configuration: ${config.name} (${config.id})`);

  // 3. Test getCourierConfigForUser with Explicit ID
  console.log("\n--- Test 1: getCourierConfigForUser (Explicit ID) ---");
  const fetchedConfig = await getCourierConfigForUser(
    user.id,
    "spedisci_online",
    config.id
  );

  if (fetchedConfig && fetchedConfig.id === config.id) {
    console.log("✅ Success: Fetched specific configuration by ID.");
  } else {
    console.error("❌ Failed: Could not fetch specific configuration.");
    console.log("Fetched:", fetchedConfig ? fetchedConfig.id : "null");
    process.exit(1);
  }

  // 4. Test getShippingProvider with Explicit ID
  console.log("\n--- Test 2: getShippingProvider (Explicit ID) ---");
  try {
    const provider = await getShippingProvider(
      user.id,
      "spedisci_online",
      undefined,
      config.id
    );

    // Relaxed check: check constructor name instead of instanceof to avoid dynamic import identity issues
    if (
      provider &&
      (provider instanceof SpedisciOnlineAdapter ||
        provider.constructor.name === "SpedisciOnlineAdapter")
    ) {
      console.log("✅ Success: Factory instantiated SpedisciOnlineAdapter.");
      console.log("✅ Provider instantiation successful.");
    } else {
      console.error("❌ Failed: Factory returned null or wrong type.");
      console.log("Returned:", provider ? provider.constructor.name : "null");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Exception in getShippingProvider:", err);
    process.exit(1);
  }

  console.log("\n🎉 ALL TESTS PASSED: Multi-Account Logic is Solid.");
}

runTest().catch(console.error);
