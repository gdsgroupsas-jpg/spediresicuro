/**
 * Workspace UI Hook Tests
 *
 * Test suite per verificare:
 * - UI adattiva per tipo workspace (platform/reseller/client)
 * - Visibilità colonna workspace
 * - Visibilità filtro workspace
 * - Visibilità menu listini
 * - Labels corrette per ogni tipo
 *
 * Pattern: Stripe Connect / Shopify Partner
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock useWorkspace hook
const mockWorkspace = vi.fn();
vi.mock('@/hooks/useWorkspace', () => ({
  useWorkspace: () => mockWorkspace(),
}));

// Import after mock
import { useWorkspaceUI } from '@/hooks/useWorkspaceUI';
import type { UserWorkspaceInfo } from '@/types/workspace';

// Helper per creare workspace mock
function createMockWorkspace(
  type: 'platform' | 'reseller' | 'client',
  depth: 0 | 1 | 2
): UserWorkspaceInfo {
  return {
    workspace_id: 'test-workspace-id',
    workspace_name: `Test ${type} Workspace`,
    workspace_slug: `test-${type}`,
    workspace_type: type,
    workspace_depth: depth,
    organization_id: 'test-org-id',
    organization_name: 'Test Organization',
    organization_slug: 'test-org',
    role: 'owner',
    permissions: [],
    wallet_balance: 1000,
    branding: {},
    member_status: 'active',
  };
}

describe('useWorkspaceUI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quando nessun workspace selezionato', () => {
    it('dovrebbe ritornare tutti i flag a false', () => {
      mockWorkspace.mockReturnValue({ workspace: null });

      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.workspaceType).toBeNull();
      expect(result.current.workspaceDepth).toBeNull();
      expect(result.current.canSeeHierarchy).toBe(false);
      expect(result.current.showWorkspaceColumn).toBe(false);
      expect(result.current.showWorkspaceFilter).toBe(false);
      expect(result.current.showPriceListMenu).toBe(false);
      expect(result.current.isPlatform).toBe(false);
      expect(result.current.isReseller).toBe(false);
      expect(result.current.isClient).toBe(false);
    });
  });

  describe('workspace Platform (depth 0)', () => {
    beforeEach(() => {
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('platform', 0),
      });
    });

    it('dovrebbe identificare correttamente il tipo', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.workspaceType).toBe('platform');
      expect(result.current.workspaceDepth).toBe(0);
      expect(result.current.isPlatform).toBe(true);
      expect(result.current.isReseller).toBe(false);
      expect(result.current.isClient).toBe(false);
    });

    it('dovrebbe mostrare colonna e filtro workspace', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.canSeeHierarchy).toBe(true);
      expect(result.current.showWorkspaceColumn).toBe(true);
      expect(result.current.showWorkspaceFilter).toBe(true);
    });

    it('dovrebbe mostrare menu listini', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.showPriceListMenu).toBe(true);
    });

    it('dovrebbe permettere invito sub-workspace', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.showInviteSubWorkspace).toBe(true);
    });

    it('dovrebbe avere labels corrette', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.typeLabel).toBe('Platform');
      expect(result.current.childrenLabel).toBe('Reseller e Client');
    });
  });

  describe('workspace Reseller (depth 1)', () => {
    beforeEach(() => {
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('reseller', 1),
      });
    });

    it('dovrebbe identificare correttamente il tipo', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.workspaceType).toBe('reseller');
      expect(result.current.workspaceDepth).toBe(1);
      expect(result.current.isPlatform).toBe(false);
      expect(result.current.isReseller).toBe(true);
      expect(result.current.isClient).toBe(false);
    });

    it('dovrebbe mostrare colonna e filtro workspace', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.canSeeHierarchy).toBe(true);
      expect(result.current.showWorkspaceColumn).toBe(true);
      expect(result.current.showWorkspaceFilter).toBe(true);
    });

    it('dovrebbe mostrare menu listini', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.showPriceListMenu).toBe(true);
    });

    it('dovrebbe permettere invito sub-workspace (client)', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.showInviteSubWorkspace).toBe(true);
    });

    it('dovrebbe avere labels corrette', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.typeLabel).toBe('Reseller');
      expect(result.current.childrenLabel).toBe('Client');
    });
  });

  describe('workspace Client (depth 2)', () => {
    beforeEach(() => {
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('client', 2),
      });
    });

    it('dovrebbe identificare correttamente il tipo', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.workspaceType).toBe('client');
      expect(result.current.workspaceDepth).toBe(2);
      expect(result.current.isPlatform).toBe(false);
      expect(result.current.isReseller).toBe(false);
      expect(result.current.isClient).toBe(true);
    });

    it('NON dovrebbe mostrare colonna e filtro workspace', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.canSeeHierarchy).toBe(false);
      expect(result.current.showWorkspaceColumn).toBe(false);
      expect(result.current.showWorkspaceFilter).toBe(false);
    });

    it('NON dovrebbe mostrare menu listini', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.showPriceListMenu).toBe(false);
    });

    it('NON dovrebbe permettere invito sub-workspace', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.showInviteSubWorkspace).toBe(false);
    });

    it('dovrebbe avere labels corrette', () => {
      const { result } = renderHook(() => useWorkspaceUI());

      expect(result.current.typeLabel).toBe('Client');
      expect(result.current.childrenLabel).toBe('');
    });
  });

  describe('gestione team', () => {
    it('tutti i tipi workspace dovrebbero poter gestire il team', () => {
      // Platform
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('platform', 0),
      });
      let { result } = renderHook(() => useWorkspaceUI());
      expect(result.current.showTeamManagement).toBe(true);

      // Reseller
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('reseller', 1),
      });
      result = renderHook(() => useWorkspaceUI()).result;
      expect(result.current.showTeamManagement).toBe(true);

      // Client
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('client', 2),
      });
      result = renderHook(() => useWorkspaceUI()).result;
      expect(result.current.showTeamManagement).toBe(true);
    });
  });

  describe('workspace stats breakdown', () => {
    it('Platform dovrebbe mostrare stats breakdown', () => {
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('platform', 0),
      });

      const { result } = renderHook(() => useWorkspaceUI());
      expect(result.current.showWorkspaceStats).toBe(true);
    });

    it('Reseller dovrebbe mostrare stats breakdown', () => {
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('reseller', 1),
      });

      const { result } = renderHook(() => useWorkspaceUI());
      expect(result.current.showWorkspaceStats).toBe(true);
    });

    it('Client NON dovrebbe mostrare stats breakdown', () => {
      mockWorkspace.mockReturnValue({
        workspace: createMockWorkspace('client', 2),
      });

      const { result } = renderHook(() => useWorkspaceUI());
      expect(result.current.showWorkspaceStats).toBe(false);
    });
  });
});
