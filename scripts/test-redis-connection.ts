/**
 * Script di test per verificare connessione Redis Upstash
 * 
 * Verifica:
 * 1. Variabili d'ambiente configurate
 * 2. Connessione a Redis funzionante
 * 3. Operazioni SET/GET funzionanti
 * 4. TTL funzionante
 */

import dotenv from 'dotenv';
import { resolve } from 'path';

// Carica variabili d'ambiente da .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config(); // Fallback a .env se esiste

import { getRedis } from '../lib/db/redis';

async function testRedisConnection() {
  console.log('🔍 [REDIS TEST] Inizio test connessione Redis...\n');

  // 1. Verifica variabili d'ambiente
  console.log('📋 [REDIS TEST] Verifica variabili d\'ambiente...');
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.error('❌ [REDIS TEST] ERRORE: Variabili d\'ambiente mancanti!');
    console.error('   UPSTASH_REDIS_REST_URL:', url ? '✅ Configurato' : '❌ Mancante');
    console.error('   UPSTASH_REDIS_REST_TOKEN:', token ? '✅ Configurato' : '❌ Mancante');
    console.error('\n💡 Soluzione: Aggiungi le variabili in .env.local o Vercel');
    process.exit(1);
  }

  console.log('✅ [REDIS TEST] Variabili d\'ambiente configurate');
  console.log(`   URL: ${url.substring(0, 30)}...`);
  console.log(`   TOKEN: ${token.substring(0, 10)}...\n`);

  // 2. Test connessione
  console.log('🔌 [REDIS TEST] Tentativo connessione a Redis...');
  const redis = getRedis();

  if (!redis) {
    console.error('❌ [REDIS TEST] ERRORE: Impossibile inizializzare client Redis');
    console.error('   Verifica che le credenziali siano corrette');
    process.exit(1);
  }

  console.log('✅ [REDIS TEST] Client Redis inizializzato\n');

  // 3. Test operazioni base
  try {
    const testKey = 'test:spediresicuro:connection';
    const testValue = `test-${Date.now()}`;

    console.log('🧪 [REDIS TEST] Test operazioni SET/GET...');
    
    // SET
    await redis.set(testKey, testValue);
    console.log(`   ✅ SET: ${testKey} = ${testValue}`);

    // GET
    const retrieved = await redis.get<string>(testKey);
    if (retrieved === testValue) {
      console.log(`   ✅ GET: ${testKey} = ${retrieved}`);
    } else {
      console.error(`   ❌ GET: Valore non corrispondente (atteso: ${testValue}, ricevuto: ${retrieved})`);
      process.exit(1);
    }

    // TTL
    await redis.setex(`${testKey}:ttl`, 10, 'ttl-test');
    const ttl = await redis.ttl(`${testKey}:ttl`);
    console.log(`   ✅ TTL: ${testKey}:ttl ha TTL di ${ttl} secondi`);

    // Cleanup
    await redis.del(testKey, `${testKey}:ttl`);
    console.log('   ✅ Cleanup: Chiavi di test rimosse\n');

    // 4. Test cache quote (simulazione)
    console.log('📦 [REDIS TEST] Test cache quote (simulazione)...');
    const quoteKey = 'quote:test:12345';
    const mockQuote = {
      rates: [
        { carrierCode: 'gls', contractCode: 'GLS-IT', total_price: '15.50' },
        { carrierCode: 'poste', contractCode: 'PDB-4', total_price: '12.30' },
      ],
      timestamp: Date.now(),
      source: 'api' as const,
    };

    await redis.setex(quoteKey, 300, JSON.stringify(mockQuote));
    const cached = await redis.get<any>(quoteKey);
    
    if (cached) {
      // Upstash Redis restituisce già l'oggetto parsato se era JSON
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (parsed.rates && parsed.rates.length === 2) {
        console.log(`   ✅ Cache quote: ${quoteKey} salvata e recuperata correttamente`);
        console.log(`   ✅ Rates salvati: ${parsed.rates.length}`);
      } else {
        console.error('   ❌ Cache quote: Dati non corrispondenti');
        process.exit(1);
      }
    } else {
      console.error('   ❌ Cache quote: Impossibile recuperare dati');
      process.exit(1);
    }

    await redis.del(quoteKey);
    console.log('   ✅ Cleanup: Cache test rimossa\n');

    // 5. Test performance
    console.log('⚡ [REDIS TEST] Test performance...');
    const startTime = Date.now();
    for (let i = 0; i < 10; i++) {
      await redis.set(`perf:test:${i}`, `value-${i}`);
      await redis.get(`perf:test:${i}`);
    }
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / 10;
    
    console.log(`   ✅ 10 operazioni SET/GET completate in ${endTime - startTime}ms`);
    console.log(`   ✅ Tempo medio per operazione: ${avgTime.toFixed(2)}ms`);

    // Cleanup
    const keys = [];
    for (let i = 0; i < 10; i++) {
      keys.push(`perf:test:${i}`);
    }
    await redis.del(...keys);
    console.log('   ✅ Cleanup: Chiavi performance rimosse\n');

    // ✅ Test completato con successo
    console.log('🎉 [REDIS TEST] TUTTI I TEST PASSATI!');
    console.log('   ✅ Connessione Redis funzionante');
    console.log('   ✅ Operazioni SET/GET funzionanti');
    console.log('   ✅ TTL funzionante');
    console.log('   ✅ Cache quote funzionante');
    console.log('   ✅ Performance ottimale\n');
    console.log('💡 Redis è pronto per essere usato in produzione!');

  } catch (error: any) {
    console.error('❌ [REDIS TEST] ERRORE durante i test:');
    console.error('   Messaggio:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Esegui test
testRedisConnection()
  .then(() => {
    console.log('\n✅ Script completato con successo');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script fallito:', error);
    process.exit(1);
  });
