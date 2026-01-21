/**
 * Admin Dashboard - God View
 *
 * Dashboard amministrativa completa con:
 * - Vista di tutti gli utenti
 * - Vista di tutte le spedizioni
 * - Statistiche globali
 * - Grafici e visualizzazioni
 *
 * ⚠️ SOLO PER ADMIN: Verifica permessi prima di mostrare
 */

'use client';

import { assignConfigurationToUser, listConfigurations } from '@/actions/configurations';
import { AiFeaturesCard } from '@/components/admin/ai-features/AiFeaturesCard';
import { ManagePriceListAssignmentsDialog } from '@/components/admin/manage-price-list-assignments-dialog';
import DashboardNav from '@/components/dashboard-nav';
import { featureFlags } from '@/lib/config/feature-flags';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Cog,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  Package,
  Power,
  PowerOff,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
  isTestUser,
  isTestShipment,
  createUserMap,
  filterProductionUsers,
  filterProductionShipments,
  countTestVsProduction,
} from '@/lib/utils/test-data-detection';

interface AdminStats {
  // Utenti
  totalUsers: number;
  adminUsers: number;
  regularUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;

  // Spedizioni
  totalShipments: number;
  shipmentsToday: number;
  shipmentsThisWeek: number;
  shipmentsThisMonth: number;

  // Status spedizioni
  shipmentsPending: number;
  shipmentsInTransit: number;
  shipmentsDelivered: number;
  shipmentsFailed: number;

  // Fatturato
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  provider: string;
  created_at: string;
  assigned_config_id?: string | null;
  metadata?: any;
  price_lists_count?: number;
  account_type?: string;
  is_reseller?: boolean;
  reseller_role?: string;
  parent_user_id?: string | null;
}

