'use client';

/**
 * WorkspaceSwitcher Component - Enterprise-Level Design
 *
 * Componente dropdown per switchare tra workspace.
 * Design ispirato a Linear/Slack/Vercel dashboard.
 *
 * Features:
 * - Avatar con iniziali colorate per workspace type
 * - Ricerca integrata (visibile con 5+ workspace)
 * - Keyboard navigation (frecce, Enter, Escape)
 * - Wallet balance nel trigger
 * - Gruppi separati: "Il mio" vs "Clienti"
 * - Animazioni fluide
 *
 * SECURITY:
 * - Workspace switch avviene via API (verifica membership server-side)
 * - Cookie httpOnly impostato dal server
 * - Client mostra solo workspace accessibili
 *
 * @module components/workspace-switcher
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Check, Loader2, ArrowLeft, Search, Wallet } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { UserWorkspaceInfo, WorkspaceType } from '@/types/workspace';

// ============================================
// CONSTANTS
// ============================================

// Soglia per mostrare la barra di ricerca
const SEARCH_THRESHOLD = 5;

// Colori avatar per workspace type
const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  platform: { bg: 'bg-violet-600', text: 'text-white' },
  reseller: { bg: 'bg-blue-600', text: 'text-white' },
  client: { bg: 'bg-emerald-600', text: 'text-white' },
  admin: { bg: 'bg-red-600', text: 'text-white' },
};

// Badge colori per ruolo/tipo
const BADGE_STYLES: Record<string, string> = {
  admin: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  platform: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  reseller: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  client: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

// ============================================
// TYPES
// ============================================

interface WorkspaceSwitcherProps {
  compact?: boolean;
  className?: string;
}

// ============================================
// HELPERS
// ============================================

function getAvatarColor(type: WorkspaceType, ownerAccountType?: string) {
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return AVATAR_COLORS.admin;
  }
  return AVATAR_COLORS[type] || AVATAR_COLORS.client;
}

function getBadgeStyle(type: WorkspaceType, ownerAccountType?: string): string {
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return BADGE_STYLES.admin;
  }
  return BADGE_STYLES[type] || BADGE_STYLES.client;
}

function getTypeLabel(type: WorkspaceType, ownerAccountType?: string): string {
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// ============================================
// COMPONENT
// ============================================

export default function WorkspaceSwitcher({ compact = false, className }: WorkspaceSwitcherProps) {
  const { workspace, workspaces, switchWorkspace, isLoading, error } = useWorkspaceContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Raggruppamento workspace
  const { myWorkspaces, clientWorkspaces, ownerWorkspace } = useMemo(() => {
    const my: UserWorkspaceInfo[] = [];
    const clients: UserWorkspaceInfo[] = [];
    let owner: UserWorkspaceInfo | null = null;

    for (const ws of workspaces) {
      if (ws.role === 'owner') {
        my.push(ws);
        if (!owner || (ws.workspace_type !== 'client' && owner.workspace_type === 'client')) {
          owner = ws;
        }
      } else {
        clients.push(ws);
      }
    }

    return { myWorkspaces: my, clientWorkspaces: clients, ownerWorkspace: owner };
  }, [workspaces]);

  // Filtro ricerca
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clientWorkspaces;
    const q = searchQuery.toLowerCase();
    return clientWorkspaces.filter(
      (ws) =>
        ws.workspace_name.toLowerCase().includes(q) ||
        ws.organization_name.toLowerCase().includes(q)
    );
  }, [clientWorkspaces, searchQuery]);

  // Lista piatta per keyboard navigation
  const flatList = useMemo(() => {
    return [...myWorkspaces, ...filteredClients];
  }, [myWorkspaces, filteredClients]);

  const showSearch = workspaces.length >= SEARCH_THRESHOLD;

  // In workspace altrui?
  const isInClientWorkspace = workspace?.workspace_type === 'client' && workspace?.role !== 'owner';

  // Focus ricerca quando si apre
  useEffect(() => {
    if (isOpen && showSearch) {
      // Piccolo delay per attendere il render del dropdown
      const timer = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    if (!isOpen) {
      setSearchQuery('');
      setFocusedIdx(-1);
    }
  }, [isOpen, showSearch]);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIdx((prev) => (prev < flatList.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIdx((prev) => (prev > 0 ? prev - 1 : flatList.length - 1));
          break;
        case 'Enter':
          event.preventDefault();
          if (focusedIdx >= 0 && focusedIdx < flatList.length) {
            handleSwitch(flatList[focusedIdx]);
          }
          break;
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIdx, flatList]);

  // Handler switch workspace
  const handleSwitch = useCallback(
    async (ws: UserWorkspaceInfo) => {
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
    },
    [workspace?.workspace_id, switchWorkspace]
  );

  // Torna al workspace proprio
  const handleBackToMyWorkspace = useCallback(async () => {
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
  }, [ownerWorkspace, workspace?.workspace_id, switchWorkspace]);

  // Loading
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2', className)}>
        <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-gray-100 rounded animate-pulse w-24" />
          <div className="h-2.5 bg-gray-100 rounded animate-pulse w-16" />
        </div>
      </div>
    );
  }

  // Nessun workspace
  if (!workspace && workspaces.length === 0) {
    return null;
  }

  // Singolo workspace — nessun dropdown
  if (workspaces.length <= 1 && workspace) {
    const avatarColor = getAvatarColor(workspace.workspace_type, workspace.owner_account_type);
    return (
      <div className={cn('flex items-center gap-2.5 px-3 py-2', className)}>
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
            avatarColor.bg,
            avatarColor.text
          )}
        >
          {getInitials(workspace.workspace_name)}
        </div>
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {workspace.workspace_name}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{workspace.organization_name}</p>
          </div>
        )}
      </div>
    );
  }

  // Multi workspace — dropdown
  const avatarColor = workspace
    ? getAvatarColor(workspace.workspace_type, workspace.owner_account_type)
    : AVATAR_COLORS.client;

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* ========== TRIGGER ========== */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200',
          'hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1',
          isOpen && 'bg-gray-50',
          isInClientWorkspace && 'bg-amber-50/60 ring-1 ring-amber-200'
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-transform duration-200',
            isInClientWorkspace ? 'bg-amber-500 text-white' : cn(avatarColor.bg, avatarColor.text),
            isSwitching && 'animate-pulse'
          )}
        >
          {isSwitching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            getInitials(workspace?.workspace_name || '?')
          )}
        </div>

        {!compact && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {workspace?.workspace_name || 'Seleziona'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isInClientWorkspace ? (
                  <span className="text-[11px] text-amber-700 font-medium">Workspace cliente</span>
                ) : (
                  <>
                    <span className="text-[11px] text-gray-500 truncate">
                      {workspace?.organization_name}
                    </span>
                    {workspace && workspace.wallet_balance > 0 && (
                      <>
                        <span className="text-gray-300">·</span>
                        <span className="text-[11px] font-medium text-gray-600">
                          {formatCurrency(workspace.wallet_balance)}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </>
        )}
      </button>

      {/* Bottone rapido "Torna al mio workspace" */}
      {isInClientWorkspace && ownerWorkspace && !compact && (
        <button
          type="button"
          onClick={handleBackToMyWorkspace}
          disabled={isSwitching}
          className="w-full flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-3 h-3 shrink-0" />
          <span className="truncate">Torna a {ownerWorkspace.workspace_name}</span>
        </button>
      )}

      {/* ========== DROPDOWN ========== */}
      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
        >
          {/* Ricerca (visibile con 5+ workspace) */}
          {showSearch && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setFocusedIdx(-1);
                  }}
                  placeholder="Cerca workspace..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                />
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {/* Gruppo: Il mio workspace */}
            {myWorkspaces.length > 0 && (
              <div>
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Il mio workspace
                  </p>
                </div>
                {myWorkspaces.map((ws) => {
                  const globalIdx = flatList.indexOf(ws);
                  return (
                    <WorkspaceItem
                      key={ws.workspace_id}
                      ws={ws}
                      isActive={ws.workspace_id === workspace?.workspace_id}
                      isFocused={focusedIdx === globalIdx}
                      isSwitching={isSwitching}
                      onSwitch={handleSwitch}
                      onHover={() => setFocusedIdx(globalIdx)}
                    />
                  );
                })}
              </div>
            )}

            {/* Gruppo: Workspace clienti */}
            {(filteredClients.length > 0 || searchQuery) && (
              <div>
                <div className="px-3 pt-3 pb-1 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Workspace clienti
                  </p>
                  <span className="text-[10px] text-gray-400 tabular-nums">
                    {filteredClients.length}
                    {searchQuery && ` / ${clientWorkspaces.length}`}
                  </span>
                </div>
                {filteredClients.length > 0 ? (
                  filteredClients.map((ws) => {
                    const globalIdx = flatList.indexOf(ws);
                    return (
                      <WorkspaceItem
                        key={ws.workspace_id}
                        ws={ws}
                        isActive={ws.workspace_id === workspace?.workspace_id}
                        isFocused={focusedIdx === globalIdx}
                        isSwitching={isSwitching}
                        onSwitch={handleSwitch}
                        onHover={() => setFocusedIdx(globalIdx)}
                      />
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-gray-400">
                      Nessun risultato per &quot;{searchQuery}&quot;
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Wallet del workspace selezionato */}
          {workspace && (
            <div className="px-3 py-2 bg-gray-50/80 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Wallet className="w-3 h-3" />
                  <span className="text-[11px]">Saldo</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">
                  {formatCurrency(workspace.wallet_balance)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg z-50">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// WORKSPACE ITEM
// ============================================

interface WorkspaceItemProps {
  ws: UserWorkspaceInfo;
  isActive: boolean;
  isFocused: boolean;
  isSwitching: boolean;
  onSwitch: (ws: UserWorkspaceInfo) => void;
  onHover: () => void;
}

function WorkspaceItem({
  ws,
  isActive,
  isFocused,
  isSwitching,
  onSwitch,
  onHover,
}: WorkspaceItemProps) {
  const avatarColor = getAvatarColor(ws.workspace_type, ws.owner_account_type);

  return (
    <button
      type="button"
      onClick={() => onSwitch(ws)}
      onMouseEnter={onHover}
      disabled={isSwitching}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left',
        isActive ? 'bg-orange-50' : isFocused ? 'bg-gray-50' : 'hover:bg-gray-50',
        isSwitching && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Avatar con iniziali */}
      <div
        className={cn(
          'w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0',
          isActive
            ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white'
            : cn(avatarColor.bg, avatarColor.text)
        )}
      >
        {getInitials(ws.workspace_name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              'text-sm font-medium truncate leading-tight',
              isActive ? 'text-orange-700' : 'text-gray-900'
            )}
          >
            {ws.workspace_name}
          </p>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 uppercase tracking-wide',
              getBadgeStyle(ws.workspace_type, ws.owner_account_type)
            )}
          >
            {getTypeLabel(ws.workspace_type, ws.owner_account_type)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-[11px] text-gray-500 truncate">{ws.organization_name}</p>
          {ws.wallet_balance > 0 && (
            <>
              <span className="text-gray-300 text-[11px]">·</span>
              <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                {formatCurrency(ws.wallet_balance)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Check attivo */}
      {isActive && <Check className="w-4 h-4 text-orange-500 shrink-0" />}
    </button>
  );
}
