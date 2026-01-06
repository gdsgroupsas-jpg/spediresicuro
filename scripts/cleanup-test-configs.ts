import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const CONFIGS_TO_DELETE = [
  "Test Config 1",
  "Test Config 2",
  "spedizioni prime",
  "speed go",
];

async function main() {
  console.log("🧹 Starting cleanup of test configurations...");
  console.log(`Targeting names: ${CONFIGS_TO_DELETE.join(", ")}`);

  // 1. Find them first to log what we are deleting
  const { data: found, error: findError } = await supabase
    .from("courier_configs")
    .select("id, name, created_by, owner_user_id")
    .in("name", CONFIGS_TO_DELETE);

  if (findError) {
    console.error("❌ Error finding configs:", findError.message);
    return;
  }

  if (!found || found.length === 0) {
    console.log("✅ No test configs found. Database is already clean.");
    return;
  }

  console.log(`\nFound ${found.length} configurations to delete:`);
  found.forEach((c) => {
    console.log(
      `- [${c.id}] "${c.name}" (Owner: ${c.created_by || "Unknown"})`
    );
  });

  // 2. Delete them
  const { error: deleteError } = await supabase
    .from("courier_configs")
    .delete()
    .in("name", CONFIGS_TO_DELETE);

  if (deleteError) {
    console.error("❌ Error deleting configs:", deleteError.message);
  } else {
    console.log(`\n✅ Successfully deleted ${found.length} configurations.`);
  }
}

main().catch(console.error);
