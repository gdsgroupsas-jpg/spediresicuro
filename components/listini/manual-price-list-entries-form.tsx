/**
 * Form per inserimento manuale entries listino fornitore
 *
 * ✨ FASE 2: Permette inserimento manuale di una o più entries
 * Supporta inserimento singolo o batch (multiple entries)
 */

'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { createPriceListEntryAction } from '@/actions/price-list-entries';
import { PRICING_MATRIX } from '@/lib/constants/pricing-matrix';
import { toast } from 'sonner';
import type { PriceListEntry } from '@/types/listini';

interface ManualPriceListEntriesFormProps {
  priceListId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface EntryFormData {
  zone_code: string;
  weight_from: number;
  weight_to: number;
  base_price: number;
  service_type: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day';
  fuel_surcharge_percent: number;
  cash_on_delivery_surcharge: number;
  insurance_rate_percent: number;
  island_surcharge: number;
  ztl_surcharge: number;
  estimated_delivery_days_min?: number;
  estimated_delivery_days_max?: number;
}

export function ManualPriceListEntriesForm({
  priceListId,
  onSuccess,
  onCancel,
}: ManualPriceListEntriesFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entries, setEntries] = useState<EntryFormData[]>([
    {
      zone_code: '',
      weight_from: 0,
      weight_to: 1,
      base_price: 0,
      service_type: 'standard',
      fuel_surcharge_percent: 0,
      cash_on_delivery_surcharge: 0,
      insurance_rate_percent: 0,
      island_surcharge: 0,
      ztl_surcharge: 0,
    },
  ]);

  // Zone disponibili dalla matrice prezzi
  const availableZones = PRICING_MATRIX.ZONES.map((z) => ({
    code: z.code,
    name: z.name,
  }));

  // Aggiungi nuova entry
  const addEntry = () => {
    const lastEntry = entries[entries.length - 1];
    setEntries([
      ...entries,
      {
        zone_code: '',
        weight_from: lastEntry?.weight_to || 0,
        weight_to: (lastEntry?.weight_to || 0) + 1,
        base_price: 0,
        service_type: 'standard',
        fuel_surcharge_percent: lastEntry?.fuel_surcharge_percent || 0,
        cash_on_delivery_surcharge: lastEntry?.cash_on_delivery_surcharge || 0,
        insurance_rate_percent: lastEntry?.insurance_rate_percent || 0,
        island_surcharge: 0,
        ztl_surcharge: 0,
      },
    ]);
  };

  // Rimuovi entry
  const removeEntry = (index: number) => {
    if (entries.length === 1) {
      toast.error('Devi avere almeno una entry');
      return;
    }
    setEntries(entries.filter((_, i) => i !== index));
  };

  // Aggiorna entry
  const updateEntry = (index: number, field: keyof EntryFormData, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-aggiorna weight_from basato su weight_to precedente
    if (field === 'weight_to' && index > 0) {
      updated[index].weight_from = updated[index - 1].weight_to;
    }

    setEntries(updated);
  };

  // Valida entry
  const validateEntry = (entry: EntryFormData, index: number): string | null => {
    if (!entry.zone_code) {
      return `Entry ${index + 1}: Seleziona una zona`;
    }
    if (entry.weight_from < 0) {
      return `Entry ${index + 1}: Peso da non può essere negativo`;
    }
    if (entry.weight_to <= entry.weight_from) {
      return `Entry ${index + 1}: Peso a deve essere maggiore di peso da`;
    }
    if (entry.base_price <= 0) {
      return `Entry ${index + 1}: Prezzo base deve essere maggiore di 0`;
    }
    return null;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Valida tutte le entries
      for (let i = 0; i < entries.length; i++) {
        const error = validateEntry(entries[i], i);
        if (error) {
          toast.error(error);
          setIsSubmitting(false);
          return;
        }
      }

      // Crea tutte le entries
      const results = await Promise.all(
        entries.map((entry) =>
          createPriceListEntryAction(priceListId, {
            zone_code: entry.zone_code,
            weight_from: entry.weight_from,
            weight_to: entry.weight_to,
            base_price: entry.base_price,
            service_type: entry.service_type,
            fuel_surcharge_percent: entry.fuel_surcharge_percent || 0,
            cash_on_delivery_surcharge: entry.cash_on_delivery_surcharge || 0,
            insurance_rate_percent: entry.insurance_rate_percent || 0,
            island_surcharge: entry.island_surcharge || 0,
            ztl_surcharge: entry.ztl_surcharge || 0,
            estimated_delivery_days_min: entry.estimated_delivery_days_min,
            estimated_delivery_days_max: entry.estimated_delivery_days_max,
          })
        )
      );

      // Verifica risultati
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        toast.error(
          `${failed.length} entry non create: ${failed[0].error || 'Errore sconosciuto'}`
        );
        setIsSubmitting(false);
        return;
      }

