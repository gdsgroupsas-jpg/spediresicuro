/**
 * Script per verificare configurazioni Poste nel database
 * Esegue query SQL direttamente tramite Supabase client
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Carica variabili da .env.local manualmente
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

loadEnvFile();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Variabili d'ambiente mancanti!");
  console.error('Richiesto: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('Assicurati di avere un file .env.local nella root del progetto');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryPosteConfig() {
  console.log('🔍 Verifica configurazione Poste Italiane nel DB...\n');

  try {
    // Query per configurazioni Poste
    const { data: configs, error } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('provider_id', 'poste')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Errore query:', error);
      console.error('   Codice:', error.code);
      console.error('   Messaggio:', error.message);
      return;
    }

    if (!configs || configs.length === 0) {
      console.error('❌ Nessuna configurazione Poste trovata!');
      console.log('\n➡️  Devi configurare Poste via UI: /dashboard/integrazioni');
      console.log('   Oppure crea una configurazione tramite il wizard PosteWizard');
      return;
    }

    console.log(`✅ Trovate ${configs.length} configurazioni Poste\n`);

    configs.forEach((config, i) => {
      console.log(`--- Configurazione ${i + 1} ---`);
      console.log('ID:', config.id);
      console.log('Nome:', config.name);
      console.log('Provider ID:', config.provider_id);
      console.log('Base URL:', config.base_url);
      console.log('Attiva:', config.is_active ? '✅' : '❌');
      console.log('Default:', config.is_default ? '✅' : '❌');
      console.log(
        'API Key:',
        config.api_key ? `✅ Presente (${config.api_key.length} caratteri)` : '❌ Mancante'
      );
      console.log(
        'API Secret:',
        config.api_secret ? `✅ Presente (${config.api_secret.length} caratteri)` : '❌ Mancante'
      );

      // Verifica formato criptato
      if (config.api_key) {
        const isEncrypted = config.api_key.includes(':');
        console.log('API Key criptata:', isEncrypted ? '✅ Sì' : '⚠️  No (testo in chiaro)');
      }
      if (config.api_secret) {
        const isEncrypted = config.api_secret.includes(':');
        console.log('API Secret criptato:', isEncrypted ? '✅ Sì' : '⚠️  No (testo in chiaro)');
      }

      // Contract mapping
      if (config.contract_mapping) {
        const mapping =
          typeof config.contract_mapping === 'string'
            ? JSON.parse(config.contract_mapping)
            : config.contract_mapping;
        console.log('CDC:', mapping.cdc || 'Non specificato');
        console.log('Contract Mapping completo:', JSON.stringify(mapping, null, 2));
      } else {
        console.log('Contract Mapping: Non configurato');
      }

      console.log('Creato:', config.created_at);
      console.log('Aggiornato:', config.updated_at);
      console.log('Creato da:', config.created_by || 'N/A');
      console.log('Descrizione:', config.description || 'N/A');
      console.log('');
    });

    // Verifica configurazione attiva
    const activeConfigs = configs.filter((c) => c.is_active);
    if (activeConfigs.length === 0) {
      console.error('\n⚠️  ATTENZIONE: Nessuna configurazione Poste ATTIVA!');
      console.log('➡️  Vai su /dashboard/integrazioni e attiva la configurazione');
    } else {
      console.log(`\n✅ ${activeConfigs.length} configurazione/i attiva/e trovata/e`);
      activeConfigs.forEach((c) => console.log(`   - ${c.name} (${c.id})`));
    }

    // Verifica configurazione default
    const defaultConfigs = configs.filter((c) => c.is_default);
    if (defaultConfigs.length === 0) {
      console.warn('\n⚠️  ATTENZIONE: Nessuna configurazione Poste DEFAULT!');
      console.log('➡️  Imposta una configurazione come default per il fallback');
    } else {
      console.log(`\n✅ ${defaultConfigs.length} configurazione/i default trovata/e`);
      defaultConfigs.forEach((c) => console.log(`   - ${c.name} (${c.id})`));
    }

    // Riepilogo
    console.log('\n📊 Riepilogo:');
    console.log(`   Totale configurazioni: ${configs.length}`);
    console.log(`   Attive: ${activeConfigs.length}`);
    console.log(`   Default: ${defaultConfigs.length}`);
    console.log(
      `   Con CDC configurato: ${
        configs.filter((c) => {
          if (!c.contract_mapping) return false;
          const mapping =
            typeof c.contract_mapping === 'string'
              ? JSON.parse(c.contract_mapping)
              : c.contract_mapping;
          return !!mapping.cdc;
        }).length
      }`
    );
  } catch (error: any) {
    console.error('\n❌ Errore durante verifica:', error);
    console.error('   Stack:', error.stack);
  }
}

queryPosteConfig()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });
