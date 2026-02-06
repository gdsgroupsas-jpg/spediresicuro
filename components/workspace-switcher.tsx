'use client';

/**
 * WorkspaceSwitcher Component
 *
 * Componente dropdown per switchare tra workspace.
 * Ispirato a Slack/Linear workspace switcher.
 *
 * SECURITY:
 * - Workspace switch avviene via API (verifica membership server-side)
 * - Cookie httpOnly impostato dal server
 * - Client mostra solo workspace accessibili
 *
 * @module components/workspace-switcher
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Building2, Users, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { UserWorkspaceInfo, WorkspaceType } from '@/types/workspace';

// ============================================
// TYPES
// ============================================

interface WorkspaceSwitcherProps {
  /** Mostra in versione compatta (solo icona) */
  compact?: boolean;
  /** Classe CSS aggiuntiva */
  className?: string;
}

// ============================================
// HELPERS
// ============================================

function getWorkspaceIcon(type: WorkspaceType) {
  switch (type) {
    case 'platform':
      return Building2;
    case 'reseller':
      return Users;
    case 'client':
    default:
      return User;
  }
}

function getWorkspaceTypeLabel(type: WorkspaceType, ownerAccountType?: string): string {
  // Owner admin/superadmin → badge "Admin" (non "Reseller")
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return 'Admin';
  }
  switch (type) {
    case 'platform':
      return 'Platform';
    case 'reseller':
      return 'Reseller';
    case 'client':
      return 'Client';
    default:
      return type;
  }
}

function getWorkspaceTypeColor(type: WorkspaceType, ownerAccountType?: string): string {
  // Owner admin/superadmin → colore distinto
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return 'bg-red-100 text-red-700';
  }
  switch (type) {
    case 'platform':
      return 'bg-purple-100 text-purple-700';
    case 'reseller':
      return 'bg-blue-100 text-blue-700';
    case 'client':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

// ============================================
// COMPONENT
// ============================================

export default function WorkspaceSwitcher({ compact = false, className }: WorkspaceSwitcherProps) {
  const { workspace, workspaces, switchWorkspace, isLoading, error } = useWorkspaceContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Chiudi con Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Handler switch workspace
  const handleSwitch = async (ws: UserWorkspaceInfo) => {
    if (ws.workspace_id === workspace?.workspace_id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      const success = await switchWorkspace(ws.workspace_id);
      if (success) {
        setIsOpen(false);
      }
    } finally {
      setIsSwitching(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Caricamento...</span>
      </div>
    );
  }

  // Nessun workspace
  if (!workspace && workspaces.length === 0) {
    return null; // Nasconde se nessun workspace
  }

  // Se solo 1 workspace, mostra senza dropdown
  if (workspaces.length <= 1 && workspace) {
    const Icon = getWorkspaceIcon(workspace.workspace_type);

    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <Icon className="w-4 h-4 text-gray-600" />
        </div>
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{workspace.workspace_name}</p>
            <p className="text-xs text-gray-500 truncate">{workspace.organization_name}</p>
          </div>
        )}
      </div>
    );
  }

  // Dropdown con multiple workspace
  const Icon = workspace ? getWorkspaceIcon(workspace.workspace_type) : Building2;

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1',
          isOpen && 'bg-gray-100'
        )}
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
          {isSwitching ? (
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
          ) : (
            <Icon className="w-4 h-4 text-orange-600" />
          )}
        </div>

        {!compact && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {workspace?.workspace_name || 'Seleziona Workspace'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {workspace?.organization_name || 'Nessun workspace'}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="py-1 max-h-64 overflow-y-auto">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                I tuoi Workspace
              </p>
            </div>

            {/* Workspace List */}
            {workspaces.map((ws) => {
              const WsIcon = getWorkspaceIcon(ws.workspace_type);
              const isActive = ws.workspace_id === workspace?.workspace_id;

              return (
                <button
                  key={ws.workspace_id}
                  onClick={() => handleSwitch(ws)}
                  disabled={isSwitching}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left',
                    isActive ? 'bg-orange-50' : 'hover:bg-gray-50',
                    isSwitching && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isActive ? 'bg-gradient-to-br from-orange-500 to-amber-600' : 'bg-gray-100'
                    )}
                  >
                    <WsIcon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-gray-600')} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          isActive ? 'text-orange-700' : 'text-gray-900'
                        )}
                      >
                        {ws.workspace_name}
                      </p>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          getWorkspaceTypeColor(ws.workspace_type, ws.owner_account_type)
                        )}
                      >
                        {getWorkspaceTypeLabel(ws.workspace_type, ws.owner_account_type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{ws.organization_name}</p>
                  </div>

                  {/* Check */}
                  {isActive && <Check className="w-4 h-4 text-orange-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer - Wallet Balance */}
          {workspace && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Saldo Wallet</span>
                <span className="text-sm font-semibold text-gray-900">
                  {new Intl.NumberFormat('it-IT', {
                    style: 'currency',
                    currency: 'EUR',
                  }).format(workspace.wallet_balance)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
