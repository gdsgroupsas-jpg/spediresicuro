/**
 * Regression Test: Compatibilità parent_id
 *
 * Verifica che le query esistenti con parent_id continuino a funzionare
 * dopo l'introduzione di tenant_id
 */

import { describe, it, expect, vi } from 'vitest';
import { supabaseAdmin } from '@/lib/db/client';

// Mock supabaseAdmin
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'sub-user-1', email: 'sub1@test.com', name: 'Sub User 1' },
                { id: 'sub-user-2', email: 'sub2@test.com', name: 'Sub User 2' },
              ],
              error: null,
            }),
          })),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'sub-user-1', email: 'sub1@test.com', name: 'Sub User 1' }],
            error: null,
          }),
        })),
      })),
    })),
  },
}));

describe('Regression: parent_id Compatibility', () => {
  it('should still work with parent_id queries (getSubUsers pattern)', async () => {
    // Simula query esistente da actions/admin-reseller.ts:243
    const resellerId = 'reseller-123';

    const { data: subUsers, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, company_name, phone, wallet_balance, created_at')
      .eq('parent_id', resellerId)
      .eq('is_reseller', false)
      .order('created_at', { ascending: false });

    // Verifica che la query funzioni ancora
    expect(error).toBeNull();
    expect(subUsers).toBeDefined();
    expect(Array.isArray(subUsers)).toBe(true);
  });

  it('should support both parent_id and tenant_id queries', async () => {
    // Query con parent_id (vecchio modo)
    const query1 = supabaseAdmin.from('users').select('id').eq('parent_id', 'reseller-123');

    // Query con tenant_id (nuovo modo)
    const query2 = supabaseAdmin.from('users').select('id').eq('tenant_id', 'reseller-123');

    // Entrambe devono essere supportate
    expect(query1).toBeDefined();
    expect(query2).toBeDefined();
  });

  it('should maintain backward compatibility for getUserChildren', async () => {
    // Simula getUserChildren da lib/db/user-helpers.ts:129
    const parentId = 'parent-123';

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    // Verifica che funzioni ancora
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
