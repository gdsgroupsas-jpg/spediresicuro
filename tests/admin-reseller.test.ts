/**
 * Test per Admin Reseller Actions
 *
 * Verifica funzionamento getAllClientsForUser() e getSubUsers() aggiornato.
 *
 * Il codice reale usa getWorkspaceAuth() da @/lib/workspace-auth.
 * getWorkspaceAuth() restituisce WorkspaceActingContext con:
 * - actor: { id, email, name, role, account_type, is_reseller, ... }
 * - workspace: { id, name, ... } | null
 *
 * canViewAllClients() controlla actor.account_type === 'superadmin' o hasCapability
 * isCurrentUserReseller() controlla actor.is_reseller
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAllClientsForUser, getSubUsers } from '@/actions/admin-reseller';
import { supabaseAdmin } from '@/lib/db/client';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { hasCapability } from '@/lib/db/capability-helpers';

// Mock dependencies
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock getWorkspaceAuth — funzione usata dal codice reale
vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: vi.fn(),
  isSuperAdmin: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: vi.fn(),
}));

vi.mock('@/lib/db/capability-helpers', () => ({
  hasCapability: vi.fn(),
}));

describe('Admin Reseller Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllClientsForUser', () => {
    it('should return error if not authenticated', async () => {
      (getWorkspaceAuth as any).mockResolvedValue(null);

      const result = await getAllClientsForUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Non autenticato');
    });

    it('should return error if user cannot view all clients', async () => {
      // Utente normale (non superadmin, non admin)
      (getWorkspaceAuth as any).mockResolvedValue({
        actor: {
          id: 'user-id',
          email: 'user@test.com',
          name: 'User',
          role: 'user',
          account_type: 'user',
          is_reseller: false,
        },
        workspace: null,
      });
      (hasCapability as any).mockResolvedValue(false);

      const result = await getAllClientsForUser();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Solo Superadmin/Admin');
    });

    it('should return hierarchical clients for superadmin', async () => {
      // Superadmin con workspace
      (getWorkspaceAuth as any).mockResolvedValue({
        actor: {
          id: 'admin-id',
          email: 'admin@test.com',
          name: 'Admin',
          role: 'admin',
          account_type: 'superadmin',
          is_reseller: false,
        },
        workspace: { id: 'ws-admin', name: 'Admin Workspace' },
      });

      // getAllClientsForUser:
      // 1. Chiama canViewAllClients() → getWorkspaceAuth() (mockato sopra, account_type=superadmin → true)
      // 2. supabaseAdmin.from('users').select(...).eq('is_reseller', true).order(...) → resellers query
      // 3. Per ogni reseller: supabaseAdmin.from('users').select(...).eq('parent_id', ...).eq('is_reseller', false).order(...) → sub-users
      // 4. supabaseAdmin.from('users').select(...).eq('account_type', 'byoc').order(...) → byoc

      // Mock resellers query
      const resellersQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'reseller-1',
                  email: 'reseller1@test.com',
                  name: 'Reseller 1',
                  company_name: 'Company 1',
                  phone: '123',
                  created_at: '2025-01-01',
                  reseller_tier: null,
                },
              ],
              error: null,
            }),
          })),
        })),
      };

      // Mock sub-users query per reseller-1
      const subUsersQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    email: 'sub1@test.com',
                    name: 'Sub User 1',
                    company_name: null,
                    phone: null,
                    created_at: '2025-01-02',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      };

      // Mock BYOC query
      const byocQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'byoc-1',
                  email: 'byoc1@test.com',
                  name: 'BYOC Client 1',
                  company_name: 'BYOC Company',
                  phone: '456',
                  created_at: '2025-01-03',
                },
              ],
              error: null,
            }),
          })),
        })),
      };

      (supabaseAdmin.from as any)
        .mockReturnValueOnce(resellersQuery) // Resellers query
        .mockReturnValueOnce(subUsersQuery) // Sub-users per reseller-1
        .mockReturnValueOnce(byocQuery); // BYOC query

      const result = await getAllClientsForUser();

      expect(result.success).toBe(true);
      expect(result.clients).toBeDefined();
      expect(result.clients?.resellers).toHaveLength(1);
      expect(result.clients?.byocClients).toHaveLength(1);
      expect(result.clients?.stats.totalResellers).toBe(1);
      expect(result.clients?.stats.totalSubUsers).toBe(1);
      expect(result.clients?.stats.totalBYOC).toBe(1);
    });
  });

  describe('getSubUsers (updated)', () => {
    it('should return all sub-users for superadmin', async () => {
      // Superadmin: canViewAllClients() e isCurrentUserReseller() usano getWorkspaceAuth()
      // Il codice chiama getWorkspaceAuth() 2 volte:
      // 1. context in getSubUsers() → actor.email check
      // 2. canViewAllClients() → getWorkspaceAuth() → actor.account_type = superadmin → true
      // 3. isCurrentUserReseller() → getWorkspaceAuth() → actor.is_reseller
      (getWorkspaceAuth as any).mockResolvedValue({
        actor: {
          id: 'admin-id',
          email: 'admin@test.com',
          name: 'Admin',
          role: 'admin',
          account_type: 'superadmin',
          is_reseller: false,
        },
        workspace: { id: 'ws-admin', name: 'Admin Workspace' },
      });

      // Dopo canViewAll.canView=true, il codice fa:
      // supabaseAdmin.from('users').select('id, email, name, ...').not('parent_id', 'is', null).eq('is_reseller', false).order(...)
      const allSubUsersQuery = {
        select: vi.fn(() => ({
          not: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    email: 'sub1@test.com',
                    name: 'Sub User 1',
                    company_name: null,
                    phone: null,
                    created_at: '2025-01-02',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      };

      (supabaseAdmin.from as any).mockReturnValueOnce(allSubUsersQuery);
      (hasCapability as any).mockResolvedValue(true);

      const result = await getSubUsers();

      expect(result.success).toBe(true);
      expect(result.subUsers).toBeDefined();
      expect(result.subUsers?.length).toBeGreaterThan(0);
    });

    it('should return only reseller sub-users for reseller', async () => {
      // Reseller: canViewAllClients() → false, isCurrentUserReseller() → true
      (getWorkspaceAuth as any).mockResolvedValue({
        actor: {
          id: 'reseller-id',
          email: 'reseller@test.com',
          name: 'Reseller',
          role: 'user',
          account_type: 'user',
          is_reseller: true,
        },
        workspace: { id: 'ws-reseller', name: 'Reseller Workspace' },
      });
      (hasCapability as any).mockResolvedValue(false);

      // Dopo resellerCheck.isReseller=true, il codice fa:
      // supabaseAdmin.from('users').select('id, email, name, ...').eq('parent_id', resellerId).eq('is_reseller', false).order(...)
      const subUsersQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'sub-1',
                    email: 'sub1@test.com',
                    name: 'Sub User 1',
                    company_name: null,
                    phone: null,
                    wallet_balance: 50,
                    created_at: '2025-01-02',
                  },
                ],
                error: null,
              }),
            })),
          })),
        })),
      };

      (supabaseAdmin.from as any).mockReturnValueOnce(subUsersQuery);

      const result = await getSubUsers();

      expect(result.success).toBe(true);
      expect(result.subUsers).toBeDefined();
      expect(result.subUsers?.length).toBe(1);
    });
  });
});
