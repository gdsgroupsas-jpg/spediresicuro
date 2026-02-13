'use client';

/**
 * Step 5: Riepilogo
 * 4 card riassuntive con pulsante "Modifica" per tornare allo step.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ClipboardCheck, FileText, Pencil, Settings, Truck } from 'lucide-react';
import { PROSPECT_SECTORS, DELIVERY_MODES } from '@/types/commercial-quotes';
import { useQuoteWizard } from '../CommercialQuoteWizardContext';

export function RiepilogoStep() {
  const { prospect, carrier, offerta, serviziCondizioni, setCurrentStep } = useQuoteWizard();

  const sectorLabel =
    PROSPECT_SECTORS.find((s) => s.value === prospect.sector)?.label || prospect.sector;
  const deliveryLabel =
    DELIVERY_MODES.find((m) => m.value === offerta.deliveryMode)?.label || offerta.deliveryMode;
  const enabledServices = serviziCondizioni.accessoryServices.filter((s) => s.enabled);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Riepilogo Preventivo</h3>
      </div>

      <p className="text-sm text-gray-600">
        Verifica i dati prima di generare il preventivo. Clicca &quot;Modifica&quot; per tornare
        allo step.
      </p>

      {/* Prospect */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Prospect
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep('prospect')}
              className="h-7 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Modifica
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            <span className="font-medium">Azienda:</span> {prospect.company}
          </div>
          {prospect.contactName && (
            <div>
              <span className="font-medium">Referente:</span> {prospect.contactName}
            </div>
          )}
          {prospect.email && (
            <div>
              <span className="font-medium">Email:</span> {prospect.email}
            </div>
          )}
          {prospect.phone && (
            <div>
              <span className="font-medium">Telefono:</span> {prospect.phone}
            </div>
          )}
          {prospect.sector && (
            <div>
              <span className="font-medium">Settore:</span> {sectorLabel}
            </div>
          )}
          {prospect.estimatedVolume && (
            <div>
              <span className="font-medium">Volume mensile:</span> {prospect.estimatedVolume}{' '}
              spedizioni
            </div>
          )}
        </CardContent>
      </Card>

      {/* Corriere */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4" />
              Corriere
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep('carrier')}
              className="h-7 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Modifica
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            <span className="font-medium">Primario:</span>{' '}
            {carrier.primaryCarrier?.carrierName || '-'}
          </div>
          {carrier.additionalCarriers.length > 0 && (
            <div>
              <span className="font-medium">Confronto:</span> {carrier.additionalCarriers.length}{' '}
              corriere/i alternativo/i
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offerta */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Offerta
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep('offerta')}
              className="h-7 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Modifica
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            <span className="font-medium">Margine:</span> {offerta.marginPercent}%
          </div>
          <div>
            <span className="font-medium">Validit&agrave;:</span> {offerta.validityDays} giorni
          </div>
          <div>
            <span className="font-medium">IVA:</span>{' '}
            {offerta.vatMode === 'excluded' ? 'Esclusa' : 'Inclusa'}
          </div>
          <div>
            <span className="font-medium">Ritiro:</span> {deliveryLabel}
          </div>
          {offerta.pickupFee && (
            <div>
              <span className="font-medium">Supplemento ritiro:</span> {offerta.pickupFee} &euro;
            </div>
          )}
          {offerta.goodsNeedsProcessing && (
            <div>
              <span className="font-medium">Lavorazione:</span>{' '}
              {offerta.processingFee ? `${offerta.processingFee} \u20AC` : 'Inclusa'}
            </div>
          )}
          {offerta.volumetricDivisor && offerta.volumetricDivisor !== '5000' && (
            <div>
              <span className="font-medium">Divisore volumetrico:</span> {offerta.volumetricDivisor}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Servizi */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4" />
              Servizi & Condizioni
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep('servizi')}
              className="h-7 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Modifica
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            <span className="font-medium">Servizi accessori:</span>{' '}
            {enabledServices.length > 0
              ? enabledServices.map((s) => s.service).join(', ')
              : 'Nessuno selezionato'}
          </div>
          {serviziCondizioni.storageNotes && (
            <div>
              <span className="font-medium">Note giacenze:</span> Compilate
            </div>
          )}
          {serviziCondizioni.codNotes && (
            <div>
              <span className="font-medium">Note contrassegno:</span> Compilate
            </div>
          )}
          {serviziCondizioni.insuranceNotes && (
            <div>
              <span className="font-medium">Note assicurazione:</span> Compilate
            </div>
          )}
          <div>
            <span className="font-medium">Clausole custom:</span>{' '}
            {serviziCondizioni.customClauses.length > 0
              ? `${serviziCondizioni.customClauses.length} clausola/e`
              : 'Nessuna'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
