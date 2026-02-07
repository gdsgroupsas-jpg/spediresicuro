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
import { PROSPECT_SECTORS } from '@/types/commercial-quotes';
import type { CreateCommercialQuoteInput } from '@/types/commercial-quotes';
import { getAvailableCouriersForUserAction } from '@/actions/price-lists';
import { createCommercialQuoteAction } from '@/actions/commercial-quotes';
import { Building2, Loader2, Send, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CourierOption {
  courierId: string;
  courierName: string;
  contractCode: string;
  carrierCode: string;
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

  // Carica corrieri disponibili
  useEffect(() => {
    async function loadCouriers() {
      try {
        const result = await getAvailableCouriersForUserAction();
        if (result.success && result.couriers) {
          setCouriers(
            result.couriers.map((c: any) => ({
              courierId: c.courierId,
              courierName: c.courierName || c.displayName,
              contractCode: c.contractCode || c.carrierCode,
              carrierCode: c.carrierCode || c.contractCode,
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
              placeholder="Es. SELFIE SRL"
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
              {couriers.map((c) => (
                <option key={c.contractCode} value={c.contractCode}>
                  {c.courierName}
                </option>
              ))}
            </Select>
          </div>

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
