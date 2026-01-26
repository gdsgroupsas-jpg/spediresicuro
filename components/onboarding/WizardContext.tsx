'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { OnboardingFormData, EMPTY_FORM_DATA, WIZARD_STEPS, WizardStep, WizardMode } from './types';

interface WizardContextValue {
  // State
  currentStep: number;
  formData: OnboardingFormData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  mode: WizardMode;
  targetUserId?: string;
  targetUserEmail?: string;
  clientEmail: string;
  setClientEmail: (email: string) => void;
  /** ✨ Listino selezionato per assegnazione */
  selectedPriceListId: string | null;
  setSelectedPriceListId: (id: string | null) => void;

  // Computed
  steps: WizardStep[];
  activeSteps: WizardStep[];
  currentStepData: WizardStep;
  progress: number;
  canGoNext: boolean;
  canGoPrev: boolean;
  isLastStep: boolean;
  isFirstStep: boolean;

  // Actions
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  updateFormData: <K extends keyof OnboardingFormData>(
    section: K,
    data: Partial<OnboardingFormData[K]>
  ) => void;
  setTipoCliente: (tipo: 'persona' | 'azienda') => void;
  setError: (field: string, message: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  validateCurrentStep: () => boolean;
  setSubmitting: (value: boolean) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  children: ReactNode;
  mode: WizardMode;
  targetUserId?: string;
  targetUserEmail?: string;
  initialData?: Partial<OnboardingFormData>;
}

export function WizardProvider({
  children,
  mode,
  targetUserId,
  targetUserEmail,
  initialData,
}: WizardProviderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>(() => ({
    ...EMPTY_FORM_DATA,
    ...initialData,
    anagrafica: { ...EMPTY_FORM_DATA.anagrafica, ...initialData?.anagrafica },
    indirizzo: { ...EMPTY_FORM_DATA.indirizzo, ...initialData?.indirizzo },
    azienda: { ...EMPTY_FORM_DATA.azienda, ...initialData?.azienda },
    bancari: { ...EMPTY_FORM_DATA.bancari, ...initialData?.bancari },
    documento: { ...EMPTY_FORM_DATA.documento, ...initialData?.documento },
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientEmail, setClientEmailState] = useState(targetUserEmail || '');
  const [selectedPriceListId, setSelectedPriceListIdState] = useState<string | null>(null);

  const setClientEmail = useCallback((email: string) => {
    setClientEmailState(email);
  }, []);

  const setSelectedPriceListId = useCallback((id: string | null) => {
    setSelectedPriceListIdState(id);
  }, []);

  // Filter steps based on tipoCliente and mode
  const activeSteps = WIZARD_STEPS.filter((step) => {
    // Skip azienda step if not azienda
    if (step.isConditional && formData.tipoCliente !== 'azienda') {
      return false;
    }
    // ✨ Skip listino step if not admin/reseller mode
    if (step.isAdminOnly && mode === 'self') {
      return false;
    }
    return true;
  });

  const currentStepData = activeSteps[currentStep] || activeSteps[0];
  const progress = ((currentStep + 1) / activeSteps.length) * 100;
  const canGoNext = currentStep < activeSteps.length - 1;
  const canGoPrev = currentStep > 0;
  const isLastStep = currentStep === activeSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const nextStep = useCallback(() => {
    if (canGoNext) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [canGoNext]);

  const prevStep = useCallback(() => {
    if (canGoPrev) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [canGoPrev]);

  const goToStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < activeSteps.length) {
        setCurrentStep(step);
      }
    },
    [activeSteps.length]
  );

  const updateFormData = useCallback(
    <K extends keyof OnboardingFormData>(section: K, data: Partial<OnboardingFormData[K]>) => {
      setFormData((prev) => ({
        ...prev,
        [section]: typeof prev[section] === 'object' ? { ...prev[section], ...data } : data,
      }));
    },
    []
  );

  const setTipoCliente = useCallback((tipo: 'persona' | 'azienda') => {
    setFormData((prev) => ({ ...prev, tipoCliente: tipo }));
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const validateCurrentStep = useCallback((): boolean => {
    const stepId = currentStepData.id;
    const newErrors: Record<string, string> = {};

    switch (stepId) {
      case 'anagrafica': {
        const { nome, cognome, codiceFiscale, telefono } = formData.anagrafica;
        if (!nome.trim()) newErrors['anagrafica.nome'] = 'Il nome è obbligatorio';
        if (!cognome.trim()) newErrors['anagrafica.cognome'] = 'Il cognome è obbligatorio';
        if (!codiceFiscale.trim()) {
          newErrors['anagrafica.codiceFiscale'] = 'Il codice fiscale è obbligatorio';
        } else if (codiceFiscale.length !== 16) {
          newErrors['anagrafica.codiceFiscale'] = 'Il codice fiscale deve essere di 16 caratteri';
        }
        if (!telefono.trim()) newErrors['anagrafica.telefono'] = 'Il telefono è obbligatorio';
        break;
      }

      case 'indirizzo': {
        const { indirizzo, citta, provincia, cap } = formData.indirizzo;
        if (!indirizzo.trim()) newErrors['indirizzo.indirizzo'] = "L'indirizzo è obbligatorio";
        if (!citta.trim()) newErrors['indirizzo.citta'] = 'La città è obbligatoria';
        if (!provincia.trim()) newErrors['indirizzo.provincia'] = 'La provincia è obbligatoria';
        if (!cap.trim()) newErrors['indirizzo.cap'] = 'Il CAP è obbligatorio';
        break;
      }

      case 'azienda': {
        if (formData.tipoCliente === 'azienda') {
          const { ragioneSociale, partitaIva } = formData.azienda;
          if (!ragioneSociale.trim()) {
            newErrors['azienda.ragioneSociale'] = 'La ragione sociale è obbligatoria';
          }
          if (!partitaIva.trim()) {
            newErrors['azienda.partitaIva'] = 'La partita IVA è obbligatoria';
          } else if (partitaIva.length !== 11) {
            newErrors['azienda.partitaIva'] = 'La partita IVA deve essere di 11 caratteri';
          }
        }
        break;
      }

      // bancari e documento sono opzionali, nessuna validazione obbligatoria
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStepData.id, formData]);

  const setSubmitting = useCallback((value: boolean) => {
    setIsSubmitting(value);
  }, []);

  const value: WizardContextValue = {
    currentStep,
    formData,
    errors,
    isSubmitting,
    mode,
    targetUserId,
    targetUserEmail,
    clientEmail,
    setClientEmail,
    selectedPriceListId,
    setSelectedPriceListId,
    steps: WIZARD_STEPS,
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
    updateFormData,
    setTipoCliente,
    setError,
    clearError,
    clearAllErrors,
    validateCurrentStep,
    setSubmitting,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
