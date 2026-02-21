import { getSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online';
import { supabaseAdmin } from '@/lib/db/client';
import { describe, expect, it, vi } from 'vitest';

// Mock getSafeAuth() - variabili mutabili per simulare utenti diversi durante i test
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

describe('P1-1 Audit Verification: Ownership Bypass', () => {
  it('SHOUD PREVENT User B from accessing User A config via getSpedisciOnlineCredentials(configId)', async () => {
    let userA: any;
    let userB: any;
    let configA: any;

    try {
      console.log('--- SETUP STARTED ---');

      // 1. Create User A (Owner)
      const emailA = `audit_user_a_${Date.now()}@test.com`;
      const { data: authA, error: errAuthA } = await supabaseAdmin.auth.admin.createUser({
        email: emailA,
        password: 'password123',
        email_confirm: true,
        user_metadata: { name: 'User A', account_type: 'reseller' },
      });

      if (errAuthA) throw new Error(`Error creating Auth User A: ${errAuthA.message}`);
      if (!authA.user) throw new Error('Auth User A created but null');
      console.log('Auth User A created:', authA.user.id);

      // Check/Create public user A
      const { data: puA } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authA.user.id)
        .maybeSingle();
      if (puA) {
        userA = puA;
        console.log('Public User A found:', userA.id);
      } else {
        console.log('Public User A not found, inserting manually...');
        const { data: puManual, error: errPu } = await supabaseAdmin
          .from('users')
          .insert({
            id: authA.user.id,
            email: emailA,
            name: 'User A',
            account_type: 'reseller',
          })
          .select()
          .single();
        if (errPu)
          throw new Error(`Error inserting Public User A: ${errPu.message} (Code: ${errPu.code})`);
        userA = puManual;
        console.log('Public User A inserted manually:', userA.id);
      }

      // 2. Create User B (Attacker)
      const emailB = `audit_user_b_${Date.now()}@test.com`;
      const { data: authB, error: errAuthB } = await supabaseAdmin.auth.admin.createUser({
        email: emailB,
        password: 'password123',
        email_confirm: true,
        user_metadata: { name: 'User B', account_type: 'reseller' },
      });

      if (errAuthB) throw new Error(`Error creating Auth User B: ${errAuthB.message}`);
      console.log('Auth User B created:', authB.user.id);

      // Check/Create public user B
      const { data: puB } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authB.user.id)
        .maybeSingle();
      if (puB) {
        userB = puB;
        console.log('Public User B found:', userB.id);
      } else {
        console.log('Public User B not found, inserting manually...');
        const { data: puManual, error: errPu } = await supabaseAdmin
          .from('users')
          .insert({
            id: authB.user.id,
            email: emailB,
            name: 'User B',
            account_type: 'reseller',
          })
          .select()
          .single();
        if (errPu) throw new Error(`Error inserting Public User B: ${errPu.message}`);
        userB = puManual;
        console.log('Public User B inserted manually:', userB.id);
      }

      // 3. Create Config for User A
      // REMOVED user_id and courier_code
      const { data: ca, error: errC } = await supabaseAdmin
        .from('courier_configs')
        .insert({
          owner_user_id: userA.id,
          provider_id: 'spedisci_online',
          api_key: 'test_key',
          base_url: 'http://test.com',
          is_active: true,
          name: 'Config User A',
          created_by: userA.email,
        })
        .select()
        .single();

      if (errC) throw new Error(`Error creating Config A: ${errC.message}`);
      configA = ca;
      console.log('Config A created:', configA.id);

      console.log('--- SETUP COMPLETE ---');

      // --- EXECUTE TEST ---

      // Simulate User B session (attacker)
      mockEmail = userB.email;
      mockUserId = userB.id;

      // Attempt to access User A's config using its ID
      console.log(
        `Attacker (User B): ${userB.id} trying to access Config: ${configA.id} (Owner: ${userA.id})`
      );

      // We use the function under test
      const result = await getSpedisciOnlineCredentials(configA.id);
      console.log('Access Attempt Result:', result);

      // --- VERIFY ---
      // Expect failure (secure)
      // If result.success is TRUE, it confirms vulnerability -> Test should FAIL expectation
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Non autorizzato|non trovata/i);
    } catch (e: any) {
      console.error('TEST FAILED WITH ERROR:', e);
      throw e;
    } finally {
      // Cleanup best effort - delete from public.users BEFORE auth.users
      // to avoid orphaned records
      if (configA?.id) await supabaseAdmin.from('courier_configs').delete().eq('id', configA.id);
      if (userA?.id) {
        await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', userA.id);
        await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userA.id);
        await supabaseAdmin.from('top_up_requests').delete().eq('user_id', userA.id);
        await supabaseAdmin.from('shipments').delete().eq('user_id', userA.id);
        await supabaseAdmin.from('users').delete().eq('id', userA.id);
        await supabaseAdmin.auth.admin.deleteUser(userA.id);
      }
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
