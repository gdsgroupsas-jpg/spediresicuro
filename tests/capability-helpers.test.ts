/**
 * Test per Capability Helpers
 * 
 * Verifica funzionamento sistema capability con fallback
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasCapability, hasCapabilityFallback } from '@/lib/db/capability-helpers';
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
        is: vi.fn(() => ({
          map: vi.fn(),
        })),
      })),
    })),
  },
}));

describe('Capability Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasCapability', () => {
    it('should return true if capability exists in database', async () => {
      // Mock: capability trovata in DB
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await hasCapability('user-id', 'can_manage_pricing');
      expect(result).toBe(true);
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('has_capability', {
        p_user_id: 'user-id',
        p_capability_name: 'can_manage_pricing',
      });
    });

    it('should fallback to role if capability not found', async () => {
      // Mock: capability non trovata in DB
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await hasCapability(
        'user-id',
        'can_manage_pricing',
        {
          role: 'admin',
          account_type: 'admin',
        }
      );

      // Dovrebbe usare fallback e restituire true
      expect(result).toBe(true);
    });

    it('should return false for unknown capability', async () => {
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: false,
        error: null,
      });

      const result = await hasCapability(
        'user-id',
        'unknown_capability',
        {
          role: 'admin',
        }
      );

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      // Mock: errore database
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await hasCapability(
        'user-id',
        'can_manage_pricing',
        {
          role: 'admin',
        }
      );

      // Dovrebbe usare fallback
      expect(result).toBe(true);
    });
  });

  describe('hasCapabilityFallback', () => {
    it('should return true for admin with can_manage_pricing', () => {
      const result = hasCapabilityFallback('can_manage_pricing', {
        role: 'admin',
        account_type: 'admin',
      });
      expect(result).toBe(true);
    });

    it('should return true for superadmin with can_manage_resellers', () => {
      const result = hasCapabilityFallback('can_manage_resellers', {
        account_type: 'superadmin',
      });
      expect(result).toBe(true);
    });

    it('should return false for user without capability', () => {
      const result = hasCapabilityFallback('can_manage_pricing', {
        role: 'user',
        account_type: 'user',
      });
      expect(result).toBe(false);
    });

    it('should return true for reseller with can_create_subusers', () => {
      const result = hasCapabilityFallback('can_create_subusers', {
        is_reseller: true,
      });
      expect(result).toBe(true);
    });

    it('should return false if user data not provided', () => {
      const result = hasCapabilityFallback('can_manage_pricing', undefined);
      expect(result).toBe(false);
    });
  });
});
