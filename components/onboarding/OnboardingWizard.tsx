'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  X,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { WizardProvider, useWizard } from './WizardContext';
import { OnboardingWizardProps, OnboardingFormData, AssignablePriceList } from './types';
import {
  StepTipoCliente,
  StepAnagrafica,
  StepIndirizzo,
  StepAzienda,
  StepBancari,
  StepDocumento,
  StepListino,
  StepRiepilogo,
} from './steps';

function WizardContent({
  onComplete,
  onCancel,
  availablePriceLists,
  onLoadPriceLists,
}: {
  onComplete?: (
    data: OnboardingFormData & {
      clientId?: string;
      generatedPassword?: string;
      priceListId?: string;
    }
  ) => void;
  onCancel?: () => void;
  availablePriceLists?: AssignablePriceList[];
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
}) {
  const {
    currentStep,
    activeSteps,
    currentStepData,
    progress,
    canGoNext,
    canGoPrev,
    isLastStep,
    isFirstStep,
    nextStep,
    prevStep,
    goToStep,
    validateCurrentStep,
    formData,
    isSubmitting,
    setSubmitting,
    mode,
    targetUserId,
    clientEmail,
    selectedPriceListId,
    errors,
    setError,
    clearError,
  } = useWizard();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleNext = () => {
    // In reseller mode, validate email on first step
    if (mode === 'reseller' && currentStep === 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!clientEmail.trim()) {
        setError('clientEmail', 'Email del cliente obbligatoria');
        return;
      }
      if (!emailRegex.test(clientEmail)) {
        setError('clientEmail', 'Email non valida');
        return;
      }
      clearError('clientEmail');
    }

    if (validateCurrentStep()) {
      nextStep();
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Prepare data for API
      const payload: Record<string, any> = {
        nome: formData.anagrafica.nome,
        cognome: formData.anagrafica.cognome,
        codiceFiscale: formData.anagrafica.codiceFiscale,
        dataNascita: formData.anagrafica.dataNascita || undefined,
        luogoNascita: formData.anagrafica.luogoNascita || undefined,
        sesso: formData.anagrafica.sesso || undefined,
        telefono: formData.anagrafica.telefono,
        cellulare: formData.anagrafica.cellulare || undefined,
        indirizzo: formData.indirizzo.indirizzo,
        citta: formData.indirizzo.citta,
        provincia: formData.indirizzo.provincia,
        cap: formData.indirizzo.cap,
        nazione: formData.indirizzo.nazione,
        tipoCliente: formData.tipoCliente,
        ragioneSociale: formData.azienda.ragioneSociale || undefined,
        partitaIva: formData.azienda.partitaIva || undefined,
        codiceSDI: formData.azienda.codiceSDI || undefined,
        pec: formData.azienda.pec || undefined,
        indirizzoFatturazione: formData.azienda.indirizzoFatturazione || undefined,
        cittaFatturazione: formData.azienda.cittaFatturazione || undefined,
        provinciaFatturazione: formData.azienda.provinciaFatturazione || undefined,
        capFatturazione: formData.azienda.capFatturazione || undefined,
        iban: formData.bancari.iban || undefined,
        banca: formData.bancari.banca || undefined,
        nomeIntestatario: formData.bancari.nomeIntestatario || undefined,
        documentoIdentita: formData.documento.tipoDocumento
          ? {
              tipo: formData.documento.tipoDocumento,
              numero: formData.documento.numeroDocumento,
              rilasciatoDa: formData.documento.rilasciatoDa,
              dataRilascio: formData.documento.dataRilascio,
              dataScadenza: formData.documento.dataScadenza || undefined,
            }
          : undefined,
      };

      // Add email for reseller mode (creating new client)
      if (mode === 'reseller') {
        payload.email = clientEmail;
        // ✨ Aggiungi listino selezionato per creazione atomica
        if (selectedPriceListId) {
          payload.priceListId = selectedPriceListId;
        }
      }

      // Choose API endpoint based on mode
      let endpoint: string;
      if (mode === 'admin' && targetUserId) {
        endpoint = `/api/admin/users/${targetUserId}/dati-cliente`;
      } else if (mode === 'reseller') {
        endpoint = '/api/reseller/clients';
      } else {
        endpoint = '/api/user/dati-cliente';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il salvataggio');
      }

      setSubmitSuccess(true);

      // Store generated password if returned (reseller mode)
      if (data.generatedPassword) {
        setGeneratedPassword(data.generatedPassword);
      }

      // Call onComplete callback with additional data
      if (onComplete) {
        onComplete({
          ...formData,
          clientId: data.client?.id,
          generatedPassword: data.generatedPassword,
          priceListId: selectedPriceListId || undefined,
        });
      }

      // If self-service mode, redirect to dashboard
      if (mode === 'self') {
        setTimeout(() => {
          window.location.href = '/dashboard?saved=true';
        }, 1500);
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Errore durante il salvataggio');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  // Render current step
  const renderStep = () => {
    switch (currentStepData.id) {
      case 'tipo-cliente':
        return <StepTipoCliente />;
      case 'anagrafica':
        return <StepAnagrafica />;
      case 'indirizzo':
        return <StepIndirizzo />;
      case 'azienda':
        return <StepAzienda />;
      case 'bancari':
        return <StepBancari />;
      case 'documento':
        return <StepDocumento />;
      case 'listino':
        return (
          <StepListino
            availablePriceLists={availablePriceLists}
            onLoadPriceLists={onLoadPriceLists}
          />
        );
      case 'riepilogo':
        return <StepRiepilogo />;
      default:
        return null;
    }
  };

  if (submitSuccess) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">
          {mode === 'reseller' ? 'Cliente creato con successo!' : 'Dati salvati con successo!'}
        </h2>
        <p className="text-gray-400 mb-4">
          {mode === 'self'
            ? 'Reindirizzamento alla dashboard...'
            : mode === 'reseller'
              ? 'Il cliente può ora accedere con le credenziali fornite.'
              : 'Puoi chiudere questa finestra.'}
        </p>

        {/* Show generated password in reseller mode */}
        {mode === 'reseller' && generatedPassword && (
          <div className="mt-6 p-4 bg-gray-700/50 rounded-xl border border-gray-600 max-w-md mx-auto">
            <p className="text-sm text-gray-400 mb-2">Credenziali di accesso:</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-lg">
                <span className="text-gray-300 text-sm">Email:</span>
                <span className="text-gray-100 font-mono text-sm">{clientEmail}</span>
              </div>
              <div className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-lg">
                <span className="text-gray-300 text-sm">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#FACC15] font-mono text-sm">{generatedPassword}</span>
                  <button
                    onClick={copyPassword}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Copia password"
                  >
                    {copiedPassword ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-amber-400 mt-3">
              Salva queste credenziali! La password non sarà più visibile.
            </p>
          </div>
        )}

        {/* Close button for admin/reseller modes */}
        {(mode === 'admin' || mode === 'reseller') && onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-xl transition-colors"
          >
            Chiudi
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-400">
            Passaggio {currentStep + 1} di {activeSteps.length}
          </span>
          <span className="text-sm font-medium text-[#FACC15]">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FACC15] to-[#FBBF24] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {activeSteps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => index < currentStep && goToStep(index)}
            disabled={index > currentStep}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all
              ${
                index === currentStep
                  ? 'bg-[#FACC15] text-black font-semibold'
                  : index < currentStep
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 cursor-pointer'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {index < currentStep ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4 text-center">{index + 1}</span>
            )}
            <span className="hidden sm:inline">{step.title}</span>
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto">{renderStep()}</div>

      {/* Error Message */}
      {submitError && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <X className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{submitError}</p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
        <div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              Annulla
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {!isFirstStep && (
            <button
              type="button"
              onClick={prevStep}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-xl transition-all disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
              Indietro
            </button>
          )}

          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#FACC15] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#F59E0B] text-black font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Conferma e Salva
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 bg-[#FACC15] hover:bg-[#FBBF24] text-black font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              Avanti
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function OnboardingWizard({
  mode,
  targetUserId,
  targetUserEmail,
  initialData,
  availablePriceLists,
  onLoadPriceLists,
  onComplete,
  onCancel,
}: OnboardingWizardProps) {
  return (
    <WizardProvider
      mode={mode}
      targetUserId={targetUserId}
      targetUserEmail={targetUserEmail}
      initialData={initialData}
    >
      <WizardContent
        onComplete={onComplete}
        onCancel={onCancel}
        availablePriceLists={availablePriceLists}
        onLoadPriceLists={onLoadPriceLists}
      />
    </WizardProvider>
  );
}
