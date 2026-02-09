/**
 * Test: Navigation workspace-type filtering
 *
 * Verifica che getNavigationForUser() filtri correttamente le sezioni
 * in base al workspaceType passato (platform, reseller, client).
 *
 * Quando workspaceType === 'client', il reseller opera come se fosse
 * il client: vede solo Dashboard, Spedizioni, Resi, Account ridotto, Supporto ridotto.
 */

import { describe, it, expect } from 'vitest';
import { getNavigationForUser } from '@/lib/config/navigationConfig';

describe('getNavigationForUser - workspaceType filtering', () => {
  // ============================================
  // workspaceType === 'client'
  // ============================================

  describe('workspaceType: client', () => {
    it('mostra solo sezioni operative per un user in workspace client', () => {
      const config = getNavigationForUser('user', {
        workspaceType: 'client',
      });

      const sectionIds = config.sections.map((s) => s.id);

      // Deve mostrare solo: logistics, returns, account (ridotto), support (ridotto)
      expect(sectionIds).toContain('logistics');
      expect(sectionIds).toContain('returns');
      expect(sectionIds).toContain('account');
      expect(sectionIds).toContain('support');

      // NON deve mostrare sezioni business/admin
      expect(sectionIds).not.toContain('reseller');
      expect(sectionIds).not.toContain('admin');
      expect(sectionIds).not.toContain('superadmin-finance');
      expect(sectionIds).not.toContain('communications');
      expect(sectionIds).not.toContain('byoc');
      expect(sectionIds).not.toContain('finance');
    });

    it('filtra account section: solo wallet, profile, settings, courier-config', () => {
      const config = getNavigationForUser('user', {
        workspaceType: 'client',
      });

      const accountSection = config.sections.find((s) => s.id === 'account');
      expect(accountSection).toBeDefined();

      const accountItemIds = accountSection!.items.map((i) => i.id);
      expect(accountItemIds).toContain('wallet');
      expect(accountItemIds).toContain('profile');
      expect(accountItemIds).toContain('settings');
      expect(accountItemIds).toContain('courier-config');

      // NON deve mostrare: invoices, security, integrations
      expect(accountItemIds).not.toContain('invoices');
      expect(accountItemIds).not.toContain('security');
      expect(accountItemIds).not.toContain('integrations');
    });

    it('filtra support section: solo manuale', () => {
      const config = getNavigationForUser('user', {
        workspaceType: 'client',
      });

      const supportSection = config.sections.find((s) => s.id === 'support');
      expect(supportSection).toBeDefined();

      const supportItemIds = supportSection!.items.map((i) => i.id);
      expect(supportItemIds).toContain('manual');
      expect(supportItemIds).not.toContain('escalations');
    });

    it('superadmin in workspace client NON vede admin sections', () => {
      const config = getNavigationForUser('superadmin', {
        workspaceType: 'client',
        accountType: 'superadmin',
      });

      const sectionIds = config.sections.map((s) => s.id);

      // Anche se superadmin, in workspace client vede solo operativo
      expect(sectionIds).not.toContain('admin');
      expect(sectionIds).not.toContain('superadmin-finance');
      expect(sectionIds).not.toContain('communications');

      // Deve vedere le sezioni operative
      expect(sectionIds).toContain('logistics');
      expect(sectionIds).toContain('returns');
    });

    it('reseller in workspace client NON vede sezione Gestione Business', () => {
      const config = getNavigationForUser('user', {
        isReseller: true,
        workspaceType: 'client',
      });

      const sectionIds = config.sections.map((s) => s.id);
      expect(sectionIds).not.toContain('reseller');
    });

    it('include dashboardItem e mainActions', () => {
      const config = getNavigationForUser('user', {
        workspaceType: 'client',
      });

      expect(config.dashboardItem).toBeDefined();
      expect(config.dashboardItem?.id).toBe('dashboard');
      expect(config.mainActions.length).toBeGreaterThan(0);
      expect(config.mainActions[0].id).toBe('ai-assistant');
    });
  });

  // ============================================
  // workspaceType: reseller (nessun filtro speciale)
  // ============================================

  describe('workspaceType: reseller', () => {
    it('reseller vede Gestione Business nel proprio workspace', () => {
      const config = getNavigationForUser('user', {
        isReseller: true,
        workspaceType: 'reseller',
      });

      const sectionIds = config.sections.map((s) => s.id);
      expect(sectionIds).toContain('reseller');
      expect(sectionIds).toContain('logistics');
    });
  });

  // ============================================
  // Senza workspaceType (backward compatibility)
  // ============================================

  describe('senza workspaceType (backward compatibility)', () => {
    it('comportamento invariato per user senza workspaceType', () => {
      const config = getNavigationForUser('user');

      const sectionIds = config.sections.map((s) => s.id);
      expect(sectionIds).toContain('logistics');
      expect(sectionIds).toContain('returns');
      expect(sectionIds).toContain('account');
      expect(sectionIds).toContain('support');
    });

    it('superadmin senza workspaceType vede tutte le sezioni admin', () => {
      const config = getNavigationForUser('superadmin', {
        accountType: 'superadmin',
      });

      const sectionIds = config.sections.map((s) => s.id);
      expect(sectionIds).toContain('admin');
      expect(sectionIds).toContain('superadmin-finance');
      expect(sectionIds).toContain('communications');
    });

    it('reseller senza workspaceType vede Gestione Business', () => {
      const config = getNavigationForUser('user', {
        isReseller: true,
      });

      const sectionIds = config.sections.map((s) => s.id);
      expect(sectionIds).toContain('reseller');
    });
  });
});
