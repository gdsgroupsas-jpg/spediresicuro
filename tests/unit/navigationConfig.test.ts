/**
 * Navigation Config Tests
 *
 * Test suite per verificare:
 * - RBAC (Role-Based Access Control)
 * - Nested sections structure
 * - Feature flags filtering
 * - Section ordering
 */

import { describe, it, expect } from 'vitest';
import {
  getNavigationForUser,
  isNavItemActive,
  type UserRole,
  FEATURES,
} from '@/lib/config/navigationConfig';

describe('navigationConfig - RBAC Filtering', () => {
  describe('User role', () => {
    it('should NOT show admin sections to regular user', () => {
      const config = getNavigationForUser('user', { isReseller: false });

      const hasAdminSection = config.sections.some((s) => s.id === 'admin');
      const hasSuperAdminFinance = config.sections.some((s) => s.id === 'superadmin-finance');

      expect(hasAdminSection).toBe(false);
      expect(hasSuperAdminFinance).toBe(false);
    });

    it('should show logistics and returns sections to user', () => {
      const config = getNavigationForUser('user', { isReseller: false });

      const hasLogistics = config.sections.some((s) => s.id === 'logistics');
      const hasReturns = config.sections.some((s) => s.id === 'returns');

      expect(hasLogistics).toBe(true);
      expect(hasReturns).toBe(true);
    });

    it('should show account section to all users', () => {
      const config = getNavigationForUser('user');

      const hasAccount = config.sections.some((s) => s.id === 'account');
      expect(hasAccount).toBe(true);
    });
  });

  describe('Admin role', () => {
    it('should show admin section to admin', () => {
      const config = getNavigationForUser('admin', { isReseller: false });

      const adminSection = config.sections.find((s) => s.id === 'admin');
      expect(adminSection).toBeDefined();
    });

    it('should NOT show super-admin item to admin', () => {
      const config = getNavigationForUser('admin', { isReseller: false });

      const adminSection = config.sections.find((s) => s.id === 'admin');
      const hasSuperAdminItem = adminSection?.items.some((item) => item.id === 'super-admin');

      expect(hasSuperAdminItem).toBe(false);
    });

    it('should show admin-panel to admin', () => {
      const config = getNavigationForUser('admin', { isReseller: false });

      const adminSection = config.sections.find((s) => s.id === 'admin');
      const hasAdminPanel = adminSection?.items.some((item) => item.id === 'admin-panel');

      expect(hasAdminPanel).toBe(true);
    });

    it('should NOT show superadmin finance section to admin', () => {
      const config = getNavigationForUser('admin', { isReseller: false });

      const hasSuperAdminFinance = config.sections.some((s) => s.id === 'superadmin-finance');

      expect(hasSuperAdminFinance).toBe(false);
    });
  });

  describe('Superadmin role', () => {
    it('should show all sections to superadmin', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });

      const hasAdmin = config.sections.some((s) => s.id === 'admin');
      const hasSuperAdminFinance = config.sections.some((s) => s.id === 'superadmin-finance');
      const hasLogistics = config.sections.some((s) => s.id === 'logistics');

      expect(hasAdmin).toBe(true);
      expect(hasSuperAdminFinance).toBe(true);
      expect(hasLogistics).toBe(true);
    });

    it('should show super-admin item to superadmin', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });

      const adminSection = config.sections.find((s) => s.id === 'admin');
      const hasSuperAdminItem = adminSection?.items.some((item) => item.id === 'super-admin');

      expect(hasSuperAdminItem).toBe(true);
    });

    it('should have superadmin finance section BEFORE logistics (priority-first)', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });

      const financeIndex = config.sections.findIndex((s) => s.id === 'superadmin-finance');
      const logisticsIndex = config.sections.findIndex((s) => s.id === 'logistics');

      expect(financeIndex).toBeGreaterThanOrEqual(0);
      expect(logisticsIndex).toBeGreaterThanOrEqual(0);
      expect(financeIndex).toBeLessThan(logisticsIndex);
    });
  });

  describe('Reseller feature flag', () => {
    it('should show reseller section only when isReseller=true', () => {
      const configWithReseller = getNavigationForUser('user', {
        isReseller: true,
      });
      const configWithoutReseller = getNavigationForUser('user', {
        isReseller: false,
      });

      const hasResellerSection = configWithReseller.sections.some((s) => s.id === 'reseller');
      const hasNoResellerSection = configWithoutReseller.sections.every((s) => s.id !== 'reseller');

      expect(hasResellerSection).toBe(true);
      expect(hasNoResellerSection).toBe(true);
    });

    it('should have correct reseller section label', () => {
      const config = getNavigationForUser('user', { isReseller: true });

      const resellerSection = config.sections.find((s) => s.id === 'reseller');

      expect(resellerSection?.label).toBe('Gestione Business');
    });
  });

  describe('BYOC account type', () => {
    it('should show byoc section only when accountType=byoc', () => {
      const configWithBYOC = getNavigationForUser('user', {
        accountType: 'byoc',
      });
      const configWithoutBYOC = getNavigationForUser('user', {
        accountType: 'user',
      });

      const hasByocSection = configWithBYOC.sections.some((s) => s.id === 'byoc');
      const hasNoByocSection = configWithoutBYOC.sections.every((s) => s.id !== 'byoc');

      expect(hasByocSection).toBe(true);
      expect(hasNoByocSection).toBe(true);
    });
  });
});

