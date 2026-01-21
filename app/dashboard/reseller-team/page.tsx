'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Users, ShieldAlert } from 'lucide-react';
import { Toaster } from 'sonner';

import DashboardNav from '@/components/dashboard-nav';
import { QueryProvider } from '@/components/providers/query-provider';
import { Button } from '@/components/ui/button';

import { TeamStatsCards } from './_components/team-stats-cards';
import { SubUsersTable } from './_components/sub-users-table';
import { CreateUserDialog } from './_components/create-user-dialog';
import { ClientsHierarchyView } from './_components/clients-hierarchy-view';

import {
  useSubUsersStats,
  useInvalidateSubUsers,
  useAllClients,
} from '@/lib/queries/use-sub-users';

function ResellerDashboardContent() {
  const { data: stats, isLoading: statsLoading } = useSubUsersStats();
  const { data: allClients, isLoading: allClientsLoading } = useAllClients();
  const invalidate = useInvalidateSubUsers();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  // Verifica se è superadmin
  useEffect(() => {
    async function checkSuperAdmin() {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const accountType = userData.account_type || userData.accountType;
          setIsSuperAdmin(accountType === 'superadmin');
        } else {
          setIsSuperAdmin(false);
        }
      } catch (error) {
        console.error('Errore verifica superadmin:', error);
        setIsSuperAdmin(false);
      }
    }
    checkSuperAdmin();
  }, []);

  const handleUserCreated = () => {
    invalidate();
  };

  // Se superadmin, mostra sempre vista gerarchica (gestisce loading/error internamente)
  // IMPORTANTE: Aspetta che isSuperAdmin sia determinato (non null) prima di decidere
  if (isSuperAdmin === true) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav
            title="Gestione Clienti"
            subtitle="Visualizza tutti i clienti della piattaforma (Reseller, Sub-Users, BYOC)"
            breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Clienti' }]}
          />

          <ClientsHierarchyView />
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  // Se ancora in loading (isSuperAdmin === null), mostra loading state
  if (isSuperAdmin === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF9500] mb-4" />
          <p className="text-gray-600">Verifica permessi...</p>
        </div>
      </div>
    );
  }

  // Vista normale per reseller
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="Gestione Clienti"
          subtitle="Amministra i tuoi clienti e il loro wallet"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Clienti' }]}
          actions={<CreateUserDialog onSuccess={handleUserCreated} />}
        />

        {/* Stats Cards */}
        <TeamStatsCards
          stats={{
            totalSubUsers: stats?.totalSubUsers || 0,
            totalWalletBalance: 0,
            totalShipments: stats?.totalShipments || 0,
            totalRevenue: stats?.totalRevenue || 0,
            activeSubUsers: stats?.activeSubUsers || 0,
          }}
          isLoading={statsLoading}
        />

        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#FF9500]" />I Tuoi Clienti
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Gestisci wallet e spedizioni dei tuoi clienti
              </p>
            </div>
          </div>
          <SubUsersTable />
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
        <p className="text-gray-600 mb-6">
          Questa sezione è riservata ai Reseller. Contatta l&apos;amministratore per richiedere i
          privilegi.
        </p>
        <Button onClick={() => router.push('/dashboard')} variant="outline">
          Torna alla Dashboard
        </Button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF9500] mb-4" />
        <p className="text-gray-600">Caricamento...</p>
      </div>
    </div>
  );
}

export default function ResellerTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isReseller, setIsReseller] = useState<boolean | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  useEffect(() => {
    async function checkResellerStatus() {
      if (status === 'loading') return;

      if (!session?.user?.email) {
        router.push('/auth/signin');
        return;
      }

      try {
        // Usa /api/user/info per avere account_type
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const accountType = userData.account_type || userData.accountType;
          // Superadmin, admin o reseller possono accedere
          const hasAccess =
            accountType === 'superadmin' ||
            accountType === 'admin' ||
            userData.is_reseller === true ||
            data.role === 'admin';
          setIsReseller(hasAccess);
        } else {
          setIsReseller(false);
        }
      } catch (error) {
        console.error('Errore verifica ruolo:', error);
        setIsReseller(false);
      } finally {
        setIsCheckingRole(false);
      }
    }

    checkResellerStatus();
  }, [session, status, router]);

  if (status === 'loading' || isCheckingRole) {
    return <LoadingState />;
  }

  if (!session) {
    return null;
  }

  if (!isReseller) {
    return <AccessDenied />;
  }

  return (
    <QueryProvider>
      <ResellerDashboardContent />
    </QueryProvider>
  );
}
