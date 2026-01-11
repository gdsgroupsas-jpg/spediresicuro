import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function toggleFeature(email: string, enable: boolean) {
  console.log(`🔍 Looking for user: ${email}...`);

  const { data: users, error: searchError } =
    await supabase.auth.admin.listUsers();

  if (searchError) {
    console.error("❌ Error listing users:", searchError.message);
    return;
  }

  // Find user by email (filtering client-side since listUsers doesn't support filter by email easily in all versions)
  const user = users.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    // Tip: listUsers returns paginated/limited list. For prod might need generic search.
    // simpler for this script: input ID directly if email search fails, but let's try.
    return;
  }

  console.log(`✅ User found: ${user.id} (${user.role})`);

  const currentMeta = user.user_metadata || {};
  const newMeta = {
    ...currentMeta,
    ai_can_manage_pricelists: enable,
  };

  console.log(`🔄 Updating metadata: ai_can_manage_pricelists = ${enable}...`);

  const { data: updatedUser, error: updateError } =
    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: newMeta,
    });

  if (updateError) {
    console.error("❌ Update failed:", updateError.message);
  } else {
    console.log("✨ Success! Feature updated.");
    console.log("New Metadata:", updatedUser.user.user_metadata);
  }
}

// CLI Args
const args = process.argv.slice(2);
const help = `
Usage: npx tsx scripts/enable_anne_features.ts <email> [true|false]

Example:
  npx tsx scripts/enable_anne_features.ts mario@rossi.it true
`;

if (args.length < 1) {
  console.log(help);
  process.exit(0);
}

const email = args[0];
const enable = args[1] === "false" ? false : true; // Default to true

toggleFeature(email, enable).catch(console.error);