      toast.success(`${entries.length} entry create con successo`);
      onSuccess();
    } catch (error: any) {
      console.error('Errore creazione entries:', error);
      toast.error('Errore imprevisto. Riprova più tardi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Inserisci Entries Manualmente</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addEntry}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Entry
        </Button>
      </div>

      {/* Lista entries */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {entries.map((entry, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-sm text-gray-700">Entry {index + 1}</h4>
              {entries.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Zona */}
              <div>
                <Label htmlFor={`zone-${index}`}>Zona *</Label>
                <Select
                  id={`zone-${index}`}
                  value={entry.zone_code}
                  onChange={(e) => updateEntry(index, 'zone_code', e.target.value)}
                  required
                  className="mt-1"
                >
                  <option value="">Seleziona zona</option>
                  {availableZones.map((zone) => (
                    <option key={zone.code} value={zone.code}>
                      {zone.name} ({zone.code})
                    </option>
                  ))}
                </Select>
              </div>

              {/* Peso da */}
              <div>
                <Label htmlFor={`weight_from-${index}`}>Peso da (kg) *</Label>
                <Input
                  id={`weight_from-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.weight_from}
                  onChange={(e) =>
                    updateEntry(index, 'weight_from', parseFloat(e.target.value) || 0)
                  }
                  required
                  className="mt-1"
                />
              </div>

              {/* Peso a */}
              <div>
                <Label htmlFor={`weight_to-${index}`}>Peso a (kg) *</Label>
                <Input
                  id={`weight_to-${index}`}
                  type="number"
                  step="0.01"
                  min={entry.weight_from + 0.01}
                  value={entry.weight_to}
                  onChange={(e) => updateEntry(index, 'weight_to', parseFloat(e.target.value) || 0)}
                  required
                  className="mt-1"
                />
              </div>

              {/* Prezzo base */}
              <div>
                <Label htmlFor={`base_price-${index}`}>Prezzo base (€) *</Label>
                <Input
                  id={`base_price-${index}`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={entry.base_price}
                  onChange={(e) =>
                    updateEntry(index, 'base_price', parseFloat(e.target.value) || 0)
                  }
                  required
                  className="mt-1"
                />
              </div>

              {/* Tipo servizio */}
              <div>
                <Label htmlFor={`service_type-${index}`}>Tipo servizio</Label>
                <Select
                  id={`service_type-${index}`}
                  value={entry.service_type}
                  onChange={(e) =>
                    updateEntry(
                      index,
                      'service_type',
                      e.target.value as EntryFormData['service_type']
                    )
                  }
                  className="mt-1"
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="economy">Economy</option>
                  <option value="same_day">Same Day</option>
                  <option value="next_day">Next Day</option>
                </Select>
              </div>

              {/* Fuel surcharge */}
              <div>
                <Label htmlFor={`fuel_surcharge-${index}`}>Supplemento carburante (%)</Label>
                <Input
                  id={`fuel_surcharge-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.fuel_surcharge_percent}
                  onChange={(e) =>
                    updateEntry(index, 'fuel_surcharge_percent', parseFloat(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              </div>

              {/* COD surcharge */}
              <div>
                <Label htmlFor={`cod_surcharge-${index}`}>Supplemento contrassegno (€)</Label>
                <Input
                  id={`cod_surcharge-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.cash_on_delivery_surcharge}
                  onChange={(e) =>
                    updateEntry(
                      index,
                      'cash_on_delivery_surcharge',
                      parseFloat(e.target.value) || 0
                    )
                  }
                  className="mt-1"
                />
              </div>

              {/* Insurance rate */}
              <div>
                <Label htmlFor={`insurance-${index}`}>Tasso assicurazione (%)</Label>
                <Input
                  id={`insurance-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.insurance_rate_percent}
                  onChange={(e) =>
                    updateEntry(index, 'insurance_rate_percent', parseFloat(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              </div>

              {/* Island surcharge */}
              <div>
                <Label htmlFor={`island_surcharge-${index}`}>Supplemento isole (€)</Label>
                <Input
                  id={`island_surcharge-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.island_surcharge}
                  onChange={(e) =>
                    updateEntry(index, 'island_surcharge', parseFloat(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              </div>

              {/* ZTL surcharge */}
              <div>
                <Label htmlFor={`ztl_surcharge-${index}`}>Supplemento ZTL (€)</Label>
                <Input
                  id={`ztl_surcharge-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={entry.ztl_surcharge}
                  onChange={(e) =>
                    updateEntry(index, 'ztl_surcharge', parseFloat(e.target.value) || 0)
                  }
                  className="mt-1"
                />
              </div>

              {/* Giorni consegna min */}
              <div>
                <Label htmlFor={`delivery_days_min-${index}`}>Giorni consegna (min)</Label>
                <Input
                  id={`delivery_days_min-${index}`}
                  type="number"
                  min="0"
                  value={entry.estimated_delivery_days_min || ''}
                  onChange={(e) =>
                    updateEntry(
                      index,
                      'estimated_delivery_days_min',
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  className="mt-1"
                />
              </div>

              {/* Giorni consegna max */}
              <div>
                <Label htmlFor={`delivery_days_max-${index}`}>Giorni consegna (max)</Label>
                <Input
                  id={`delivery_days_max-${index}`}
                  type="number"
                  min="0"
                  value={entry.estimated_delivery_days_max || ''}
                  onChange={(e) =>
                    updateEntry(
                      index,
                      'estimated_delivery_days_max',
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        ))}
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
              Creazione...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Crea {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
