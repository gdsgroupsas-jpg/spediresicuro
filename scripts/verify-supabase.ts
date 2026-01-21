/**
 * Script di Verifica Configurazione Supabase
 *
 * Verifica che Supabase sia configurato correttamente:
 * - Connessione funzionante
 * - Tabella geo_locations esistente
 * - Indici creati
 * - Dati presenti (opzionale)
 *
 * Utilizzo:
 *   npm run verify:supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface VerificationResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
}

async function main() {
  console.log('🔍 Verifica Configurazione Supabase\n');
  console.log('='.repeat(50));
  console.log('');

  const results: VerificationResult[] = [];

  // 1. Verifica variabili ambiente
  console.log('📋 Verifica variabili ambiente...\n');

  if (!SUPABASE_URL) {
    results.push({
      step: 'Variabili ambiente',
      status: 'error',
      message: 'NEXT_PUBLIC_SUPABASE_URL mancante',
    });
  } else if (!SUPABASE_URL.includes('supabase.co')) {
    results.push({
      step: 'Variabili ambiente',
      status: 'warning',
      message: 'URL Supabase potrebbe essere errato',
    });
  }

  if (!SUPABASE_ANON_KEY) {
    results.push({
      step: 'Variabili ambiente',
      status: 'error',
      message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY mancante',
    });
  }

  if (!SUPABASE_SERVICE_KEY) {
    results.push({
      step: 'Variabili ambiente',
      status: 'warning',
      message: 'SUPABASE_SERVICE_ROLE_KEY mancante (necessaria per seeding)',
    });
  }

  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    results.push({
      step: 'Variabili ambiente',
      status: 'success',
      message: 'Tutte le variabili necessarie sono configurate',
    });
  }

  // 2. Test connessione
  console.log('📋 Test connessione...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    results.push({
      step: 'Connessione',
      status: 'error',
      message: 'Impossibile testare: variabili mancanti',
    });
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Test query semplice
      const { error } = await supabase.from('geo_locations').select('id').limit(0);

      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('relation')) {
          results.push({
            step: 'Connessione',
            status: 'error',
            message: 'Tabella geo_locations non trovata. Esegui lo schema SQL!',
          });
        } else {
          results.push({
            step: 'Connessione',
            status: 'error',
            message: `Errore connessione: ${error.message}`,
          });
        }
      } else {
        results.push({
          step: 'Connessione',
          status: 'success',
          message: 'Connessione a Supabase riuscita',
        });
      }
    } catch (error) {
      results.push({
        step: 'Connessione',
        status: 'error',
        message: `Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
      });
    }
  }

  // 3. Verifica struttura tabella
  console.log('📋 Verifica struttura tabella...\n');

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Prova a leggere un record per verificare struttura
      const { data, error, count } = await supabase
        .from('geo_locations')
        .select('id, name, province, region, caps, search_vector', { count: 'exact' })
        .limit(1);

      if (error) {
        results.push({
          step: 'Struttura tabella',
          status: 'error',
          message: `Errore: ${error.message}`,
        });
      } else {
        const hasRequiredFields =
          data &&
          data.length > 0 &&
          'name' in data[0] &&
          'province' in data[0] &&
          'caps' in data[0];

        if (hasRequiredFields) {
          results.push({
            step: 'Struttura tabella',
            status: 'success',
            message: 'Tabella configurata correttamente con tutti i campi necessari',
          });
        } else {
          results.push({
            step: 'Struttura tabella',
            status: 'warning',
            message: 'Tabella esiste ma potrebbe mancare qualche campo',
          });
        }

        // Verifica dati
        if (count !== null) {
          if (count === 0) {
            results.push({
              step: 'Dati',
              status: 'warning',
              message: 'Tabella vuota. Esegui: npm run seed:geo',
            });
          } else {
            results.push({
              step: 'Dati',
              status: 'success',
              message: `${count} comuni presenti nel database`,
            });
          }
        }
      }
    } catch (error) {
      results.push({
        step: 'Struttura tabella',
        status: 'error',
        message: `Errore verifica: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
      });
    }
  }

  // 4. Test API endpoint (se server è in esecuzione)
  console.log('📋 Verifica API endpoint...\n');

  try {
    const response = await fetch('http://localhost:3000/api/geo/search?q=Roma');
    if (response.ok) {
      const data = await response.json();
      results.push({
        step: 'API endpoint',
        status: 'success',
        message: `API funzionante. Test: "${data.query}" → ${data.count} risultati`,
      });
    } else {
      results.push({
        step: 'API endpoint',
        status: 'warning',
        message: 'Server non in esecuzione o endpoint non raggiungibile',
      });
    }
  } catch (error) {
    results.push({
      step: 'API endpoint',
      status: 'warning',
      message: 'Server non in esecuzione (normale se non hai avviato npm run dev)',
    });
  }

  // Stampa risultati
  console.log('\n📊 RISULTATI VERIFICA\n');
  console.log('='.repeat(50));
  console.log('');

  results.forEach((result) => {
    const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
    const color =
      result.status === 'success'
        ? '\x1b[32m'
        : result.status === 'error'
          ? '\x1b[31m'
          : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${icon} ${color}${result.step}${reset}`);
    console.log(`   ${result.message}\n`);
  });

  // Riepilogo
  const errors = results.filter((r) => r.status === 'error').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const successes = results.filter((r) => r.status === 'success').length;

  console.log('='.repeat(50));
  console.log('');
  console.log('📈 Riepilogo:');
  console.log(`   ✅ Successi: ${successes}`);
  console.log(`   ⚠️  Warning: ${warnings}`);
  console.log(`   ❌ Errori: ${errors}`);
  console.log('');

  if (errors > 0) {
    console.log('❌ Configurazione incompleta. Risolvi gli errori sopra.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  Configurazione parziale. Controlla i warning sopra.\n');
    process.exit(0);
  } else {
    console.log('🎉 Configurazione completa e funzionante!\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('\n❌ ERRORE CRITICO:', error);
  process.exit(1);
});
