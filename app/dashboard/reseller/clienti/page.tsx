'use client';

/**
 * Dashboard Unificata Clienti per Reseller
 *
 * Combina gestione clienti e listini in un'unica interfaccia.
 * Sprint 2 - UX Unification
 *
 * Features:
 * - Lista clienti con badge listino inline
 * - Statistiche aggregate
 * - Assegnazione rapida listini
 * - Gestione wallet inline
 * - Creazione clienti
 */

import { FileText, Filter, RefreshCw, Search, ShieldAlert, Users, UserPlus } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';

import DashboardNav from '@/components/dashboard-nav';
import { QueryProvider } from '@/components/providers/query-provider';
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { AssignListinoDialog } from './_components/assign-listino-dialog';
import {
  ClientCardWithListino,
  type ClientWithListino,
} from './_components/client-card-with-listino';
import { ClientStatsCards } from './_components/client-stats-cards';
import { WalletRechargeDialog } from '@/app/dashboard/reseller-team/_components/wallet-recharge-dialog';

import {
  getResellerClientsStats,
  getResellerClientsWithListino,
  type ClientsStatsResult,
} from '@/actions/reseller-clients';

type SortField = 'name' | 'wallet_balance' | 'shipments_count' | 'created_at';
type SortOrder = 'asc' | 'desc';
type ListinoFilter = 'all' | 'with' | 'without';

