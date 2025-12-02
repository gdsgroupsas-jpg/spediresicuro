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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import DashboardNav from '@/components/dashboard-nav';
import { 
  Users, 
  Package, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Shield,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  Settings
} from 'lucide-react';

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
  const [users, setUsers] = useState<User[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [killerFeatures, setKillerFeatures] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          {change && (
            <div className="text-sm text-gray-500">{change}</div>
          )}
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

  // Badge status spedizione
  function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pending: { label: 'In attesa', className: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      draft: { label: 'Bozza', className: 'bg-gray-100 text-gray-800', icon: <Clock className="w-3 h-3" /> },
      in_transit: { label: 'In transito', className: 'bg-blue-100 text-blue-800', icon: <Activity className="w-3 h-3" /> },
      shipped: { label: 'Spedita', className: 'bg-blue-100 text-blue-800', icon: <Activity className="w-3 h-3" /> },
      delivered: { label: 'Consegnata', className: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { label: 'Fallita', className: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
      cancelled: { label: 'Cancellata', className: 'bg-red-100 text-red-800', icon: <XCircle className="w-3 h-3" /> },
    };

    const statusConfig = config[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: <AlertCircle className="w-3 h-3" /> };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.className}`}>
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
          <DashboardNav
            title="Admin Dashboard"
            subtitle="Accesso negato"
            showBackButton={true}
          />
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600 mb-6">{error || 'Solo gli admin possono accedere a questa pagina.'}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Admin Dashboard"
          subtitle="God View - Panoramica completa della piattaforma"
          showBackButton={true}
        />

        {/* Stat Cards - Utenti */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Utenti
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Totale Utenti"
              value={stats.totalUsers}
              change={`${stats.adminUsers} admin, ${stats.regularUsers} utenti`}
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
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Spedizioni
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Totale Spedizioni"
              value={stats.totalShipments}
              change={`${stats.shipmentsDelivered} consegnate`}
              gradient="bg-gradient-to-r from-orange-500 to-orange-600"
              icon={<Package className="w-5 h-5" />}
            />
            <StatCard
              title="Oggi"
              value={stats.shipmentsToday}
              change={formatCurrency(stats.revenueToday)}
              gradient="bg-gradient-to-r from-cyan-500 to-cyan-600"
              icon={<Activity className="w-5 h-5" />}
            />
            <StatCard
              title="Questa Settimana"
              value={stats.shipmentsThisWeek}
              change={formatCurrency(stats.revenueThisWeek)}
              gradient="bg-gradient-to-r from-pink-500 to-pink-600"
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Questo Mese"
              value={stats.shipmentsThisMonth}
              change={formatCurrency(stats.revenueThisMonth)}
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
              value={stats.shipmentsPending}
              gradient="bg-gradient-to-r from-yellow-500 to-yellow-600"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              title="In Transito"
              value={stats.shipmentsInTransit}
              gradient="bg-gradient-to-r from-blue-500 to-blue-600"
              icon={<Activity className="w-5 h-5" />}
            />
            <StatCard
              title="Consegnate"
              value={stats.shipmentsDelivered}
              gradient="bg-gradient-to-r from-green-500 to-green-600"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
            <StatCard
              title="Fatturato Totale"
              value={formatCurrency(stats.totalRevenue)}
              gradient="bg-gradient-to-r from-emerald-500 to-emerald-600"
              icon={<DollarSign className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Tabella Utenti Recenti */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Utenti Recenti</h2>
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
                      Registrato
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.slice(0, 10).map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name || user.email}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.role === 'admin' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : 'Utente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.provider || 'credentials'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Tabella Spedizioni Recenti */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Spedizioni Recenti</h2>
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shipments.slice(0, 20).map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {shipment.tracking_number || 'N/A'}
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
                        {shipment.final_price ? formatCurrency(shipment.final_price) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(shipment.created_at)}
                      </td>
                    </tr>
                  ))}
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
      </div>
    </div>
  );
}

