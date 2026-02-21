'use client';

/**
 * Step 4: Servizi & Condizioni
 *
 * 4a. Servizi accessori (tabella toggle on/off da supplier_price_list_config)
 * 4b. Note informative (giacenze, contrassegno, assicurazione)
 * 4c. Clausole standard (preview read-only) + clausole custom (CRUD)
 */

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Plus, Settings, Trash2 } from 'lucide-react';
import { getDefaultClauses } from '@/lib/commercial-quotes/clauses';
import { useQuoteWizard } from '../CommercialQuoteWizardContext';

export function ServiziCondizioniStep() {
  const {
    serviziCondizioni,
    setServiziCondizioni,
    toggleAccessoryService,
    addCustomClause,
    removeCustomClause,
    updateCustomClause,
    offerta,
  } = useQuoteWizard();

  // Clausole standard generate dal sistema (preview read-only)
  const defaultClauses = useMemo(
    () =>
      getDefaultClauses(offerta.vatMode, 22, {
        deliveryMode: offerta.deliveryMode,
        pickupFee: offerta.pickupFee ? parseFloat(offerta.pickupFee) : null,
        goodsNeedsProcessing: offerta.goodsNeedsProcessing,
        processingFee: offerta.processingFee ? parseFloat(offerta.processingFee) : null,
      }),
    [
      offerta.vatMode,
      offerta.deliveryMode,
      offerta.pickupFee,
      offerta.goodsNeedsProcessing,
      offerta.processingFee,
    ]
  );

  const enabledCount = serviziCondizioni.accessoryServices.filter((s) => s.enabled).length;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Servizi & Condizioni</h3>
      </div>

      {/* 4a. Servizi Accessori */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-medium">Servizi Accessori</Label>
          {enabledCount > 0 && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
              {enabledCount} attivi
            </span>
          )}
        </div>

        {serviziCondizioni.accessoryServices.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Seleziona un corriere nello step precedente per caricare i servizi disponibili.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Attivo</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">Servizio</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">Prezzo fisso</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600">%</th>
                </tr>
              </thead>
              <tbody>
                {serviziCondizioni.accessoryServices.map((svc) => (
                  <tr key={svc.id} className={`border-t ${svc.enabled ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={svc.enabled}
                        onChange={() => toggleAccessoryService(svc.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                        aria-label={`Attiva ${svc.service}`}
                      />
                    </td>
                    <td className="px-4 py-2">{svc.service}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {svc.price > 0 ? `${svc.price.toFixed(2)} \u20AC` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {svc.percent > 0 ? `${svc.percent}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">
          I servizi attivati appariranno nel PDF con i relativi costi.
        </p>
      </section>

      {/* 4b. Note Informative */}
      <section>
        <Label className="text-base font-medium mb-3 block">Note Informative</Label>
        <div className="space-y-4">
          <div>
            <Label htmlFor="storage-notes" className="text-sm">
              Giacenze (costi riconsegna, reso, ecc.)
            </Label>
            <textarea
              id="storage-notes"
              value={serviziCondizioni.storageNotes}
              onChange={(e) => setServiziCondizioni({ storageNotes: e.target.value })}
              placeholder="Es. Riconsegna: 5.00 EUR, Reso al mittente: 8.00 EUR..."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="cod-notes" className="text-sm">
              Contrassegno (soglie, percentuali)
            </Label>
            <textarea
              id="cod-notes"
              value={serviziCondizioni.codNotes}
              onChange={(e) => setServiziCondizioni({ codNotes: e.target.value })}
              placeholder="Es. Fino a 500 EUR: 2.00 EUR + 1.5%, oltre 500 EUR: 3.50 EUR + 2%..."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="insurance-notes" className="text-sm">
              Assicurazione (limiti, copertura)
            </Label>
            <textarea
              id="insurance-notes"
              value={serviziCondizioni.insuranceNotes}
              onChange={(e) => setServiziCondizioni({ insuranceNotes: e.target.value })}
              placeholder="Es. Assicurazione fino a 3000 EUR: 1.50 EUR + 5% del valore dichiarato..."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              rows={2}
            />
          </div>
        </div>
      </section>

      {/* 4c. Clausole */}
      <section>
        <Label className="text-base font-medium mb-3 block">Clausole</Label>

        {/* Standard (read-only preview) */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-600">
                Clausole standard (automatiche)
              </span>
            </div>
            <div className="space-y-2">
              {defaultClauses.map((c, i) => (
                <div
                  key={i}
                  className="text-sm text-gray-600 py-1 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium">{c.title}:</span> {c.text}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom clauses (CRUD) */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600">Clausole personalizzate</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomClause}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Aggiungi clausola
          </Button>
        </div>

        {serviziCondizioni.customClauses.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Nessuna clausola personalizzata. Clicca &quot;Aggiungi clausola&quot; per aggiungerne
            una.
          </p>
        ) : (
          <div className="space-y-3">
            {serviziCondizioni.customClauses.map((clause, idx) => (
              <div key={idx} className="border rounded-lg p-3 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={clause.title}
                    onChange={(e) => updateCustomClause(idx, { title: e.target.value })}
                    placeholder="Titolo clausola"
                    className="flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeCustomClause(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Rimuovi clausola ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={clause.text}
                  onChange={(e) => updateCustomClause(idx, { text: e.target.value })}
                  placeholder="Testo della clausola..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                  rows={2}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
