/**
 * Test Cleanup Helper
 *
 * Utility per pulire automaticamente i dati di test creati durante i test.
 * Usare in afterAll() o afterEach() per evitare accumulo di dati test nel DB.
 *
 * USAGE:
 *   import { TestCleanup } from '@/tests/helpers/test-cleanup';
 *
 *   describe('My Test', () => {
 *     const cleanup = new TestCleanup();
 *
 *     afterAll(async () => {
 *       await cleanup.execute();
 *     });
 *
 *     it('should create user', async () => {
 *       const user = await createTestUser();
 *       cleanup.trackUser(user.id);  // Track for cleanup
 *     });
 *   });
 */

import { supabaseAdmin } from '@/lib/db/client';

export class TestCleanup {
  private userIds: Set<string> = new Set();
  private shipmentIds: Set<string> = new Set();
  private configIds: Set<string> = new Set();
  private priceListIds: Set<string> = new Set();
  private verbose: boolean;

  constructor(options?: { verbose?: boolean }) {
    this.verbose = options?.verbose ?? false;
  }

  /**
   * Track a user ID for cleanup
   */
  trackUser(userId: string): void {
    if (userId) this.userIds.add(userId);
  }

  /**
   * Track multiple user IDs for cleanup
   */
  trackUsers(userIds: string[]): void {
    userIds.forEach((id) => this.trackUser(id));
  }

  /**
   * Track a shipment ID for cleanup
   */
  trackShipment(shipmentId: string): void {
    if (shipmentId) this.shipmentIds.add(shipmentId);
  }

  /**
   * Track a config ID for cleanup
   */
  trackConfig(configId: string): void {
    if (configId) this.configIds.add(configId);
  }

  /**
   * Track a price list ID for cleanup
   */
  trackPriceList(priceListId: string): void {
    if (priceListId) this.priceListIds.add(priceListId);
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(`[TEST-CLEANUP] ${message}`);
    }
  }

  /**
   * Execute cleanup for all tracked resources
   * Call this in afterAll() or afterEach()
   */
  async execute(): Promise<{
    usersDeleted: number;
    shipmentsDeleted: number;
    configsDeleted: number;
    priceListsDeleted: number;
    errors: string[];
  }> {
    const stats = {
      usersDeleted: 0,
      shipmentsDeleted: 0,
      configsDeleted: 0,
      priceListsDeleted: 0,
      errors: [] as string[],
    };

    // 1. Delete shipments first (FK to users)
    if (this.shipmentIds.size > 0) {
      const ids = Array.from(this.shipmentIds);
      this.log(`Deleting ${ids.length} shipments...`);

      const { error, count } = await supabaseAdmin
        .from('shipments')
        .delete({ count: 'exact' })
        .in('id', ids);

      if (error) {
        stats.errors.push(`Shipments: ${error.message}`);
      } else {
        stats.shipmentsDeleted = count || 0;
        this.log(`Deleted ${count} shipments`);
      }
    }

    // 2. Delete price lists
    if (this.priceListIds.size > 0) {
      const ids = Array.from(this.priceListIds);
      this.log(`Deleting ${ids.length} price lists...`);

      // Delete assignments first
      await supabaseAdmin.from('price_list_assignments').delete().in('price_list_id', ids);

      const { error, count } = await supabaseAdmin
        .from('price_lists')
        .delete({ count: 'exact' })
        .in('id', ids);

      if (error) {
        stats.errors.push(`Price lists: ${error.message}`);
      } else {
        stats.priceListsDeleted = count || 0;
        this.log(`Deleted ${count} price lists`);
      }
    }

    // 3. Delete configs
    if (this.configIds.size > 0) {
      const ids = Array.from(this.configIds);
      this.log(`Deleting ${ids.length} configs...`);

      const { error, count } = await supabaseAdmin
        .from('user_spedisci_online_configs')
        .delete({ count: 'exact' })
        .in('id', ids);

      if (error) {
        stats.errors.push(`Configs: ${error.message}`);
      } else {
        stats.configsDeleted = count || 0;
        this.log(`Deleted ${count} configs`);
      }
    }

    // 4. Delete users (last, due to FK constraints)
    if (this.userIds.size > 0) {
      const ids = Array.from(this.userIds);
      this.log(`Deleting ${ids.length} users...`);

      for (const userId of ids) {
        try {
          // Delete cascade dependencies (order matters for FK constraints)
          await supabaseAdmin.from('platform_provider_costs').delete().eq('billed_user_id', userId);
          await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', userId);
          await supabaseAdmin.from('shipments').delete().eq('user_id', userId);
          await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userId);
          await supabaseAdmin.from('top_up_requests').delete().eq('user_id', userId);
          await supabaseAdmin.from('price_list_assignments').delete().eq('user_id', userId);
          await supabaseAdmin.from('user_spedisci_online_configs').delete().eq('user_id', userId);

          // Delete user
          const { error } = await supabaseAdmin.from('users').delete().eq('id', userId);

          if (error) {
            stats.errors.push(`User ${userId}: ${error.message}`);
          } else {
            stats.usersDeleted++;
          }
        } catch (error: any) {
          stats.errors.push(`User ${userId}: ${error.message}`);
        }
      }

      this.log(`Deleted ${stats.usersDeleted} users`);
    }

    // Clear tracked IDs
    this.userIds.clear();
    this.shipmentIds.clear();
    this.configIds.clear();
    this.priceListIds.clear();

    return stats;
  }

  /**
   * Get count of tracked resources
   */
  getTrackedCount(): {
    users: number;
    shipments: number;
    configs: number;
    priceLists: number;
  } {
    return {
      users: this.userIds.size,
      shipments: this.shipmentIds.size,
      configs: this.configIds.size,
      priceLists: this.priceListIds.size,
    };
  }
}

/**
 * Quick cleanup function for simple cases
 * Deletes a user and all related data
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  const cleanup = new TestCleanup();
  cleanup.trackUser(userId);
  await cleanup.execute();
}

/**
 * Quick cleanup function for multiple users
 */
export async function cleanupTestUsers(userIds: string[]): Promise<void> {
  const cleanup = new TestCleanup();
  cleanup.trackUsers(userIds);
  await cleanup.execute();
}

/**
 * Full cleanup for test user - deletes from both public.users AND auth.users
 * Use this in security tests that create users via auth.admin.createUser
 *
 * IMPORTANT: This function deletes from public.users FIRST (cascade dependencies),
 * then from auth.users. This order is critical to avoid orphaned records.
 */
export async function cleanupTestUserFull(userId: string): Promise<void> {
  if (!userId) return;

  // 1. Delete cascade dependencies from public schema
  await supabaseAdmin.from('courier_configs').delete().eq('owner_user_id', userId);
  await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', userId);
  await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userId);
  await supabaseAdmin.from('top_up_requests').delete().eq('user_id', userId);
  await supabaseAdmin.from('shipments').delete().eq('user_id', userId);
  await supabaseAdmin.from('price_list_assignments').delete().eq('user_id', userId);
  await supabaseAdmin.from('platform_provider_costs').delete().eq('billed_user_id', userId);
  await supabaseAdmin.from('user_spedisci_online_configs').delete().eq('user_id', userId);

  // 2. Delete from public.users
  await supabaseAdmin.from('users').delete().eq('id', userId);

  // 3. Delete from auth.users (if it still exists)
  try {
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch {
    // Ignore errors - user might already be deleted or not exist in auth
  }
}
