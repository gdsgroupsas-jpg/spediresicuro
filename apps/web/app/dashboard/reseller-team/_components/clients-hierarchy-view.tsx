'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Building2,
  Wallet,
  Package,
  Plus,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

// Usa classi Tailwind direttamente per coerenza con dashboard
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';

import { useAllClients, useInvalidateSubUsers } from '@/lib/queries/use-sub-users';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TierBadge } from '@/lib/utils/tier-badge';
import { calculateTierFromSubUsers } from '@/lib/db/tier-helpers';
import { WalletRechargeDialog } from './wallet-recharge-dialog';
import { UserActionsMenu } from './user-actions-menu';

interface ResellerCardProps {
  reseller: {
    id: string;
    email: string;
    name: string;
    company_name: string | null;
    phone: string | null;
    wallet_balance: number;
    created_at: string;
    reseller_tier: string | null;
  };
  subUsers: Array<{
    id: string;
    email: string;
    name: string;
    company_name: string | null;
    phone: string | null;
    wallet_balance: number;
    created_at: string;
  }>;
  stats: {
    totalSubUsers: number;
    totalWalletBalance: number;
  };
  onRechargeWallet: (reseller: ResellerCardProps['reseller']) => void;
  onDelete: (reseller: ResellerCardProps['reseller']) => void;
  onCreateSubUser: (resellerId: string) => void;
}