describe('navigationConfig - Nested Sections', () => {
  it('should have admin section with subsections', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');

    expect(adminSection).toBeDefined();
    expect(adminSection?.subsections).toBeDefined();
    expect(adminSection?.subsections?.length).toBeGreaterThan(0);
  });

  it('should have exactly 3 admin subsections', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');

    expect(adminSection?.subsections).toHaveLength(3);
  });

  it('should have correct subsection IDs', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const subsectionIds = adminSection?.subsections?.map((s) => s.id);

    expect(subsectionIds).toContain('admin-users');
    expect(subsectionIds).toContain('admin-finance');
    expect(subsectionIds).toContain('admin-system');
  });

  it('should have items in admin-users subsection', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const usersSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-users');

    expect(usersSubsection?.items).toBeDefined();
    expect(usersSubsection?.items.length).toBeGreaterThan(0);
  });

  it('should have team and leads items in admin-users', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const usersSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-users');
    const itemIds = usersSubsection?.items.map((i) => i.id);

    expect(itemIds).toContain('team');
    expect(itemIds).toContain('leads');
  });

  it('should have admin-finance subsection with 7 items', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const financeSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-finance');

    expect(financeSubsection?.items).toHaveLength(7);
  });

  it('should have admin-system subsection with 5 items', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const systemSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-system');

    expect(systemSubsection?.items).toHaveLength(5);
  });
});

describe('navigationConfig - Section Ordering', () => {
  it('should have superadmin sections in correct priority order', () => {
    const config = getNavigationForUser('superadmin');

    const sectionIds = config.sections.map((s) => s.id);

    // Verifica che finanza piattaforma venga prima di logistics
    const financeIndex = sectionIds.indexOf('superadmin-finance');
    const adminIndex = sectionIds.indexOf('admin');
    const logisticsIndex = sectionIds.indexOf('logistics');

    expect(financeIndex).toBeLessThan(adminIndex);
    expect(adminIndex).toBeLessThan(logisticsIndex);
  });

  it('should have user sections in correct order', () => {
    const config = getNavigationForUser('user');

    const sectionIds = config.sections.map((s) => s.id);

    const logisticsIndex = sectionIds.indexOf('logistics');
    const returnsIndex = sectionIds.indexOf('returns');
    const accountIndex = sectionIds.indexOf('account');

    expect(logisticsIndex).toBeGreaterThanOrEqual(0);
    expect(returnsIndex).toBeGreaterThanOrEqual(0);
    expect(accountIndex).toBeGreaterThanOrEqual(0);
    expect(logisticsIndex).toBeLessThan(accountIndex);
  });

  it('should have support as the last section for user role', () => {
    const config = getNavigationForUser('user');

    const sectionIds = config.sections.map((s) => s.id);
    // Communications is superadmin-only, so user only sees support at the end
    expect(sectionIds[sectionIds.length - 1]).toBe('support');
    expect(sectionIds).not.toContain('communications');
  });

  it('should have communications and support at the end for superadmin', () => {
    const config = getNavigationForUser('superadmin');

    const sectionIds = config.sections.map((s) => s.id);
    const lastTwoSections = sectionIds.slice(-2);

    expect(lastTwoSections).toContain('communications');
    expect(lastTwoSections).toContain('support');
  });
});

describe('navigationConfig - Dashboard and Main Actions', () => {
  it('should have dashboard item', () => {
    const config = getNavigationForUser('user');

    expect(config.dashboardItem).toBeDefined();
    expect(config.dashboardItem?.id).toBe('dashboard');
    expect(config.dashboardItem?.href).toBe('/dashboard');
  });

  it('should have AI assistant in main actions', () => {
    const config = getNavigationForUser('user');

    const hasAiAssistant = config.mainActions.some((action) => action.id === 'ai-assistant');

    expect(hasAiAssistant).toBe(true);
    expect(config.mainActions).toHaveLength(1);
  });
});

