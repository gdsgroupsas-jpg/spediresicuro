'use client';

/**
 * Step 2: Selezione Corriere
 * Corriere primario* + confronto multi-corriere (max 3 alternativi)
 */

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Truck, X } from 'lucide-react';
import { getAvailableCarriersForQuotesAction } from '@/actions/commercial-quotes';
import { useQuoteWizard } from '../CommercialQuoteWizardContext';

interface CourierOption {
  courierId: string;
  courierName: string;
  contractCode: string;
  carrierCode: string;
  priceListId: string;
  doesClientPickup: boolean;
}

export function CarrierStep() {
  const { carrier, setCarrier, offerta, loadAccessoryServices } = useQuoteWizard();
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(true);

  // Carica corrieri disponibili
  useEffect(() => {
    async function load() {
      try {
        const result = await getAvailableCarriersForQuotesAction();
        if (result.success && result.data) {
          setCouriers(
            result.data.map((c) => ({
              courierId: c.carrierCode,
              courierName: c.courierName,
              contractCode: c.contractCode,
              carrierCode: c.carrierCode,
              priceListId: c.priceListId,
              doesClientPickup: c.doesClientPickup,
            }))
          );
        }
      } catch (error) {
        console.error('Errore caricamento corrieri:', error);
      } finally {
        setLoadingCouriers(false);
      }
    }
    load();
  }, []);

  // Quando cambia corriere primario, carica servizi accessori
  useEffect(() => {
    if (!carrier.primaryCarrier?.priceListId) return;

    async function loadServices() {
      try {
        // Importa dinamicamente per evitare dipendenza circolare
        const { getAccessoryServicesAction } = await import('@/actions/commercial-quotes');
        const result = await getAccessoryServicesAction(carrier.primaryCarrier!.priceListId);
        if (result.success && result.data) {
          loadAccessoryServices(result.data);
        }
      } catch (error) {
        console.error('Errore caricamento servizi accessori:', error);
      }
    }
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier.primaryCarrier?.priceListId, loadAccessoryServices]);

  // Corrieri disponibili per confronto
  const availableForComparison = useMemo(() => {
    const selectedCodes = new Set([
      carrier.primaryCarrier?.contractCode,
      ...carrier.additionalCarriers.map((ac) => ac.contractCode),
    ]);
    return couriers.filter((c) => !selectedCodes.has(c.contractCode));
  }, [couriers, carrier.primaryCarrier, carrier.additionalCarriers]);

  const handlePrimaryChange = (contractCode: string) => {
    if (!contractCode) {
      setCarrier({ primaryCarrier: null });
      return;
    }
    const c = couriers.find((c) => c.contractCode === contractCode);
    if (c) {
      setCarrier({
        primaryCarrier: {
          contractCode: c.contractCode,
          carrierCode: c.carrierCode,
          carrierName: c.courierName,
          priceListId: c.priceListId,
        },
      });
    }
  };

  const addAlternative = () => {
    setCarrier({
      additionalCarriers: [
        ...carrier.additionalCarriers,
        { contractCode: '', marginPercent: offerta.marginPercent },
      ],
    });
  };

  const removeAlternative = (idx: number) => {
    setCarrier({
      additionalCarriers: carrier.additionalCarriers.filter((_, i) => i !== idx),
    });
  };

  const updateAlternative = (idx: number, field: string, value: string) => {
    const updated = [...carrier.additionalCarriers];
    updated[idx] = { ...updated[idx], [field]: value };
    setCarrier({ additionalCarriers: updated });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Selezione Corriere</h3>
      </div>

      <div>
        <Label htmlFor="primary-courier">Corriere primario *</Label>
        <Select
          id="primary-courier"
          value={carrier.primaryCarrier?.contractCode || ''}
          onChange={(e) => handlePrimaryChange(e.target.value)}
          className="mt-1"
          disabled={loadingCouriers}
        >
          <option value="">{loadingCouriers ? 'Caricamento...' : 'Seleziona corriere'}</option>
          {couriers.map((c) => (
            <option key={c.contractCode} value={c.contractCode}>
              {c.courierName}
            </option>
          ))}
        </Select>
        {loadingCouriers && (
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Caricamento corrieri...
          </div>
        )}
      </div>

      {/* Confronto multi-corriere */}
      {carrier.primaryCarrier && couriers.length > 1 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Confronto corrieri (opzionale)</Label>
            {availableForComparison.length > 0 && carrier.additionalCarriers.length < 3 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAlternative}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Aggiungi alternativa
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Aggiungi fino a 3 corrieri alternativi per confronto prezzi nello stesso PDF.
          </p>

          {carrier.additionalCarriers.map((ac, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 w-6 flex-shrink-0">
                {String.fromCharCode(66 + idx)}
              </span>
              <Select
                value={ac.contractCode}
                onChange={(e) => updateAlternative(idx, 'contractCode', e.target.value)}
                className="flex-1 text-sm"
              >
                <option value="">Seleziona corriere</option>
                {couriers
                  .filter(
                    (c) =>
                      c.contractCode !== carrier.primaryCarrier?.contractCode &&
                      !carrier.additionalCarriers.some(
                        (other, otherIdx) =>
                          otherIdx !== idx && other.contractCode === c.contractCode
                      )
                  )
                  .map((c) => (
                    <option key={c.contractCode} value={c.contractCode}>
                      {c.courierName}
                    </option>
                  ))}
              </Select>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={ac.marginPercent}
                onChange={(e) => updateAlternative(idx, 'marginPercent', e.target.value)}
                placeholder="Margine %"
                className="w-24 text-sm"
                aria-label={`Margine corriere alternativo ${String.fromCharCode(66 + idx)}`}
              />
              <button
                type="button"
                onClick={() => removeAlternative(idx)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label={`Rimuovi corriere alternativo ${String.fromCharCode(66 + idx)}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
