/**
 * Test per Tenant Helpers
 * 
 * Verifica funzionamento sistema tenant_id con fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUserTenant,
  getUserTenantWithQuery,
  isSameTenant,
  getUsersByTenant,
} from '@/lib/db/tenant-helpers';
import { supabaseAdmin } from '@/lib/db/client';

// Mock supabaseAdmin
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        or: vi.fn(() => ({
          map: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('Tenant Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserTenant', () => {
    it('should return tenant_id if provided in fallbackUser', async () => {
      const result = await getUserTenant('user-id', {
        tenant_id: 'tenant-123',
        parent_id: 'parent-456',
      });
      expect(result).toBe('tenant-123');
    });

    it('should fallback to parent_id if tenant_id is null', async () => {
      const result = await getUserTenant('user-id', {
        tenant_id: null,
        parent_id: 'parent-456',
      });
      expect(result).toBe('parent-456');
    });

    it('should fallback to user_id if both tenant_id and parent_id are null', async () => {
      const result = await getUserTenant('user-id', {
        tenant_id: null,
        parent_id: null,
      });
      expect(result).toBe('user-id');
    });

    it('should use database function if fallbackUser not provided', async () => {
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: 'tenant-from-db',
        error: null,
      });

      const result = await getUserTenant('user-id');
      expect(result).toBe('tenant-from-db');
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_user_tenant', {
        p_user_id: 'user-id',
      });
    });

    it('should handle database errors gracefully', async () => {
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await getUserTenant('user-id');
      expect(result).toBe('user-id'); // Fallback a user_id
    });
  });

  describe('getUserTenantWithQuery', () => {
    it('should query user and return tenant_id', async () => {
      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                tenant_id: 'tenant-123',
                parent_id: 'parent-456',
              },
              error: null,
            }),
          })),
        })),
      });

      const result = await getUserTenantWithQuery('user-id');
      expect(result).toBe('tenant-123');
    });

    it('should fallback to parent_id if tenant_id is null', async () => {
      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                tenant_id: null,
                parent_id: 'parent-456',
              },
              error: null,
            }),
          })),
        })),
      });

      const result = await getUserTenantWithQuery('user-id');
      expect(result).toBe('parent-456');
    });

    it('should handle user not found', async () => {
      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' },
            }),
          })),
        })),
      });

      const result = await getUserTenantWithQuery('user-id');
      expect(result).toBe('user-id'); // Fallback a user_id
    });
  });

  describe('isSameTenant', () => {
    it('should return true if same tenant', async () => {
      // Mock getUserTenant per entrambe le chiamate
      (supabaseAdmin.rpc as any)
        .mockResolvedValueOnce({ data: 'tenant-123', error: null })
        .mockResolvedValueOnce({ data: 'tenant-123', error: null });

      const result = await isSameTenant('user-1', 'user-2');
      expect(result).toBe(true);
    });

    it('should return false if different tenants', async () => {
      (supabaseAdmin.rpc as any)
        .mockResolvedValueOnce({ data: 'tenant-123', error: null })
        .mockResolvedValueOnce({ data: 'tenant-456', error: null });

      const result = await isSameTenant('user-1', 'user-2');
      expect(result).toBe(false);
    });
  });

  describe('getUsersByTenant', () => {
    it('should return users for tenant', async () => {
      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => ({
          or: vi.fn().mockResolvedValue({
            data: [
              { id: 'user-1' },
              { id: 'user-2' },
            ],
            error: null,
          }),
        })),
      });

      const result = await getUsersByTenant('tenant-123');
      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array on error', async () => {
      (supabaseAdmin.from as any).mockReturnValue({
        select: vi.fn(() => ({
          or: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        })),
      });

      const result = await getUsersByTenant('tenant-123');
      expect(result).toEqual([]);
    });
  });
});