function ResellerCard({
  reseller,
  subUsers,
  stats,
  onRechargeWallet,
  onDelete,
  onCreateSubUser,
}: ResellerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-4 hover:shadow-md transition-shadow">
      <div className="p-6 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {reseller.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'R'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {reseller.name || reseller.email}
              </h3>
              <p className="text-sm text-gray-600 truncate">{reseller.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-600 font-medium">Sub-Users</p>
              <p className="text-sm font-semibold text-gray-900">{stats.totalSubUsers}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 font-medium">Wallet</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(reseller.wallet_balance)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                Reseller
              </Badge>
              <TierBadge
                tier={
                  (reseller.reseller_tier as 'small' | 'medium' | 'enterprise' | null) ||
                  calculateTierFromSubUsers(stats.totalSubUsers)
                }
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Azioni Reseller</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onRechargeWallet(reseller)}>
                  <Wallet className="mr-2 h-4 w-4 text-green-600" />
                  <span className="text-gray-900">Gestisci Wallet</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateSubUser(reseller.id)}>
                  <Plus className="mr-2 h-4 w-4 text-blue-600" />
                  <span className="text-gray-900">Crea Sub-User</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDelete(reseller)} destructive>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina Reseller
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-6 pb-6 pt-0">
          {subUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <EmptyState
                icon={Users}
                title="Nessun Sub-User"
                description="Questo reseller non ha ancora sub-users."
              />
              <Button onClick={() => onCreateSubUser(reseller.id)} className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Crea Primo Sub-User
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {subUsers.map((subUser) => (
                <SubUserRow key={subUser.id} subUser={subUser} resellerId={reseller.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SubUserRowProps {
  subUser: {
    id: string;
    email: string;
    name: string;
    company_name: string | null;
    phone: string | null;
    wallet_balance: number;
    created_at: string;
  };
  resellerId: string;
}

function SubUserRow({ subUser, resellerId }: SubUserRowProps) {
  const invalidate = useInvalidateSubUsers();
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/admin/users/${subUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Sub-User eliminato con successo');
        await invalidate();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Errore durante l'eliminazione");
      }
    } catch (error: any) {
      toast.error("Errore durante l'eliminazione");
      console.error('Errore eliminazione sub-user:', error);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
              {subUser.name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {subUser.name || subUser.email}
            </p>
            <p className="text-xs text-gray-600 truncate">{subUser.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {subUser.company_name && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-600 font-medium">Azienda</p>
              <p className="text-xs font-semibold text-gray-900 truncate max-w-[150px]">
                {subUser.company_name}
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-gray-600 font-medium">Wallet</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatCurrency(subUser.wallet_balance)}
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs text-gray-600 font-medium">Registrato</p>
            <p className="text-xs text-gray-900">{formatDate(subUser.created_at)}</p>
          </div>
          <UserActionsMenu
            user={subUser}
            onRechargeWallet={() => setWalletDialogOpen(true)}
            onDelete={() => setShowDeleteConfirm(true)}
          />
        </div>
      </div>
      <WalletRechargeDialog
        user={walletDialogOpen ? subUser : null}
        isOpen={walletDialogOpen}
        onClose={() => setWalletDialogOpen(false)}
        onSuccess={async () => {
          await invalidate();
        }}
      />
      <ConfirmActionDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Elimina Sub-User"
        description={`Sei sicuro di voler eliminare ${subUser.name || subUser.email}? Questa azione non può essere annullata.`}
        confirmText="Elimina"
        variant="destructive"
      />
    </>
  );
}

interface BYOCSectionProps {
  clients: Array<{
    id: string;
    email: string;
    name: string;
    company_name: string | null;
    phone: string | null;
    wallet_balance: number;
    created_at: string;
  }>;
  onRechargeWallet: (client: BYOCSectionProps['clients'][0]) => void;
  onDelete: (client: BYOCSectionProps['clients'][0]) => void;
}

function BYOCSection({ clients, onRechargeWallet, onDelete }: BYOCSectionProps) {
  if (clients.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mt-6">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Clienti BYOC
          <Badge variant="outline" className="ml-2">
            {clients.length}
          </Badge>
        </h2>
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {client.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'B'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {client.name || client.email}
                  </p>
                  <p className="text-xs text-gray-600 truncate">{client.email}</p>
                  {client.company_name && (
                    <p className="text-xs text-gray-700 truncate">{client.company_name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-600 font-medium">Wallet</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(client.wallet_balance)}
                  </p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  BYOC
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Azioni BYOC</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onRechargeWallet(client)}>
                      <Wallet className="mr-2 h-4 w-4 text-green-600" />
                      <span className="text-gray-900">Gestisci Wallet</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(client)} destructive>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Elimina Cliente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientsHierarchyView() {
  const { data: clients, isLoading, error } = useAllClients();
  const invalidate = useInvalidateSubUsers();
  const router = useRouter();

  // Dialog states
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [selectedUserForWallet, setSelectedUserForWallet] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  const handleRechargeWallet = (user: any) => {
    setSelectedUserForWallet(user);
    setWalletDialogOpen(true);
  };

  const handleDelete = (user: any) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleCreateSubUser = (resellerId: string) => {
    // Naviga alla pagina di creazione cliente con reseller preselezionato
    router.push(`/dashboard/reseller/clienti/nuovo?resellerId=${resellerId}`);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Utente eliminato con successo');
        await invalidate();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Errore durante l'eliminazione");
      }
    } catch (error: any) {
      toast.error("Errore durante l'eliminazione");
      console.error('Errore eliminazione utente:', error);
    } finally {
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    }
  };

  if (isLoading) {
    return <DataTableSkeleton />;
  }

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Errore nel caricamento"
        description={error instanceof Error ? error.message : 'Errore sconosciuto'}
      />
    );
  }

  if (!clients) {
    return (
      <EmptyState
        icon={Users}
        title="Nessun dato"
        description="Non ci sono clienti da visualizzare."
      />
    );
  }

  const { resellers, byocClients, stats } = clients;

  return (
    <>
      <div className="space-y-6">
        {/* Header con pulsante Crea */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-orange-500" />
              Reseller ({resellers.length})
            </h2>
          </div>
          <Button
            onClick={() => router.push('/dashboard/reseller/clienti/nuovo')}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Utente
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Reseller</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalResellers}</p>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Sub-Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSubUsers}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">BYOC</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBYOC}</p>
              </div>
              <Building2 className="h-8 w-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium mb-1">Wallet Totale</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalWalletBalance)}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Resellers Section */}
        <div>
          {resellers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nessun Reseller"
              description="Non ci sono reseller registrati."
            />
          ) : (
            <div className="space-y-4">
              {resellers.map((item) => (
                <ResellerCard
                  key={item.reseller.id}
                  reseller={item.reseller}
                  subUsers={item.subUsers}
                  stats={item.stats}
                  onRechargeWallet={handleRechargeWallet}
                  onDelete={handleDelete}
                  onCreateSubUser={handleCreateSubUser}
                />
              ))}
            </div>
          )}
        </div>

        {/* BYOC Section */}
        <BYOCSection
          clients={byocClients}
          onRechargeWallet={handleRechargeWallet}
          onDelete={handleDelete}
        />
      </div>

      {/* Dialogs */}
      <WalletRechargeDialog
        user={selectedUserForWallet}
        isOpen={walletDialogOpen}
        onClose={() => {
          setWalletDialogOpen(false);
          setSelectedUserForWallet(null);
        }}
        onSuccess={async () => {
          await invalidate();
        }}
      />

      <ConfirmActionDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Elimina Utente"
        description={`Sei sicuro di voler eliminare ${userToDelete?.name || userToDelete?.email}? Questa azione non può essere annullata.`}
        confirmText="Elimina"
        variant="destructive"
      />
    </>
  );
}
