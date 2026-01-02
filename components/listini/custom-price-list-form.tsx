/**
 * Form per creazione/modifica listino personalizzato
 * 
 * Componente per Reseller per creare listini personalizzati per sub-users
 */

'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { createPriceListAction, updatePriceListAction } from '@/actions/price-lists';
import { toast } from 'sonner';
import type { PriceList, PriceListStatus } from '@/types/listini';

interface CustomPriceListFormProps {
  priceList?: PriceList;
  onSuccess: () => void;
  onCancel: () => void;
  subUsers: Array<{ id: string; email: string; name?: string }>;
}

export function CustomPriceListForm({
  priceList,
  onSuccess,
  onCancel,
  subUsers,
}: CustomPriceListFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: priceList?.name || '',
    version: priceList?.version || '1.0.0',
    status: (priceList?.status || 'draft') as PriceListStatus,
    assigned_to_user_id: priceList?.assigned_to_user_id || '',
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
        if (!formData.assigned_to_user_id) {
          toast.error('Seleziona un utente');
          setIsSubmitting(false);
          return;
        }

        const result = await createPriceListAction({
          name: formData.name,
          version: formData.version,
          status: formData.status,
          list_type: 'custom',
          assigned_to_user_id: formData.assigned_to_user_id,
          description: formData.description,
          notes: formData.notes,
          is_global: false,
        });

        if (result.success) {
          toast.success('Listino personalizzato creato con successo');
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
          placeholder="Es: Listino Personalizzato Cliente ABC"
          required
          className="mt-1"
        />
      </div>

      {/* Utente Assegnato (solo in creazione) */}
      {!priceList && (
        <div>
          <Label htmlFor="assigned_to_user_id">Utente Assegnato *</Label>
          <Select
            id="assigned_to_user_id"
            value={formData.assigned_to_user_id}
            onChange={(e) => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
            required
            className="mt-1"
          >
            <option value="">Seleziona utente</option>
            {subUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email} ({user.email})
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
              <FileText className="w-4 h-4 mr-2" />
              {priceList ? 'Aggiorna Listino' : 'Crea Listino'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

