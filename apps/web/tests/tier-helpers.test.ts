/**
 * Test per Tier Helpers
 *
 * Verifica funzionamento getResellerTier(), calculateTierFromSubUsers(), getTierLimits()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabaseAdmin } from '@/lib/db/client';

// Mock dependencies
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

// Import dopo mock
import {
  getResellerTier,
  calculateTierFromSubUsers,
  getTierLimits,
  isTierAtLimit,
} from '@/lib/db/tier-helpers';

describe('Tier Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTierFromSubUsers', () => {
    it('should return small for < 10 sub-users', () => {
      expect(calculateTierFromSubUsers(0)).toBe('small');
      expect(calculateTierFromSubUsers(5)).toBe('small');
      expect(calculateTierFromSubUsers(9)).toBe('small');
    });

    it('should return medium for 10-100 sub-users (incluso)', () => {
      expect(calculateTierFromSubUsers(10)).toBe('medium');
      expect(calculateTierFromSubUsers(50)).toBe('medium');
      expect(calculateTierFromSubUsers(99)).toBe('medium');
      expect(calculateTierFromSubUsers(100)).toBe('medium'); // Boundary: 100 è medium
    });

    it('should return enterprise for > 100 sub-users', () => {
      expect(calculateTierFromSubUsers(101)).toBe('enterprise');
      expect(calculateTierFromSubUsers(150)).toBe('enterprise');
      expect(calculateTierFromSubUsers(1000)).toBe('enterprise');
    });

    it('should handle edge cases', () => {
      expect(calculateTierFromSubUsers(-1)).toBe('small'); // Edge case
      expect(calculateTierFromSubUsers(0)).toBe('small');
    });
  });

  describe('getTierLimits', () => {
    it('should return correct limits for small tier', () => {
      const limits = getTierLimits('small');
      expect(limits.maxSubUsers).toBe(10);
      expect(limits.features).toContain('base');
    });

    it('should return correct limits for medium tier', () => {
      const limits = getTierLimits('medium');
      expect(limits.maxSubUsers).toBe(100);
      expect(limits.features).toContain('advanced');
    });

    it('should return correct limits for enterprise tier', () => {
      const limits = getTierLimits('enterprise');
      expect(limits.maxSubUsers).toBe(null); // Unlimited
      expect(limits.features).toContain('unlimited');
    });

    it('should throw error for invalid tier', () => {
      expect(() => getTierLimits('invalid' as any)).toThrow();
    });
  });

  describe('isTierAtLimit', () => {
    it('should return false for small tier below limit', () => {
      expect(isTierAtLimit('small', 9)).toBe(false);
      expect(isTierAtLimit('small', 5)).toBe(false);
    });

    it('should return true for small tier at limit', () => {
      expect(isTierAtLimit('small', 10)).toBe(true);
      expect(isTierAtLimit('small', 11)).toBe(true);
    });

    it('should return false for medium tier below limit', () => {
      expect(isTierAtLimit('medium', 99)).toBe(false);
      expect(isTierAtLimit('medium', 50)).toBe(false);
    });

    it('should return true for medium tier at limit', () => {
      expect(isTierAtLimit('medium', 100)).toBe(true);
      expect(isTierAtLimit('medium', 101)).toBe(true);
    });

    it('should always return false for enterprise tier', () => {
      expect(isTierAtLimit('enterprise', 100)).toBe(false);
      expect(isTierAtLimit('enterprise', 1000)).toBe(false);
      expect(isTierAtLimit('enterprise', 10000)).toBe(false);
    });
  });

  describe('getResellerTier', () => {
    it('should return tier from database if exists', async () => {
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: 'medium',
        error: null,
      });

      const result = await getResellerTier('user-id-123');

      expect(result).toBe('medium');
      expect(supabaseAdmin.rpc).toHaveBeenCalledWith('get_reseller_tier', {
        p_user_id: 'user-id-123',
      });
    });

    it('should return null for non-reseller', async () => {
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await getResellerTier('user-id-123');

      expect(result).toBeNull();
    });

    it('should calculate tier from sub-users count if tier is null and fallback provided', async () => {
      // Se fallbackUser ha subUsersCount, calcola direttamente (non chiama DB)
      const result = await getResellerTier('user-id-123', {
        id: 'user-id-123',
        is_reseller: true,
        subUsersCount: 15,
      } as any);

      expect(result).toBe('medium'); // 15 sub-users = medium
      // Non dovrebbe chiamare RPC se fallbackUser ha subUsersCount
      expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      (supabaseAdmin.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await getResellerTier('user-id-123');

      expect(result).toBeNull();
    });
  });
});
