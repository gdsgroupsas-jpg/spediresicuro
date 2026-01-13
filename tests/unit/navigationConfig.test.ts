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
      const hasSuperAdminFinance = config.sections.some(
        (s) => s.id === 'superadmin-finance'
      );

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
      const hasSuperAdminItem = adminSection?.items.some(
        (item) => item.id === 'super-admin'
      );

      expect(hasSuperAdminItem).toBe(false);
    });

    it('should show admin-panel to admin', () => {
      const config = getNavigationForUser('admin', { isReseller: false });

      const adminSection = config.sections.find((s) => s.id === 'admin');
      const hasAdminPanel = adminSection?.items.some(
        (item) => item.id === 'admin-panel'
      );

      expect(hasAdminPanel).toBe(true);
    });

    it('should NOT show superadmin finance section to admin', () => {
      const config = getNavigationForUser('admin', { isReseller: false });

      const hasSuperAdminFinance = config.sections.some(
        (s) => s.id === 'superadmin-finance'
      );

      expect(hasSuperAdminFinance).toBe(false);
    });
  });

  describe('Superadmin role', () => {
    it('should show all sections to superadmin', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });

      const hasAdmin = config.sections.some((s) => s.id === 'admin');
      const hasSuperAdminFinance = config.sections.some(
        (s) => s.id === 'superadmin-finance'
      );
      const hasLogistics = config.sections.some((s) => s.id === 'logistics');

      expect(hasAdmin).toBe(true);
      expect(hasSuperAdminFinance).toBe(true);
      expect(hasLogistics).toBe(true);
    });

    it('should show super-admin item to superadmin', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });

      const adminSection = config.sections.find((s) => s.id === 'admin');
      const hasSuperAdminItem = adminSection?.items.some(
        (item) => item.id === 'super-admin'
      );

      expect(hasSuperAdminItem).toBe(true);
    });

    it('should have superadmin finance section BEFORE logistics (priority-first)', () => {
      const config = getNavigationForUser('superadmin', { isReseller: false });

      const financeIndex = config.sections.findIndex(
        (s) => s.id === 'superadmin-finance'
      );
      const logisticsIndex = config.sections.findIndex(
        (s) => s.id === 'logistics'
      );

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

      const hasResellerSection = configWithReseller.sections.some(
        (s) => s.id === 'reseller'
      );
      const hasNoResellerSection = configWithoutReseller.sections.every(
        (s) => s.id !== 'reseller'
      );

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

      const hasByocSection = configWithBYOC.sections.some(
        (s) => s.id === 'byoc'
      );
      const hasNoByocSection = configWithoutBYOC.sections.every(
        (s) => s.id !== 'byoc'
      );

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
    const usersSubsection = adminSection?.subsections?.find(
      (s) => s.id === 'admin-users'
    );

    expect(usersSubsection?.items).toBeDefined();
    expect(usersSubsection?.items.length).toBeGreaterThan(0);
  });

  it('should have team and leads items in admin-users', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const usersSubsection = adminSection?.subsections?.find(
      (s) => s.id === 'admin-users'
    );
    const itemIds = usersSubsection?.items.map((i) => i.id);

    expect(itemIds).toContain('team');
    expect(itemIds).toContain('leads');
  });

  it('should have admin-finance subsection with 7 items', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const financeSubsection = adminSection?.subsections?.find(
      (s) => s.id === 'admin-finance'
    );

    expect(financeSubsection?.items).toHaveLength(7);
  });

  it('should have admin-system subsection with 4 items', () => {
    const config = getNavigationForUser('admin');

    const adminSection = config.sections.find((s) => s.id === 'admin');
    const systemSubsection = adminSection?.subsections?.find(
      (s) => s.id === 'admin-system'
    );

    expect(systemSubsection?.items).toHaveLength(4);
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

  it('should have communications and support sections at the end', () => {
    const config = getNavigationForUser('user');

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

    const hasAiAssistant = config.mainActions.some(
      (action) => action.id === 'ai-assistant'
    );

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
