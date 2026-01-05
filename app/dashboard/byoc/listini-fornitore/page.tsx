/**
 * Dashboard BYOC: Gestione Listini Fornitore
 * 
 * Interfaccia per BYOC per gestire i propri listini fornitore
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Package, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DashboardNav from '@/components/dashboard-nav';
import { SupplierPriceListForm } from '@/components/listini/supplier-price-list-form';
import { SupplierPriceListTable } from '@/components/listini/supplier-price-list-table';
import {
  listSupplierPriceListsAction,
  deletePriceListAction,
} from '@/actions/price-lists';
import { getAvailableCouriersForUser } from '@/lib/db/price-lists';
import { toast } from 'sonner';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import type { PriceList } from '@/types/listini';

export default function ByocListiniFornitorePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableCouriers, setAvailableCouriers] = useState<Array<{ courierId: string; courierName: string }>>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<string | null>(null);

  // Verifica permessi e carica dati
  useEffect(() => {
    async function checkPermissionsAndLoad() {
      if (!session?.user?.email) {
        router.push('/login');
        return;
      }

      try {
        // Verifica se è BYOC
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          
          if (userData.account_type !== 'byoc') {
            router.push('/dashboard?error=unauthorized');
            return;
          }

          // Carica corrieri disponibili
          const couriers = await getAvailableCouriersForUser(userData.id);
          setAvailableCouriers(couriers.map(c => ({
            courierId: c.courierId,
            courierName: c.courierName,
          })));

          // Carica listini
          await loadPriceLists();
        }
      } catch (error) {
        console.error('Errore verifica permessi:', error);
        router.push('/dashboard?error=unauthorized');
      }
    }

    checkPermissionsAndLoad();
  }, [session, router]);

  async function loadPriceLists() {
    try {
      setIsLoading(true);
      const result = await listSupplierPriceListsAction();
      
      if (result.success && result.priceLists) {
        setPriceLists(result.priceLists);
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
    setEditingPriceList(null);
    loadPriceLists();
  };

  // Filtra listini
  const filteredPriceLists = priceLists.filter((pl) => {
    const matchesSearch = pl.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pl.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Listini Fornitore"
        subtitle="Gestisci i tuoi listini fornitore per ogni corriere"
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-8 h-8 text-orange-600" />
              Listini Fornitore
            </h1>
            <p className="text-gray-500 mt-1">
              Gestisci i tuoi listini fornitore per ogni corriere configurato
            </p>
          </div>
          <Button onClick={handleCreate} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Crea Listino Fornitore
          </Button>
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
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
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
          />
        </div>

        {/* Dialog Creazione/Modifica */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingPriceList(null);
          }
        }}>
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
    </div>
  );
}



