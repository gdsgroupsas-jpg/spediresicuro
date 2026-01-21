import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Carica variabili ambiente da .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variabili d'ambiente mancanti!");
  console.error('Richiesto: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('Assicurati di avere un file .env.local nella root del progetto');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPosteConfig() {
  console.log('🔍 Verifica configurazione Poste Italiane nel DB...\n');

  // 1. Cerca configurazioni Poste
  const { data: configs, error } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('provider_id', 'poste');

  if (error) {
    console.error('❌ Errore query:', error);
    return;
  }

  if (!configs || configs.length === 0) {
    console.error('❌ Nessuna configurazione Poste trovata!');
    console.log('➡️  Devi configurare Poste via UI: /dashboard/integrazioni');
    return;
  }

  console.log(`✅ Trovate ${configs.length} configurazioni Poste`);

  configs.forEach((config, i) => {
    console.log(`\n--- Configurazione ${i + 1} ---`);
    console.log('ID:', config.id);
    console.log('Nome:', config.name);
    console.log('Provider ID:', config.provider_id);
    console.log('Base URL:', config.base_url);
    console.log('Attiva:', config.is_active ? '✅' : '❌');
    console.log('Default:', config.is_default ? '✅' : '❌');
    console.log('API Key (criptato):', config.api_key ? '✅ Presente' : '❌ Mancante');
    console.log('API Secret (criptato):', config.api_secret ? '✅ Presente' : '❌ Mancante');

    if (config.contract_mapping) {
      const mapping =
        typeof config.contract_mapping === 'string'
          ? JSON.parse(config.contract_mapping)
          : config.contract_mapping;
      console.log('CDC:', mapping.cdc || 'Non specificato');
    }

    console.log('Creato:', config.created_at);
    console.log('Aggiornato:', config.updated_at);
    console.log('Creato da:', config.created_by || 'N/A');
  });

  // 2. Verifica configurazione attiva
  const activeConfig = configs.find((c) => c.is_active);
  if (!activeConfig) {
    console.error('\n⚠️  ATTENZIONE: Nessuna configurazione Poste ATTIVA!');
    console.log('➡️  Vai su /dashboard/integrazioni e attiva la configurazione');
  } else {
    console.log('\n✅ Configurazione attiva trovata:', activeConfig.name);
  }

  // 3. Verifica configurazione default
  const defaultConfig = configs.find((c) => c.is_default);
  if (!defaultConfig) {
    console.warn('\n⚠️  ATTENZIONE: Nessuna configurazione Poste DEFAULT!');
    console.log('➡️  Imposta una configurazione come default per il fallback');
  } else {
    console.log('✅ Configurazione default trovata:', defaultConfig.name);
  }
}

checkPosteConfig()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore durante verifica:', error);
    process.exit(1);
  });
