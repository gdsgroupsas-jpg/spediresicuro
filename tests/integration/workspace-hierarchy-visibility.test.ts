/**
 * Test Integrazione: Workspace Hierarchy Visibility
 *
 * Verifica che la visibilità gerarchica funzioni correttamente:
 * 1. Platform vede tutti i workspace discendenti (reseller + client)
 * 2. Reseller vede solo self + suoi client
 * 3. Client vede solo self
 * 4. get_visible_workspace_ids() ritorna i corretti UUID
 * 5. can_workspace_see() verifica correttamente la visibilità
 *
 * Pattern: Stripe Connect - Platform sees all connected accounts
 * Riferimento: supabase/migrations/20260204110000_workspace_hierarchy_visibility.sql
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Assicura che si usi il client reale
vi.unmock('@/lib/db/client');

import * as dotenv from 'dotenv';
import path from 'path';

// Carica variabili d'ambiente
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  dotenv.config({ path: envPath });
} catch (error) {
  console.warn('⚠️ Impossibile caricare .env.local');
}

// Type per Supabase client
type SupabaseClient = any;

describe('Workspace Hierarchy Visibility', () => {
  let supabaseAdmin: SupabaseClient;
  let platformId: string;
  let resellerId: string;
  let clientAId: string;
  let clientBId: string;
  let organizationId: string;

  // Flag per skip se Supabase non configurato
  let skipTests = false;

  beforeAll(async () => {
    const dbModule = await vi.importActual<any>('@/lib/db/client');
    supabaseAdmin = dbModule.supabaseAdmin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('mock')) {
      console.warn('⚠️ Supabase non configurato - test verranno saltati');
      skipTests = true;
      return;
    }

    // Setup: Crea gerarchia di test
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 1. Crea Organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: `Test Org ${suffix}`,
        slug: `test-org-${suffix}`,
        billing_email: `billing-${suffix}@test.local`,
        status: 'active',
      })
      .select()
      .single();

    if (orgError) {
      console.error('Errore creazione organization:', orgError);
      skipTests = true;
      return;
    }
    organizationId = org.id;

    // 2. Crea Platform workspace (depth 0)
    const { data: platform, error: platformError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        organization_id: organizationId,
        name: `Platform Test ${suffix}`,
        slug: `platform-${suffix}`,
        type: 'platform',
        depth: 0,
        parent_workspace_id: null,
        status: 'active',
        wallet_balance: 0,
      })
      .select()
      .single();

    if (platformError) {
      console.error('Errore creazione platform:', platformError);
      skipTests = true;
      return;
    }
    platformId = platform.id;

    // 3. Crea Reseller workspace (depth 1)
    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        organization_id: organizationId,
        name: `Reseller Test ${suffix}`,
        slug: `reseller-${suffix}`,
        type: 'reseller',
        depth: 1,
        parent_workspace_id: platformId,
        status: 'active',
        wallet_balance: 0,
      })
      .select()
      .single();

    if (resellerError) {
      console.error('Errore creazione reseller:', resellerError);
      skipTests = true;
      return;
    }
    resellerId = reseller.id;

    // 4. Crea Client A workspace (depth 2)
    const { data: clientA, error: clientAError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        organization_id: organizationId,
        name: `Client A Test ${suffix}`,
        slug: `client-a-${suffix}`,
        type: 'client',
        depth: 2,
        parent_workspace_id: resellerId,
        status: 'active',
        wallet_balance: 0,
      })
      .select()
      .single();

    if (clientAError) {
      console.error('Errore creazione client A:', clientAError);
      skipTests = true;
      return;
    }
    clientAId = clientA.id;

    // 5. Crea Client B workspace (depth 2)
    const { data: clientB, error: clientBError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        organization_id: organizationId,
        name: `Client B Test ${suffix}`,
        slug: `client-b-${suffix}`,
        type: 'client',
        depth: 2,
        parent_workspace_id: resellerId,
        status: 'active',
        wallet_balance: 0,
      })
      .select()
      .single();

    if (clientBError) {
      console.error('Errore creazione client B:', clientBError);
      skipTests = true;
      return;
    }
    clientBId = clientB.id;
  });

  afterAll(async () => {
    if (skipTests || !supabaseAdmin) return;

    // Cleanup: Elimina workspace e organization di test
    // Ordine: client -> reseller -> platform -> organization
    try {
      if (clientBId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', clientBId);
      }
      if (clientAId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', clientAId);
      }
      if (resellerId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', resellerId);
      }
      if (platformId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', platformId);
      }
      if (organizationId) {
        await supabaseAdmin.from('organizations').delete().eq('id', organizationId);
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  });

  describe('get_visible_workspace_ids()', () => {
    it('Platform dovrebbe vedere 4 workspace (self + reseller + 2 client)', async () => {
      if (skipTests) return;

      const { data, error } = await supabaseAdmin.rpc('get_visible_workspace_ids', {
        p_workspace_id: platformId,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(4);
      expect(data).toContain(platformId);
      expect(data).toContain(resellerId);
      expect(data).toContain(clientAId);
      expect(data).toContain(clientBId);
    });

    it('Reseller dovrebbe vedere 3 workspace (self + 2 client)', async () => {
      if (skipTests) return;

      const { data, error } = await supabaseAdmin.rpc('get_visible_workspace_ids', {
        p_workspace_id: resellerId,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data).toContain(resellerId);
      expect(data).toContain(clientAId);
      expect(data).toContain(clientBId);
      // Platform NON deve essere visibile
      expect(data).not.toContain(platformId);
    });

    it('Client A dovrebbe vedere solo 1 workspace (self)', async () => {
      if (skipTests) return;

      const { data, error } = await supabaseAdmin.rpc('get_visible_workspace_ids', {
        p_workspace_id: clientAId,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data).toContain(clientAId);
      // Altri workspace NON devono essere visibili
      expect(data).not.toContain(platformId);
      expect(data).not.toContain(resellerId);
      expect(data).not.toContain(clientBId);
    });

    it('Client B dovrebbe vedere solo 1 workspace (self)', async () => {
      if (skipTests) return;

      const { data, error } = await supabaseAdmin.rpc('get_visible_workspace_ids', {
        p_workspace_id: clientBId,
      });

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data).toContain(clientBId);
    });
  });

  describe('can_workspace_see()', () => {
    it('Platform può vedere tutti i discendenti', async () => {
      if (skipTests) return;

      // Platform -> Reseller
      const { data: canSeeReseller } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: platformId,
        p_target_workspace_id: resellerId,
      });
      expect(canSeeReseller).toBe(true);

      // Platform -> Client A
      const { data: canSeeClientA } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: platformId,
        p_target_workspace_id: clientAId,
      });
      expect(canSeeClientA).toBe(true);

      // Platform -> Client B
      const { data: canSeeClientB } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: platformId,
        p_target_workspace_id: clientBId,
      });
      expect(canSeeClientB).toBe(true);
    });

    it('Reseller può vedere i suoi client', async () => {
      if (skipTests) return;

      const { data: canSeeClientA } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: resellerId,
        p_target_workspace_id: clientAId,
      });
      expect(canSeeClientA).toBe(true);

      const { data: canSeeClientB } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: resellerId,
        p_target_workspace_id: clientBId,
      });
      expect(canSeeClientB).toBe(true);
    });

    it('Reseller NON può vedere Platform (parent)', async () => {
      if (skipTests) return;

      const { data: canSeePlatform } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: resellerId,
        p_target_workspace_id: platformId,
      });
      expect(canSeePlatform).toBe(false);
    });

    it('Client NON può vedere siblings (altri client)', async () => {
      if (skipTests) return;

      const { data: canSeeClientB } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: clientAId,
        p_target_workspace_id: clientBId,
      });
      expect(canSeeClientB).toBe(false);
    });

    it('Client NON può vedere Reseller (parent)', async () => {
      if (skipTests) return;

      const { data: canSeeReseller } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: clientAId,
        p_target_workspace_id: resellerId,
      });
      expect(canSeeReseller).toBe(false);
    });

    it('Client NON può vedere Platform (grandparent)', async () => {
      if (skipTests) return;

      const { data: canSeePlatform } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: clientAId,
        p_target_workspace_id: platformId,
      });
      expect(canSeePlatform).toBe(false);
    });

    it('Stesso workspace può sempre vedere se stesso', async () => {
      if (skipTests) return;

      const { data: canSeeSelf } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: clientAId,
        p_target_workspace_id: clientAId,
      });
      expect(canSeeSelf).toBe(true);
    });

    it('NULL target è sempre visibile (backward-compatibility)', async () => {
      if (skipTests) return;

      const { data: canSeeNull } = await supabaseAdmin.rpc('can_workspace_see', {
        p_viewer_workspace_id: clientAId,
        p_target_workspace_id: null,
      });
      expect(canSeeNull).toBe(true);
    });
  });

  describe('get_workspace_stats()', () => {
    it('dovrebbe ritornare statistiche senza errori', async () => {
      if (skipTests) return;

      const { data, error } = await supabaseAdmin.rpc('get_workspace_stats', {
        p_workspace_id: platformId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveLength(1);

      const stats = data[0];
      expect(stats).toHaveProperty('total_shipments');
      expect(stats).toHaveProperty('shipments_today');
      expect(stats).toHaveProperty('shipments_this_month');
      expect(stats).toHaveProperty('total_revenue');
      expect(stats).toHaveProperty('revenue_this_month');
      expect(stats).toHaveProperty('in_transit');
      expect(stats).toHaveProperty('delivered');
    });
  });
});
