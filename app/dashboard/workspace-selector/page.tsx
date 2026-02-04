'use client';

/**
 * Workspace Selector Page
 *
 * Pagina per la selezione del workspace iniziale.
 * Mostrata quando l'utente ha più workspace e deve sceglierne uno.
 *
 * FLOW:
 * 1. Utente accede a /dashboard senza workspace selezionato
 * 2. Redirect a questa pagina
 * 3. Utente seleziona workspace
 * 4. Redirect a /dashboard con workspace attivo
 *
 * @module app/dashboard/workspace-selector/page
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Building2, Users, User, Check, ArrowRight, Loader2, Wallet, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserWorkspaceInfo, WorkspaceType } from '@/types/workspace';

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

function getWorkspaceTypeLabel(type: WorkspaceType): string {
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

function getWorkspaceTypeColor(type: WorkspaceType): string {
  switch (type) {
    case 'platform':
      return 'from-purple-500 to-indigo-600';
    case 'reseller':
      return 'from-blue-500 to-cyan-600';
    case 'client':
      return 'from-green-500 to-emerald-600';
    default:
      return 'from-gray-500 to-gray-600';
  }
}

function getWorkspaceTypeBadgeColor(type: WorkspaceType): string {
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
// PAGE COMPONENT
// ============================================

export default function WorkspaceSelectorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<UserWorkspaceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // LOAD WORKSPACES
  // ============================================

  useEffect(() => {
    async function loadWorkspaces() {
      if (status !== 'authenticated') return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/workspaces/my', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Errore caricamento workspace');
        }

        const data = await response.json();
        const ws = data.workspaces || [];
        setWorkspaces(ws);

        // Se solo un workspace, auto-seleziona e vai
        if (ws.length === 1) {
          handleSelectWorkspace(ws[0].workspace_id);
        }
      } catch (err: any) {
        console.error('Error loading workspaces:', err);
        setError(err.message || 'Errore caricamento workspace');
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspaces();
  }, [status]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectWorkspace = async (workspaceId: string) => {
    if (isSwitching) return;

    setIsSwitching(true);
    setSelectedId(workspaceId);

    try {
      const response = await fetch('/api/workspaces/switch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Errore selezione workspace');
      }

      // Redirect a dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('Error selecting workspace:', err);
      setError(err.message || 'Errore selezione workspace');
      setSelectedId(null);
      setIsSwitching(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  // Loading session
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento workspace...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  // No workspaces
  if (workspaces.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Nessun workspace</h1>
          <p className="text-gray-600 mb-6">
            Non hai accesso a nessun workspace. Contatta il tuo amministratore per richiedere
            accesso.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Torna alla dashboard
          </button>
        </div>
      </div>
    );
  }

  // Workspace selector
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Seleziona Workspace</h1>
          <p className="text-gray-600">
            Benvenuto, {session?.user?.name || session?.user?.email}! Scegli il workspace in cui
            vuoi operare.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Workspace Cards */}
        <div className="grid gap-4">
          {workspaces.map((ws) => {
            const Icon = getWorkspaceIcon(ws.workspace_type);
            const isSelected = selectedId === ws.workspace_id;

            return (
              <button
                key={ws.workspace_id}
                onClick={() => handleSelectWorkspace(ws.workspace_id)}
                disabled={isSwitching}
                className={cn(
                  'w-full bg-white rounded-xl border-2 p-4 text-left transition-all group',
                  'hover:shadow-lg hover:border-orange-300',
                  isSelected
                    ? 'border-orange-500 shadow-lg ring-4 ring-orange-100'
                    : 'border-gray-200',
                  isSwitching && !isSelected && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0',
                      'bg-gradient-to-br',
                      getWorkspaceTypeColor(ws.workspace_type)
                    )}
                  >
                    {isSelected && isSwitching ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Icon className="w-6 h-6 text-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{ws.workspace_name}</h3>
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          getWorkspaceTypeBadgeColor(ws.workspace_type)
                        )}
                      >
                        {getWorkspaceTypeLabel(ws.workspace_type)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate">{ws.organization_name}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Wallet className="w-3 h-3" />
                        {new Intl.NumberFormat('it-IT', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(ws.wallet_balance)}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {ws.role}
                      </span>
                    </div>
                  </div>

                  {/* Arrow/Check */}
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                        {isSwitching ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </div>
                    ) : (
                      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition-colors" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Puoi cambiare workspace in qualsiasi momento dalla sidebar.
            <br />I tuoi dati sono isolati per ogni workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
