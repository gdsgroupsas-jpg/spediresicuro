/**
 * Script Completo di Verifica Database Supabase
 * 
 * Verifica completa della configurazione Supabase per SpedireSicuro:
 * - Variabili ambiente
 * - Connessione al database
 * - Tabelle necessarie (shipments, users, user_profiles)
 * - Test query per Annie AI
 * 
 * Utilizzo:
 *   npm run verify:db
 *   oppure
 *   npx tsx scripts/verifica-database-completo.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carica variabili ambiente
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CheckResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

async function main() {
  console.log('\n🔍 VERIFICA COMPLETA DATABASE SUPABASE\n');
  console.log('='.repeat(60));
  console.log('');

  const results: CheckResult[] = [];

  // ============================================
  // 1. VERIFICA VARIABILI AMBIENTE
  // ============================================
  console.log('📋 STEP 1: Verifica variabili ambiente...\n');

  const envChecks = {
    url: { present: !!SUPABASE_URL, valid: false },
    anonKey: { present: !!SUPABASE_ANON_KEY, valid: false },
    serviceKey: { present: !!SUPABASE_SERVICE_KEY, valid: false },
  };

  // Verifica URL
  if (!SUPABASE_URL) {
    results.push({
      step: 'Variabili ambiente - URL',
      status: 'error',
      message: '❌ NEXT_PUBLIC_SUPABASE_URL mancante',
      details: 'Aggiungi questa variabile in .env.local o su Vercel',
    });
  } else if (!SUPABASE_URL.includes('supabase.co')) {
    results.push({
      step: 'Variabili ambiente - URL',
      status: 'error',
      message: '❌ URL Supabase non valido',
      details: `URL trovato: ${SUPABASE_URL.substring(0, 30)}... (dovrebbe contenere "supabase.co")`,
    });
  } else if (SUPABASE_URL.includes('xxxxxxxx')) {
    results.push({
      step: 'Variabili ambiente - URL',
      status: 'error',
      message: '❌ URL Supabase è un placeholder',
      details: 'Sostituisci il placeholder con il tuo URL reale da Supabase Dashboard',
    });
  } else {
    envChecks.url.valid = true;
    results.push({
      step: 'Variabili ambiente - URL',
      status: 'success',
      message: `✅ URL configurato: ${SUPABASE_URL.substring(0, 30)}...`,
    });
  }

  // Verifica Anon Key
  if (!SUPABASE_ANON_KEY) {
    results.push({
      step: 'Variabili ambiente - Anon Key',
      status: 'error',
      message: '❌ NEXT_PUBLIC_SUPABASE_ANON_KEY mancante',
      details: 'Aggiungi questa variabile in .env.local o su Vercel',
    });
  } else if (SUPABASE_ANON_KEY.includes('placeholder')) {
    results.push({
      step: 'Variabili ambiente - Anon Key',
      status: 'error',
      message: '❌ Anon Key è un placeholder',
      details: 'Sostituisci il placeholder con la tua chiave reale da Supabase Dashboard → Settings → API',
    });
  } else if (SUPABASE_ANON_KEY.length < 100) {
    results.push({
      step: 'Variabili ambiente - Anon Key',
      status: 'warning',
      message: '⚠️ Anon Key sembra troppo corta',
      details: 'Verifica che sia la chiave completa da Supabase Dashboard',
    });
  } else {
    envChecks.anonKey.valid = true;
    results.push({
      step: 'Variabili ambiente - Anon Key',
      status: 'success',
      message: '✅ Anon Key configurata correttamente',
    });
  }

  // Verifica Service Key
  if (!SUPABASE_SERVICE_KEY) {
    results.push({
      step: 'Variabili ambiente - Service Key',
      status: 'warning',
      message: '⚠️ SUPABASE_SERVICE_ROLE_KEY mancante',
      details: 'Necessaria per operazioni admin e per Annie AI. Aggiungila in .env.local o su Vercel',
    });
  } else if (SUPABASE_SERVICE_KEY.includes('placeholder')) {
    results.push({
      step: 'Variabili ambiente - Service Key',
      status: 'error',
      message: '❌ Service Key è un placeholder',
      details: 'Sostituisci il placeholder con la tua chiave reale da Supabase Dashboard → Settings → API → Service Role',
    });
  } else {
    envChecks.serviceKey.valid = true;
    results.push({
      step: 'Variabili ambiente - Service Key',
      status: 'success',
      message: '✅ Service Key configurata correttamente',
    });
  }

  // Se mancano variabili critiche, ferma qui
  if (!envChecks.url.valid || !envChecks.anonKey.valid) {
    console.log('\n❌ Configurazione incompleta. Risolvi gli errori sopra prima di continuare.\n');
    printResults(results);
    process.exit(1);
  }

  // ============================================
  // 2. TEST CONNESSIONE
  // ============================================
  console.log('\n📋 STEP 2: Test connessione a Supabase...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    results.push({
      step: 'Connessione',
      status: 'error',
      message: '❌ Impossibile testare: variabili mancanti',
    });
  } else {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Test connessione base (query semplice)
      const { error: healthError } = await supabase
        .from('shipments')
        .select('id')
        .limit(0);

      if (healthError) {
        if (healthError.code === '42P01') {
          // Tabella non esiste
          results.push({
            step: 'Connessione',
            status: 'success',
            message: '✅ Connessione a Supabase riuscita',
            details: 'La tabella shipments non esiste ancora (normale se non hai eseguito le migration)',
          });
        } else if (healthError.code === 'PGRST116') {
          // Nessun risultato (tabella vuota o non accessibile)
          results.push({
            step: 'Connessione',
            status: 'success',
            message: '✅ Connessione a Supabase riuscita',
            details: 'Tabella shipments accessibile ma vuota',
          });
        } else {
          results.push({
            step: 'Connessione',
            status: 'error',
            message: `❌ Errore connessione: ${healthError.message}`,
            details: {
              code: healthError.code,
              hint: healthError.hint,
            },
          });
        }
      } else {
        results.push({
          step: 'Connessione',
          status: 'success',
          message: '✅ Connessione a Supabase riuscita',
        });
      }
    } catch (error) {
      results.push({
        step: 'Connessione',
        status: 'error',
        message: `❌ Errore: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
        details: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  // ============================================
  // 3. VERIFICA TABELLE NECESSARIE
  // ============================================
  console.log('\n📋 STEP 3: Verifica tabelle necessarie...\n');

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Tabella shipments (CRITICA per Annie AI)
    try {
      const { data, error, count } = await supabase
        .from('shipments')
        .select('id, tracking_number, status, user_id, created_at', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          results.push({
            step: 'Tabella shipments',
            status: 'error',
            message: '❌ Tabella shipments NON esiste',
            details: {
              action: 'Esegui la migration SQL per creare la tabella',
              location: 'Supabase Dashboard → SQL Editor',
              sqlFile: 'supabase/migrations/001_complete_schema.sql (o equivalente)',
            },
          });
        } else {
          results.push({
            step: 'Tabella shipments',
            status: 'error',
            message: `❌ Errore accesso tabella shipments: ${error.message}`,
            details: {
              code: error.code,
              hint: error.hint,
            },
          });
        }
      } else {
        const shipmentCount = count || 0;
        results.push({
          step: 'Tabella shipments',
          status: 'success',
          message: `✅ Tabella shipments esiste${shipmentCount > 0 ? ` con ${shipmentCount} spedizioni` : ' (vuota)'}`,
          details: shipmentCount > 0 ? `Ultima spedizione: ${data?.[0]?.tracking_number || 'N/A'}` : undefined,
        });
      }
    } catch (error) {
      results.push({
        step: 'Tabella shipments',
        status: 'error',
        message: `❌ Errore verifica: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
      });
    }

    // Tabella users (opzionale ma utile)
    try {
      const { error, count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          results.push({
            step: 'Tabella users',
            status: 'warning',
            message: '⚠️ Tabella users non esiste (opzionale)',
            details: 'Non critica, ma utile per gestione utenti avanzata',
          });
        } else {
          results.push({
            step: 'Tabella users',
            status: 'warning',
            message: `⚠️ Errore accesso tabella users: ${error.message}`,
          });
        }
      } else {
        results.push({
          step: 'Tabella users',
          status: 'success',
          message: `✅ Tabella users esiste${count ? ` con ${count} utenti` : ' (vuota)'}`,
        });
      }
    } catch (error) {
      results.push({
        step: 'Tabella users',
        status: 'warning',
        message: `⚠️ Errore verifica: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
      });
    }

    // Tabella user_profiles (opzionale)
    try {
      const { error, count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          results.push({
            step: 'Tabella user_profiles',
            status: 'warning',
            message: '⚠️ Tabella user_profiles non esiste (opzionale)',
          });
        }
      } else {
        results.push({
          step: 'Tabella user_profiles',
          status: 'success',
          message: `✅ Tabella user_profiles esiste${count ? ` con ${count} profili` : ' (vuota)'}`,
        });
      }
    } catch (error) {
      // Ignora errori per tabella opzionale
    }
  }

  // ============================================
  // 4. TEST QUERY PER ANNIE AI
  // ============================================
  console.log('\n📋 STEP 4: Test query per Annie AI...\n');

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    try {
      // Prima verifica: query base senza filtro (test struttura)
      const { data: allData, error: baseError } = await supabase
        .from('shipments')
        .select('id, tracking_number, user_id, updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (baseError) {
        if (baseError.code === '42P01') {
          results.push({
            step: 'Test query Annie AI',
            status: 'error',
            message: '❌ Impossibile testare: tabella shipments non esiste',
            details: 'Annie AI non può funzionare senza la tabella shipments',
          });
        } else {
          results.push({
            step: 'Test query Annie AI',
            status: 'error',
            message: `❌ Errore query base: ${baseError.message}`,
            details: {
              code: baseError.code,
            },
          });
        }
      } else {
        // Query base funziona, ora testa con filtro user_id se ci sono dati
        if (allData && allData.length > 0) {
          // Prendi un user_id reale dalla prima spedizione
          const realUserId = allData[0].user_id;
          
          if (realUserId) {
            // Test con user_id reale
            const { data, error } = await supabase
              .from('shipments')
              .select('*')
              .eq('user_id', realUserId)
              .order('updated_at', { ascending: false })
              .limit(15);

            if (error) {
              results.push({
                step: 'Test query Annie AI',
                status: 'warning',
                message: `⚠️ Query con filtro user_id fallita: ${error.message}`,
                details: {
                  code: error.code,
                  note: 'La query base funziona, ma il filtro user_id ha problemi',
                },
              });
            } else {
              results.push({
                step: 'Test query Annie AI',
                status: 'success',
                message: `✅ Query Annie AI funzionante (trovate ${data?.length || 0} spedizioni per user_id reale)`,
                details: `Test eseguito con user_id: ${realUserId.substring(0, 8)}...`,
              });
            }
          } else {
            // user_id null, test senza filtro
            results.push({
              step: 'Test query Annie AI',
              status: 'success',
              message: `✅ Query base Annie AI funzionante (${allData.length} spedizioni trovate, alcune con user_id null)`,
              details: 'La query funziona correttamente anche senza filtro user_id',
            });
          }
        } else {
          // Tabella vuota, ma struttura ok
          results.push({
            step: 'Test query Annie AI',
            status: 'success',
            message: '✅ Query Annie AI funzionante (tabella vuota ma struttura corretta)',
            details: 'La struttura della query è corretta, Annie AI può funzionare quando ci saranno spedizioni',
          });
        }
      }
    } catch (error) {
      results.push({
        step: 'Test query Annie AI',
        status: 'error',
        message: `❌ Errore test: ${error instanceof Error ? error.message : 'Sconosciuto'}`,
      });
    }
  }

  // ============================================
  // 5. RIEPILOGO FINALE
  // ============================================
  console.log('\n📊 RIEPILOGO FINALE\n');
  console.log('='.repeat(60));
  console.log('');

  printResults(results);

  const errors = results.filter((r) => r.status === 'error').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const successes = results.filter((r) => r.status === 'success').length;

  console.log('='.repeat(60));
  console.log('');
  console.log('📈 Statistiche:');
  console.log(`   ✅ Successi: ${successes}`);
  console.log(`   ⚠️  Warning: ${warnings}`);
  console.log(`   ❌ Errori: ${errors}`);
  console.log('');

  // Verifica critica: tabella shipments
  const shipmentsCheck = results.find((r) => r.step === 'Tabella shipments');
  const hasShipmentsError = shipmentsCheck?.status === 'error';

  if (hasShipmentsError) {
    console.log('❌ ERRORE CRITICO: La tabella shipments non esiste!');
    console.log('   Annie AI non può funzionare senza questa tabella.');
    console.log('');
    console.log('🔧 COSA FARE:');
    console.log('   1. Vai su Supabase Dashboard → SQL Editor');
    console.log('   2. Esegui la migration SQL per creare la tabella shipments');
    console.log('   3. Verifica che la tabella sia stata creata correttamente');
    console.log('   4. Riesegui questo script per verificare');
    console.log('');
    process.exit(1);
  }

  if (errors > 0) {
    console.log('❌ Configurazione incompleta. Risolvi gli errori sopra.\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  Configurazione parziale. Controlla i warning sopra.\n');
    process.exit(0);
  } else {
    console.log('🎉 Configurazione completa e funzionante!\n');
    console.log('✅ Annie AI può funzionare correttamente con questa configurazione.\n');
    process.exit(0);
  }
}

function printResults(results: CheckResult[]) {
  results.forEach((result) => {
    const icon =
      result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
    const color =
      result.status === 'success'
        ? '\x1b[32m'
        : result.status === 'error'
        ? '\x1b[31m'
        : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${icon} ${color}${result.step}${reset}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      if (typeof result.details === 'object') {
        console.log(`   Dettagli:`, JSON.stringify(result.details, null, 2));
      } else {
        console.log(`   Dettagli: ${result.details}`);
      }
    }
    console.log('');
  });
}

main().catch((error) => {
  console.error('\n❌ ERRORE CRITICO:', error);
  if (error instanceof Error) {
    console.error('Stack:', error.stack);
  }
  process.exit(1);
});






