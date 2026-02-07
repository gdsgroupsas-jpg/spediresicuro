'use client';

/**
 * Form creazione preventivo commerciale
 *
 * Prospect (azienda, contatto, settore, volume) +
 * Configurazione offerta (corriere, listino, margine %, validita').
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PROSPECT_SECTORS, DELIVERY_MODES } from '@/types/commercial-quotes';
import type { CreateCommercialQuoteInput, DeliveryMode } from '@/types/commercial-quotes';
import {
  createCommercialQuoteAction,
  getAvailableCarriersForQuotesAction,
} from '@/actions/commercial-quotes';
import { AlertTriangle, Building2, Loader2, Plus, Send, Truck, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface CourierOption {
  courierId: string;
  courierName: string;
  contractCode: string;
  carrierCode: string;
  doesClientPickup: boolean;
}

interface QuoteFormProps {
  onQuoteCreated?: () => void;
}

export function QuoteForm({ onQuoteCreated }: QuoteFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(true);

  // Prospect
  const [prospectCompany, setProspectCompany] = useState('');
  const [prospectContactName, setProspectContactName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [prospectSector, setProspectSector] = useState('');
  const [prospectVolume, setProspectVolume] = useState('');
  const [prospectNotes, setProspectNotes] = useState('');

  // Configurazione offerta
  const [selectedCourier, setSelectedCourier] = useState('');
  const [marginPercent, setMarginPercent] = useState('20');
  const [validityDays, setValidityDays] = useState('30');
  const [vatMode, setVatMode] = useState<'included' | 'excluded'>('excluded');

  // Logistica ritiro
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('carrier_pickup');
  const [pickupFee, setPickupFee] = useState('');

  // Lavorazione merce
  const [goodsNeedsProcessing, setGoodsNeedsProcessing] = useState(false);
  const [processingFee, setProcessingFee] = useState('');

  // Multi-corriere (confronto)
  const [additionalCarriers, setAdditionalCarriers] = useState<
    Array<{ contractCode: string; marginPercent: string }>
  >([]);

  // Corrieri filtrati in base a delivery mode
  // carrier_pickup: solo corrieri con doesClientPickup = true
  // own_fleet / client_dropoff: tutti i corrieri (il reseller gestisce la logistica)
  const filteredCouriers = useMemo(() => {
    if (deliveryMode === 'carrier_pickup') {
      return couriers.filter((c) => c.doesClientPickup);
    }
    return couriers;
  }, [couriers, deliveryMode]);

  // Quanti corrieri esclusi dal filtro
  const excludedCount = couriers.length - filteredCouriers.length;

  // Corrieri disponibili per confronto (escludi primario e gia' selezionati)
  const availableForComparison = useMemo(() => {
    const selectedCodes = new Set([
      selectedCourier,
      ...additionalCarriers.map((ac) => ac.contractCode),
    ]);
    return filteredCouriers.filter((c) => !selectedCodes.has(c.contractCode));
  }, [filteredCouriers, selectedCourier, additionalCarriers]);

  // Reset selezione corriere quando cambio delivery mode e il corriere selezionato non e' piu' disponibile
  useEffect(() => {
    if (selectedCourier && !filteredCouriers.find((c) => c.contractCode === selectedCourier)) {
      setSelectedCourier('');
    }
    // Rimuovi corrieri aggiuntivi non piu' disponibili nel filtro
    setAdditionalCarriers((prev) =>
      prev.filter((ac) => filteredCouriers.some((c) => c.contractCode === ac.contractCode))
    );
  }, [deliveryMode, filteredCouriers, selectedCourier]);

  // Carica corrieri disponibili (dai listini attivi del workspace)
  useEffect(() => {
    async function loadCouriers() {
      try {
        const result = await getAvailableCarriersForQuotesAction();
        if (result.success && result.data) {
          setCouriers(
            result.data.map((c) => ({
              courierId: c.carrierCode,
              courierName: c.courierName,
              contractCode: c.contractCode,
              carrierCode: c.carrierCode,
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
    loadCouriers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prospectCompany.trim()) {
      toast.error('Nome azienda obbligatorio');
      return;
    }
    if (!selectedCourier) {
      toast.error('Seleziona un corriere');
      return;
    }

    const courier = couriers.find((c) => c.contractCode === selectedCourier);
    if (!courier) {
      toast.error('Corriere non valido');
      return;
    }

    setIsLoading(true);

    try {
      // Prepara corrieri aggiuntivi per confronto
      const additionalCarrierCodes = additionalCarriers
        .filter((ac) => ac.contractCode)
        .map((ac) => {
          const acCourier = couriers.find((c) => c.contractCode === ac.contractCode);
          return {
            carrier_code: acCourier?.carrierCode || ac.contractCode,
            contract_code: ac.contractCode,
            margin_percent: ac.marginPercent ? parseFloat(ac.marginPercent) : undefined,
          };
        });

      const input: CreateCommercialQuoteInput = {
        prospect_company: prospectCompany,
        prospect_contact_name: prospectContactName || undefined,
        prospect_email: prospectEmail || undefined,
        prospect_phone: prospectPhone || undefined,
        prospect_sector: prospectSector || undefined,
        prospect_estimated_volume: prospectVolume ? parseInt(prospectVolume) : undefined,
        prospect_notes: prospectNotes || undefined,
        carrier_code: courier.carrierCode,
        contract_code: courier.contractCode,
        margin_percent: parseFloat(marginPercent) || 20,
        validity_days: parseInt(validityDays) || 30,
        vat_mode: vatMode,
        delivery_mode: deliveryMode,
        pickup_fee: pickupFee ? parseFloat(pickupFee) : undefined,
        goods_needs_processing: goodsNeedsProcessing,
        processing_fee: processingFee ? parseFloat(processingFee) : undefined,
        additional_carrier_codes:
          additionalCarrierCodes.length > 0 ? additionalCarrierCodes : undefined,
      };

      const result = await createCommercialQuoteAction(input);

      if (result.success) {
        toast.success('Preventivo creato con successo');
        // Reset form
        setProspectCompany('');
        setProspectContactName('');
        setProspectEmail('');
        setProspectPhone('');
        setProspectSector('');
        setProspectVolume('');
        setProspectNotes('');
        setSelectedCourier('');
        setMarginPercent('20');
        setValidityDays('30');
        setDeliveryMode('carrier_pickup');
        setPickupFee('');
        setGoodsNeedsProcessing(false);
        setProcessingFee('');
        setAdditionalCarriers([]);
        onQuoteCreated?.();
      } else {
        toast.error(result.error || 'Errore creazione preventivo');
      }
    } catch (error: any) {
      console.error('Errore:', error);
      toast.error('Errore imprevisto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prospect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Dati Prospect
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="prospect-company">Azienda *</Label>
            <Input
              id="prospect-company"
              value={prospectCompany}
              onChange={(e) => setProspectCompany(e.target.value)}
              placeholder="Es. Azienda Esempio SRL"
              required
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prospect-contact">Referente</Label>
              <Input
                id="prospect-contact"
                value={prospectContactName}
                onChange={(e) => setProspectContactName(e.target.value)}
                placeholder="Mario Rossi"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="prospect-phone">Telefono</Label>
              <Input
                id="prospect-phone"
                value={prospectPhone}
                onChange={(e) => setProspectPhone(e.target.value)}
                placeholder="+39 333 1234567"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prospect-email">Email</Label>
            <Input
              id="prospect-email"
              type="email"
              value={prospectEmail}
              onChange={(e) => setProspectEmail(e.target.value)}
              placeholder="info@azienda.it"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prospect-sector">Settore</Label>
              <Select
                id="prospect-sector"
                value={prospectSector}
                onChange={(e) => setProspectSector(e.target.value)}
                className="mt-1"
              >
                <option value="">Seleziona settore</option>
                {PROSPECT_SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="prospect-volume">Vol. mensile stimato</Label>
              <Input
                id="prospect-volume"
                type="number"
                min="1"
                value={prospectVolume}
                onChange={(e) => setProspectVolume(e.target.value)}
                placeholder="Es. 100"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="prospect-notes">Note</Label>
            <textarea
              id="prospect-notes"
              value={prospectNotes}
              onChange={(e) => setProspectNotes(e.target.value)}
              placeholder="Note aggiuntive sul prospect..."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configurazione offerta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Configurazione Offerta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="courier">Corriere *</Label>
            <Select
              id="courier"
              value={selectedCourier}
              onChange={(e) => setSelectedCourier(e.target.value)}
              required
              className="mt-1"
              disabled={loadingCouriers}
            >
              <option value="">{loadingCouriers ? 'Caricamento...' : 'Seleziona corriere'}</option>
              {filteredCouriers.map((c) => (
                <option key={c.contractCode} value={c.contractCode}>
                  {c.courierName}
                </option>
              ))}
            </Select>
            {deliveryMode === 'carrier_pickup' && excludedCount > 0 && (
              <p className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {excludedCount} corriere/i esclusi (non fanno ritiro dal cliente)
              </p>
            )}
            {deliveryMode === 'carrier_pickup' &&
              filteredCouriers.length === 0 &&
              couriers.length > 0 && (
                <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  Nessun corriere fa ritiro dal cliente. Cambia modalit&agrave; o configura il flag
                  nelle impostazioni listino.
                </p>
              )}
          </div>

          {/* Corrieri aggiuntivi per confronto multi-corriere */}
          {selectedCourier && filteredCouriers.length > 1 && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Confronto corrieri (opzionale)</Label>
                {availableForComparison.length > 0 && additionalCarriers.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAdditionalCarriers((prev) => [
                        ...prev,
                        { contractCode: '', marginPercent: marginPercent },
                      ])
                    }
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
              {additionalCarriers.map((ac, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500 w-6 flex-shrink-0">
                    {String.fromCharCode(66 + idx)}
                  </span>
                  <Select
                    value={ac.contractCode}
                    onChange={(e) => {
                      const updated = [...additionalCarriers];
                      updated[idx] = { ...updated[idx], contractCode: e.target.value };
                      setAdditionalCarriers(updated);
                    }}
                    className="flex-1 text-sm"
                  >
                    <option value="">Seleziona corriere</option>
                    {filteredCouriers
                      .filter(
                        (c) =>
                          c.contractCode !== selectedCourier &&
                          !additionalCarriers.some(
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
                    onChange={(e) => {
                      const updated = [...additionalCarriers];
                      updated[idx] = { ...updated[idx], marginPercent: e.target.value };
                      setAdditionalCarriers(updated);
                    }}
                    placeholder="Margine %"
                    className="w-24 text-sm"
                    aria-label={`Margine corriere alternativo ${String.fromCharCode(66 + idx)}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAdditionalCarriers((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    aria-label={`Rimuovi corriere alternativo ${String.fromCharCode(66 + idx)}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="margin">Margine %</Label>
              <Input
                id="margin"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="validity">Validit\u00E0 (giorni)</Label>
              <Input
                id="validity"
                type="number"
                min="1"
                max="180"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="vat-mode">IVA</Label>
              <Select
                id="vat-mode"
                value={vatMode}
                onChange={(e) => setVatMode(e.target.value as 'included' | 'excluded')}
                className="mt-1"
              >
                <option value="excluded">Esclusa</option>
                <option value="included">Inclusa</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logistica Ritiro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-4 w-4" />
            Logistica Ritiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="delivery-mode">Modalit&agrave; ritiro *</Label>
            <Select
              id="delivery-mode"
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
              className="mt-1"
            >
              {DELIVERY_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              {DELIVERY_MODES.find((m) => m.value === deliveryMode)?.description}
            </p>
          </div>

          {deliveryMode !== 'client_dropoff' && (
            <div>
              <Label htmlFor="pickup-fee">Supplemento ritiro (opzionale)</Label>
              <div className="relative mt-1">
                <Input
                  id="pickup-fee"
                  type="number"
                  min="0"
                  step="0.50"
                  value={pickupFee}
                  onChange={(e) => setPickupFee(e.target.value)}
                  placeholder="Gratuito"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  &euro;
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Lascia vuoto per ritiro gratuito. Il supplemento apparir&agrave; nel PDF.
              </p>
            </div>
          )}

          {/* Lavorazione merce - solo per own_fleet e client_dropoff */}
          {deliveryMode !== 'carrier_pickup' && (
            <>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2">
                  <input
                    id="goods-processing"
                    type="checkbox"
                    checked={goodsNeedsProcessing}
                    onChange={(e) => setGoodsNeedsProcessing(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
                    aria-label="Merce da lavorare"
                  />
                  <Label htmlFor="goods-processing" className="cursor-pointer">
                    Merce da lavorare (etichettatura, imballaggio)
                  </Label>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Attiva se i pacchi richiedono lavorazione da parte dei nostri operatori.
                </p>
              </div>

              {goodsNeedsProcessing && (
                <div>
                  <Label htmlFor="processing-fee">
                    Costo lavorazione per spedizione (opzionale)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="processing-fee"
                      type="number"
                      min="0"
                      step="0.50"
                      value={processingFee}
                      onChange={(e) => setProcessingFee(e.target.value)}
                      placeholder="Incluso"
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                      &euro;
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Lascia vuoto se il costo &egrave; incluso nel servizio. Apparir&agrave; nel PDF
                    come clausola.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Button
        type="submit"
        disabled={isLoading || !prospectCompany || !selectedCourier}
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generazione in corso...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Genera Preventivo
          </>
        )}
      </Button>
    </form>
  );
}
