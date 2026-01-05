/**
 * Script Node.js per creare utente di test in Supabase
 *
 * Questo script può essere usato come alternativa allo script SQL
 * se preferisci usare Node.js invece di SQL diretto.
 *
 * Uso:
 *   node scripts/create-test-user-supabase.js
 */

// Carica variabili d'ambiente da .env.local
require("dotenv").config({ path: ".env.local" });
// Prova anche .env se .env.local non esiste
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");

// Configurazione Supabase (usa variabili d'ambiente)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Errore: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere configurati"
  );
  console.error("");
  console.error("   Variabili trovate:");
  console.error(
    "   - NEXT_PUBLIC_SUPABASE_URL:",
    supabaseUrl ? "✅ Configurato" : "❌ Mancante"
  );
  console.error(
    "   - SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceKey ? "✅ Configurato" : "❌ Mancante"
  );
  console.error("");
  console.error("   Aggiungi queste variabili al tuo .env.local:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key");
  console.error("");
  console.error(
    "   Oppure usa lo script SQL direttamente in Supabase Dashboard."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUser() {
  const testEmail = "testspediresicuro+postaexpress@gmail.com";
  const testPassword = "Striano1382-";

  // Genera hash password
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  console.log("🔐 Hash password generato");
  console.log("📧 Email:", testEmail);
  console.log("🔑 Password:", testPassword);
  console.log("");

  // Verifica se l'utente esiste già
  const { data: existingUser } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", testEmail)
    .single();

  if (existingUser) {
    console.log(
      "⚠️  Utente testspediresicuro+postaexpress@gmail.com esiste già. Aggiornamento..."
    );

    const { data, error } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        name: "Test User E2E",
        role: "user",
        provider: "credentials",
        updated_at: new Date().toISOString(),
      })
      .eq("email", testEmail)
      .select()
      .single();

    if (error) {
      console.error("❌ Errore aggiornamento utente:", error);
      process.exit(1);
    }

    console.log("✅ Utente aggiornato con successo!");
    console.log("   ID:", data.id);
  } else {
    console.log("➕ Creazione nuovo utente di test...");

    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          email: testEmail,
          password: hashedPassword,
          name: "Test User E2E",
          role: "user",
          provider: "credentials",
          account_type: "user",
          is_reseller: false,
          wallet_balance: 0.0,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("❌ Errore creazione utente:", error);
      process.exit(1);
    }

    console.log("✅ Utente creato con successo!");
    console.log("   ID:", data.id);
  }

  console.log("");
  console.log("📋 Credenziali utente di test:");
  console.log("   Email: testspediresicuro+postaexpress@gmail.com");
  console.log("   Password: Striano1382-");
  console.log("");
  console.log(
    "⚠️  IMPORTANTE: Questo è l'account reseller di produzione per test!"
  );
  console.log("   Non usare in produzione.");
}

createTestUser().catch((error) => {
  console.error("❌ Errore:", error);
  process.exit(1);
});
