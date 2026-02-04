'use client';

/**
 * useWorkspace Hook - React Hook per gestione Workspace
 *
 * Hook client-side per:
 * - Ottenere workspace corrente
 * - Switchare tra workspace
 * - Verificare permessi
 *
 * SECURITY:
 * - Workspace ID salvato in localStorage (client-side per UI)
 * - Cookie httpOnly impostato da API /api/workspaces/switch (per middleware)
 * - Client NON puo leggere il cookie httpOnly (XSS protection)
 * - Verifica permessi avviene SEMPRE server-side
 *
 * USAGE:
 * ```tsx
 * const { workspace, workspaces, switchWorkspace, isLoading } = useWorkspace();
 *
 * if (!workspace) {
 *   return <WorkspaceSelector />;
 * }
 *
 * return <Dashboard workspace={workspace} />;
 * ```
 *
 * @module hooks/useWorkspace
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type {
  UserWorkspaceInfo,
  WorkspaceMemberRole,
  WorkspacePermission,
} from '@/types/workspace';
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-constants';

// ============================================
// TYPES
// ============================================

export interface UseWorkspaceReturn {
  /** Workspace corrente (null se non selezionato) */
  workspace: UserWorkspaceInfo | null;

  /** Lista di tutti i workspace accessibili */
  workspaces: UserWorkspaceInfo[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: string | null;

  /** Switcha al workspace specificato */
  switchWorkspace: (workspaceId: string) => Promise<boolean>;

  /** Refresh lista workspace */
  refreshWorkspaces: () => Promise<void>;

  /** Verifica se ha un permesso (client-side, non sicuro!) */
  hasPermission: (permission: WorkspacePermission) => boolean;

  /** Verifica se e' owner o admin */
  isAdmin: boolean;

  /** Verifica se e' owner */
  isOwner: boolean;
}

// ============================================
// HOOK
// ============================================

export function useWorkspace(): UseWorkspaceReturn {
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<UserWorkspaceInfo[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workspace corrente (derivato da workspaces + currentWorkspaceId)
  const workspace = useMemo(() => {
    if (!currentWorkspaceId || workspaces.length === 0) {
      return null;
    }
    return workspaces.find((w) => w.workspace_id === currentWorkspaceId) || null;
  }, [currentWorkspaceId, workspaces]);

  // ============================================
  // LOAD WORKSPACES
  // ============================================

  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/workspaces/my', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Non autenticato - redirect a login
          router.push('/login');
          return;
        }
        throw new Error('Failed to load workspaces');
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      // Se no workspace corrente, prova a caricare da storage/cookie
      if (!currentWorkspaceId) {
        const savedId = getSavedWorkspaceId();

        if (
          savedId &&
          data.workspaces?.some((w: UserWorkspaceInfo) => w.workspace_id === savedId)
        ) {
          // Workspace salvato esiste ancora
          setCurrentWorkspaceId(savedId);
        } else if (data.workspaces?.length > 0) {
          // Usa il primo workspace disponibile
          setCurrentWorkspaceId(data.workspaces[0].workspace_id);
          saveWorkspaceId(data.workspaces[0].workspace_id);
        }
      }
    } catch (err: any) {
      console.error('Error loading workspaces:', err);
      setError(err.message || 'Errore caricamento workspace');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspaceId, router]);

  // Load on mount
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // ============================================
  // SWITCH WORKSPACE
  // ============================================

  const switchWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      try {
        // Verifica che workspace esista nella lista
        const targetWorkspace = workspaces.find((w) => w.workspace_id === workspaceId);
        if (!targetWorkspace) {
          setError('Workspace non trovato');
          return false;
        }

        // Chiama API per impostare workspace (verifica accesso server-side)
        const response = await fetch('/api/workspaces/switch', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ workspaceId }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Errore switch workspace');
          return false;
        }

        // Salva localmente
        setCurrentWorkspaceId(workspaceId);
        saveWorkspaceId(workspaceId);

        // Refresh pagina per caricare nuovi dati
        router.refresh();

        console.log('✅ [WORKSPACE] Switched to:', targetWorkspace.workspace_name);
        return true;
      } catch (err: any) {
        console.error('Error switching workspace:', err);
        setError(err.message || 'Errore switch workspace');
        return false;
      }
    },
    [workspaces, router]
  );

  // ============================================
  // PERMISSION HELPERS
  // ============================================

  /**
   * Verifica permesso CLIENT-SIDE
   *
   * ATTENZIONE: Questa verifica NON e' sicura!
   * Usare solo per UI (nascondere bottoni, etc.)
   * La verifica REALE avviene SEMPRE server-side.
   */
  const hasPermission = useCallback(
    (permission: WorkspacePermission): boolean => {
      if (!workspace) return false;

      // Owner e Admin hanno tutti i permessi
      if (workspace.role === 'owner' || workspace.role === 'admin') {
        return true;
      }

      // Verifica permessi espliciti
      if (workspace.permissions.includes(permission)) {
        return true;
      }

      // Permessi impliciti per Operator
      if (workspace.role === 'operator') {
        const operatorPermissions: WorkspacePermission[] = [
          'shipments:create',
          'shipments:view',
          'shipments:track',
          'wallet:view',
          'contacts:view',
          'contacts:create',
        ];
        return operatorPermissions.includes(permission);
      }

      // Viewer: solo :view
      if (workspace.role === 'viewer') {
        return permission.endsWith(':view');
      }

      return false;
    },
    [workspace]
  );

  const isAdmin = useMemo(() => {
    return workspace?.role === 'owner' || workspace?.role === 'admin';
  }, [workspace]);

  const isOwner = useMemo(() => {
    return workspace?.role === 'owner';
  }, [workspace]);

  // ============================================
  // RETURN
  // ============================================

  return {
    workspace,
    workspaces,
    isLoading,
    error,
    switchWorkspace,
    refreshWorkspaces: loadWorkspaces,
    hasPermission,
    isAdmin,
    isOwner,
  };
}

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

/**
 * Ottiene workspace ID salvato in localStorage
 *
 * NOTA: Il cookie httpOnly NON e' accessibile da JavaScript (XSS protection).
 * Il cookie viene gestito dal server (API /api/workspaces/switch).
 * localStorage e' usato solo per UI client-side.
 */
function getSavedWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Salva workspace ID in localStorage
 *
 * NOTA: Il cookie httpOnly viene impostato dall'API /api/workspaces/switch,
 * non dal client. Questo previene attacchi XSS.
 */
function saveWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  } catch (err) {
    console.error('Error saving workspace ID:', err);
  }
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default useWorkspace;
