'use client';

/**
 * Step 3: Configurazione Offerta
 * Margine, validita', IVA, modalita' ritiro, supplemento, lavorazione
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DELIVERY_MODES } from '@/types/commercial-quotes';
import type { DeliveryMode } from '@/types/commercial-quotes';
import { FileText } from 'lucide-react';
import { useQuoteWizard } from '../CommercialQuoteWizardContext';

export function OffertaStep() {
  const { offerta, setOfferta } = useQuoteWizard();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Configurazione Offerta</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="margin">Margine %</Label>
          <Input
            id="margin"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={offerta.marginPercent}
            onChange={(e) => setOfferta({ marginPercent: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="validity">Validit&agrave; (giorni)</Label>
          <Input
            id="validity"
            type="number"
            min="1"
            max="180"
            value={offerta.validityDays}
            onChange={(e) => setOfferta({ validityDays: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="vat-mode">IVA</Label>
          <Select
            id="vat-mode"
            value={offerta.vatMode}
            onChange={(e) => setOfferta({ vatMode: e.target.value as 'included' | 'excluded' })}
            className="mt-1"
          >
            <option value="excluded">Esclusa</option>
            <option value="included">Inclusa</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="vol-divisor">Divisore volumetrico</Label>
          <Input
            id="vol-divisor"
            type="number"
            min="1000"
            max="10000"
            step="1000"
            value={offerta.volumetricDivisor}
            onChange={(e) => setOfferta({ volumetricDivisor: e.target.value })}
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">Standard: 5000 (corrieri), 6000 (aerei)</p>
        </div>
      </div>

      {/* Modalita' ritiro */}
      <div>
        <Label htmlFor="delivery-mode">Modalit&agrave; ritiro</Label>
        <Select
          id="delivery-mode"
          value={offerta.deliveryMode}
          onChange={(e) => setOfferta({ deliveryMode: e.target.value as DeliveryMode })}
          className="mt-1"
        >
          {DELIVERY_MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-gray-500 mt-1">
          {DELIVERY_MODES.find((m) => m.value === offerta.deliveryMode)?.description}
        </p>
      </div>

      {/* Supplemento ritiro */}
      {offerta.deliveryMode !== 'client_dropoff' && (
        <div>
          <Label htmlFor="pickup-fee">Supplemento ritiro (opzionale)</Label>
          <div className="relative mt-1">
            <Input
              id="pickup-fee"
              type="number"
              min="0"
              step="0.50"
              value={offerta.pickupFee}
              onChange={(e) => setOfferta({ pickupFee: e.target.value })}
              placeholder="Gratuito"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              &euro;
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Lascia vuoto per ritiro gratuito.</p>
        </div>
      )}

      {/* Lavorazione merce */}
      {offerta.deliveryMode !== 'carrier_pickup' && (
        <>
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-2">
              <input
                id="goods-processing"
                type="checkbox"
                checked={offerta.goodsNeedsProcessing}
                onChange={(e) => setOfferta({ goodsNeedsProcessing: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
              />
              <Label htmlFor="goods-processing" className="cursor-pointer">
                Merce da lavorare (etichettatura, imballaggio)
              </Label>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Attiva se i pacchi richiedono lavorazione da parte dei nostri operatori.
            </p>
          </div>

          {offerta.goodsNeedsProcessing && (
            <div>
              <Label htmlFor="processing-fee">Costo lavorazione per spedizione (opzionale)</Label>
              <div className="relative mt-1">
                <Input
                  id="processing-fee"
                  type="number"
                  min="0"
                  step="0.50"
                  value={offerta.processingFee}
                  onChange={(e) => setOfferta({ processingFee: e.target.value })}
                  placeholder="Incluso"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  &euro;
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Lascia vuoto se il costo &egrave; incluso nel servizio.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
