import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { decryptCredential } from '../lib/security/encryption';

// Carica variabili ambiente da .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variabili d\'ambiente mancanti!');
  console.error('Richiesto: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('Assicurati di avere un file .env.local nella root del progetto');
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ENCRYPTION_KEY non configurata!');
  console.error('Impossibile testare decriptazione senza chiave di criptazione');
  console.error('Aggiungi ENCRYPTION_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDecrypt() {
  console.log('🔐 Test decriptazione credenziali Poste...\n');
  
  const { data: config, error } = await supabase
    .from('courier_configs')
    .select('id, name, api_key, api_secret')
    .eq('provider_id', 'poste')
    .eq('is_active', true)
    .single();
  
  if (error) {
    console.error('❌ Errore query:', error);
    if (error.code === 'PGRST116') {
      console.error('➡️  Nessuna configurazione Poste attiva trovata');
      console.error('➡️  Configura Poste via UI: /dashboard/integrazioni');
    }
    return;
  }
  
  if (!config) {
    console.error('❌ Nessuna config attiva');
    return;
  }
  
  console.log('📋 Configurazione trovata:', config.name);
  console.log('ID:', config.id);
  console.log('');
  
  // Test decriptazione API Key
  if (config.api_key) {
    try {
      const clientId = decryptCredential(config.api_key);
      console.log('✅ API Key decriptata con successo');
      console.log('Client ID (primi 15 caratteri):', clientId.substring(0, 15) + '...');
      console.log('Lunghezza totale:', clientId.length, 'caratteri');
    } catch (error: any) {
      console.error('❌ Errore decriptazione API Key:', error.message);
      console.error('   Possibili cause:');
      console.error('   - ENCRYPTION_KEY diversa da quella usata per criptare');
      console.error('   - Formato dati corrotto');
      console.error('   - Credenziale non criptata (testo in chiaro)');
    }
  } else {
    console.warn('⚠️  API Key mancante');
  }
  
  console.log('');
  
  // Test decriptazione API Secret
  if (config.api_secret) {
    try {
      const clientSecret = decryptCredential(config.api_secret);
      console.log('✅ API Secret decriptata con successo');
      console.log('Client Secret (primi 15 caratteri):', clientSecret.substring(0, 15) + '...');
      console.log('Lunghezza totale:', clientSecret.length, 'caratteri');
    } catch (error: any) {
      console.error('❌ Errore decriptazione API Secret:', error.message);
      console.error('   Possibili cause:');
      console.error('   - ENCRYPTION_KEY diversa da quella usata per criptare');
      console.error('   - Formato dati corrotto');
      console.error('   - Credenziale non criptata (testo in chiaro)');
    }
  } else {
    console.warn('⚠️  API Secret mancante');
  }
  
  console.log('');
  console.log('✅ Test decriptazione completato');
}

testDecrypt()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore durante test:', error);
    process.exit(1);
  });