describe('isNavItemActive helper', () => {
  it('should return true for exact dashboard match', () => {
    const result = isNavItemActive('/dashboard', '/dashboard');
    expect(result).toBe(true);
  });

  it('should return false for dashboard when on subpage', () => {
    const result = isNavItemActive('/dashboard', '/dashboard/spedizioni');
    expect(result).toBe(false);
  });

  it('should return true for matching subpath', () => {
    const result = isNavItemActive('/dashboard/admin', '/dashboard/admin/features');
    expect(result).toBe(true);
  });

  it('should return true for exact subpath match', () => {
    const result = isNavItemActive('/dashboard/admin', '/dashboard/admin');
    expect(result).toBe(true);
  });

  it('should return false for non-matching path', () => {
    const result = isNavItemActive('/dashboard/admin', '/dashboard/reseller');
    expect(result).toBe(false);
  });
});

describe('navigationConfig - Unified Listini Refactor', () => {
  describe('Reseller section', () => {
    it('should have single "Listini" item instead of fornitore + personalizzati', () => {
      const config = getNavigationForUser('user', { isReseller: true });
      const resellerSection = config.sections.find((s) => s.id === 'reseller');
      const itemIds = resellerSection?.items.map((i) => i.id) || [];

      expect(itemIds).toContain('reseller-listini');
      expect(itemIds).not.toContain('reseller-listini-fornitore');
      expect(itemIds).not.toContain('reseller-listini-personalizzati');
    });

    it('should have unified Listini pointing to /dashboard/reseller/listini', () => {
      const config = getNavigationForUser('user', { isReseller: true });
      const resellerSection = config.sections.find((s) => s.id === 'reseller');
      const listiniItem = resellerSection?.items.find((i) => i.id === 'reseller-listini');

      expect(listiniItem).toBeDefined();
      expect(listiniItem?.href).toBe('/dashboard/reseller/listini');
      expect(listiniItem?.label).toBe('Listini');
    });
  });

  describe('Superadmin finance section', () => {
    it('should NOT have listini-master item (moved to unified page)', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });
      const financeSection = config.sections.find((s) => s.id === 'superadmin-finance');
      const itemIds = financeSection?.items.map((i) => i.id) || [];

      expect(itemIds).not.toContain('listini-master');
    });
  });

  describe('Admin finance subsection', () => {
    it('should have "Listini" item (renamed from "Listini Prezzi")', () => {
      const config = getNavigationForUser('admin', { isReseller: false });
      const adminSection = config.sections.find((s) => s.id === 'admin');
      const financeSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-finance');
      const listiniItem = financeSubsection?.items.find((i) => i.id === 'price-lists');

      expect(listiniItem).toBeDefined();
      expect(listiniItem?.label).toBe('Listini');
      expect(listiniItem?.href).toBe('/dashboard/listini');
    });
  });
});

