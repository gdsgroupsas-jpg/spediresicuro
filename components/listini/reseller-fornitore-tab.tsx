/**
 * Tab: Listini Fornitore (reseller)
 * Estratto da app/dashboard/reseller/listini-fornitore/page.tsx
 */

'use client';

import {
  deletePriceListAction,
  getAvailableCouriersForUserAction,
  listPriceListsAction,
  listSupplierPriceListsAction,
} from '@/actions/price-lists';
import { SupplierPriceListForm } from '@/components/listini/supplier-price-list-form';
import { SupplierPriceListTable } from '@/components/listini/supplier-price-list-table';
import { SyncSpedisciOnlineDialog } from '@/components/listini/sync-spedisci-online-dialog';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { PriceList } from '@/types/listini';
import { Package, Plus, RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface ResellerFornitoreTabProps {
  accountType?: string;
  resellerRole?: string;
  userId?: string;
}

export function ResellerFornitoreTab({
  accountType,
  resellerRole,
  userId,
}: ResellerFornitoreTabProps) {
  const router = useRouter();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCouriers, setAvailableCouriers] = useState<
    Array<{ courierId: string; courierName: string }>
  >([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>(
    'active'
  );
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [isResellerAdmin, setIsResellerAdmin] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<string | null>(null);

  useEffect(() => {
    // Se accountType passato come prop, calcola isResellerAdmin senza fetch extra
    if (accountType) {
      setIsResellerAdmin(
        resellerRole === 'admin' || accountType === 'superadmin' || accountType === 'admin'
      );
    }

    async function loadInitialData() {
      try {
        // Se accountType non passato come prop, fetch per ottenere resellerAdmin
        if (!accountType) {
          const response = await fetch('/api/user/info');
          if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;

            setIsResellerAdmin(
              userData.reseller_role === 'admin' ||
                userData.account_type === 'superadmin' ||
                userData.account_type === 'admin'
            );
          }
        }

        const couriersResult = await getAvailableCouriersForUserAction();
        if (couriersResult.success && couriersResult.couriers) {
          setAvailableCouriers(
            couriersResult.couriers.map((c) => ({
              courierId: c.courierId,
              courierName: c.courierName,
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
  }, [accountType, resellerRole]);

  async function loadPriceLists() {
    try {
      setIsLoading(true);
      const result = await listSupplierPriceListsAction();
      const ownSupplier = result.success && result.priceLists ? result.priceLists : [];

      // Carica anche i listini globali e assegnati dal SuperAdmin (created_by != me)
      let receivedLists: PriceList[] = [];
      const allResult = await listPriceListsAction();
      if (allResult.success && allResult.priceLists) {
        // Filtra solo i listini NON creati dal reseller (globali + assegnati)
        const ownSupplierIds = new Set(ownSupplier.map((pl) => pl.id));
        receivedLists = allResult.priceLists.filter(
          (pl) => !ownSupplierIds.has(pl.id) && (!userId || pl.created_by !== userId)
        );
      }

      setPriceLists([...ownSupplier, ...receivedLists]);

      if (!result.success) {
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
    router.push(`/dashboard/reseller/listini-fornitore/${priceListId}`);
  };

  const handleFormSuccess = () => {
    setShowCreateDialog(false);
    setEditingPriceList(null);
    loadPriceLists();
  };

  const filteredPriceLists = priceLists.filter((pl) => {
    const matchesSearch = pl.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pl.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-orange-600" />
            Listini Fornitore
          </h2>
          <p className="text-gray-500 mt-1">
            Gestisci i tuoi listini fornitore per ogni corriere configurato
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowSyncDialog(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizza da Spedisci.Online
          </Button>
          <Button onClick={handleCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Crea Listino Fornitore
          </Button>
        </div>
      </div>

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
        </div>
      </div>

      {/* Tabella Listini */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <SupplierPriceListTable
          priceLists={filteredPriceLists}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewDetails={handleViewDetails}
          isLoading={isLoading}
          canDelete={isResellerAdmin}
        />
      </div>

      {/* Dialog Creazione/Modifica */}
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
            <DialogTitle>
              {editingPriceList ? 'Modifica Listino Fornitore' : 'Crea Nuovo Listino Fornitore'}
            </DialogTitle>
            <DialogDescription>
              {editingPriceList
                ? 'Modifica i dettagli del listino fornitore'
                : 'Crea un nuovo listino fornitore per un corriere specifico'}
            </DialogDescription>
          </DialogHeader>
          <SupplierPriceListForm
            priceList={editingPriceList || undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowCreateDialog(false);
              setEditingPriceList(null);
            }}
            availableCouriers={availableCouriers}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Sincronizzazione Spedisci.Online */}
      <SyncSpedisciOnlineDialog
        open={showSyncDialog}
        onOpenChange={setShowSyncDialog}
        onSyncComplete={() => {
          loadPriceLists();
        }}
      />

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
    </div>
  );
}
