/**
 * Dashboard Premium - Ultra Web Designer
 *
 * Dashboard moderna e professionale con:
 * - Statistiche in tempo reale
 * - Grafici e visualizzazioni
 * - Attività recente
 * - Configurazioni rapide
 * Design ispirato a Stripe, Linear, Vercel
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import PageHeader from '@/components/page-header';
import UserFeaturesList from '@/components/features/user-features-list';
import {
  Shield,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Building2,
  Wallet,
  ChevronRight,
  Package,
} from 'lucide-react';
import { useProfileCompletion } from '@/lib/hooks/use-profile-completion';
import { WelcomeGate } from '@/components/invite/welcome-gate';
import { WELCOME_SEEN_KEY } from '@/lib/welcome-gate-helpers';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import WorkspaceSwitcher from '@/components/workspace-switcher';
import { useUser } from '@/contexts/UserContext';
import { StatsCardsSkeleton } from '@/components/shared/data-table-skeleton';
import { EmptyState } from '@/components/shared/empty-state';

// Interfaccia per le statistiche
interface Stats {
  totaleSpedizioni: number;
  spedizioniOggi: number;
  spedizioniSettimana: number;
  spedizioniMese: number;
  totalePreventivi: number;
  fatturatoTotale: number;
  fatturatoMese: number;
  margineMedio: number;
  spedizioniInTransito: number;
  spedizioniConsegnate: number;
  spedizioniInPreparazione: number;
}

// Componente Stat Card Premium
function StatCard({
  title,
  value,
  change,
  icon,
  gradient,
  trend,
}: {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
      <div className={`h-1 ${gradient}`}></div>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${gradient} bg-opacity-10`}>
            <div className={`${gradient.replace('bg-', 'text-')}`}>{icon}</div>
          </div>
          {change && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                trend === 'up'
                  ? 'bg-green-100 text-green-700'
                  : trend === 'down'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {change}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Componente Mini Chart (barre semplici)
function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((value, index) => (
        <div
          key={index}
          className={`flex-1 ${color} rounded-t transition-all duration-300 hover:opacity-80`}
          style={{ height: `${(value / max) * 100}%` }}
        />
      ))}
    </div>
  );
}

// Componente Progress Ring
function ProgressRing({
  percentage,
  size = 80,
  strokeWidth = 8,
  color = 'blue',
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const colorClasses: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colorClasses[color]} transition-all duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold ${colorClasses[color]}`}>{percentage}%</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Onboarding gating: verifica se profilo completato
  const { isComplete: isProfileComplete, isLoading: isProfileLoading } = useProfileCompletion();
  const profileIncomplete = !isProfileLoading && isProfileComplete === false;

  // Dati utente condivisi (elimina fetch ridondanti /api/user/settings e /api/user/dati-cliente)
  const { user, isAdmin, hasCompletedOnboarding, isLoading: isUserLoading } = useUser();
  const [stats, setStats] = useState<Stats>({
    totaleSpedizioni: 0,
    spedizioniOggi: 0,
    spedizioniSettimana: 0,
    spedizioniMese: 0,
    totalePreventivi: 0,
    fatturatoTotale: 0,
    fatturatoMese: 0,
    margineMedio: 0,
    spedizioniInTransito: 0,
    spedizioniConsegnate: 0,
    spedizioniInPreparazione: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentSpedizioni, setRecentSpedizioni] = useState<any[]>([]);
  const [margine, setMargine] = useState(15);

  // Workspace context
  const { workspace } = useWorkspaceContext();

  // WelcomeGate: primo accesso in assoluto
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (status === 'authenticated' && typeof window !== 'undefined') {
      const hasSeenWelcome = localStorage.getItem(WELCOME_SEEN_KEY);
      if (!hasSeenWelcome) {
        setShowWelcome(true);
      }
    }
  }, [status]);

  // Redirect se dati cliente non completati (usa UserContext, no fetch aggiuntivo)
  useEffect(() => {
    if (isUserLoading || !user) return;
    // Utente test: mai redirect
    if (user.email?.toLowerCase() === 'test@spediresicuro.it') return;
    // Fail-closed: se dati non completati → redirect obbligatorio
    if (!hasCompletedOnboarding) {
      router.push('/dashboard/dati-cliente');
    }
  }, [isUserLoading, user, hasCompletedOnboarding, router]);

  // Ruolo utente derivato da UserContext (nessun fetch aggiuntivo)

  // Carica dati dashboard
  useEffect(() => {
    async function loadDashboardData() {
      try {
        setIsLoading(true);

        // Carica spedizioni
        const spedizioniRes = await fetch('/api/spedizioni');
        const spedizioniData = await spedizioniRes.json();
        const spedizioni = spedizioniData.data || [];

        // Calcola statistiche
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const spedizioniOggi = spedizioni.filter((s: any) => {
          const date = new Date(s.createdAt);
          return date >= today;
        }).length;

        const spedizioniSettimana = spedizioni.filter((s: any) => {
          const date = new Date(s.createdAt);
          return date >= weekAgo;
        }).length;

        const spedizioniMese = spedizioni.filter((s: any) => {
          const date = new Date(s.createdAt);
          return date >= monthAgo;
        }).length;

        const fatturatoTotale = spedizioni.reduce(
          (sum: number, s: any) => sum + (s.prezzoFinale || 0),
          0
        );

        const fatturatoMese = spedizioni
          .filter((s: any) => {
            const date = new Date(s.createdAt);
            return date >= monthAgo;
          })
          .reduce((sum: number, s: any) => sum + (s.prezzoFinale || 0), 0);

        const spedizioniInTransito = spedizioni.filter(
          (s: any) => s.status === 'in_transito'
        ).length;

        const spedizioniConsegnate = spedizioni.filter(
          (s: any) => s.status === 'consegnata'
        ).length;

        const spedizioniInPreparazione = spedizioni.filter(
          (s: any) => s.status === 'in_preparazione'
        ).length;

        // Ultime 5 spedizioni
        const recent = spedizioni
          .sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 5);

        setStats({
          totaleSpedizioni: spedizioni.length,
          spedizioniOggi,
          spedizioniSettimana,
          spedizioniMese,
          totalePreventivi: 0, // TODO: caricare preventivi
          fatturatoTotale,
          fatturatoMese,
          margineMedio: 15, // TODO: calcolare margine medio
          spedizioniInTransito,
          spedizioniConsegnate,
          spedizioniInPreparazione,
        });

        setRecentSpedizioni(recent);
      } catch (error) {
        console.error('Errore caricamento dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Formatta prezzo
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  // Formatta data
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  // Dati per grafico settimanale (mock)
  const weeklyData = [12, 19, 15, 25, 22, 18, 24];

  // Calcola percentuale consegnate
  const consegnaRate =
    stats.totaleSpedizioni > 0
      ? Math.round((stats.spedizioniConsegnate / stats.totaleSpedizioni) * 100)
      : 0;

  // WelcomeGate: primo accesso — Anne accoglie l'utente
  if (showWelcome) {
    return (
      <WelcomeGate
        userName={session?.user?.name || ''}
        onComplete={() => {
          localStorage.setItem(WELCOME_SEEN_KEY, 'true');
          setShowWelcome(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica completa delle tue attività di spedizione"
        showBackButton={false}
      />

      {/* Banner Profilo Incompleto */}
      {profileIncomplete && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Completa il profilo per sbloccare le funzioni principali
              </p>
              <p className="text-sm text-amber-700">
                Per poter creare spedizioni, importare ordini ed esportare dati, devi prima
                completare i tuoi dati cliente.{' '}
                <Link
                  href="/dashboard/dati-cliente"
                  className="underline font-medium hover:text-amber-900"
                >
                  Completa ora →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Context Bar — interattiva con switch */}
      {workspace && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 mb-8 relative z-10">
          <div className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              {/* Sinistra: Workspace switcher interattivo */}
              <div className="flex-1 min-w-0">
                <WorkspaceSwitcher />
              </div>

              {/* Destra: Saldo wallet */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                    Saldo
                  </p>
                  <p className="text-sm font-bold text-gray-900 tabular-nums">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'currency',
                      currency: 'EUR',
                    }).format(workspace.wallet_balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wallet depletion warning */}
      {workspace && workspace.wallet_balance < 10 && !isLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${
              workspace.wallet_balance <= 0
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 flex-shrink-0 ${
                workspace.wallet_balance <= 0 ? 'text-red-500' : 'text-amber-500'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {workspace.wallet_balance <= 0
                  ? 'Saldo esaurito — non puoi creare nuove spedizioni'
                  : `Saldo basso: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(workspace.wallet_balance)} rimasti`}
              </p>
            </div>
            <Link
              href="/dashboard/wallet"
              className={`text-sm font-semibold whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors ${
                workspace.wallet_balance <= 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              Ricarica
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="space-y-8">
            {/* Skeleton stat cards */}
            <StatsCardsSkeleton count={4} />
            {/* Skeleton grafici + status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-5 w-40 bg-gray-200 rounded mb-2" />
                <div className="h-3 w-24 bg-gray-100 rounded mb-6" />
                <div className="flex items-end gap-1 h-32">
                  {[40, 65, 50, 80, 70, 55, 75].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gray-200 rounded-t"
                      style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-5 w-32 bg-gray-200 rounded mb-6" />
                <div className="space-y-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-gray-200 rounded-full" />
                        <div className="h-4 w-24 bg-gray-200 rounded" />
                      </div>
                      <div className="h-5 w-8 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Skeleton attività recente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse"
                >
                  <div className="h-5 w-32 bg-gray-200 rounded mb-6" />
                  <div className="space-y-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                          <div>
                            <div className="h-4 w-28 bg-gray-200 rounded mb-2" />
                            <div className="h-3 w-20 bg-gray-100 rounded" />
                          </div>
                        </div>
                        <div className="h-4 w-16 bg-gray-200 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Totale Spedizioni"
                value={stats.totaleSpedizioni}
                change={`+${stats.spedizioniOggi} oggi`}
                trend="up"
                gradient="bg-gradient-to-r from-blue-500 to-blue-600"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                }
              />

              <StatCard
                title="Fatturato Totale"
                value={formatPrice(stats.fatturatoTotale)}
                change={`${formatPrice(stats.fatturatoMese)} questo mese`}
                trend="up"
                gradient="bg-gradient-to-r from-green-500 to-emerald-600"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />

              <StatCard
                title="In Transito"
                value={stats.spedizioniInTransito}
                change={`${stats.spedizioniConsegnate} consegnate`}
                trend="neutral"
                gradient="bg-gradient-to-r from-amber-500 to-orange-600"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                }
              />

              <StatCard
                title="Tasso Consegna"
                value={`${consegnaRate}%`}
                change={`${stats.spedizioniConsegnate} di ${stats.totaleSpedizioni}`}
                trend="up"
                gradient="bg-gradient-to-r from-purple-500 to-indigo-600"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Grafico Settimanale */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Spedizioni Settimanali</h3>
                    <p className="text-sm text-gray-600 mt-1">Ultimi 7 giorni</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>Spedizioni</span>
                  </div>
                </div>
                <MiniChart data={weeklyData} color="bg-blue-500" />
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, i) => (
                    <span key={i}>{day}</span>
                  ))}
                </div>
              </div>

              {/* Status Overview */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Stato Spedizioni</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-sm font-medium text-gray-700">In Preparazione</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {stats.spedizioniInPreparazione}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm font-medium text-gray-700">In Transito</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {stats.spedizioniInTransito}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium text-gray-700">Consegnate</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {stats.spedizioniConsegnate}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-center">
                      <ProgressRing percentage={consegnaRate} size={100} color="green" />
                    </div>
                    <p className="text-center text-sm text-gray-600 mt-2">Tasso di consegna</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistiche Mensili e Attività Recente */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Statistiche Mensili */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Questo Mese</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-600">Spedizioni</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.spedizioniMese}</p>
                    </div>
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <div>
                      <p className="text-sm text-gray-600">Fatturato</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatPrice(stats.fatturatoMese)}
                      </p>
                    </div>
                    <div className="p-3 bg-green-500 rounded-xl">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attività Recente */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Attività Recente</h3>
                  <Link
                    href="/dashboard/spedizioni"
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Vedi tutte
                  </Link>
                </div>
                <div className="space-y-4">
                  {recentSpedizioni.length > 0 ? (
                    recentSpedizioni.map((spedizione) => (
                      <div
                        key={spedizione.id}
                        className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-blue-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {spedizione.destinatario?.nome || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(spedizione.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {spedizione.prezzoFinale > 0
                              ? formatPrice(spedizione.prezzoFinale)
                              : '—'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Package}
                      title="Nessuna spedizione"
                      description="Crea la tua prima spedizione per vedere l'attività qui"
                      action={
                        <Link
                          href="/dashboard/spedizioni/nuova"
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Nuova spedizione
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      }
                      className="py-6"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Azioni Rapide</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  href="/dashboard/spedizioni"
                  className="flex items-center gap-3 p-4 border-2 border-indigo-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group bg-gradient-to-br from-indigo-50 to-blue-50"
                >
                  <div className="p-2 bg-indigo-500 rounded-lg group-hover:bg-indigo-600 transition-colors shadow-sm">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-base">Lista Spedizioni</p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Visualizza, filtra e gestisci tutte le spedizioni
                    </p>
                    {stats.totaleSpedizioni > 0 && (
                      <p className="text-xs font-medium text-indigo-600 mt-1">
                        {stats.totaleSpedizioni} spedizione{stats.totaleSpedizioni !== 1 ? 'i' : ''}{' '}
                        total{stats.totaleSpedizioni !== 1 ? 'i' : 'e'}
                      </p>
                    )}
                  </div>
                  <svg
                    className="w-5 h-5 text-indigo-500 group-hover:text-indigo-600 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>

                <Link
                  href="/preventivo"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
                >
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-500 transition-colors">
                    <svg
                      className="w-5 h-5 text-purple-600 group-hover:text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Nuovo Preventivo</p>
                    <p className="text-xs text-gray-600">Calcola un preventivo</p>
                  </div>
                </Link>
              </div>

              {/* Admin Dashboard Link - Solo per admin */}
              {isAdmin && (
                <div className="mb-8">
                  <Link
                    href="/dashboard/admin"
                    className="flex items-center gap-3 p-6 border-2 border-purple-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg"
                  >
                    <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg group-hover:scale-110 transition-transform shadow-md">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">Admin Dashboard</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Gestisci utenti, spedizioni e impostazioni globali
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-purple-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                  </Link>
                </div>
              )}

              {/* Killer Features Attive */}
              <div className="mb-8">
                <UserFeaturesList />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
