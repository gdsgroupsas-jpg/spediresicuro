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

import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Building2, Users, User, Loader2, ArrowLeft } from 'lucide-react';
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

  // Raggruppamento: workspace proprio (owner) vs workspace clienti (admin via parent)
  const { myWorkspaces, clientWorkspaces, ownerWorkspace } = useMemo(() => {
    const my: UserWorkspaceInfo[] = [];
    const clients: UserWorkspaceInfo[] = [];
    let owner: UserWorkspaceInfo | null = null;

    for (const ws of workspaces) {
      // Workspace dove l'utente è owner = il proprio workspace
      if (ws.role === 'owner') {
        my.push(ws);
        // Il workspace "principale" del reseller è di tipo reseller/platform con role=owner
        if (!owner || (ws.workspace_type !== 'client' && owner.workspace_type === 'client')) {
          owner = ws;
        }
      } else {
        // Workspace dove ha accesso admin (child workspace dei client)
        clients.push(ws);
      }
    }

    return { myWorkspaces: my, clientWorkspaces: clients, ownerWorkspace: owner };
  }, [workspaces]);

  // Il reseller sta operando in un workspace client?
  const isInClientWorkspace = workspace?.workspace_type === 'client' && workspace?.role !== 'owner';

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

  // Torna al workspace proprio (owner) del reseller
  const handleBackToMyWorkspace = async () => {
    if (!ownerWorkspace || ownerWorkspace.workspace_id === workspace?.workspace_id) return;
    setIsSwitching(true);
    try {
      const success = await switchWorkspace(ownerWorkspace.workspace_id);
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
          isOpen && 'bg-gray-100',
          isInClientWorkspace && 'bg-green-50 border border-green-200'
        )}
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            isInClientWorkspace
              ? 'bg-gradient-to-br from-green-100 to-emerald-100'
              : 'bg-gradient-to-br from-orange-100 to-amber-100'
          )}
        >
          {isSwitching ? (
            <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
          ) : (
            <Icon
              className={cn('w-4 h-4', isInClientWorkspace ? 'text-green-600' : 'text-orange-600')}
            />
          )}
        </div>

        {!compact && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">
                {workspace?.workspace_name || 'Seleziona Workspace'}
              </p>
              {isInClientWorkspace ? (
                <p className="text-[11px] text-green-600 font-medium truncate">
                  Operando come cliente
                </p>
              ) : (
                <p className="text-xs text-gray-500 truncate">
                  {workspace?.organization_name || 'Nessun workspace'}
                </p>
              )}
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

      {/* Bottone rapido "Torna al mio workspace" quando si è in un client */}
      {isInClientWorkspace && ownerWorkspace && !compact && (
        <button
          type="button"
          onClick={handleBackToMyWorkspace}
          disabled={isSwitching}
          className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-xs font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span className="truncate">Torna a {ownerWorkspace.workspace_name}</span>
        </button>
      )}

      {/* Dropdown Menu - si apre verso il basso (switcher in cima alla sidebar) */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
          <div className="py-1 max-h-72 overflow-y-auto">
            {/* Gruppo: Il mio workspace */}
            {myWorkspaces.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Il mio workspace
                  </p>
                </div>
                {myWorkspaces.map((ws) => (
                  <WorkspaceItem
                    key={ws.workspace_id}
                    ws={ws}
                    isActive={ws.workspace_id === workspace?.workspace_id}
                    isSwitching={isSwitching}
                    onSwitch={handleSwitch}
                  />
                ))}
              </>
            )}

            {/* Gruppo: Workspace clienti */}
            {clientWorkspaces.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-gray-100 border-t">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Workspace clienti
                  </p>
                </div>
                {clientWorkspaces.map((ws) => (
                  <WorkspaceItem
                    key={ws.workspace_id}
                    ws={ws}
                    isActive={ws.workspace_id === workspace?.workspace_id}
                    isSwitching={isSwitching}
                    onSwitch={handleSwitch}
                  />
                ))}
              </>
            )}
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

// ============================================
// WORKSPACE ITEM (sotto-componente per lista)
// ============================================

interface WorkspaceItemProps {
  ws: UserWorkspaceInfo;
  isActive: boolean;
  isSwitching: boolean;
  onSwitch: (ws: UserWorkspaceInfo) => void;
}

function WorkspaceItem({ ws, isActive, isSwitching, onSwitch }: WorkspaceItemProps) {
  const WsIcon = getWorkspaceIcon(ws.workspace_type);

  return (
    <button
      type="button"
      onClick={() => onSwitch(ws)}
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
              'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
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
}
