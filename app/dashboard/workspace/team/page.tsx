/**
 * Pagina: Workspace Team Management
 *
 * Gestione membri del workspace corrente:
 * - Lista membri con ruolo e permessi
 * - Invita nuovi membri
 * - Modifica ruoli
 * - Rimuovi membri
 *
 * SECURITY:
 * - Verifica permessi tramite WorkspaceContext
 * - Solo owner/admin possono gestire membri
 * - Email mascherata per privacy
 *
 * @module app/dashboard/workspace/team
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TeamSetupWizard } from '@/components/team-setup-wizard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  UserPlus,
  Shield,
  Eye,
  Edit,
  Trash2,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Crown,
  UserCog,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import type { WorkspaceMemberRole, WorkspacePermission } from '@/types/workspace';

// ============================================
// TYPES
// ============================================

interface WorkspaceMemberUI {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  permissions: WorkspacePermission[];
  status: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string; // Mascherata
    avatar_url?: string;
  } | null;
}

interface InvitationUI {
  id: string;
  email: string; // Mascherata
  role: string;
  permissions: WorkspacePermission[];
  status: string;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
}

// ============================================
// COMPONENT
// ============================================

export default function WorkspaceTeamPage() {
  const router = useRouter();
  const { workspace, isLoading: wsLoading, hasPermission } = useWorkspaceContext();

  // State
  const [members, setMembers] = useState<WorkspaceMemberUI[]>([]);
  const [invitations, setInvitations] = useState<InvitationUI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMemberUI | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<WorkspaceMemberRole, 'owner'>>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    success: boolean;
    message: string;
    url?: string;
  } | null>(null);

  // Edit form
  const [editRole, setEditRole] = useState<WorkspaceMemberRole>('viewer');
  const [isUpdating, setIsUpdating] = useState(false);

  // Wizard primo setup
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);

  // Permissions
  const canManageMembers = hasPermission('members:invite') || hasPermission('members:remove');
  const canEditRoles = hasPermission('members:edit_role');
  const canViewMembers = hasPermission('members:view');

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchMembers = useCallback(async () => {
    if (!workspace?.workspace_id) return;

    try {
      const response = await fetch(`/api/workspaces/${workspace.workspace_id}/members`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch members');
      }
      const data = await response.json();
      setMembers(data.members || []);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      setError(err.message);
    }
  }, [workspace?.workspace_id]);

  const fetchInvitations = useCallback(async () => {
    if (!workspace?.workspace_id) return;

    try {
      const response = await fetch(`/api/workspaces/${workspace.workspace_id}/invite`);
      if (!response.ok) return;
      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
    }
  }, [workspace?.workspace_id]);

  useEffect(() => {
    async function loadData() {
      if (wsLoading) return;

      if (!workspace) {
        router.push('/dashboard/workspace-selector');
        return;
      }

      if (!canViewMembers) {
        setError('Non hai i permessi per visualizzare i membri del team');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      await Promise.all([fetchMembers(), fetchInvitations()]);
      setIsLoading(false);
    }

    loadData();
  }, [workspace, wsLoading, router, canViewMembers, fetchMembers, fetchInvitations]);

  // Determina se mostrare il wizard primo setup
  // Condizioni: solo 1 membro (owner), nessun invito, wizard non gia' dismissato
  useEffect(() => {
    if (isLoading || wizardDismissed) return;

    const wizardKey = workspace?.workspace_id ? `team_wizard_done_${workspace.workspace_id}` : null;
    const alreadyDone = wizardKey ? localStorage.getItem(wizardKey) === 'true' : false;

    if (alreadyDone) {
      setShowWizard(false);
      return;
    }

    // Solo owner, nessun altro membro, nessun invito pending
    const isAlone = members.length <= 1 && invitations.filter((i) => !i.is_expired).length === 0;
    setShowWizard(isAlone && canManageMembers);
  }, [members, invitations, isLoading, workspace?.workspace_id, canManageMembers, wizardDismissed]);

  const handleWizardComplete = () => {
    if (workspace?.workspace_id) {
      localStorage.setItem(`team_wizard_done_${workspace.workspace_id}`, 'true');
    }
    setShowWizard(false);
    setWizardDismissed(true);
    // Ricarica dati per mostrare il nuovo invito
    fetchMembers();
    fetchInvitations();
  };

  const handleWizardSkip = () => {
    if (workspace?.workspace_id) {
      localStorage.setItem(`team_wizard_done_${workspace.workspace_id}`, 'true');
    }
    setShowWizard(false);
    setWizardDismissed(true);
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.workspace_id || !inviteEmail) return;

    setIsInviting(true);
    setInviteResult(null);

    try {
      const response = await fetch(`/api/workspaces/${workspace.workspace_id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setInviteResult({ success: false, message: data.error || "Errore durante l'invito" });
        return;
      }

      setInviteResult({
        success: true,
        message: data.message,
        url: data.invitation?.invite_url,
      });

      // Refresh invitations
      await fetchInvitations();

      // Reset form after success
      setTimeout(() => {
        setInviteEmail('');
        setInviteRole('viewer');
      }, 100);
    } catch (err: any) {
      setInviteResult({ success: false, message: err.message || 'Errore sconosciuto' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!workspace?.workspace_id || !selectedMember) return;

    setIsUpdating(true);

    try {
      const response = await fetch(`/api/workspaces/${workspace.workspace_id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMember.user_id,
          role: editRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      // Refresh members
      await fetchMembers();
      setShowEditModal(false);
      setSelectedMember(null);
      toast.success('Ruolo aggiornato con successo');
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast.error(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMemberUI) => {
    if (!workspace?.workspace_id) return;
    if (
      !confirm(
        `Sei sicuro di voler rimuovere ${member.user?.name || 'questo membro'} dal workspace?`
      )
    )
      return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspace.workspace_id}/members?userId=${member.user_id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove member');
      }

      // Refresh members
      await fetchMembers();
      toast.success('Membro rimosso con successo');
    } catch (err: any) {
      console.error('Error removing member:', err);
      toast.error(err.message);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!workspace?.workspace_id) return;
    if (!confirm('Sei sicuro di voler revocare questo invito?')) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspace.workspace_id}/invite?invitationId=${invitationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke invitation');
      }

      // Refresh invitations
      await fetchInvitations();
      toast.success('Invito revocato');
    } catch (err: any) {
      console.error('Error revoking invitation:', err);
      toast.error(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiato negli appunti!');
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!workspace?.workspace_id) return;

    try {
      const response = await fetch(`/api/workspaces/${workspace.workspace_id}/invite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resend invitation');
      }

      toast.success('Email re-inviata con successo!');
    } catch (err: any) {
      console.error('Error resending invitation:', err);
      toast.error(err.message);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />;
      case 'admin':
        return <Shield className="w-4 h-4" />;
      case 'operator':
        return <UserCog className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): 'default' | 'warning' | 'success' | 'secondary' => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'warning';
      case 'operator':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Proprietario';
      case 'admin':
        return 'Amministratore';
      case 'operator':
        return 'Operatore';
      case 'viewer':
        return 'Visualizzatore';
      default:
        return role;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // ============================================
  // RENDER
  // ============================================

  if (wsLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento team...</p>
        </div>
      </div>
    );
  }

  // No workspace selected - show helpful message
  if (!workspace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Team Workspace" subtitle="Gestione membri" showBackButton />
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nessun Workspace Selezionato</h2>
            <p className="text-gray-600 mb-6">
              Seleziona un workspace per gestire i membri del team.
            </p>
            <Button
              onClick={() => router.push('/dashboard/workspace-selector')}
              className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] hover:from-[#E88500] hover:to-[#E55A2B]"
            >
              Seleziona Workspace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !canViewMembers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Team" subtitle="Accesso negato" showBackButton />
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Wizard primo setup team
  if (showWizard && workspace) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav
            title="Setup Team"
            subtitle="Configura il tuo team di lavoro"
            showBackButton
          />
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mt-6">
            <TeamSetupWizard
              workspaceId={workspace.workspace_id}
              workspaceName={workspace.workspace_name}
              onComplete={handleWizardComplete}
              onSkip={handleWizardSkip}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <DashboardNav
          title="Team"
          subtitle={`Gestisci i membri di "${workspace?.workspace_name}"`}
          showBackButton
          actions={
            canManageMembers && (
              <Button
                onClick={() => {
                  setInviteResult(null);
                  setShowInviteModal(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invita Membro
              </Button>
            )
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] p-4">
              <div className="flex items-center justify-between">
                <div className="text-white/90 text-sm font-medium">Membri Attivi</div>
                <Users className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-gray-900 mb-1">{members.length}</div>
              <div className="text-sm text-gray-500">Nel tuo team</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4">
              <div className="flex items-center justify-between">
                <div className="text-white/90 text-sm font-medium">Inviti Pending</div>
                <Mail className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {invitations.filter((i) => !i.is_expired).length}
              </div>
              <div className="text-sm text-gray-500">In attesa di risposta</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
              <div className="flex items-center justify-between">
                <div className="text-white/90 text-sm font-medium">Il Tuo Ruolo</div>
                <Shield className="w-5 h-5 text-white/80" />
              </div>
            </div>
            <div className="p-6">
              <div className="text-xl font-bold text-gray-900 mb-1">
                {getRoleLabel(workspace?.role || 'viewer')}
              </div>
              <div className="text-sm text-gray-500">In questo workspace</div>
            </div>
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Membri del Team
            </h2>
          </div>

          {members.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun Membro</h3>
              <p className="text-gray-600">
                Invita membri al tuo workspace per iniziare a collaborare.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ruolo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Membro dal
                    </th>
                    {(canManageMembers || canEditRoles) && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#FF9500] to-[#FF6B35] rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                            {(member.user?.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.user?.name || 'Utente'}
                            </div>
                            <div className="text-sm text-gray-500">{member.user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant={getRoleBadgeVariant(member.role)}
                          className="flex items-center gap-1 w-fit"
                        >
                          {getRoleIcon(member.role)}
                          {getRoleLabel(member.role)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(member.accepted_at || member.created_at)}
                      </td>
                      {(canManageMembers || canEditRoles) && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEditRoles && member.role !== 'owner' && (
                              <button
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditRole(member.role);
                                  setShowEditModal(true);
                                }}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Modifica Ruolo"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canManageMembers && member.role !== 'owner' && (
                              <button
                                onClick={() => handleRemoveMember(member)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Rimuovi Membro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            {member.role === 'owner' && (
                              <span className="text-xs text-gray-400 italic">Proprietario</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-600" />
                Inviti Pending
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ruolo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Scadenza
                    </th>
                    {canManageMembers && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Azioni
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {inv.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={getRoleBadgeVariant(inv.role)}>
                          {getRoleLabel(inv.role)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {inv.is_expired ? (
                          <Badge variant="error">Scaduto</Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            In attesa
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(inv.expires_at)}
                      </td>
                      {canManageMembers && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!inv.is_expired && (
                              <>
                                <button
                                  onClick={() => handleResendInvitation(inv.id)}
                                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Re-invia Email"
                                >
                                  <Mail className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRevokeInvitation(inv.id)}
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Revoca Invito"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent onClose={() => setShowInviteModal(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Invita Nuovo Membro
            </DialogTitle>
            <DialogDescription>
              Invia un invito per unirsi al workspace &quot;{workspace?.workspace_name}&quot;
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {inviteResult ? (
              <div
                className={`p-4 rounded-xl ${inviteResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
              >
                <div className="flex items-start gap-3">
                  {inviteResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={inviteResult.success ? 'text-green-800' : 'text-red-800'}>
                      {inviteResult.message}
                    </p>
                    {inviteResult.url && (
                      <div className="mt-3 p-3 bg-white rounded-lg border">
                        <p className="text-xs text-gray-500 mb-2">
                          Link invito (condividi con l&apos;utente):
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={inviteResult.url}
                            readOnly
                            className="flex-1 text-xs p-2 bg-gray-50 border rounded"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(inviteResult.url!)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={isInviting}
                    placeholder="nome@azienda.it"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ruolo</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    disabled={isInviting}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                  >
                    <option value="viewer">Visualizzatore - Solo lettura</option>
                    <option value="operator">Operatore - Può creare spedizioni</option>
                    <option value="admin">Amministratore - Gestione completa</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Info Ruoli:</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>
                      <strong>Visualizzatore:</strong> Può solo vedere dati
                    </li>
                    <li>
                      <strong>Operatore:</strong> Può creare spedizioni e gestire contatti
                    </li>
                    <li>
                      <strong>Amministratore:</strong> Può gestire membri e impostazioni
                    </li>
                  </ul>
                </div>
              </form>
            )}
          </DialogBody>

          <DialogFooter>
            {inviteResult?.success ? (
              <Button onClick={() => setShowInviteModal(false)}>Chiudi</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  disabled={isInviting}
                >
                  Annulla
                </Button>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail}>
                  {isInviting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Invio...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Invia Invito
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent onClose={() => setShowEditModal(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-blue-600" />
              Modifica Ruolo
            </DialogTitle>
            <DialogDescription>
              Modifica il ruolo di {selectedMember?.user?.name || 'questo membro'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nuovo Ruolo</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as WorkspaceMemberRole)}
                disabled={isUpdating}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="viewer">Visualizzatore</option>
                <option value="operator">Operatore</option>
                <option value="admin">Amministratore</option>
              </select>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)} disabled={isUpdating}>
              Annulla
            </Button>
            <Button onClick={handleUpdateRole} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                'Salva Modifiche'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
