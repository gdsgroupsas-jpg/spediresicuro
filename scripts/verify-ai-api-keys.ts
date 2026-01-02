#!/usr/bin/env tsx
/**
 * Script per verificare se le API keys AI sono configurate
 * Verifica sia locale (.env.local) che produzione (variabili d'ambiente)
 */

import { config } from "dotenv";
import { resolve } from "path";

// Carica .env.local se esiste
config({ path: resolve(process.cwd(), ".env.local") });

console.log("🔍 Verifica API Keys AI Provider\n");
console.log("═".repeat(50));

// Verifica ANTHROPIC_API_KEY
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const anthropicStatus = anthropicKey ? "✅ CONFIGURATA" : "❌ NON CONFIGURATA";
const anthropicLength = anthropicKey?.length || 0;
const anthropicPrefix = anthropicKey?.substring(0, 15) || "N/A";

console.log("\n📦 ANTHROPIC_API_KEY:");
console.log(`   Status: ${anthropicStatus}`);
if (anthropicKey) {
  console.log(`   Lunghezza: ${anthropicLength} caratteri`);
  console.log(`   Prefisso: ${anthropicPrefix}...`);
  console.log(
    `   Formato: ${
      anthropicKey.startsWith("sk-ant-")
        ? "✅ Corretto"
        : "⚠️ Formato non standard"
    }`
  );
} else {
  console.log("   ⚠️  Aggiungi ANTHROPIC_API_KEY a .env.local o Vercel");
}

// Verifica DEEPSEEK_API_KEY
const deepseekKey = process.env.DEEPSEEK_API_KEY;
const deepseekStatus = deepseekKey ? "✅ CONFIGURATA" : "❌ NON CONFIGURATA";
const deepseekLength = deepseekKey?.length || 0;
const deepseekPrefix = deepseekKey?.substring(0, 15) || "N/A";

console.log("\n📦 DEEPSEEK_API_KEY:");
console.log(`   Status: ${deepseekStatus}`);
if (deepseekKey) {
  console.log(`   Lunghezza: ${deepseekLength} caratteri`);
  console.log(`   Prefisso: ${deepseekPrefix}...`);
  console.log(
    `   Formato: ${
      deepseekKey.startsWith("sk-") ? "✅ Corretto" : "⚠️ Formato non standard"
    }`
  );
} else {
  console.log("   ⚠️  Aggiungi DEEPSEEK_API_KEY a .env.local o Vercel");
}

// Verifica GOOGLE_API_KEY (Gemini)
const googleKey = process.env.GOOGLE_API_KEY;
const googleStatus = googleKey ? "✅ CONFIGURATA" : "❌ NON CONFIGURATA";
const googleLength = googleKey?.length || 0;
const googlePrefix = googleKey?.substring(0, 15) || "N/A";

console.log("\n📦 GOOGLE_API_KEY (Gemini):");
console.log(`   Status: ${googleStatus}`);
if (googleKey) {
  console.log(`   Lunghezza: ${googleLength} caratteri`);
  console.log(`   Prefisso: ${googlePrefix}...`);
  console.log(
    `   Formato: ${
      googleKey.length > 20 ? "✅ Sembra valida" : "⚠️ Formato non standard"
    }`
  );
} else {
  console.log("   ⚠️  Aggiungi GOOGLE_API_KEY a .env.local o Vercel");
}

// Riepilogo
console.log("\n" + "═".repeat(50));
console.log("📊 RIEPILOGO:\n");

const providers = [
  { name: "Anthropic Claude", key: anthropicKey, status: !!anthropicKey },
  { name: "DeepSeek", key: deepseekKey, status: !!deepseekKey },
  { name: "Google Gemini", key: googleKey, status: !!googleKey },
];

providers.forEach((provider) => {
  const icon = provider.status ? "✅" : "❌";
  console.log(
    `   ${icon} ${provider.name}: ${
      provider.status ? "Disponibile" : "Non disponibile"
    }`
  );
});

console.log("\n💡 NOTA:");
console.log("   - Locale: Verifica .env.local nella root del progetto");
console.log(
  "   - Produzione: Verifica Vercel Dashboard > Settings > Environment Variables"
);
console.log(
  "   - Il componente UI mostra lo stato delle API keys in /dashboard/super-admin\n"
);

// Exit code
const allConfigured = anthropicKey && deepseekKey && googleKey;
const atLeastOne = anthropicKey || deepseekKey || googleKey;

if (!atLeastOne) {
  console.log("⚠️  Nessuna API key configurata! Anne non funzionerà.");
  process.exit(1);
} else if (!allConfigured) {
  console.log(
    "⚠️  Alcune API keys mancanti. Alcuni provider non saranno disponibili."
  );
  process.exit(0);
} else {
  console.log("✅ Tutte le API keys configurate correttamente!");
  process.exit(0);
}
