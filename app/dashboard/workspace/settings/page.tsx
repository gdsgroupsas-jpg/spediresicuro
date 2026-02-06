/**
 * Pagina: Impostazioni Workspace
 *
 * Panoramica e configurazione del workspace corrente:
 * - Info workspace (nome, tipo, slug)
 * - Info organizzazione
 * - Saldo wallet
 * - Riepilogo team (count membri)
 * - Ruolo e permessi dell'utente corrente
 *
 * SECURITY:
 * - Verifica permessi tramite WorkspaceContext
 * - Richiede settings:view
 *
 * @module app/dashboard/workspace/settings
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardNav from '@/components/dashboard-nav';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  Wallet,
  Shield,
  Settings,
  Crown,
  UserCog,
  Eye,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { WorkspacePermission } from '@/types/workspace';

// ============================================
// HELPERS
// ============================================

const typeLabel: Record<string, string> = {
  platform: 'Piattaforma',
  reseller: 'Reseller',
  client: 'Cliente',
};

const typeBadgeVariant: Record<string, 'default' | 'warning' | 'success'> = {
  platform: 'default',
  reseller: 'warning',
  client: 'success',
};

const roleLabel: Record<string, string> = {
  owner: 'Proprietario',
  admin: 'Amministratore',
  operator: 'Operatore',
  viewer: 'Visualizzatore',
};

const roleIcon: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  operator: UserCog,
  viewer: Eye,
};

// Raggruppamento permessi per sezione
const permissionGroups: Record<string, { label: string; permissions: WorkspacePermission[] }> = {
  shipments: {
    label: 'Spedizioni',
    permissions: [
      'shipments:create',
      'shipments:view',
      'shipments:edit',
      'shipments:delete',
      'shipments:track',
      'shipments:cancel',
    ],
  },
  wallet: {
    label: 'Wallet',
    permissions: ['wallet:view', 'wallet:manage', 'wallet:recharge'],
  },
  members: {
    label: 'Membri',
    permissions: ['members:view', 'members:invite', 'members:remove', 'members:edit_role'],
  },
  settings: {
    label: 'Impostazioni',
    permissions: ['settings:view', 'settings:edit'],
  },
  pricelists: {
    label: 'Listini',
    permissions: ['pricelists:view', 'pricelists:manage'],
  },
  contacts: {
    label: 'Contatti',
    permissions: ['contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete'],
  },
  reports: {
    label: 'Report',
    permissions: ['reports:view', 'reports:export'],
  },
};

function formatPermission(perm: WorkspacePermission): string {
  const action = perm.split(':')[1];
  const labels: Record<string, string> = {
    create: 'Crea',
    view: 'Visualizza',
    edit: 'Modifica',
    delete: 'Elimina',
    track: 'Traccia',
    cancel: 'Cancella',
    manage: 'Gestisci',
    recharge: 'Ricarica',
    invite: 'Invita',
    remove: 'Rimuovi',
    edit_role: 'Cambia ruolo',
    export: 'Esporta',
  };
  return labels[action] || action;
}

// ============================================
// COMPONENT
// ============================================

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const { workspace, isLoading: wsLoading, hasPermission } = useWorkspaceContext();

  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);

  const canViewSettings = hasPermission('settings:view');

  // Fetch count membri dal workspace
  const fetchMemberCount = useCallback(async () => {
    if (!workspace?.workspace_id) return;

    setIsFetchingMembers(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.workspace_id}/members`);
      if (response.ok) {
        const data = await response.json();
        setMemberCount(data.members?.length ?? 0);
      }
    } catch {
      // Non bloccare la pagina per un errore sul count
    } finally {
      setIsFetchingMembers(false);
    }
  }, [workspace?.workspace_id]);

  useEffect(() => {
    if (wsLoading) return;

    if (!workspace) {
      router.push('/dashboard/workspace-selector');
      return;
    }

    fetchMemberCount();
  }, [workspace, wsLoading, router, fetchMemberCount]);

  // ============================================
  // RENDER
  // ============================================

  if (wsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento impostazioni...</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return null; // redirect in useEffect
  }

  if (!canViewSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Impostazioni" subtitle="Accesso negato" showBackButton />
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600">
              Non hai i permessi per visualizzare le impostazioni del workspace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const RoleIcon = roleIcon[workspace.role] || Eye;
  const userPermissions = workspace.permissions || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <DashboardNav
          title="Impostazioni Workspace"
          subtitle={`Panoramica di "${workspace.workspace_name}"`}
          showBackButton
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Workspace */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] p-4">
              <div className="flex items-center justify-between">
                <div className="text-white/90 text-sm font-medium">Workspace</div>
                <Building2 className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <div className="p-6">
              <div className="text-xl font-bold text-gray-900 mb-1">{workspace.workspace_name}</div>
              <Badge variant={typeBadgeVariant[workspace.workspace_type] || 'default'}>
                {typeLabel[workspace.workspace_type] || workspace.workspace_type}
              </Badge>
            </div>
          </div>

          {/* Wallet */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
              <div className="flex items-center justify-between">
                <div className="text-white/90 text-sm font-medium">Saldo Wallet</div>
                <Wallet className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                €{(workspace.wallet_balance ?? 0).toFixed(2)}
              </div>
              <Link
                href="/dashboard/wallet"
                className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                Vai al wallet <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Team */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
              <div className="flex items-center justify-between">
                <div className="text-white/90 text-sm font-medium">Team</div>
                <Users className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {isFetchingMembers ? (
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                ) : (
                  (memberCount ?? '—')
                )}
              </div>
              <Link
                href="/dashboard/workspace/team"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Gestisci team <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Dettagli Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Info Workspace */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" />
                Dettagli Workspace
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Nome</span>
                <span className="text-sm font-medium text-gray-900">
                  {workspace.workspace_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Tipo</span>
                <Badge variant={typeBadgeVariant[workspace.workspace_type] || 'default'}>
                  {typeLabel[workspace.workspace_type] || workspace.workspace_type}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Slug</span>
                <span className="text-sm font-mono text-gray-700">{workspace.workspace_slug}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Livello</span>
                <span className="text-sm text-gray-700">
                  {workspace.workspace_depth === 0
                    ? 'Piattaforma (root)'
                    : workspace.workspace_depth === 1
                      ? 'Reseller (livello 1)'
                      : 'Cliente (livello 2)'}
                </span>
              </div>
            </div>
          </div>

          {/* Info Organizzazione */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-600" />
                Organizzazione
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Nome</span>
                <span className="text-sm font-medium text-gray-900">
                  {workspace.organization_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Slug</span>
                <span className="text-sm font-mono text-gray-700">
                  {workspace.organization_slug}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">ID Workspace</span>
                <span className="text-xs font-mono text-gray-400">{workspace.workspace_id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ruolo e Permessi */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Il Tuo Ruolo e Permessi
            </h2>
          </div>
          <div className="p-6">
            {/* Ruolo attuale */}
            <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF9500] to-[#FF6B35] rounded-full flex items-center justify-center">
                <RoleIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {roleLabel[workspace.role] || workspace.role}
                </div>
                <div className="text-xs text-gray-500">
                  Ruolo nel workspace &quot;{workspace.workspace_name}&quot;
                </div>
              </div>
            </div>

            {/* Permessi raggruppati */}
            {userPermissions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(permissionGroups).map(([groupId, group]) => {
                  const activePerms = group.permissions.filter((p) => userPermissions.includes(p));

                  if (activePerms.length === 0) return null;

                  return (
                    <div key={groupId} className="border border-gray-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activePerms.map((perm) => (
                          <Badge key={perm} variant="secondary" className="text-xs">
                            {formatPermission(perm)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Nessun permesso esplicito configurato. I permessi sono determinati dal ruolo.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
