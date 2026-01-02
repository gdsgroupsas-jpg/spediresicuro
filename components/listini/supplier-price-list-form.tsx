/**
 * Form per creazione/modifica listino fornitore
 * 
 * Componente riutilizzabile per gestire listini fornitore (Reseller/BYOC)
 */

'use client';

import { useState, useEffect } from 'react';
import { Package, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { createSupplierPriceListAction, updatePriceListAction } from '@/actions/price-lists';
import { toast } from 'sonner';
import type { PriceList, PriceListStatus } from '@/types/listini';

interface SupplierPriceListFormProps {
  priceList?: PriceList; // Se presente, modalità modifica
  onSuccess: () => void;
  onCancel: () => void;
  availableCouriers: Array<{ courierId: string; courierName: string }>;
}

export function SupplierPriceListForm({
  priceList,
  onSuccess,
  onCancel,
  availableCouriers,
}: SupplierPriceListFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: priceList?.name || '',
    version: priceList?.version || '1.0.0',
    status: (priceList?.status || 'draft') as PriceListStatus,
    courier_id: priceList?.courier_id || '',
    description: priceList?.description || '',
    notes: priceList?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (priceList) {
        // Modifica
        const result = await updatePriceListAction(priceList.id, {
          name: formData.name,
          version: formData.version,
          status: formData.status,
          description: formData.description,
          notes: formData.notes,
        });

        if (result.success) {
          toast.success('Listino aggiornato con successo');
          onSuccess();
        } else {
          toast.error(result.error || 'Errore aggiornamento listino');
        }
      } else {
        // Creazione
        if (!formData.courier_id) {
          toast.error('Seleziona un corriere');
          setIsSubmitting(false);
          return;
        }

        const result = await createSupplierPriceListAction({
          name: formData.name,
          version: formData.version,
          status: formData.status,
          courier_id: formData.courier_id,
          description: formData.description,
          notes: formData.notes,
        });

        if (result.success) {
          toast.success('Listino creato con successo');
          onSuccess();
        } else {
          toast.error(result.error || 'Errore creazione listino');
        }
      }
    } catch (error: any) {
      console.error('Errore submit form:', error);
      toast.error('Errore imprevisto. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nome Listino */}
      <div>
        <Label htmlFor="name">Nome Listino *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Es: Listino GLS 2025"
          required
          className="mt-1"
        />
      </div>

      {/* Corriere (solo in creazione) */}
      {!priceList && (
        <div>
          <Label htmlFor="courier_id">Corriere *</Label>
          <Select
            id="courier_id"
            value={formData.courier_id}
            onChange={(e) => setFormData({ ...formData, courier_id: e.target.value })}
            required
            className="mt-1"
          >
            <option value="">Seleziona corriere</option>
            {availableCouriers.map((courier) => (
              <option key={courier.courierId} value={courier.courierId}>
                {courier.courierName}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Versione */}
      <div>
        <Label htmlFor="version">Versione *</Label>
        <Input
          id="version"
          value={formData.version}
          onChange={(e) => setFormData({ ...formData, version: e.target.value })}
          placeholder="Es: 1.0.0"
          required
          className="mt-1"
        />
      </div>

      {/* Status */}
      <div>
        <Label htmlFor="status">Status *</Label>
          <Select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as PriceListStatus })}
            required
            className="mt-1"
          >
          <option value="draft">Bozza</option>
          <option value="active">Attivo</option>
          <option value="archived">Archiviato</option>
        </Select>
      </div>

      {/* Descrizione */}
      <div>
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrizione opzionale del listino"
          rows={3}
          className="mt-1"
        />
      </div>

      {/* Note */}
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Note interne opzionali"
          rows={2}
          className="mt-1"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Annulla
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {priceList ? 'Aggiornamento...' : 'Creazione...'}
            </>
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" />
              {priceList ? 'Aggiorna Listino' : 'Crea Listino'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

