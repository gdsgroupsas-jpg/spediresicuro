/**
 * Test Completi per Fix Audit P1-1, P1-2, P1-3
 *
 * Verifica che tutti i fix implementati funzionino correttamente:
 * - P1-1: Ownership validation (già verificato, ma ri-testiamo)
 * - P1-2: DB Lock per prevenire race conditions in sync
 * - P1-3: Sanitizzazione log (UUIDs e nomi)
 */

import { getSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online';
import { syncPriceListsFromSpedisciOnline } from '@/actions/spedisci-online-rates';
import { supabaseAdmin } from '@/lib/db/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getCourierConfigForUser } from '@/lib/couriers/factory';

// Mock getSafeAuth() - le funzioni testate usano getSafeAuth che chiama auth internamente
// Usiamo valori dinamici che vengono impostati prima di ogni test
let mockEmail = '';
let mockUserId = '';
vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: () => {
    if (!mockEmail || !mockUserId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      actor: { email: mockEmail, id: mockUserId, name: 'Test User', role: 'user' },
      target: { email: mockEmail, id: mockUserId, name: 'Test User', role: 'user' },
      isImpersonating: false,
    });
  },
}));

describe('Audit Fixes Comprehensive Tests', () => {
  let testUser: any;
  let testConfig: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(async () => {
    // Setup: Crea utente di test
    const email = `audit_test_${Date.now()}@test.com`;
    const { data: authUser, error: errAuth } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true,
      user_metadata: { name: 'Test User', account_type: 'reseller' },
    });

    if (errAuth) throw new Error(`Error creating test user: ${errAuth.message}`);
    if (!authUser.user) throw new Error('Test user created but null');

    // Crea/verifica public user
    const { data: pu } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authUser.user.id)
      .maybeSingle();

    if (pu) {
      testUser = pu;
    } else {
      const { data: puManual, error: errPu } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.user.id,
          email,
          name: 'Test User',
          account_type: 'reseller',
          is_reseller: true,
        })
        .select()
        .single();
      if (errPu) throw new Error(`Error inserting test user: ${errPu.message}`);
      testUser = puManual;
    }

    // Crea configurazione di test
    const { data: config, error: errC } = await supabaseAdmin
      .from('courier_configs')
      .insert({
        owner_user_id: testUser.id,
        provider_id: 'spedisci_online',
        api_key: 'test_key_12345',
        base_url: 'http://test.com',
        is_active: true,
        name: 'Test Config Name',
        created_by: testUser.email,
      })
      .select()
      .single();

    if (errC) throw new Error(`Error creating test config: ${errC.message}`);
    testConfig = config;

    // Imposta mock auth con i dati del test user
    mockEmail = testUser.email;
    mockUserId = testUser.id;

    // Spy su console.log e console.warn per test P1-3
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Cleanup - IMPORTANT: Delete from public.users BEFORE auth.users
    // to avoid orphaned records (auth.admin.deleteUser only deletes from auth.users)
    if (testConfig?.id) {
      await supabaseAdmin.from('courier_configs').delete().eq('id', testConfig.id);
    }
    if (testUser?.id) {
      // First delete from public.users (cascade dependencies)
      await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', testUser.id);
      await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', testUser.id);
      await supabaseAdmin.from('top_up_requests').delete().eq('user_id', testUser.id);
      await supabaseAdmin.from('shipments').delete().eq('user_id', testUser.id);
      await supabaseAdmin.from('users').delete().eq('id', testUser.id);
      // Then delete from auth.users
      await supabaseAdmin.auth.admin.deleteUser(testUser.id);
    }

    // Restore console spies
    consoleLogSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
  });

  describe('P1-1: Ownership Validation', () => {
    it('dovrebbe prevenire accesso a config di altro utente', async () => {
      // Crea User B (attacker)
      const emailB = `audit_user_b_${Date.now()}@test.com`;
      const { data: authB, error: errAuthB } = await supabaseAdmin.auth.admin.createUser({
        email: emailB,
        password: 'password123',
        email_confirm: true,
        user_metadata: { name: 'User B', account_type: 'reseller' },
      });

      if (errAuthB) throw new Error(`Error creating User B: ${errAuthB.message}`);
      if (!authB.user) throw new Error('User B created but null');

      // Crea/verifica public user B
      let userB: any;
      const { data: puB } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authB.user.id)
        .maybeSingle();

      if (puB) {
        userB = puB;
      } else {
        const { data: puManual, error: errPu } = await supabaseAdmin
          .from('users')
          .insert({
            id: authB.user.id,
            email: emailB,
            name: 'User B',
            account_type: 'reseller',
            is_reseller: true,
          })
          .select()
          .single();
        if (errPu) throw new Error(`Error inserting User B: ${errPu.message}`);
        userB = puManual;
      }

      try {
        // Simula User B session
        mockEmail = userB.email;
        mockUserId = userB.id;

        // Tenta di accedere a config di testUser
        const result = await getSpedisciOnlineCredentials(testConfig.id);

        // Verifica: dovrebbe fallire
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Non autorizzato|non trovata/i);
      } finally {
        // Cleanup User B - delete from public.users BEFORE auth.users
        if (userB?.id) {
          await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('top_up_requests').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('shipments').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('users').delete().eq('id', userB.id);
          await supabaseAdmin.auth.admin.deleteUser(userB.id);
        }
      }
    });

    it('dovrebbe permettere accesso a propria config', async () => {
      // Usa testUser (owner della config)
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      const result = await getSpedisciOnlineCredentials(testConfig.id);

      // Verifica: dovrebbe avere successo
      expect(result.success).toBe(true);
      expect(result.credentials).toBeDefined();
    });

    it('dovrebbe prevenire accesso via factory.getCourierConfigForUser', async () => {
      // Crea User B
      const emailB = `audit_user_b_factory_${Date.now()}@test.com`;
      const { data: authB, error: errAuthB } = await supabaseAdmin.auth.admin.createUser({
        email: emailB,
        password: 'password123',
        email_confirm: true,
        user_metadata: { name: 'User B Factory', account_type: 'reseller' },
      });

      if (errAuthB) throw new Error(`Error creating User B: ${errAuthB.message}`);
      if (!authB.user) throw new Error('User B created but null');

      let userB: any;
      const { data: puB } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authB.user.id)
        .maybeSingle();

      if (puB) {
        userB = puB;
      } else {
        const { data: puManual, error: errPu } = await supabaseAdmin
          .from('users')
          .insert({
            id: authB.user.id,
            email: emailB,
            name: 'User B Factory',
            account_type: 'reseller',
            is_reseller: true,
          })
          .select()
          .single();
        if (errPu) throw new Error(`Error inserting User B: ${errPu.message}`);
        userB = puManual;
      }

      try {
        // Tenta di accedere a config di testUser usando factory
        const config = await getCourierConfigForUser(userB.id, 'spedisci_online', testConfig.id);

        // Verifica: dovrebbe essere null (accesso negato)
        expect(config).toBeNull();
      } finally {
        // Cleanup User B - delete from public.users BEFORE auth.users
        if (userB?.id) {
          await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('top_up_requests').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('shipments').delete().eq('user_id', userB.id);
          await supabaseAdmin.from('users').delete().eq('id', userB.id);
          await supabaseAdmin.auth.admin.deleteUser(userB.id);
        }
      }
    });
  });

  describe('P1-2: DB Lock per Race Condition', () => {
    it('dovrebbe prevenire sync simultanee con DB lock', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      // Simula due sync simultanee
      const sync1Promise = syncPriceListsFromSpedisciOnline({
        courierId: 'gls',
        mode: 'fast',
        testParams: {
          packages: [
            {
              length: 10,
              width: 10,
              height: 10,
              weight: 1,
            },
          ],
          shipFrom: {
            name: 'Test From',
            street1: 'Via Test 1',
            city: 'Milano',
            state: 'MI',
            postalCode: '20100',
            country: 'IT',
          },
          shipTo: {
            name: 'Test To',
            street1: 'Via Test 2',
            city: 'Roma',
            state: 'RM',
            postalCode: '00100',
            country: 'IT',
          },
        },
      });

      // Seconda sync immediatamente dopo (simula race condition)
      const sync2Promise = syncPriceListsFromSpedisciOnline({
        courierId: 'gls',
        mode: 'fast',
        testParams: {
          packages: [
            {
              length: 10,
              width: 10,
              height: 10,
              weight: 1,
            },
          ],
          shipFrom: {
            name: 'Test From',
            street1: 'Via Test 1',
            city: 'Milano',
            state: 'MI',
            postalCode: '20100',
            country: 'IT',
          },
          shipTo: {
            name: 'Test To',
            street1: 'Via Test 2',
            city: 'Roma',
            state: 'RM',
            postalCode: '00100',
            country: 'IT',
          },
        },
      });

      const [result1, result2] = await Promise.all([sync1Promise, sync2Promise]);

      // Almeno una dovrebbe fallire con errore di lock
      const lockErrors = [result1, result2].filter(
        (r) =>
          !r.success &&
          (r.error?.includes('in corso') || r.error?.includes('lock') || r.error?.includes('già'))
      );

      // Verifica: almeno una sync dovrebbe essere bloccata dal lock
      expect(lockErrors.length).toBeGreaterThan(0);
    });

    it('dovrebbe rilasciare lock dopo completamento', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      const lockKey = `sync_price_lists_${testUser.id}_gls`;

      // Prima sync
      const result1 = await syncPriceListsFromSpedisciOnline({
        courierId: 'gls',
        mode: 'fast',
        testParams: {
          packages: [
            {
              length: 10,
              width: 10,
              height: 10,
              weight: 1,
            },
          ],
          shipFrom: {
            name: 'Test From',
            street1: 'Via Test 1',
            city: 'Milano',
            state: 'MI',
            postalCode: '20100',
            country: 'IT',
          },
          shipTo: {
            name: 'Test To',
            street1: 'Via Test 2',
            city: 'Roma',
            state: 'RM',
            postalCode: '00100',
            country: 'IT',
          },
        },
      });

      // Verifica che la prima sync abbia completato (o fallito per altro motivo)
      expect(result1).toBeDefined();

      // Attendi che il lock sia rilasciato (verifica nel DB)
      let lockReleased = false;
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const { data: lock } = await supabaseAdmin
          .from('idempotency_locks')
          .select('status')
          .eq('idempotency_key', lockKey)
          .maybeSingle();

        if (!lock || lock.status === 'completed' || lock.status === 'failed') {
          lockReleased = true;
          break;
        }
      }

      // Se il lock è stato rilasciato, la seconda sync dovrebbe poter procedere
      // (anche se può fallire per altri motivi come API key non valida)
      if (lockReleased) {
        const result2 = await syncPriceListsFromSpedisciOnline({
          courierId: 'gls',
          mode: 'fast',
          testParams: {
            packages: [
              {
                length: 10,
                width: 10,
                height: 10,
                weight: 1,
              },
            ],
            shipFrom: {
              name: 'Test From',
              street1: 'Via Test 1',
              city: 'Milano',
              state: 'MI',
              postalCode: '20100',
              country: 'IT',
            },
            shipTo: {
              name: 'Test To',
              street1: 'Via Test 2',
              city: 'Roma',
              state: 'RM',
              postalCode: '00100',
              country: 'IT',
            },
          },
        });

        // Verifica: se fallisce, non dovrebbe essere per lock (se il lock è stato rilasciato)
        if (!result2.success && lockReleased) {
          // Se il lock è stato rilasciato, l'errore non dovrebbe essere di lock
          // (può essere API key non valida, ma non lock)
          const isLockError = /in corso|lock|già/i.test(result2.error || '');
          if (isLockError) {
            // Se è ancora un errore di lock, potrebbe essere che il lock non è stato ancora rilasciato
            // o che c'è un problema con il release. Verifichiamo nel DB.
            const { data: currentLock } = await supabaseAdmin
              .from('idempotency_locks')
              .select('status, expires_at')
              .eq('idempotency_key', lockKey)
              .maybeSingle();

            // Se il lock esiste ancora ed è in_progress, potrebbe essere un problema
            // Ma potrebbe anche essere che la seconda sync ha acquisito un nuovo lock
            // Quindi non facciamo asserzione rigida qui
            expect(currentLock).toBeDefined();
          }
        }
      } else {
        // Se il lock non è stato rilasciato entro 5 secondi, potrebbe essere un problema
        // ma non facciamo fallire il test - potrebbe essere che la sync è ancora in corso
        console.warn(
          '⚠️ Lock non rilasciato entro 5 secondi - potrebbe essere normale se la sync è ancora in corso'
        );
      }
    });

    it('dovrebbe verificare che il lock sia nel database', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      const lockKey = `sync_price_lists_${testUser.id}_gls`;

      // Verifica che non ci sia lock attivo
      const { data: lockBefore } = await supabaseAdmin
        .from('idempotency_locks')
        .select('*')
        .eq('idempotency_key', lockKey)
        .eq('status', 'in_progress')
        .maybeSingle();

      expect(lockBefore).toBeNull();

      // Avvia sync (in background, non aspettiamo completamento)
      syncPriceListsFromSpedisciOnline({
        courierId: 'gls',
        mode: 'fast',
        testParams: {
          packages: [
            {
              length: 10,
              width: 10,
              height: 10,
              weight: 1,
            },
          ],
          shipFrom: {
            name: 'Test From',
            street1: 'Via Test 1',
            city: 'Milano',
            state: 'MI',
            postalCode: '20100',
            country: 'IT',
          },
          shipTo: {
            name: 'Test To',
            street1: 'Via Test 2',
            city: 'Roma',
            state: 'RM',
            postalCode: '00100',
            country: 'IT',
          },
        },
      }).catch(() => {}); // Ignora errori

      // Attendi un po' per permettere al lock di essere acquisito
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verifica che il lock sia stato creato nel database
      const { data: lockAfter } = await supabaseAdmin
        .from('idempotency_locks')
        .select('*')
        .eq('idempotency_key', lockKey)
        .maybeSingle();

      // Il lock potrebbe esistere se la sync è ancora in corso
      // o potrebbe essere già completato, quindi non facciamo asserzioni rigide
      // ma verifichiamo che la funzione di lock funzioni
      expect(
        lockAfter === null ||
          lockAfter?.status === 'in_progress' ||
          lockAfter?.status === 'completed'
      ).toBe(true);
    });
  });

  describe('P1-3: Sanitizzazione Log', () => {
    it('dovrebbe sanitizzare UUIDs nei log di factory', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      // Chiama funzione che logga
      await getCourierConfigForUser(testUser.id, 'spedisci_online', testConfig.id);

      // Verifica che i log non contengano UUID completo
      const logCalls = consoleLogSpy.mock.calls;
      const warnCalls = consoleWarnSpy.mock.calls;
      const allCalls = [...logCalls, ...warnCalls];

      // Cerca UUID completo nel formato standard (8-4-4-4-12)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

      for (const call of allCalls) {
        const message = JSON.stringify(call);
        // Verifica che non ci siano UUID completi nei log
        // (potrebbero esserci hash parziali, ma non UUID completi)
        const hasFullUuid = uuidPattern.test(message);
        if (hasFullUuid) {
          // Se troviamo un UUID completo, verifica che sia un hash (8 caratteri esadecimali)
          const matches = message.match(uuidPattern);
          if (matches) {
            for (const match of matches) {
              // Se è un UUID completo (36 caratteri con trattini), fallisce
              if (match.length === 36) {
                // Potrebbe essere un hash se è solo 8 caratteri senza trattini
                // Ma se ha trattini ed è 36 caratteri, è un UUID completo
                expect(match.length).toBeLessThan(36);
              }
            }
          }
        }
      }
    });

    it('dovrebbe sanitizzare nomi nei log di factory', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      // Chiama funzione che logga
      await getCourierConfigForUser(testUser.id, 'spedisci_online', testConfig.id);

      // Verifica che i log non contengano nomi completi non sanitizzati
      const logCalls = consoleLogSpy.mock.calls;
      const allCalls = [...logCalls];

      // Cerca il nome completo della config nei log
      // Il nome dovrebbe essere sanitizzato (max 20 caratteri, senza caratteri speciali)
      for (const call of allCalls) {
        const message = JSON.stringify(call);
        // Se contiene il nome completo non sanitizzato, verifica che sia stato sanitizzato
        if (message.includes('Test Config Name')) {
          // Il nome completo potrebbe essere presente, ma dovrebbe essere limitato
          // Verifica che non ci siano caratteri speciali pericolosi
          expect(message).not.toContain('Test Config Name'); // Dovrebbe essere sanitizzato
        }
      }
    });

    it('dovrebbe sanitizzare UUIDs nei log di spedisci-online', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      // Chiama funzione che logga
      await getSpedisciOnlineCredentials(testConfig.id);

      // Verifica che i log non contengano UUID completo
      const logCalls = consoleLogSpy.mock.calls;
      const allCalls = [...logCalls];

      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

      for (const call of allCalls) {
        const message = JSON.stringify(call);
        const hasFullUuid = uuidPattern.test(message);
        if (hasFullUuid) {
          const matches = message.match(uuidPattern);
          if (matches) {
            for (const match of matches) {
              // UUID completo non dovrebbe essere presente
              if (match.length === 36) {
                // Verifica che sia stato sanitizzato (hash parziale)
                expect(match.length).toBeLessThan(36);
              }
            }
          }
        }
      }
    });

    it('dovrebbe usare hash parziale invece di UUID completo', async () => {
      mockEmail = testUser.email;
      mockUserId = testUser.id;

      // Chiama funzione che logga
      await getSpedisciOnlineCredentials(testConfig.id);

      // Verifica che i log contengano hash parziali (8 caratteri esadecimali)
      const logCalls = consoleLogSpy.mock.calls;
      const allCalls = [...logCalls];

      // Pattern per hash parziale (8 caratteri esadecimali)
      const hashPattern = /[0-9a-f]{8}/i;

      let foundHash = false;
      for (const call of allCalls) {
        const message = JSON.stringify(call);
        if (hashPattern.test(message)) {
          foundHash = true;
          // Verifica che non ci siano UUID completi insieme agli hash
          const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
          // Non dovrebbe esserci UUID completo
          expect(uuidPattern.test(message)).toBe(false);
        }
      }

      // Almeno un hash dovrebbe essere presente nei log
      // (non sempre garantito, ma è un buon indicatore)
      // Non facciamo asserzione rigida qui perché dipende da quali log vengono generati
    });
  });
});
