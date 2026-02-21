'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  UserCog,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SearchInputDebounced } from '@/components/shared/search-input-debounced';
import { EmptyState } from '@/components/shared/empty-state';
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Input } from '@/components/ui/input';

import { ManageWalletDialog } from './manage-wallet-dialog';
import { BulkActionsBar } from './bulk-actions-bar';

import {
  useAllUsers,
  useToggleResellerStatus,
  useUpdateResellerRole,
  useInvalidateAllUsers,
} from '@/lib/queries/use-all-users';
import { formatCurrency, formatDate, formatUuid, cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/lib/hooks';
import { WALLET_THRESHOLDS } from '@/lib/validations/wallet-schema';
import { isSuperAdminCheck } from '@/lib/auth-helpers';

interface User {
  id: string;
  email: string;
  name: string;
  account_type: string;
  is_reseller: boolean;
  reseller_role: string | null;
  wallet_balance: number;
  created_at: string;
}

type SortField = 'name' | 'wallet_balance' | 'created_at' | 'account_type';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 50;

export function UsersTable() {
  const { data: users = [], isLoading, error } = useAllUsers();
  const toggleResellerMutation = useToggleResellerStatus();
  const updateResellerRoleMutation = useUpdateResellerRole();
  const invalidate = useInvalidateAllUsers();
  const { copy, isCopied } = useCopyToClipboard();

  // Filtri e ordinamento
  const [search, setSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'admin' | 'reseller' | 'user'>(
    'all'
  );
  const [resellerStatusFilter, setResellerStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'all'
  );
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // Selezione multipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ user: User; enabled: boolean } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ user: User; confirmEmail: string } | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtra utenti
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Ricerca
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          u.id.toLowerCase().includes(searchLower)
      );
    }

    // Filtro account type
    if (accountTypeFilter !== 'all') {
      result = result.filter((u) => u.account_type === accountTypeFilter);
    }

    // Filtro reseller status
    if (resellerStatusFilter === 'active') {
      result = result.filter((u) => u.is_reseller === true);
    } else if (resellerStatusFilter === 'inactive') {
      result = result.filter((u) => u.is_reseller !== true);
    }

    // Ordinamento
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'wallet_balance':
          comparison = (a.wallet_balance || 0) - (b.wallet_balance || 0);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'account_type':
          comparison = (a.account_type || '').localeCompare(b.account_type || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [users, search, accountTypeFilter, resellerStatusFilter, sortField, sortOrder]);

  // Paginazione
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleToggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedUsers.map((u) => u.id)));
    }
  };

  const handleResellerToggle = (user: User, enabled: boolean) => {
    setConfirmToggle({ user, enabled });
  };

  const confirmResellerToggle = async () => {
    if (!confirmToggle) return;

    try {
      await toggleResellerMutation.mutateAsync({
        userId: confirmToggle.user.id,
        enabled: confirmToggle.enabled,
      });
      toast.success(
        confirmToggle.enabled
          ? `${confirmToggle.user.name} è ora un Reseller`
          : `${confirmToggle.user.name} non è più un Reseller`
      );
    } catch (error: any) {
      toast.error(error.message || 'Errore nel cambio status');
    }
    setConfirmToggle(null);
  };

  const handleManageWallet = (user: User) => {
    setSelectedUser(user);
    setWalletDialogOpen(true);
  };

  const handleCopyId = (id: string) => {
    copy(id, 'ID copiato');
  };

  const handleDeleteUser = (user: User) => {
    setDeleteDialog({ user, confirmEmail: '' });
  };

  const confirmDeleteUser = async () => {
    if (!deleteDialog) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${deleteDialog.user.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'eliminazione");
      }

      toast.success(`Utente ${deleteDialog.user.email} eliminato con successo`);
      invalidate();
      setDeleteDialog(null);
    } catch (error: any) {
      toast.error(error.message || "Errore durante l'eliminazione dell'utente");
    } finally {
      setIsDeleting(false);
    }
  };

  const canDeleteUser = (user: User) => {
    // Non può eliminare superadmin
    if (isSuperAdminCheck(user)) return false;
    return true;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1 text-[#FF9500]" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 text-[#FF9500]" />
    );
  };

  const getAccountTypeBadge = (type: string, isReseller?: boolean) => {
    // Import dinamico per evitare problemi SSR
    const { RoleBadge } = require('@/lib/utils/role-badges');
    return <RoleBadge accountType={type} isReseller={isReseller} />;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Errore nel caricamento degli utenti</p>
        <Button variant="outline" onClick={() => invalidate()} className="mt-4">
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div className="flex flex-wrap gap-4">
        <SearchInputDebounced
          onSearch={handleSearch}
          placeholder="Cerca per nome, email o ID..."
          className="w-full sm:w-64"
        />

        <Select
          value={accountTypeFilter}
          onChange={(e) => {
            setAccountTypeFilter(e.target.value as typeof accountTypeFilter);
            setCurrentPage(1);
          }}
          className="w-full sm:w-36"
        >
          <option value="all">Tutti i tipi</option>
          <option value="admin">Admin</option>
          <option value="user">Utenti</option>
        </Select>

        <Select
          value={resellerStatusFilter}
          onChange={(e) => {
            setResellerStatusFilter(e.target.value as typeof resellerStatusFilter);
            setCurrentPage(1);
          }}
          className="w-full sm:w-40"
        >
          <option value="all">Tutti</option>
          <option value="active">Reseller Attivi</option>
          <option value="inactive">Non Reseller</option>
        </Select>
      </div>

      {/* Tabella */}
      {isLoading ? (
        <DataTableSkeleton rows={5} columns={6} />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessun utente trovato"
          description="Prova a modificare i filtri di ricerca"
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setAccountTypeFilter('all');
                setResellerStatusFilter('all');
              }}
            >
              Resetta filtri
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <table className="w-full" aria-label="Tabella utenti">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === paginatedUsers.length && paginatedUsers.length > 0
                      }
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                    >
                      Utente
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('account_type')}
                      className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                    >
                      Tipo
                      <SortIcon field="account_type" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reseller
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ruolo Reseller
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort('wallet_balance')}
                      className="flex items-center justify-end text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 ml-auto"
                    >
                      Wallet
                      <SortIcon field="wallet_balance" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => handleToggleSelect(user.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleCopyId(user.id)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-mono"
                        title="Clicca per copiare"
                      >
                        {formatUuid(user.id)}
                        {isCopied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar size="md">
                          <AvatarFallback name={user.name} />
                        </Avatar>
                        <div className="min-w-0">
                          <span className="font-medium text-gray-900 truncate block">
                            {user.name || 'N/A'}
                          </span>
                          <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {getAccountTypeBadge(user.account_type, user.is_reseller)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Switch
                        checked={user.is_reseller === true}
                        onCheckedChange={(enabled) => handleResellerToggle(user, enabled)}
                        disabled={isSuperAdminCheck(user)}
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      {user.is_reseller ? (
                        <Select
                          value={user.reseller_role || 'user'}
                          onChange={async (e) => {
                            const newRole = e.target.value as 'admin' | 'user';
                            try {
                              await updateResellerRoleMutation.mutateAsync({
                                userId: user.id,
                                role: newRole,
                              });
                              toast.success(
                                `${user.name} è ora ${newRole === 'admin' ? 'Admin Reseller' : 'User Reseller'}`
                              );
                            } catch (error: any) {
                              toast.error(error.message || "Errore nell'aggiornamento del ruolo");
                            }
                          }}
                          disabled={updateResellerRoleMutation.isPending || isSuperAdminCheck(user)}
                          className="w-32 text-sm"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </Select>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button onClick={() => handleManageWallet(user)} className="inline-block">
                        <Badge
                          variant={
                            (user.wallet_balance || 0) < WALLET_THRESHOLDS.LOW
                              ? 'error'
                              : (user.wallet_balance || 0) >= WALLET_THRESHOLDS.HIGH
                                ? 'success'
                                : 'secondary'
                          }
                          className="font-mono cursor-pointer hover:opacity-80"
                        >
                          {formatCurrency(user.wallet_balance || 0)}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageWallet(user)}
                          className="gap-1"
                        >
                          <UserCog className="h-4 w-4" />
                          Gestisci
                        </Button>
                        {canDeleteUser(user) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Elimina utente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-gray-500">
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} di{' '}
                {filteredUsers.length} utenti
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedente
                </Button>
                <span className="text-sm text-gray-600">
                  Pagina {currentPage} di {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Successiva
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          selectedUsers={filteredUsers.filter((u) => selectedIds.has(u.id))}
          onClearSelection={() => setSelectedIds(new Set())}
          onSuccess={() => {
            invalidate();
            setSelectedIds(new Set());
          }}
        />
      )}

      {/* Manage Wallet Dialog */}
      <ManageWalletDialog
        user={selectedUser}
        isOpen={walletDialogOpen}
        onClose={() => {
          setWalletDialogOpen(false);
          setSelectedUser(null);
        }}
        onSuccess={() => invalidate()}
      />

      {/* Confirm Toggle Reseller Dialog */}
      <ConfirmActionDialog
        isOpen={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={confirmResellerToggle}
        title={confirmToggle?.enabled ? 'Attiva Reseller' : 'Disattiva Reseller'}
        description={
          confirmToggle?.enabled
            ? `Stai per attivare i privilegi Reseller per ${confirmToggle?.user.name}. L'utente potrà creare sub-users e gestire margini.`
            : `Stai per rimuovere i privilegi Reseller da ${confirmToggle?.user.name}.`
        }
        confirmText={confirmToggle?.enabled ? 'Attiva' : 'Disattiva'}
        variant={confirmToggle?.enabled ? 'default' : 'destructive'}
        isLoading={toggleResellerMutation.isPending}
      />

      {/* Delete User Confirmation Dialog */}
      <ConfirmActionDialog
        isOpen={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDeleteUser}
        title="Elimina Utente"
        description={
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Attenzione: questa azione è irreversibile!</p>
                <p className="mt-1">
                  Stai per eliminare definitivamente l&apos;utente{' '}
                  <strong>{deleteDialog?.user.email}</strong>. Verranno eliminati anche tutti i dati
                  associati (spedizioni, transazioni, profili).
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Digita l&apos;email dell&apos;utente per confermare:
              </label>
              <Input
                type="email"
                value={deleteDialog?.confirmEmail || ''}
                onChange={(e) =>
                  setDeleteDialog((prev) =>
                    prev ? { ...prev, confirmEmail: e.target.value } : null
                  )
                }
                placeholder={deleteDialog?.user.email}
                className="w-full"
              />
            </div>
          </div>
        }
        confirmText="Elimina definitivamente"
        variant="destructive"
        isLoading={isDeleting}
        disabled={deleteDialog?.confirmEmail !== deleteDialog?.user.email}
      />
    </div>
  );
}
