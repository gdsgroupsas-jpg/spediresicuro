'use client';

/**
 * useWorkspaceUI - Hook per UI adattiva in base al tipo di workspace
 *
 * Fornisce helper per mostrare/nascondere elementi UI in base a:
 * - workspace_type: platform | reseller | client
 * - workspace_depth: 0 | 1 | 2
 *
 * Pattern: Stripe Connect / Shopify Partner
 * - Platform vede tutto + gestione hierarchy
 * - Reseller vede gestione suoi + client
 * - Client vede solo operazioni proprie
 *
 * @module hooks/useWorkspaceUI
 */

import { useMemo } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import type { WorkspaceType, WorkspaceDepth } from '@/types/workspace';

// ============================================
// TYPES
// ============================================

export interface WorkspaceUICapabilities {
  /** Tipo workspace corrente */
  workspaceType: WorkspaceType | null;

  /** Depth workspace (0=platform, 1=reseller, 2=client) */
  workspaceDepth: WorkspaceDepth | null;

  // === Visibility Flags ===

  /** Può vedere dati di altri workspace (ha figli) */
  canSeeHierarchy: boolean;

  /** Mostra colonna "Workspace" nelle tabelle */
  showWorkspaceColumn: boolean;

  /** Mostra filtro dropdown workspace */
  showWorkspaceFilter: boolean;

  /** Mostra sezione "Listini" nel menu */
  showPriceListMenu: boolean;

  /** Mostra gestione team/membri */
  showTeamManagement: boolean;

  /** Mostra stats breakdown per workspace */
  showWorkspaceStats: boolean;

  /** Mostra invita sub-workspace */
  showInviteSubWorkspace: boolean;

  /** È Platform (SpedireSicuro) */
  isPlatform: boolean;

  /** È Reseller */
  isReseller: boolean;

  /** È Client */
  isClient: boolean;

  // === Labels ===

  /** Label per i "figli" (Reseller/Client) */
  childrenLabel: string;

  /** Label per il workspace type */
  typeLabel: string;
}

// ============================================
// HOOK
// ============================================

export function useWorkspaceUI(): WorkspaceUICapabilities {
  const { workspace } = useWorkspace();

  return useMemo(() => {
    // Default: nessun workspace selezionato
    if (!workspace) {
      return {
        workspaceType: null,
        workspaceDepth: null,
        canSeeHierarchy: false,
        showWorkspaceColumn: false,
        showWorkspaceFilter: false,
        showPriceListMenu: false,
        showTeamManagement: false,
        showWorkspaceStats: false,
        showInviteSubWorkspace: false,
        isPlatform: false,
        isReseller: false,
        isClient: false,
        childrenLabel: '',
        typeLabel: '',
      };
    }

    const type = workspace.workspace_type;
    const depth = workspace.workspace_depth;

    const isPlatform = type === 'platform';
    const isReseller = type === 'reseller';
    const isClient = type === 'client';

    // Platform e Reseller possono avere figli
    const canSeeHierarchy = isPlatform || isReseller;

    return {
      workspaceType: type,
      workspaceDepth: depth,

      // Visibility
      canSeeHierarchy,
      showWorkspaceColumn: canSeeHierarchy,
      showWorkspaceFilter: canSeeHierarchy,
      showPriceListMenu: isPlatform || isReseller, // Client non gestisce listini
      showTeamManagement: true, // Tutti possono gestire il proprio team
      showWorkspaceStats: canSeeHierarchy,
      showInviteSubWorkspace: isPlatform || isReseller, // Solo chi può avere figli

      // Type flags
      isPlatform,
      isReseller,
      isClient,

      // Labels
      childrenLabel: isPlatform ? 'Reseller e Client' : isReseller ? 'Client' : '',
      typeLabel: isPlatform ? 'Platform' : isReseller ? 'Reseller' : 'Client',
    };
  }, [workspace]);
}

export default useWorkspaceUI;
