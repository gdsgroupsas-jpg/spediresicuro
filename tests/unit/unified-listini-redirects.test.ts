/**
 * Unified Listini Redirects - Test
 *
 * Verifica che le vecchie pagine listini facciano redirect
 * alle nuove pagine unificate.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

describe('Unified Listini Redirects', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('listini-master should redirect to /dashboard/listini?tab=master', async () => {
    try {
      const mod = await import('@/app/dashboard/super-admin/listini-master/page');
      mod.default();
    } catch (e: any) {
      expect(e.message).toBe('NEXT_REDIRECT:/dashboard/listini?tab=master');
    }
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/listini?tab=master');
  });

  it('listini-fornitore should redirect to /dashboard/reseller/listini?tab=fornitore', async () => {
    try {
      const mod = await import('@/app/dashboard/reseller/listini-fornitore/page');
      mod.default();
    } catch (e: any) {
      expect(e.message).toBe('NEXT_REDIRECT:/dashboard/reseller/listini?tab=fornitore');
    }
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/reseller/listini?tab=fornitore');
  });

  it('listini-personalizzati should redirect to /dashboard/reseller/listini?tab=personalizzati', async () => {
    try {
      const mod = await import('@/app/dashboard/reseller/listini-personalizzati/page');
      mod.default();
    } catch (e: any) {
      expect(e.message).toBe('NEXT_REDIRECT:/dashboard/reseller/listini?tab=personalizzati');
    }
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/reseller/listini?tab=personalizzati');
  });
});
