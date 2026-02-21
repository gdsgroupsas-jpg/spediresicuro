/**
 * Script: Debug DETTAGLIATO delle credenziali per ENTRAMBE le configurazioni
 *
 * Investiga perché "spedizioni prime" fallisce con 401
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

async function main() {
  console.log('═'.repeat(70));
  console.log('🔍 DEBUG DETTAGLIATO CREDENZIALI');
  console.log('═'.repeat(70));

  // Import dinamici
  const { decryptCredential, isEncrypted } = await import('../lib/security/encryption');
  const { SpedisciOnlineAdapter } = await import('../lib/adapters/couriers/spedisci-online');

  // Trova l'utente
  const { data: user } = await supabase.from('users').select('id').eq('email', TEST_EMAIL).single();

  if (!user) {
    console.log('❌ Utente non trovato');
    return;
  }

  // Trova TUTTE le configurazioni con TUTTI i campi
  const { data: configs } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('owner_user_id', user.id)
    .eq('provider_id', 'spedisci_online');

  console.log(`\n📡 Trovate ${configs?.length || 0} configurazioni\n`);

  for (const cfg of configs || []) {
    console.log('═'.repeat(70));
    console.log(`📦 CONFIG: ${cfg.name}`);
    console.log(`   ID: ${cfg.id}`);
    console.log('');

    // Mostra TUTTI i campi che potrebbero contenere credenziali
    console.log('📋 CAMPI DISPONIBILI:');
    console.log(`   - api_key presente: ${!!(cfg as any).api_key}`);
    console.log(`   - api_secret presente: ${!!(cfg as any).api_secret}`);
    console.log(`   - credentials presente: ${!!cfg.credentials}`);
    console.log(`   - credentials_encrypted presente: ${!!cfg.credentials_encrypted}`);

    if (cfg.credentials) {
      console.log(`   - credentials.api_key presente: ${!!cfg.credentials.api_key}`);
      console.log(`   - credentials.api_secret presente: ${!!cfg.credentials.api_secret}`);
      console.log(`   - credentials.base_url: ${cfg.credentials.base_url || 'non definito'}`);
    }

    // Prova a estrarre l'API key da vari posti
    let apiKey: string | null = null;
    let apiKeySource = '';

    // Metodo 1: api_key diretto
    if ((cfg as any).api_key) {
      apiKey = (cfg as any).api_key;
      apiKeySource = 'campo api_key diretto';
    }
    // Metodo 2: credentials.api_key
    else if (cfg.credentials?.api_key) {
      apiKey = cfg.credentials.api_key;
      apiKeySource = 'credentials.api_key';
    }
    // Metodo 3: credentials_encrypted
    else if (cfg.credentials_encrypted) {
      try {
        const decryptedStr = decryptCredential(cfg.credentials_encrypted);
        const decrypted = JSON.parse(decryptedStr);
        apiKey = decrypted.api_key;
        apiKeySource = 'credentials_encrypted (decriptato)';
      } catch (e: any) {
        console.log(`   ❌ Errore decrypt credentials_encrypted: ${e.message}`);
      }
    }

    if (!apiKey) {
      console.log('\n   ❌ API KEY NON TROVATA!');
      continue;
    }

    console.log(`\n   🔑 API Key trovata da: ${apiKeySource}`);

    // Verifica se è criptata
    const wasCrypted = isEncrypted(apiKey);
    console.log(`   🔐 Era criptata: ${wasCrypted ? 'SÌ' : 'NO'}`);

    if (wasCrypted) {
      try {
        apiKey = decryptCredential(apiKey);
        console.log(`   ✅ Decriptazione riuscita`);
      } catch (e: any) {
        console.log(`   ❌ Errore decriptazione: ${e.message}`);
        continue;
      }
    }

    console.log(`   📝 API Key (primi 15 char): ${apiKey.substring(0, 15)}...`);
    console.log(`   📏 Lunghezza API Key: ${apiKey.length}`);

    // Ora testa l'API
    console.log('\n   🌐 TEST CHIAMATA API...');

    try {
      const adapter = new SpedisciOnlineAdapter({
        api_key: apiKey,
        api_secret: cfg.credentials?.api_secret || (cfg as any).api_secret || '',
        base_url: cfg.credentials?.base_url || 'https://infinity.spedisci.online/api/v2',
        contract_mapping: cfg.credentials?.contract_mapping || {},
      });

      const result = await adapter.getRates({
        packages: [{ length: 30, width: 20, height: 15, weight: 2 }],
        shipFrom: {
          name: 'Test',
          street1: 'Via Roma 1',
          city: 'Roma',
          state: 'RM',
          postalCode: '00100',
          country: 'IT',
        },
        shipTo: {
          name: 'Test',
          street1: 'Via Milano 1',
          city: 'Milano',
          state: 'MI',
          postalCode: '20100',
          country: 'IT',
        },
        notes: 'Test',
      });

      if (result.success && result.rates) {
        console.log(`   ✅ API OK! ${result.rates.length} rates`);
        const carriers = [...new Set(result.rates.map((r) => r.carrierCode))];
        console.log(`   🚚 Corrieri: ${carriers.join(', ')}`);
      } else {
        console.log(`   ❌ API ERROR: ${result.error}`);
      }
    } catch (e: any) {
      console.log(`   ❌ EXCEPTION: ${e.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
}

main().catch(console.error);