describe('navigationConfig - Reseller Team in Gestione Business', () => {
  it('reseller deve avere "Il Mio Team" nella sezione Gestione Business', () => {
    const config = getNavigationForUser('user', { isReseller: true });
    const resellerSection = config.sections.find((s) => s.id === 'reseller');
    const teamItem = resellerSection?.items.find((i) => i.id === 'reseller-team');

    expect(teamItem).toBeDefined();
    expect(teamItem?.label).toBe('Il Mio Team');
    expect(teamItem?.href).toBe('/dashboard/workspace/team');
  });

  it('reseller deve avere "Impostazioni Workspace" nella sezione Gestione Business', () => {
    const config = getNavigationForUser('user', { isReseller: true });
    const resellerSection = config.sections.find((s) => s.id === 'reseller');
    const settingsItem = resellerSection?.items.find((i) => i.id === 'workspace-settings');

    expect(settingsItem).toBeDefined();
    expect(settingsItem?.label).toBe('Impostazioni Workspace');
    expect(settingsItem?.href).toBe('/dashboard/workspace/settings');
  });

  it('reseller NON deve avere workspace-team in "Il Mio Account"', () => {
    const config = getNavigationForUser('user', { isReseller: true });
    const accountSection = config.sections.find((s) => s.id === 'account');
    const hasWorkspaceTeam = accountSection?.items.some((i) => i.id === 'workspace-team');

    expect(hasWorkspaceTeam).toBe(false);
  });

  it('admin non-reseller NON deve avere workspace-team in "Il Mio Account" (lo ha in Amministrazione)', () => {
    const config = getNavigationForUser('admin', { isReseller: false });
    const accountSection = config.sections.find((s) => s.id === 'account');
    const hasWorkspaceTeam = accountSection?.items.some((i) => i.id === 'workspace-team');

    expect(hasWorkspaceTeam).toBe(false);
  });

  it('superadmin non-reseller NON deve avere workspace-team in "Il Mio Account" (lo ha in Amministrazione)', () => {
    const config = getNavigationForUser('superadmin', { isReseller: false });
    const accountSection = config.sections.find((s) => s.id === 'account');
    const hasWorkspaceTeam = accountSection?.items.some((i) => i.id === 'workspace-team');

    expect(hasWorkspaceTeam).toBe(false);
  });

  it('BYOC deve avere workspace-team in "Il Mio Account"', () => {
    const config = getNavigationForUser('user', { accountType: 'byoc' });
    const accountSection = config.sections.find((s) => s.id === 'account');
    const hasWorkspaceTeam = accountSection?.items.some((i) => i.id === 'workspace-team');

    expect(hasWorkspaceTeam).toBe(true);
  });

  it('sezione Gestione Business deve avere 8 item totali per reseller', () => {
    const config = getNavigationForUser('user', { isReseller: true });
    const resellerSection = config.sections.find((s) => s.id === 'reseller');

    expect(resellerSection?.items).toHaveLength(9);
  });

  it('reseller deve avere "I Miei Prospect" nella sezione Gestione Business', () => {
    const config = getNavigationForUser('user', { isReseller: true });
    const resellerSection = config.sections.find((s) => s.id === 'reseller');
    const hasProspects = resellerSection?.items.some((i) => i.id === 'reseller-prospects');

    expect(hasProspects).toBe(true);
  });

  it('user semplice (non-reseller) NON deve avere workspace-team in "Il Mio Account"', () => {
    const config = getNavigationForUser('user', { isReseller: false });
    const accountSection = config.sections.find((s) => s.id === 'account');
    const hasWorkspaceTeam = accountSection?.items.some((i) => i.id === 'workspace-team');

    expect(hasWorkspaceTeam).toBe(false);
  });
});

describe('navigationConfig - Team Piattaforma per Superadmin', () => {
  it('superadmin deve avere "Team Piattaforma" in Amministrazione > Utenti & Team', () => {
    const config = getNavigationForUser('superadmin', { isReseller: false });
    const adminSection = config.sections.find((s) => s.id === 'admin');
    const usersSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-users');
    const teamItem = usersSubsection?.items.find((i) => i.id === 'team');

    expect(teamItem).toBeDefined();
    expect(teamItem?.label).toBe('Team Piattaforma');
    expect(teamItem?.href).toBe('/dashboard/workspace/team');
  });

  it('admin deve avere "Team Piattaforma" in Amministrazione > Utenti & Team', () => {
    const config = getNavigationForUser('admin', { isReseller: false });
    const adminSection = config.sections.find((s) => s.id === 'admin');
    const usersSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-users');
    const teamItem = usersSubsection?.items.find((i) => i.id === 'team');

    expect(teamItem).toBeDefined();
    expect(teamItem?.label).toBe('Team Piattaforma');
    expect(teamItem?.href).toBe('/dashboard/workspace/team');
  });

  it('"Team Piattaforma" punta alla pagina workspace team (non vecchia pagina /dashboard/team)', () => {
    const config = getNavigationForUser('superadmin', { isReseller: false });
    const adminSection = config.sections.find((s) => s.id === 'admin');
    const usersSubsection = adminSection?.subsections?.find((s) => s.id === 'admin-users');
    const teamItem = usersSubsection?.items.find((i) => i.id === 'team');

    expect(teamItem?.href).not.toBe('/dashboard/team');
    expect(teamItem?.href).toBe('/dashboard/workspace/team');
  });

  it('user NON vede Amministrazione (e quindi nemmeno Team Piattaforma)', () => {
    const config = getNavigationForUser('user', { isReseller: false });
    const adminSection = config.sections.find((s) => s.id === 'admin');

    expect(adminSection).toBeUndefined();
  });
});

describe('Feature Flags', () => {
  it('should have KEYBOARD_NAV enabled by default', () => {
    expect(FEATURES.KEYBOARD_NAV).toBe(true);
  });

  it('should have SIDEBAR_SEARCH disabled by default', () => {
    expect(FEATURES.SIDEBAR_SEARCH).toBe(false);
  });

  it('should have TELEMETRY disabled by default', () => {
    expect(FEATURES.TELEMETRY).toBe(false);
  });
});
