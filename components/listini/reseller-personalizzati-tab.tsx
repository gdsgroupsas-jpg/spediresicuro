/**
 * Tab: Listini Personalizzati (reseller)
 * Estratto da app/dashboard/reseller/listini-personalizzati/page.tsx
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  Users,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Copy,
  FileSpreadsheet,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CustomPriceListForm } from '@/components/listini/custom-price-list-form';
import { CreateCustomerPriceListDialog } from '@/components/listini/create-customer-price-list-dialog';
import { CloneSupplierPriceListDialog } from '@/components/listini/clone-supplier-price-list-dialog';
import { ImportPriceListEntriesDialog } from '@/components/listini/import-price-list-entries-dialog';
import { listPriceListsAction, deletePriceListAction } from '@/actions/price-lists';
import { getSubUsers } from '@/actions/admin-reseller';
import { activateResellerPriceListAction } from '@/actions/reseller-price-lists';
import { toast } from 'sonner';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import type { PriceList } from '@/types/listini';

export function ResellerPersonalizzatiTab() {
  const router = useRouter();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subUsers, setSubUsers] = useState<Array<{ id: string; email: string; name?: string }>>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPriceListId, setImportPriceListId] = useState<string>('');
  const [importPriceListName, setImportPriceListName] = useState<string>('');
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<string | null>(null);
  const [activatingPriceList, setActivatingPriceList] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const subUsersResult = await getSubUsers();
        if (subUsersResult.success && subUsersResult.subUsers) {
          setSubUsers(
            subUsersResult.subUsers.map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name || undefined,
            }))
          );
        }

        await loadPriceLists();
      } catch (error) {
        console.error('Errore caricamento dati:', error);
        toast.error('Errore caricamento dati');
      }
    }

    loadInitialData();
  }, []);

  async function loadPriceLists() {
    try {
      setIsLoading(true);
      const result = await listPriceListsAction();

      if (result.success && result.priceLists) {
        const customLists = result.priceLists.filter((pl) => pl.list_type === 'custom');
        setPriceLists(customLists);
      } else {
        toast.error(result.error || 'Errore caricamento listini');
      }
    } catch (error) {
      console.error('Errore caricamento listini:', error);
      toast.error('Errore caricamento listini');
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreate = () => {
    if (subUsers.length === 0) {
      toast.error(
        'Non hai sub-users. Crea prima dei clienti per assegnare listini personalizzati.'
      );
      return;
    }
    setEditingPriceList(null);
    setShowCreateDialog(true);
  };

  const handleEdit = (priceList: PriceList) => {
    setEditingPriceList(priceList);
    setShowCreateDialog(true);
  };

  const handleDelete = (priceListId: string) => {
    setPriceListToDelete(priceListId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!priceListToDelete) return;

    try {
      const result = await deletePriceListAction(priceListToDelete);

      if (result.success) {
        toast.success('Listino eliminato con successo');
        setShowDeleteDialog(false);
        setPriceListToDelete(null);
        await loadPriceLists();
      } else {
        toast.error(result.error || 'Errore eliminazione listino');
      }
    } catch (error) {
      console.error('Errore eliminazione listino:', error);
      toast.error('Errore eliminazione listino');
    }
  };

  const handleViewDetails = (priceListId: string) => {
    router.push(`/dashboard/listini/${priceListId}`);
  };

  const handleFormSuccess = () => {
    setShowCreateDialog(false);
    setShowCloneDialog(false);
    setEditingPriceList(null);
    loadPriceLists();
  };

  const handleClone = () => {
    setShowCloneDialog(true);
  };

  const handleImport = (priceListId: string, priceListName: string) => {
    setImportPriceListId(priceListId);
    setImportPriceListName(priceListName);
    setShowImportDialog(true);
  };

  const handleActivate = async (priceListId: string) => {
    setActivatingPriceList(priceListId);
    try {
      const result = await activateResellerPriceListAction(priceListId);
      if (result.success) {
        toast.success('Listino attivato con successo');
        await loadPriceLists();
      } else {
        toast.error(result.error || 'Errore attivazione listino');
      }
    } catch (error) {
      console.error('Errore attivazione:', error);
      toast.error('Errore attivazione listino');
    } finally {
      setActivatingPriceList(null);
    }
  };

  const filteredPriceLists = priceLists.filter((pl) => {
    const matchesSearch = pl.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pl.status === statusFilter;
    const matchesUser = userFilter === 'all' || pl.assigned_to_user_id === userFilter;
    return matchesSearch && matchesStatus && matchesUser;
  });

  const getUserName = (userId?: string) => {
    if (!userId) return '-';
    const user = subUsers.find((u) => u.id === userId);
    return user ? user.name || user.email : userId.substring(0, 8) + '...';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-orange-600" />
            Listini Personalizzati
          </h2>
          <p className="text-gray-500 mt-1">
            Crea e gestisci listini personalizzati per i tuoi clienti
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleClone} variant="outline" className="flex items-center gap-2">
            <Copy className="w-4 h-4" />
            Clona da Fornitore
          </Button>
          <Button
            onClick={handleCreate}
            className="flex items-center gap-2"
            disabled={subUsers.length === 0}
          >
            <Plus className="w-4 h-4" />
            Crea Vuoto
          </Button>
        </div>
      </div>

      {subUsers.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Nessun cliente disponibile</p>
              <p className="text-sm text-amber-700 mt-1">
                Crea prima dei clienti per poter assegnare listini personalizzati.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cerca per nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">Tutti gli status</option>
              <option value="draft">Bozza</option>
              <option value="active">Attivo</option>
              <option value="archived">Archiviato</option>
            </Select>
          </div>
          <div className="w-full md:w-48">
            <Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="all">Tutti gli utenti</option>
              {subUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Tabella Listini */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
            <p className="text-gray-500">Caricamento listini...</p>
          </div>
        ) : filteredPriceLists.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Nessun listino personalizzato trovato
            </h3>
            <p className="text-gray-500 mt-1">
              Crea il tuo primo listino personalizzato per un cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-4 font-medium text-gray-500">Nome</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Utente Assegnato</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Versione</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 font-medium text-gray-500">Data Creazione</th>
                  <th className="px-6 py-4 font-medium text-gray-500 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPriceLists.map((priceList) => (
                  <tr key={priceList.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">{priceList.name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {getUserName(priceList.assigned_to_user_id)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{priceList.version}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          priceList.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : priceList.status === 'draft'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {priceList.status === 'active'
                          ? 'Attivo'
                          : priceList.status === 'draft'
                            ? 'Bozza'
                            : 'Archiviato'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {priceList.created_at
                          ? new Intl.DateTimeFormat('it-IT', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            }).format(new Date(priceList.created_at))
                          : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {priceList.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleImport(priceList.id, priceList.name)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Importa tariffe da file CSV"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </Button>
                        )}

                        {priceList.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleActivate(priceList.id)}
                            disabled={activatingPriceList === priceList.id}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50"
                            title="Attiva listino"
                          >
                            {activatingPriceList === priceList.id ? (
                              <Play className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(priceList.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Visualizza dettagli"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(priceList)}
                          className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                          title="Modifica listino"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(priceList.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Elimina listino"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog Creazione Listino Cliente (nuovo) */}
      {!editingPriceList && (
        <CreateCustomerPriceListDialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateDialog(false);
            }
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Dialog Modifica Listino (esistente) */}
      {editingPriceList && (
        <Dialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowCreateDialog(false);
              setEditingPriceList(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifica Listino Personalizzato</DialogTitle>
              <DialogDescription>Modifica i dettagli del listino personalizzato</DialogDescription>
            </DialogHeader>
            <CustomPriceListForm
              priceList={editingPriceList}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowCreateDialog(false);
                setEditingPriceList(null);
              }}
              subUsers={subUsers}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog Eliminazione */}
      <ConfirmActionDialog
        isOpen={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setPriceListToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Elimina Listino"
        description="Sei sicuro di voler eliminare questo listino? Questa azione non può essere annullata."
        confirmText="Elimina"
        cancelText="Annulla"
        variant="destructive"
      />

      {/* Dialog Clonazione Listino Fornitore */}
      <CloneSupplierPriceListDialog
        open={showCloneDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCloneDialog(false);
          }
        }}
        onSuccess={handleFormSuccess}
      />

      {/* Dialog Import CSV */}
      <ImportPriceListEntriesDialog
        open={showImportDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowImportDialog(false);
            setImportPriceListId('');
            setImportPriceListName('');
          }
        }}
        priceListId={importPriceListId}
        priceListName={importPriceListName}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
