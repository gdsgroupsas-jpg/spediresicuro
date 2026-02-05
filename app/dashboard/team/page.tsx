/**
 * Pagina: Team Management - Gestione Sotto-Admin
 *
 * Permette agli admin di gestire i propri sotto-admin:
 * - Visualizza lista sotto-admin diretti
 * - Statistiche aggregate gerarchia
 * - Invita nuovi sotto-admin
 *
 * ⚠️ SOLO PER ADMIN: Verifica permessi prima di mostrare
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import DashboardNav from '@/components/dashboard-nav';
import {
  Users,
  UserPlus,
  TrendingUp,
  DollarSign,
  Package,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Mail,
  Calendar,
  Shield,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  createSubAdmin,
  getDirectSubAdmins,
  getHierarchyStats,
  deleteSubAdmin,
} from '@/actions/admin';

interface SubAdmin {
  id: string;
  email: string;
  name: string;
  account_type: string;
  admin_level: number;
  created_at: string;
}

interface HierarchyStats {
  totalSubAdmins: number;
  totalShipments: number;
  totalRevenue: number;
  subAdminsByLevel: Record<number, number>;
}

export default function TeamManagementPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [subAdmins, setSubAdmins] = useState<SubAdmin[]>([]);
  const [stats, setStats] = useState<HierarchyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stati per modale invito
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Stati per eliminazione
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // ID del sub-admin in eliminazione

  // Carica dati
  useEffect(() => {
    async function loadTeamData() {
      if (status === 'loading') return;

      if (!session) {
        router.push('/login');
        return;
      }

      try {
        setIsLoading(true);

        // Verifica che sia admin
        const response = await fetch('/api/user/info');
        if (!response.ok) {
          throw new Error('Errore verifica utente');
        }

        const responseData = await response.json();
        // API restituisce { success: true, user: { account_type, ... } }
        const userData = responseData.user || responseData;

        // Verifica account_type
        if (userData.account_type !== 'admin' && userData.account_type !== 'superadmin') {
          setError('Accesso negato. Solo gli admin possono gestire il team.');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        setIsAuthorized(true);

        // Carica sotto-admin
        await loadSubAdmins();

        // Carica statistiche
        await loadStats();
      } catch (err: any) {
        console.error('Errore caricamento dati team:', err);
        setError(err.message || 'Errore nel caricamento dei dati');
      } finally {
        setIsLoading(false);
      }
    }

    loadTeamData();
  }, [session, status, router]);

  // Carica sotto-admin diretti
  async function loadSubAdmins() {
    if (!session?.user?.email) return;

    try {
      const result = await getDirectSubAdmins(session.user.email);

      if (result.success && result.subAdmins) {
        setSubAdmins(result.subAdmins);
      } else {
        console.error('Errore caricamento sotto-admin:', result.error);
      }
    } catch (err: any) {
      console.error('Errore caricamento sotto-admin:', err);
    }
  }

  // Carica statistiche
  async function loadStats() {
    if (!session?.user?.email) return;

    try {
      const result = await getHierarchyStats(session.user.email);

      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (err: any) {
      console.error('Errore caricamento statistiche:', err);
    }
  }

  // Gestisci invito nuovo sotto-admin
  async function handleInviteSubAdmin(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const result = await createSubAdmin(
        inviteEmail.trim(),
        inviteName.trim(),
        invitePassword.trim() || undefined
      );

      if (result.success) {
        setCreateSuccess(result.message || 'Sotto-admin creato con successo!');
        setInviteEmail('');
        setInviteName('');
        setInvitePassword('');

        // Ricarica lista
        await loadSubAdmins();
        await loadStats();

        // Chiudi modal dopo 2 secondi
        setTimeout(() => {
          setShowInviteModal(false);
          setCreateSuccess(null);
        }, 2000);
      } else {
        setCreateError(result.error || 'Errore durante la creazione');
      }
    } catch (err: any) {
      setCreateError(err.message || 'Errore sconosciuto');
    } finally {
      setIsCreating(false);
    }
  }

  // Gestisci eliminazione sotto-admin
  async function handleDeleteSubAdmin(admin: SubAdmin) {
    if (
      !confirm(
        `Sei sicuro di voler eliminare ${admin.name}?\n\nQuesta azione non può essere annullata.`
      )
    ) {
      return;
    }

    setIsDeleting(admin.id);

    try {
      const result = await deleteSubAdmin(admin.id);

      if (result.success) {
        // Ricarica lista
        await loadSubAdmins();
        await loadStats();
      } else {
        alert(result.error || "Errore durante l'eliminazione");
      }
    } catch (err: any) {
      alert(err.message || 'Errore sconosciuto');
    } finally {
      setIsDeleting(null);
    }
  }

  // Formatta valuta
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  // Formatta data
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento team management...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Team Management" subtitle="Accesso negato" showBackButton={true} />
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600 mb-6">
              {error || 'Solo gli admin possono accedere a questa pagina.'}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Torna alla Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Team Management"
          subtitle="Gestisci i tuoi sotto-admin e visualizza le statistiche della gerarchia"
          showBackButton={true}
        />

        {/* Stat Cards */}
        {stats && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Totale Sotto-Admin */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white/90 text-sm font-medium">Totale Sotto-Admin</div>
                    <Users className="w-5 h-5 text-white/80" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats.totalSubAdmins}
                  </div>
                  <div className="text-sm text-gray-500">Nella tua gerarchia</div>
                </div>
              </div>

              {/* Totale Spedizioni */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white/90 text-sm font-medium">Spedizioni Totali</div>
                    <Package className="w-5 h-5 text-white/80" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stats.totalShipments}
                  </div>
                  <div className="text-sm text-gray-500">Gerarchia completa</div>
                </div>
              </div>

              {/* Fatturato Totale */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white/90 text-sm font-medium">Fatturato Totale</div>
                    <DollarSign className="w-5 h-5 text-white/80" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {formatCurrency(stats.totalRevenue)}
                  </div>
                  <div className="text-sm text-gray-500">Gerarchia completa</div>
                </div>
              </div>

              {/* Livelli Gerarchia */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white/90 text-sm font-medium">Livelli Attivi</div>
                    <TrendingUp className="w-5 h-5 text-white/80" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {Object.keys(stats.subAdminsByLevel).length}
                  </div>
                  <div className="text-sm text-gray-500">Livelli utilizzati</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header Tabella */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Sotto-Admin Diretti</h2>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl"
          >
            <UserPlus className="w-5 h-5" />
            Invita Nuovo Sub-Admin
          </button>
        </div>

        {/* Tabella Sotto-Admin */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {subAdmins.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun Sotto-Admin</h3>
              <p className="text-gray-600 mb-6">
                Non hai ancora creato sotto-admin. Clicca su &quot;Invita Nuovo Sub-Admin&quot; per
                iniziare.
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
                      Livello
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Creazione
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{admin.name}</div>
                          <div className="text-sm text-gray-500">{admin.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                          Livello {admin.admin_level || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(admin.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/dashboard/team/${admin.id}`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Visualizza Dettagli"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubAdmin(admin)}
                            disabled={isDeleting === admin.id}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Elimina Sotto-Admin"
                          >
                            {isDeleting === admin.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Invita Sub-Admin */}
        {showInviteModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !isCreating && setShowInviteModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <UserPlus className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Invita Nuovo Sub-Admin</h3>
                      <p className="text-sm text-gray-600">
                        Crea un nuovo sotto-admin nella tua gerarchia
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !isCreating && setShowInviteModal(false)}
                    disabled={isCreating}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleInviteSubAdmin} className="p-6 space-y-4">
                {/* Success Message */}
                {createSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span>{createSuccess}</span>
                  </div>
                )}

                {/* Error Message */}
                {createError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    disabled={isCreating}
                    placeholder="subadmin@esempio.it"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md transition-all bg-white text-gray-900 font-medium placeholder:text-gray-500 hover:border-gray-400 disabled:opacity-50 disabled:bg-gray-100"
                  />
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    disabled={isCreating}
                    placeholder="Mario Rossi"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md transition-all bg-white text-gray-900 font-medium placeholder:text-gray-500 hover:border-gray-400 disabled:opacity-50 disabled:bg-gray-100"
                  />
                </div>

                {/* Password (Opzionale) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password (Opzionale)
                  </label>
                  <input
                    type="password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    disabled={isCreating}
                    placeholder="Lascia vuoto per generare password automatica"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md transition-all bg-white text-gray-900 font-medium placeholder:text-gray-500 hover:border-gray-400 disabled:opacity-50 disabled:bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Se lasci vuoto, verrà generata una password casuale da comunicare al nuovo admin
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creazione...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Crea Sub-Admin
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    disabled={isCreating}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
