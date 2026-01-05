import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { decryptCredential } from "../lib/security/encryption";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function show() {
  const { data: configs } = await supabase
    .from("courier_configs")
    .select("id, name, api_key")
    .eq("owner_user_id", "904dc243-e9da-408d-8c0b-5dbe2a48b739")
    .eq("provider_id", "spedisci_online");

  for (const cfg of configs || []) {
    const decrypted = decryptCredential((cfg as any).api_key);
    console.log("Config:", cfg.name);
    console.log("API Key:", decrypted);
    console.log("---");
  }
}

show();
