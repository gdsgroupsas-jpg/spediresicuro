'use client';

/**
 * Orchestratore wizard preventivatore commerciale.
 *
 * Provider + Progress + Step corrente + Navigation.
 * Submit: mappa wizard data -> CreateCommercialQuoteInput -> createCommercialQuoteAction.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { createCommercialQuoteAction } from '@/actions/commercial-quotes';
import { getDefaultClauses, mergeWithCustomClauses } from '@/lib/commercial-quotes/clauses';
import type { CreateCommercialQuoteInput } from '@/types/commercial-quotes';
import {
  QuoteWizardProvider,
  useQuoteWizard,
  type AccessoryService,
} from './CommercialQuoteWizardContext';
import { QuoteWizardProgress } from './components/QuoteWizardProgress';
import { QuoteStepNavigation } from './components/QuoteStepNavigation';
import { ProspectStep } from './steps/ProspectStep';
import { CarrierStep } from './steps/CarrierStep';
import { OffertaStep } from './steps/OffertaStep';
import { ServiziCondizioniStep } from './steps/ServiziCondizioniStep';
import { RiepilogoStep } from './steps/RiepilogoStep';

interface CommercialQuoteWizardProps {
  onSuccess?: () => void;
}

// Formatta servizi abilitati + note per prospect_notes
function formatServicesForNotes(
  originalNotes: string,
  enabledServices: AccessoryService[],
  storageNotes: string,
  codNotes: string,
  insuranceNotes: string
): string {
  const parts: string[] = [];

  if (originalNotes.trim()) {
    parts.push(originalNotes.trim());
  }

  if (enabledServices.length > 0) {
    parts.push('\n**Servizi Accessori:**');
    for (const s of enabledServices) {
      const priceStr = s.price > 0 ? `\u20AC${s.price.toFixed(2)}` : '';
      const pctStr = s.percent > 0 ? `${s.percent}%` : '';
      const costStr = [priceStr, pctStr].filter(Boolean).join(' + ');
      parts.push(`- ${s.service}${costStr ? ` (${costStr})` : ''}`);
    }
  }

  if (storageNotes.trim()) {
    parts.push(`\n**Note Giacenze:** ${storageNotes.trim()}`);
  }
  if (codNotes.trim()) {
    parts.push(`\n**Note Contrassegno:** ${codNotes.trim()}`);
  }
  if (insuranceNotes.trim()) {
    parts.push(`\n**Note Assicurazione:** ${insuranceNotes.trim()}`);
  }

  return parts.join('\n');
}

function WizardInner({ onSuccess }: CommercialQuoteWizardProps) {
  const {
    currentStep,
    prospect,
    carrier,
    offerta,
    serviziCondizioni,
    validateStep,
    setIsSubmitting,
    setSubmitError,
    resetWizard,
  } = useQuoteWizard();

  const handleSubmit = useCallback(async () => {
    // Valida riepilogo (tutti gli step)
    const validation = validateStep('riepilogo');
    if (!validation.isValid) {
      toast.error(validation.errors[0] || 'Compila tutti i campi obbligatori');
      return;
    }

    if (!carrier.primaryCarrier) {
      toast.error('Seleziona un corriere primario');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Servizi abilitati
      const enabledServices = serviziCondizioni.accessoryServices.filter((s) => s.enabled);

      // Formatta prospect_notes con servizi e note aggiuntive
      const prospectNotes = formatServicesForNotes(
        prospect.notes,
        enabledServices,
        serviziCondizioni.storageNotes,
        serviziCondizioni.codNotes,
        serviziCondizioni.insuranceNotes
      );

      // Genera clausole (standard + custom)
      const volDivisor = offerta.volumetricDivisor ? parseInt(offerta.volumetricDivisor) : 5000;
      const defaultClauses = getDefaultClauses(offerta.vatMode, 22, {
        deliveryMode: offerta.deliveryMode,
        pickupFee: offerta.pickupFee ? parseFloat(offerta.pickupFee) : null,
        goodsNeedsProcessing: offerta.goodsNeedsProcessing,
        processingFee: offerta.processingFee ? parseFloat(offerta.processingFee) : null,
        volumetricDivisor: volDivisor,
      });
      const allClauses = mergeWithCustomClauses(
        defaultClauses,
        serviziCondizioni.customClauses.filter((c) => c.title && c.text)
      );

      // Corrieri aggiuntivi
      const additionalCarrierCodes = carrier.additionalCarriers
        .filter((ac) => ac.contractCode)
        .map((ac) => ({
          carrier_code: ac.contractCode.split('-')[0] || ac.contractCode,
          contract_code: ac.contractCode,
          margin_percent: ac.marginPercent ? parseFloat(ac.marginPercent) : undefined,
        }));

      const input: CreateCommercialQuoteInput = {
        prospect_company: prospect.company,
        prospect_contact_name: prospect.contactName || undefined,
        prospect_email: prospect.email || undefined,
        prospect_phone: prospect.phone || undefined,
        prospect_sector: prospect.sector || undefined,
        prospect_estimated_volume: prospect.estimatedVolume
          ? parseInt(prospect.estimatedVolume)
          : undefined,
        prospect_notes: prospectNotes || undefined,
        carrier_code: carrier.primaryCarrier.carrierCode,
        contract_code: carrier.primaryCarrier.contractCode,
        price_list_id: carrier.primaryCarrier.priceListId,
        margin_percent: parseFloat(offerta.marginPercent) || 20,
        validity_days: parseInt(offerta.validityDays) || 30,
        vat_mode: offerta.vatMode,
        delivery_mode: offerta.deliveryMode,
        pickup_fee: offerta.pickupFee ? parseFloat(offerta.pickupFee) : undefined,
        goods_needs_processing: offerta.goodsNeedsProcessing,
        processing_fee: offerta.processingFee ? parseFloat(offerta.processingFee) : undefined,
        volumetric_divisor: volDivisor !== 5000 ? volDivisor : undefined,
        clauses: allClauses,
        additional_carrier_codes:
          additionalCarrierCodes.length > 0 ? additionalCarrierCodes : undefined,
      };

      const result = await createCommercialQuoteAction(input);

      if (result.success) {
        toast.success('Preventivo creato con successo');
        resetWizard();
        onSuccess?.();
      } else {
        setSubmitError(result.error || 'Errore creazione preventivo');
        toast.error(result.error || 'Errore creazione preventivo');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Errore imprevisto';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    prospect,
    carrier,
    offerta,
    serviziCondizioni,
    validateStep,
    setIsSubmitting,
    setSubmitError,
    resetWizard,
    onSuccess,
  ]);

  // Render step corrente
  const renderStep = () => {
    switch (currentStep) {
      case 'prospect':
        return <ProspectStep />;
      case 'carrier':
        return <CarrierStep />;
      case 'offerta':
        return <OffertaStep />;
      case 'servizi':
        return <ServiziCondizioniStep />;
      case 'riepilogo':
        return <RiepilogoStep />;
    }
  };

  return (
    <div className="space-y-6">
      <QuoteWizardProgress />

      <Card>
        <CardContent className="pt-6">{renderStep()}</CardContent>
      </Card>

      <QuoteStepNavigation onSubmit={handleSubmit} />
    </div>
  );
}

export function CommercialQuoteWizard({ onSuccess }: CommercialQuoteWizardProps) {
  return (
    <QuoteWizardProvider>
      <WizardInner onSuccess={onSuccess} />
    </QuoteWizardProvider>
  );
}
