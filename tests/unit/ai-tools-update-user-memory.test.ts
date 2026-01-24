import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/ai/user-memory', () => ({
  upsertUserMemory: vi.fn(),
}));

import { executeTool } from '@/lib/ai/tools';
import { upsertUserMemory } from '@/lib/ai/user-memory';

/**
 * NOTE: The update_user_memory tool is not yet integrated into ANNE_TOOLS.
 * These tests are skipped until the tool is implemented.
 * See: lib/ai/user-memory.ts for the underlying upsertUserMemory function.
 */
describe.skip('executeTool update_user_memory', () => {
  it('rejects invalid preferredCouriers', async () => {
    const result = await executeTool(
      {
        name: 'update_user_memory',
        arguments: {
          preferredCouriers: 'GLS',
        },
      },
      'user-1',
      'user'
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/preferredCouriers/i);
  });

  it('persists memory and returns success', async () => {
    (upsertUserMemory as any).mockResolvedValue({
      preferences: { tone: 'amichevole' },
    });

    const result = await executeTool(
      {
        name: 'update_user_memory',
        arguments: {
          preferences: { tone: 'amichevole' },
        },
      },
      'user-1',
      'user'
    );

    expect(result.success).toBe(true);
    expect(result.result?.message).toMatch(/Preferenze salvate/i);
    expect(upsertUserMemory).toHaveBeenCalledOnce();
  });
});
