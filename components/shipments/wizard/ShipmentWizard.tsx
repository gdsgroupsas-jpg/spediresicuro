'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { ShipmentWizardProvider, useShipmentWizard } from './ShipmentWizardContext';
import { WizardProgress } from './components/WizardProgress';
import { StepNavigation } from './components/StepNavigation';
import { SenderStep } from './steps/SenderStep';
import { RecipientStep } from './steps/RecipientStep';
import { PackagesStep } from './steps/PackagesStep';
import { ServicesStep } from './steps/ServicesStep';
import { PickupStep } from './steps/PickupStep';
import { CarrierStep } from './steps/CarrierStep';
import { ConfirmStep } from './steps/ConfirmStep';

interface ShipmentWizardProps {
  onSuccess?: (shipmentId: string) => void;
  onCancel?: () => void;
}

// Normalizza il carrier code per l'API (es. POSTEDELIVERYBUSINESS -> POSTE)
function normalizeCarrierCode(carrierCode: string | undefined): string {
  if (!carrierCode) return 'GLS';
  const code = carrierCode.toUpperCase();
  // Mappa codici estesi ai codici base accettati dall'API
  if (code.includes('POSTE') || code.includes('CRONO')) return 'POSTE';
  if (code.includes('GLS')) return 'GLS';
  if (code.includes('BRT') || code.includes('BARTOLINI')) return 'BRT';
  if (code.includes('UPS')) return 'UPS';
  if (code.includes('DHL')) return 'DHL';
  if (code.includes('SDA')) return 'SDA';
  if (code.includes('TNT')) return 'TNT';
  if (code.includes('FEDEX')) return 'FEDEX';
  // Fallback: usa i primi 3-4 caratteri
  return code.substring(0, 4);
}

function WizardContent({ onSuccess, onCancel }: ShipmentWizardProps) {
  const { data, currentStep, isStepComplete } = useShipmentWizard();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Render the current step
  const renderStep = () => {
    switch (currentStep) {
      case 'sender':
        return <SenderStep />;
      case 'recipient':
        return <RecipientStep />;
      case 'packages':
        return <PackagesStep />;
      case 'services':
        return <ServicesStep />;
      case 'pickup':
        return <PickupStep />;
      case 'carrier':
        return <CarrierStep />;
      case 'confirm':
        return <ConfirmStep />;
      default:
        return <SenderStep />;
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Verifica completamento di tutti gli step
    const allComplete =
      isStepComplete('sender') &&
      isStepComplete('recipient') &&
      isStepComplete('packages') &&
      isStepComplete('services') &&
      isStepComplete('pickup') &&
      isStepComplete('carrier');

    if (!allComplete) {
      toast.error('Completa tutti i campi obbligatori prima di procedere');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepara il payload per l'API (converte nomi italiani → inglesi)
      const payload = {
        // Mittente
        sender: {
          name: data.mittente.nome,
          company: data.mittente.company,
          address: data.mittente.indirizzo,
          city: data.mittente.citta,
          postalCode: data.mittente.cap,
          province: data.mittente.provincia,
          country: 'IT',
          phone: data.mittente.telefono,
          email: data.mittente.email,
        },
        // Destinatario
        recipient: {
          name: data.destinatario.nome,
          company: data.destinatario.company,
          address: data.destinatario.indirizzo,
          city: data.destinatario.citta,
          postalCode: data.destinatario.cap,
          province: data.destinatario.provincia,
          country: 'IT',
          phone: data.destinatario.telefono,
          email: data.destinatario.email,
        },
        // Colli
        packages: data.packages.map((pkg) => ({
          weight: pkg.peso,
          length: pkg.lunghezza,
          width: pkg.larghezza,
          height: pkg.altezza,
        })),
        // Servizi (formato legacy per retrocompatibilità)
        contrassegnoAmount: data.services.contrassegnoEnabled
          ? data.services.contrassegnoAmount
          : undefined,
        note: data.services.note || undefined,
        // Assicurazione (se supportata dall'API)
        insurance: data.services.assicurazioneEnabled
          ? { value: data.services.assicurazioneValue }
          : undefined,
        // Ritiro (parametri per Spedisci.online API)
        pickup: data.pickup.requestPickup
          ? {
              pickup_from_address: '1',
              pickup_date: data.pickup.pickupDate,
              pickup_time: data.pickup.pickupTime,
            }
          : undefined,
        // Corriere selezionato (normalizzato per API)
        carrier: normalizeCarrierCode(data.carrier?.carrierCode),
        provider: 'spediscionline',
        configId: data.carrier?.configId,
        final_price: data.carrier?.finalPrice,
        base_price: data.carrier?.supplierPrice,
        vat_mode: data.carrier?.vatMode,
        vat_rate: data.carrier?.vatRate,
      };

      // Chiamata API per creare la spedizione
      const response = await fetch('/api/shipments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nella creazione della spedizione');
      }

      // Download automatico etichetta PDF se disponibile
      const labelData = result.shipment?.label_data;
      if (labelData) {
        try {
          // labelData può essere base64 o URL
          if (labelData.startsWith('http')) {
            // È un URL, apri in nuova tab
            window.open(labelData, '_blank');
          } else {
            // È base64, crea blob e scarica
            const byteCharacters = atob(labelData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `etichetta-${result.shipment?.tracking_number || result.ldv || 'spedizione'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        } catch (downloadError) {
          console.warn('Errore download etichetta:', downloadError);
          // Non bloccare il flusso, mostra solo warning
        }
      }

      toast.success(
        <div>
          <p className="font-semibold">Spedizione creata con successo!</p>
          <p className="text-sm mt-1">
            LDV: {result.shipment?.tracking_number || result.ldv || result.shipmentId}
          </p>
          {labelData && (
            <p className="text-xs text-green-600 mt-1">Etichetta scaricata automaticamente</p>
          )}
        </div>
      );

      // Callback di successo
      onSuccess?.(result.shipment?.id || result.shipmentId || result.ldv);
    } catch (error: any) {
      console.error('Errore creazione spedizione:', error);
      toast.error(error.message || 'Errore imprevisto. Riprova.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Progress Indicator */}
      <div className="flex-shrink-0 mb-6">
        <WizardProgress />
      </div>

      {/* Step Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex-shrink-0 mt-6 pt-4 border-t border-gray-200">
        {isSubmitting ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-3" />
            <span className="text-gray-600">Creazione spedizione in corso...</span>
          </div>
        ) : (
          <StepNavigation onSubmit={handleSubmit} />
        )}
      </div>
    </div>
  );
}

export function ShipmentWizard({ onSuccess, onCancel }: ShipmentWizardProps) {
  return (
    <ShipmentWizardProvider>
      <WizardContent onSuccess={onSuccess} onCancel={onCancel} />
    </ShipmentWizardProvider>
  );
}

export default ShipmentWizard;
