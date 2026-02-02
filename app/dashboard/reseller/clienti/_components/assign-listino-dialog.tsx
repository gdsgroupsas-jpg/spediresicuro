'use client';

import {
  assignPriceListToUserAction as assignPriceListAction,
  revokePriceListFromUserAction,
  listPriceListsAction,
} from '@/actions/price-lists';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PriceList } from '@/types/listini';
import { AlertTriangle, Check, FileText, Loader2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface AssignListinoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  currentListinoIds: string[];
  onSuccess: () => void;
  onCreateNew: () => void;
}

export function AssignListinoDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentListinoIds,
  onSuccess,
  onCreateNew,
}: AssignListinoDialogProps) {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentListinoIds));

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentListinoIds));
    }
  }, [open, currentListinoIds]);

  useEffect(() => {
    async function loadPriceLists() {
      if (!open) return;

      setIsLoading(true);
      try {
        const result = await listPriceListsAction();
        if (result.success && result.priceLists) {
          const assignableLists = result.priceLists.filter(
            (pl) =>
              pl.status === 'active' && (pl.list_type === 'custom' || pl.list_type === 'supplier')
          );
          setPriceLists(assignableLists);
        }
      } catch (error) {
        console.error('Errore caricamento listini:', error);
        toast.error('Errore nel caricamento dei listini');
      } finally {
        setIsLoading(false);
      }
    }

    loadPriceLists();
  }, [open]);

  const toggleListino = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentSet = new Set(currentListinoIds);
      const toAssign = [...selectedIds].filter((id) => !currentSet.has(id));
      const toRevoke = [...currentSet].filter((id) => !selectedIds.has(id));

      let errors = 0;

      for (const plId of toAssign) {
        const result = await assignPriceListAction(clientId, plId);
        if (!result.success) {
          errors++;
          toast.error(result.error || 'Errore assegnazione listino');
        }
      }

      for (const plId of toRevoke) {
        const result = await revokePriceListFromUserAction(clientId, plId);
        if (!result.success) {
          errors++;
          toast.error(result.error || 'Errore revoca listino');
        }
      }

      if (errors === 0) {
        const changes = toAssign.length + toRevoke.length;
        if (changes > 0) {
          toast.success(
            `Listini aggiornati (${toAssign.length} aggiunti, ${toRevoke.length} rimossi)`
          );
        }
        onSuccess();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Errore salvataggio listini:', error);
      toast.error('Errore nel salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    selectedIds.size !== currentListinoIds.length ||
    [...selectedIds].some((id) => !currentListinoIds.includes(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-orange-600" />
            Gestisci Listini di {clientName}
          </DialogTitle>
          <DialogDescription>
            Seleziona i listini da assegnare al cliente. Puoi assegnarne quanti ne vuoi.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
              <span className="ml-2 text-gray-500">Caricamento listini...</span>
            </div>
          ) : priceLists.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Non hai listini disponibili da assegnare.</p>
              <Button onClick={onCreateNew} className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" />
                Crea Listino Personalizzato
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
              {priceLists.map((listino) => {
                const isSelected = selectedIds.has(listino.id);
                const isCurrentlyAssigned = currentListinoIds.includes(listino.id);

                return (
                  <div
                    key={listino.id}
                    onClick={() => toggleListino(listino.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-orange-500' : 'bg-gray-100'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-4 h-4 text-white" />
                          ) : (
                            <FileText className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{listino.name}</p>
                          <p className="text-xs text-gray-500">
                            {listino.list_type === 'custom' ? 'Personalizzato' : 'Fornitore'}
                            {listino.default_margin_percent !== undefined &&
                              ` • +${listino.default_margin_percent}% margine`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCurrentlyAssigned && (
                          <Badge variant="success" className="text-xs">
                            Assegnato
                          </Badge>
                        )}
                        <Badge
                          variant={listino.status === 'active' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          v{listino.version}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {priceLists.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={onCreateNew}
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crea Nuovo
            </Button>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <span className="text-xs text-gray-500">{selectedIds.size} selezionati</span>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  'Salva Listini'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