interface Shipment {
  id: string;
  tracking_number?: string;
  status: string;
  final_price?: number;
  created_at: string;
  recipient_name?: string;
  recipient_city?: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [productionStats, setProductionStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [killerFeatures, setKillerFeatures] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stati per modali e azioni
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [showDeleteShipmentModal, setShowDeleteShipmentModal] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [userFeatures, setUserFeatures] = useState<any[]>([]);
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [courierConfigs, setCourierConfigs] = useState<any[]>([]);
  const [assigningConfig, setAssigningConfig] = useState<string | null>(null);

  // Stati per gestione listini personalizzati
  const [selectedUserForPriceLists, setSelectedUserForPriceLists] = useState<User | null>(null);
  const [showPriceListsDialog, setShowPriceListsDialog] = useState(false);

  // Filtri per dati di test
  const [showTestData, setShowTestData] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [currentUserPage, setCurrentUserPage] = useState(1);
  const [currentShipmentPage, setCurrentShipmentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Carica configurazioni corrieri
  useEffect(() => {
    loadCourierConfigs();
  }, []);

  async function loadCourierConfigs() {
    try {
      const result = await listConfigurations();
      if (result.success && result.configs) {
        setCourierConfigs(result.configs);
      }
    } catch (error) {
      console.error('Errore caricamento configurazioni:', error);
    }
  }

  // Assegna configurazione a utente
  async function handleAssignConfig(userId: string, configId: string | null) {
    setAssigningConfig(userId);
    try {
      const result = await assignConfigurationToUser(userId, configId);
      if (result.success) {
        // Ricarica dati
        const overviewResponse = await fetch('/api/admin/overview');
        if (overviewResponse.ok) {
          const data = await overviewResponse.json();
          if (data.success) {
            setUsers(data.users || []);
          }
        }
        alert(result.message || 'Configurazione assegnata con successo');
      } else {
        alert(`Errore: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Errore assegnazione configurazione:', error);
      alert(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setAssigningConfig(null);
    }
  }

  // Verifica autorizzazione e carica dati
  useEffect(() => {
    async function loadAdminData() {
      if (status === 'loading') return;

      if (!session) {
        router.push('/login');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/overview');

        if (response.status === 403) {
          setError('Accesso negato. Solo gli admin possono accedere a questa pagina.');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error('Errore nel caricamento dei dati admin');
        }

        const data = await response.json();

        if (data.success) {
          setStats(data.stats);
          setProductionStats(data.productionStats || data.stats);
          setUsers(data.users || []);
          setShipments(data.shipments || []);
          setIsAuthorized(true);
        } else {
          throw new Error(data.error || 'Errore sconosciuto');
        }

        // Carica anche le killer features
        try {
          const featuresResponse = await fetch('/api/admin/features');
          if (featuresResponse.ok) {
            const featuresData = await featuresResponse.json();
            setKillerFeatures(featuresData.features || []);
          }
        } catch (err) {
          console.warn('Errore caricamento features:', err);
        }
      } catch (err: any) {
        console.error('Errore caricamento dati admin:', err);
        setError(err.message || 'Errore nel caricamento dei dati');
      } finally {
        setIsLoading(false);
      }
    }

    loadAdminData();
  }, [session, status, router]);

  // Componente Stat Card
  function StatCard({
    title,
    value,
    change,
    icon,
    gradient,
  }: {
    title: string;
    value: string | number;
    change?: string;
    icon: React.ReactNode;
    gradient: string;
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
        <div className={`${gradient} p-4`}>
          <div className="flex items-center justify-between">
            <div className="text-white/90 text-sm font-medium">{title}</div>
            <div className="text-white/80">{icon}</div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
          {change && <div className="text-sm text-gray-500">{change}</div>}
        </div>
      </div>
    );
  }

  // Formatta numero come valuta
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

  // Statistiche test vs produzione (definite prima degli early return - REGOLA HOOKS)
  const userStats = useMemo(() => {
    if (!users || users.length === 0) {
      return { test: 0, production: 0, total: 0 };
    }
    return countTestVsProduction(users);
  }, [users]);

  const shipmentStats = useMemo(() => {
    if (!shipments || shipments.length === 0) {
      return { test: 0, production: 0, total: 0 };
    }
    const userMap = createUserMap(users);
    let test = 0;
    let production = 0;

    shipments.forEach((s) => {
      if (isTestShipment(s, userMap)) {
        test++;
      } else {
        production++;
      }
    });

    return { test, production, total: shipments.length };
  }, [shipments, users]);

  // Filtra e processa utenti
  const processedUsers = useMemo(() => {
    let filtered = [...users];

    // Filtro dati di test
    if (!showTestData) {
      filtered = filterProductionUsers(filtered);
    }

    // Filtro ricerca
    if (userSearch) {
      const searchLower = userSearch.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.email?.toLowerCase().includes(searchLower) ||
          u.name?.toLowerCase().includes(searchLower) ||
          u.id.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [users, showTestData, userSearch]);

  // Filtra e processa spedizioni
  const processedShipments = useMemo(() => {
    let filtered = [...shipments];
    const userMap = createUserMap(users);

    // Filtro dati di test
    if (!showTestData) {
      filtered = filterProductionShipments(filtered, userMap);
    }

    // Filtro ricerca
    if (shipmentSearch) {
      const searchLower = shipmentSearch.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.tracking_number?.toLowerCase().includes(searchLower) ||
          s.recipient_name?.toLowerCase().includes(searchLower) ||
          s.recipient_city?.toLowerCase().includes(searchLower) ||
          s.id.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [shipments, users, showTestData, shipmentSearch]);

  // Paginazione utenti
  const paginatedUsers = useMemo(() => {
    const start = (currentUserPage - 1) * ITEMS_PER_PAGE;
    return processedUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [processedUsers, currentUserPage]);

  // Paginazione spedizioni
  const paginatedShipments = useMemo(() => {
    const start = (currentShipmentPage - 1) * ITEMS_PER_PAGE;
    return processedShipments.slice(start, start + ITEMS_PER_PAGE);
  }, [processedShipments, currentShipmentPage]);

  // Carica features di un utente
  async function loadUserFeatures(userId: string) {
    setIsLoadingFeatures(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/features`);
      if (response.ok) {
        const data = await response.json();
        setUserFeatures(data.features || []);
      }
    } catch (error) {
      console.error('Errore caricamento features utente:', error);
    } finally {
      setIsLoadingFeatures(false);
    }
  }

  // Apri modale gestione features
  function handleManageFeatures(user: User) {
    setSelectedUser(user);
    setShowFeaturesModal(true);
    loadUserFeatures(user.id);
  }

  // Toggle feature per utente
  async function toggleUserFeature(featureCode: string, activate: boolean) {
    if (!selectedUser) return;

    try {
      const response = await fetch('/api/admin/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserEmail: selectedUser.email,
          featureCode,
          activate,
          activationType: 'admin_grant',
        }),
      });

      if (response.ok) {
        // Ricarica features
        await loadUserFeatures(selectedUser.id);
        // Ricarica dati dashboard
        const overviewResponse = await fetch('/api/admin/overview');
        if (overviewResponse.ok) {
          const data = await overviewResponse.json();
          if (data.success) {
            setUsers(data.users || []);
          }
        }
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error || 'Errore sconosciuto'}`);
      }
    } catch (error: any) {
      console.error('Errore toggle feature:', error);
      alert(`Errore: ${error.message || 'Errore sconosciuto'}`);
    }
  }

  // Cancella utente
  async function handleDeleteUser() {
    if (!selectedUser || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Ricarica dati
        const overviewResponse = await fetch('/api/admin/overview');
        if (overviewResponse.ok) {
          const data = await overviewResponse.json();
          if (data.success) {
            setUsers(data.users || []);
            setStats(data.stats);
            setProductionStats(data.productionStats || data.stats);
          }
        }
        setShowDeleteUserModal(false);
        setSelectedUser(null);
        alert('Utente cancellato con successo');
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error || 'Errore sconosciuto'}`);
      }
    } catch (error: any) {
      console.error('Errore cancellazione utente:', error);
      alert(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setIsDeleting(false);
    }
  }

  // Cancella spedizione
  async function handleDeleteShipment() {
    if (!selectedShipment || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/shipments/${selectedShipment.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Ricarica dati
        const overviewResponse = await fetch('/api/admin/overview');
        if (overviewResponse.ok) {
          const data = await overviewResponse.json();
          if (data.success) {
            setShipments(data.shipments || []);
            setStats(data.stats);
            setProductionStats(data.productionStats || data.stats);
          }
        }
        setShowDeleteShipmentModal(false);
        setSelectedShipment(null);
        alert('Spedizione cancellata con successo');
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.error || 'Errore sconosciuto'}`);
      }
    } catch (error: any) {
      console.error('Errore cancellazione spedizione:', error);
      alert(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setIsDeleting(false);
    }
  }

  // Badge status spedizione
  function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pending: {
        label: 'In attesa',
        className: 'bg-yellow-100 text-yellow-800',
        icon: <Clock className="w-3 h-3" />,
      },
      draft: {
        label: 'Bozza',
        className: 'bg-gray-100 text-gray-800',
        icon: <Clock className="w-3 h-3" />,
      },
      in_transit: {
        label: 'In transito',
        className: 'bg-blue-100 text-blue-800',
        icon: <Activity className="w-3 h-3" />,
      },
      shipped: {
        label: 'Spedita',
        className: 'bg-blue-100 text-blue-800',
        icon: <Activity className="w-3 h-3" />,
      },
      delivered: {
        label: 'Consegnata',
        className: 'bg-green-100 text-green-800',
        icon: <CheckCircle2 className="w-3 h-3" />,
      },
      failed: {
        label: 'Fallita',
        className: 'bg-red-100 text-red-800',
        icon: <XCircle className="w-3 h-3" />,
      },
      cancelled: {
        label: 'Cancellata',
        className: 'bg-red-100 text-red-800',
        icon: <XCircle className="w-3 h-3" />,
      },
    };

    const statusConfig = config[status] || {
      label: status,
      className: 'bg-gray-100 text-gray-800',
      icon: <AlertCircle className="w-3 h-3" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}
      >
        {statusConfig.icon}
        {statusConfig.label}
      </span>
    );
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento dati admin...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Admin Dashboard" subtitle="Accesso negato" showBackButton={true} />
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

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav
            title="Admin Dashboard"
            subtitle="Nessun dato disponibile"
            showBackButton={true}
          />
        </div>
      </div>
    );
  }

  const effectiveStats = showTestData ? stats : productionStats || stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Admin Dashboard"
          subtitle="God View - Panoramica completa della piattaforma"
          showBackButton={true}
        />

        {/* Banner Informazioni Filtri */}
        {(userStats.test > 0 || shipmentStats.test > 0) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Filter className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  Filtri Dati di Test Attivi
                </h3>
                <p className="text-sm text-blue-800">
                  Per default, i dati di test sono nascosti per una navigazione più pulita.{' '}
                  {userStats.test > 0 && (
                    <span>
                      <strong>{userStats.test} utenti di test</strong> e{' '}
                    </span>
                  )}
                  {shipmentStats.test > 0 && (
                    <span>
                      <strong>{shipmentStats.test} spedizioni di test</strong>{' '}
                    </span>
                  )}
                  sono attualmente nascosti. Attiva &quot;Mostra dati di test&quot; nelle tabelle
                  per visualizzarli.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions - Admin Tools */}
        {session?.user && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Azioni Rapide
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <Link
                  href="/dashboard/admin/metrics"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-emerald-300 hover:shadow-md transition-all group"
                >
                  <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Business Metrics</h3>
                    <p className="text-sm text-gray-500">KPI e dashboard</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/admin/configurations"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Cog className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Configurazioni</h3>
                    <p className="text-sm text-gray-500">Gestisci API corrieri</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/admin/features"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all group"
                >
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Features Piattaforma</h3>
                    <p className="text-sm text-gray-500">Attiva/disattiva features</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/admin/automation"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:shadow-md transition-all group"
                >
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <Zap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Automation</h3>
                    <p className="text-sm text-gray-500">Gestisci automazione</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/team"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all group"
                >
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Gestione Team</h3>
                    <p className="text-sm text-gray-500">Gestisci utenti e admin</p>
                  </div>
                </Link>
                <Link
                  href="/dashboard/admin/logs"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all group"
                >
                  <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                    <Activity className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Log Diagnostici</h3>
                    <p className="text-sm text-gray-500">Eventi e monitoring</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards - Utenti */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Utenti
            </h2>
            {userStats.test > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-medium text-green-600">
                  {userStats.production} produzione
                </span>
                {' / '}
                <span className="font-medium text-yellow-600">{userStats.test} test</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Totale Utenti"
              value={showTestData ? stats.totalUsers : userStats.production}
              change={
                showTestData
                  ? `${stats.adminUsers} admin, ${stats.regularUsers} utenti`
                  : `${userStats.production} produzione${userStats.test > 0 ? ` (${userStats.test} test nascosti)` : ''}`
              }
              gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Nuovi Oggi"
              value={stats.newUsersToday}
              change="Registrati oggi"
              gradient="bg-gradient-to-r from-green-500 to-green-600"
              icon={<UserCheck className="w-5 h-5" />}
            />
            <StatCard
              title="Nuovi Questa Settimana"
              value={stats.newUsersThisWeek}
              change="Ultimi 7 giorni"
              gradient="bg-gradient-to-r from-purple-500 to-purple-600"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Nuovi Questo Mese"
              value={stats.newUsersThisMonth}
              change="Ultimi 30 giorni"
              gradient="bg-gradient-to-r from-indigo-500 to-indigo-600"
              icon={<Activity className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Stat Cards - Spedizioni */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Spedizioni
            </h2>
            {shipmentStats.test > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-medium text-green-600">
                  {shipmentStats.production} produzione
                </span>
                {' / '}
                <span className="font-medium text-yellow-600">{shipmentStats.test} test</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Totale Spedizioni"
              value={showTestData ? stats.totalShipments : effectiveStats.totalShipments}
              change={
                showTestData
                  ? `${stats.shipmentsDelivered} consegnate`
                  : `${effectiveStats.totalShipments} produzione${
                      shipmentStats.test > 0 ? ` (${shipmentStats.test} test nascoste)` : ''
                    }`
              }
              gradient="bg-gradient-to-r from-orange-500 to-orange-600"
              icon={<Package className="w-5 h-5" />}
            />
            <StatCard
              title="Oggi"
              value={effectiveStats.shipmentsToday}
              change={formatCurrency(effectiveStats.revenueToday)}
              gradient="bg-gradient-to-r from-cyan-500 to-cyan-600"
              icon={<Activity className="w-5 h-5" />}
            />
            <StatCard
              title="Questa Settimana"
              value={effectiveStats.shipmentsThisWeek}
              change={formatCurrency(effectiveStats.revenueThisWeek)}
              gradient="bg-gradient-to-r from-pink-500 to-pink-600"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Questo Mese"
              value={effectiveStats.shipmentsThisMonth}
              change={formatCurrency(effectiveStats.revenueThisMonth)}
              gradient="bg-gradient-to-r from-teal-500 to-teal-600"
              icon={<Package className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Stat Cards - Status e Fatturato */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Status e Fatturato
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="In Attesa"
              value={effectiveStats.shipmentsPending}
              gradient="bg-gradient-to-r from-yellow-500 to-yellow-600"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              title="In Transito"
              value={effectiveStats.shipmentsInTransit}
              gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              icon={<Activity className="w-5 h-5" />}
            />
            <StatCard
              title="Consegnate"
              value={effectiveStats.shipmentsDelivered}
              gradient="bg-gradient-to-r from-green-500 to-green-600"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
            <StatCard
              title="Fatturato Totale"
              value={formatCurrency(effectiveStats.totalRevenue)}
              gradient="bg-gradient-to-r from-emerald-500 to-emerald-600"
              icon={<DollarSign className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Tabella Utenti Recenti */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Utenti {!showTestData && `(Produzione: ${userStats.production})`}
            </h2>
            <div className="flex items-center gap-4">
              {/* Filtro dati di test */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTestData}
                  onChange={(e) => {
                    setShowTestData(e.target.checked);
                    setCurrentUserPage(1);
                  }}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">Mostra dati di test</span>
              </label>
              {/* Ricerca utenti */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca utenti..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setCurrentUserPage(1);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          {userStats.test > 0 && !showTestData && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>{userStats.test} utenti di test</strong> nascosti. Attiva &quot;Mostra
                dati di test&quot; per visualizzarli.
              </p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                      Provider
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Configurazione Corriere
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Listini Personalizzati
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedUsers.map((user) => {
                    const isTest = isTestUser(user);
                    return (
                      <tr
                        key={user.id}
                        className={`hover:bg-gray-50 ${isTest ? 'bg-yellow-50/50' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {user.name || user.email}
                                </div>
                                {isTest && (
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                    TEST
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            // Import dinamico per evitare problemi SSR
                            const roleUtils = require('@/lib/utils/role-badges');
                            return (
                              <roleUtils.RoleBadgeSpan
                                accountType={(user as any).account_type}
                                isReseller={(user as any).is_reseller}
                                role={user.role}
                              />
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.provider || 'credentials'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.assigned_config_id || ''}
                            onChange={(e) => handleAssignConfig(user.id, e.target.value || null)}
                            disabled={assigningConfig === user.id}
                            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                          >
                            <option value="">Nessuna (usa default)</option>
                            {courierConfigs.map((config) => (
                              <option key={config.id} value={config.id}>
                                {config.name} ({config.provider_id})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {!user.parent_user_id ? (
                            <button
                              onClick={() => {
                                setSelectedUserForPriceLists(user);
                                setShowPriceListsDialog(true);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all ${
                                (user.price_lists_count || 0) > 0
                                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                              {(user.price_lists_count || 0) > 0
                                ? `${user.price_lists_count} Listino${(user.price_lists_count || 0) > 1 ? 'i' : ''}`
                                : 'Nessuno'}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/dashboard/admin/users/${user.id}`}
                              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                              title="Dettaglio Utente / Gestione Fee"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleManageFeatures(user)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Gestisci Features"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            {user.email !== session?.user?.email && (
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowDeleteUserModal(true);
                                }}
                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Cancella Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Tabella Spedizioni Recenti */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Spedizioni {!showTestData && `(Produzione: ${shipmentStats.production})`}
            </h2>
            <div className="flex items-center gap-4">
              {/* Ricerca spedizioni */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca spedizioni..."
                  value={shipmentSearch}
                  onChange={(e) => {
                    setShipmentSearch(e.target.value);
                    setCurrentShipmentPage(1);
                  }}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          {shipmentStats.test > 0 && !showTestData && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>{shipmentStats.test} spedizioni di test</strong> nascoste. Attiva
                &quot;Mostra dati di test&quot; per visualizzarle.
              </p>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tracking
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destinatario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prezzo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const userMap = createUserMap(users);
                    return paginatedShipments.map((shipment) => {
                      const isTest = isTestShipment(shipment, userMap);
                      return (
                        <tr
                          key={shipment.id}
                          className={`hover:bg-gray-50 ${isTest ? 'bg-yellow-50/50' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {shipment.tracking_number || 'N/A'}
                              </span>
                              {isTest && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                  TEST
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {shipment.recipient_name || 'N/A'}
                            {shipment.recipient_city && (
                              <div className="text-xs text-gray-400">{shipment.recipient_city}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={shipment.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <div className="flex flex-col">
                              <span>
                                {shipment.final_price
                                  ? formatCurrency(shipment.final_price)
                                  : 'N/A'}
                              </span>
                              {/* ✨ NUOVO: Badge VAT (solo se feature flag abilitato) - ADR-001 */}
                              {featureFlags.showVATSemantics &&
                                shipment.final_price &&
                                (shipment as any).vat_mode && (
                                  <span className="text-xs text-gray-500 mt-0.5">
                                    {(shipment as any).vat_mode === 'excluded'
                                      ? `+ IVA ${(shipment as any).vat_rate || 22}%`
                                      : 'IVA incl.'}
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(shipment.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedShipment(shipment);
                                setShowDeleteShipmentModal(true);
                              }}
                              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Cancella Spedizione"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Killer Features */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Killer Features
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6">
              {killerFeatures.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nessuna feature disponibile</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {killerFeatures.map((feature) => (
                    <div
                      key={feature.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{feature.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                        </div>
                        {feature.is_free ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            Gratuita
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            Premium
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {feature.category}
                        </span>
                        {feature.is_available ? (
                          <span className="text-xs text-green-600">✓ Disponibile</span>
                        ) : (
                          <span className="text-xs text-gray-400">Non disponibile</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modali */}

        {/* Modale Cancellazione Utente */}
        {showDeleteUserModal && selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteUserModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Cancella Account</h3>
                    <p className="text-sm text-gray-600">Questa azione non può essere annullata</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Sei sicuro di voler cancellare l&apos;account di{' '}
                  <strong>{selectedUser.email}</strong>?
                  <br />
                  <span className="text-sm text-red-600">
                    Tutte le spedizioni verranno eliminate.
                  </span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteUser}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Cancellazione...' : 'Cancella Account'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteUserModal(false);
                      setSelectedUser(null);
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modale Cancellazione Spedizione */}
        {showDeleteShipmentModal && selectedShipment && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDeleteShipmentModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Cancella Spedizione</h3>
                    <p className="text-sm text-gray-600">Questa azione non può essere annullata</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  Sei sicuro di voler cancellare la spedizione{' '}
                  <strong>{selectedShipment.tracking_number || selectedShipment.id}</strong>?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteShipment}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Cancellazione...' : 'Cancella Spedizione'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteShipmentModal(false);
                      setSelectedShipment(null);
                    }}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modale Gestione Features */}
        {showFeaturesModal && selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFeaturesModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Sparkles className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Gestisci Features</h3>
                      <p className="text-sm text-gray-600">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowFeaturesModal(false);
                      setSelectedUser(null);
                      setUserFeatures([]);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                {/* AI Features Toggle for Resellers */}
                {selectedUser.role !== 'admin' && (selectedUser as any).is_reseller && (
                  <div className="mb-6">
                    <AiFeaturesCard
                      userId={selectedUser.id}
                      initialCanManagePriceLists={
                        selectedUser.metadata?.ai_can_manage_pricelists === true
                      }
                      userName={selectedUser.name || selectedUser.email}
                      onToggleComplete={async () => {
                        try {
                          // Fetch fresh data for this specific user (including auth metadata)
                          const response = await fetch(
                            `/api/admin/users/${selectedUser.id}/features`
                          );
                          if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.metadata) {
                              // Update selected user state with new metadata
                              const updatedUser = {
                                ...selectedUser,
                                metadata: data.metadata,
                              };
                              setSelectedUser(updatedUser);

                              // Also update the user in the main list to keep it in sync
                              setUsers((currentUsers) =>
                                currentUsers.map((u) =>
                                  u.id === selectedUser.id ? { ...u, metadata: data.metadata } : u
                                )
                              );
                            }
                          }
                        } catch (error) {
                          console.error('Error refreshing user data:', error);
                        }
                      }}
                    />
                  </div>
                )}

                {isLoadingFeatures ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 mt-2">Caricamento features...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userFeatures.map((feature) => (
                      <div
                        key={feature.id}
                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{feature.name}</h4>
                            {feature.is_free ? (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Gratuita
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                Premium
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
                          {feature.is_active_for_user && feature.expires_at && (
                            <p className="text-xs text-gray-400 mt-1">
                              Scade il: {new Date(feature.expires_at).toLocaleDateString('it-IT')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            toggleUserFeature(feature.code, !feature.is_active_for_user)
                          }
                          className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                            feature.is_active_for_user
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {feature.is_active_for_user ? (
                            <>
                              <Power className="w-4 h-4" />
                              Attiva
                            </>
                          ) : (
                            <>
                              <PowerOff className="w-4 h-4" />
                              Disattiva
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                    {userFeatures.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Nessuna feature disponibile</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dialog Gestione Listini Personalizzati */}
        {showPriceListsDialog && selectedUserForPriceLists && (
          <ManagePriceListAssignmentsDialog
            open={showPriceListsDialog}
            onOpenChange={setShowPriceListsDialog}
            userId={selectedUserForPriceLists.id}
            userName={selectedUserForPriceLists.name}
            userEmail={selectedUserForPriceLists.email}
            onSuccess={() => {
              // Ricarica overview per aggiornare count
              fetch('/api/admin/overview')
                .then((res) => res.json())
                .then((data) => {
                  if (data.success) {
                    setUsers(data.users || []);
                  }
                });
            }}
          />
        )}
      </div>
    </div>
  );
}
