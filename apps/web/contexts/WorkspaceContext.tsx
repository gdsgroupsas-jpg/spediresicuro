'use client';

/**
 * WorkspaceContext - React Context per Workspace
 *
 * Fornisce accesso al workspace corrente in tutta l'app.
 *
 * USAGE:
 * ```tsx
 * // In layout.tsx
 * <WorkspaceProvider>
 *   {children}
 * </WorkspaceProvider>
 *
 * // In componenti
 * const { workspace, switchWorkspace } = useWorkspaceContext();
 * ```
 *
 * @module contexts/WorkspaceContext
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWorkspace, type UseWorkspaceReturn } from '@/hooks/useWorkspace';

// ============================================
// CONTEXT
// ============================================

const WorkspaceContext = createContext<UseWorkspaceReturn | null>(null);

// ============================================
// PROVIDER
// ============================================

export interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const workspaceState = useWorkspace();

  // Memoize per evitare re-render inutili
  const value = useMemo(() => workspaceState, [workspaceState]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook per accedere al WorkspaceContext
 *
 * @throws Error se usato fuori dal WorkspaceProvider
 */
export function useWorkspaceContext(): UseWorkspaceReturn {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }

  return context;
}

// ============================================
// GUARD COMPONENT
// ============================================

export interface WorkspaceGuardProps {
  children: ReactNode;
  /** Componente da mostrare mentre carica */
  loadingComponent?: ReactNode;
  /** Componente da mostrare se no workspace selezionato */
  noWorkspaceComponent?: ReactNode;
  /** Permesso richiesto (opzionale) */
  requiredPermission?: string;
  /** Componente da mostrare se no permesso */
  noPermissionComponent?: ReactNode;
}

/**
 * Guard che protegge contenuto richiedendo workspace
 *
 * USAGE:
 * ```tsx
 * <WorkspaceGuard
 *   loadingComponent={<Spinner />}
 *   noWorkspaceComponent={<WorkspaceSelector />}
 * >
 *   <ProtectedContent />
 * </WorkspaceGuard>
 * ```
 */
export function WorkspaceGuard({
  children,
  loadingComponent,
  noWorkspaceComponent,
  requiredPermission,
  noPermissionComponent,
}: WorkspaceGuardProps) {
  const { workspace, isLoading, hasPermission } = useWorkspaceContext();

  // Loading
  if (isLoading) {
    return <>{loadingComponent || <DefaultLoading />}</>;
  }

  // No workspace
  if (!workspace) {
    return <>{noWorkspaceComponent || <DefaultNoWorkspace />}</>;
  }

  // Check permission
  if (requiredPermission && !hasPermission(requiredPermission as any)) {
    return <>{noPermissionComponent || <DefaultNoPermission />}</>;
  }

  return <>{children}</>;
}

// ============================================
// DEFAULT COMPONENTS
// ============================================

function DefaultLoading() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function DefaultNoWorkspace() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-4">
      <h3 className="text-lg font-semibold mb-2">Nessun Workspace Selezionato</h3>
      <p className="text-muted-foreground">Seleziona un workspace per continuare.</p>
    </div>
  );
}

function DefaultNoPermission() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-4">
      <h3 className="text-lg font-semibold mb-2">Accesso Negato</h3>
      <p className="text-muted-foreground">
        Non hai i permessi necessari per accedere a questa sezione.
      </p>
    </div>
  );
}

// ============================================
// EXPORTS
// ============================================

export default WorkspaceProvider;