function ResellerClientiContent() {
  const router = useRouter();

  // Data state
  const [clients, setClients] = useState<ClientWithListino[]>([]);
  const [stats, setStats] = useState<ClientsStatsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [listinoFilter, setListinoFilter] = useState<ListinoFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Dialog state
  const [selectedClientForListino, setSelectedClientForListino] =
    useState<ClientWithListino | null>(null);
  const [selectedClientForWallet, setSelectedClientForWallet] = useState<ClientWithListino | null>(
    null
  );
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [clientsResult, statsResult] = await Promise.all([
        getResellerClientsWithListino(),
        getResellerClientsStats(),
      ]);

      if (clientsResult.success && clientsResult.clients) {
        setClients(clientsResult.clients);
      }
      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }
    } catch (error) {
      console.error('Errore caricamento dati:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Filtered and sorted clients
  const filteredClients = useMemo(() => {
    let result = [...clients];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.company_name?.toLowerCase().includes(query)
      );
    }

    // Listino filter
    if (listinoFilter === 'with') {
      result = result.filter((c) => c.assigned_listino !== null);
    } else if (listinoFilter === 'without') {
      result = result.filter((c) => c.assigned_listino === null);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'wallet_balance':
          comparison = a.wallet_balance - b.wallet_balance;
          break;
        case 'shipments_count':
          comparison = a.shipments_count - b.shipments_count;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [clients, searchQuery, listinoFilter, sortField, sortOrder]);

  // Handlers
  const handleAssignListino = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setSelectedClientForListino(client);
      setShowAssignDialog(true);
    }
  };

  const handleCreateListino = (clientId: string) => {
    // Naviga alla pagina di creazione listino personalizzato con client preselezionato
    router.push(`/dashboard/reseller/listini-personalizzati?clientId=${clientId}`);
  };

  const handleManageWallet = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setSelectedClientForWallet(client as any);
      setShowWalletDialog(true);
    }
  };

  const handleViewShipments = (clientId: string) => {
    router.push(`/dashboard/spedizioni?userId=${clientId}`);
  };

  const handleEditClient = (clientId: string) => {
    // Per ora naviga al team page, in futuro dialog inline
    router.push(`/dashboard/reseller-team?edit=${clientId}`);
  };

  const handleListinoAssigned = () => {
    setShowAssignDialog(false);
    setSelectedClientForListino(null);
    loadData();
  };

  const handleWalletSuccess = () => {
    setShowWalletDialog(false);
    setSelectedClientForWallet(null);
    loadData();
    toast.success('Wallet aggiornato con successo');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="I Miei Clienti"
          subtitle="Gestisci clienti, listini e wallet in un'unica dashboard"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Clienti' }]}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Aggiorna
              </Button>
              <Button
                onClick={() => router.push('/dashboard/reseller/clienti/nuovo')}
                className="bg-[#FACC15] hover:bg-[#FBBF24] text-black font-semibold"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Nuovo Cliente
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <ClientStatsCards stats={stats} isLoading={isLoading} />

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cerca per nome, email o azienda..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Listino Filter */}
            <Select
              value={listinoFilter}
              onChange={(e) => setListinoFilter(e.target.value as ListinoFilter)}
              className="w-full md:w-48"
            >
              <option value="all">Tutti i clienti</option>
              <option value="with">Con listino</option>
              <option value="without">Senza listino</option>
            </Select>

            {/* Sort */}
            <Select
              value={`${sortField}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortField(field as SortField);
                setSortOrder(order as SortOrder);
              }}
              className="w-full md:w-48"
            >
              <option value="created_at-desc">Più recenti</option>
              <option value="created_at-asc">Più vecchi</option>
              <option value="name-asc">Nome A-Z</option>
              <option value="name-desc">Nome Z-A</option>
              <option value="wallet_balance-desc">Saldo più alto</option>
              <option value="wallet_balance-asc">Saldo più basso</option>
              <option value="shipments_count-desc">Più spedizioni</option>
            </Select>
          </div>

          {/* Active filters summary */}
          {(searchQuery || listinoFilter !== 'all') && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">Filtri attivi:</span>
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  Ricerca: &quot;{searchQuery}&quot;
                </Badge>
              )}
              {listinoFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {listinoFilter === 'with' ? 'Con listino' : 'Senza listino'}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setListinoFilter('all');
                }}
                className="text-xs text-gray-500 hover:text-gray-700 h-6"
              >
                Resetta filtri
              </Button>
            </div>
          )}
        </div>

        {/* Client List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <DataTableSkeleton rows={5} columns={4} />
            </div>
          ) : filteredClients.length === 0 ? (
            clients.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nessun cliente ancora"
                description="Crea il tuo primo cliente per iniziare a gestire le spedizioni"
                action={
                  <Button
                    onClick={() => router.push('/dashboard/reseller/clienti/nuovo')}
                    className="bg-[#FACC15] hover:bg-[#FBBF24] text-black font-semibold"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Nuovo Cliente
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title="Nessun risultato"
                description="Prova a modificare i filtri di ricerca"
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery('');
                      setListinoFilter('all');
                    }}
                  >
                    Resetta filtri
                  </Button>
                }
              />
            )
          ) : (
            <>
              {/* Results count */}
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-gray-500">
                  {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clienti'}
                  {filteredClients.length !== clients.length && ` su ${clients.length} totali`}
                </p>
                {stats && stats.clientsWithoutListino > 0 && listinoFilter === 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setListinoFilter('without')}
                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    {stats.clientsWithoutListino} senza listino
                  </Button>
                )}
              </div>

              {/* Cards */}
              {filteredClients.map((client) => (
                <ClientCardWithListino
                  key={client.id}
                  client={client}
                  onAssignListino={handleAssignListino}
                  onCreateListino={handleCreateListino}
                  onManageWallet={handleManageWallet}
                  onViewShipments={handleViewShipments}
                  onEditClient={handleEditClient}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {selectedClientForListino && (
        <AssignListinoDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          clientId={selectedClientForListino.id}
          clientName={selectedClientForListino.name}
          currentListinoId={selectedClientForListino.assigned_listino?.id}
          onSuccess={handleListinoAssigned}
          onCreateNew={() => {
            setShowAssignDialog(false);
            handleCreateListino(selectedClientForListino.id);
          }}
        />
      )}

      {selectedClientForWallet && (
        <WalletRechargeDialog
          user={selectedClientForWallet as any}
          isOpen={showWalletDialog}
          onClose={() => {
            setShowWalletDialog(false);
            setSelectedClientForWallet(null);
          }}
          onSuccess={handleWalletSuccess}
        />
      )}

      <Toaster position="top-right" richColors />
    </div>
  );
}

function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
        <p className="text-gray-600 mb-6">Questa sezione è riservata ai Reseller.</p>
        <Button onClick={() => router.push('/dashboard')} variant="outline">
          Torna alla Dashboard
        </Button>
      </div>
    </div>
  );
}

export default function ResellerClientiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isReseller, setIsReseller] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkResellerStatus() {
      if (status === 'loading') return;

      if (!session?.user?.email) {
        router.push('/auth/signin');
        return;
      }

      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const accountType = userData.account_type || userData.accountType;

          // Reseller, admin o superadmin possono accedere
          const hasAccess =
            accountType === 'superadmin' ||
            accountType === 'admin' ||
            userData.is_reseller === true;

          setIsReseller(hasAccess);
        } else {
          setIsReseller(false);
        }
      } catch (error) {
        console.error('Errore verifica ruolo:', error);
        setIsReseller(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkResellerStatus();
  }, [session, status, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!isReseller) {
    return <AccessDenied />;
  }

  return (
    <QueryProvider>
      <ResellerClientiContent />
    </QueryProvider>
  );
}
