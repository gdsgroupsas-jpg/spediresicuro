'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  OnboardingFormData,
  EMPTY_FORM_DATA,
  WIZARD_STEPS,
  WizardStep,
  WizardMode,
  UserCreationType,
  ResellerFormData,
  EMPTY_RESELLER_FORM_DATA,
} from './types';

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
  /** Listino selezionato per assegnazione (backward compat) */
  selectedPriceListId: string | null;
  setSelectedPriceListId: (id: string | null) => void;
  /** Listini selezionati per assegnazione (multi-select) */
  selectedPriceListIds: string[];
  togglePriceListId: (id: string) => void;
  clearPriceListIds: () => void;
  /** Tipo utente da creare (solo superadmin) */
  userCreationType: UserCreationType;
  setUserCreationType: (type: UserCreationType) => void;
  /** Dati form reseller (solo superadmin) */
  resellerFormData: ResellerFormData;
  updateResellerFormData: (data: Partial<ResellerFormData>) => void;
  /** Reseller selezionato per assegnare cliente (solo superadmin) */
  selectedResellerId: string | null;
  setSelectedResellerId: (id: string | null) => void;

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
  const [selectedPriceListIds, setSelectedPriceListIds] = useState<string[]>([]);

  // Superadmin-specific state
  const [userCreationType, setUserCreationTypeState] = useState<UserCreationType>('cliente');
  const [resellerFormData, setResellerFormData] =
    useState<ResellerFormData>(EMPTY_RESELLER_FORM_DATA);
  const [selectedResellerId, setSelectedResellerIdState] = useState<string | null>(null);

  const setClientEmail = useCallback((email: string) => {
    setClientEmailState(email);
  }, []);

  const setSelectedPriceListId = useCallback((id: string | null) => {
    setSelectedPriceListIdState(id);
  }, []);

  const togglePriceListId = useCallback((id: string) => {
    setSelectedPriceListIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // Keep backward compat: first selected or null
      setSelectedPriceListIdState(next.length > 0 ? next[0] : null);
      return next;
    });
  }, []);

  const clearPriceListIds = useCallback(() => {
    setSelectedPriceListIds([]);
    setSelectedPriceListIdState(null);
  }, []);

  const setUserCreationType = useCallback((type: UserCreationType) => {
    setUserCreationTypeState(type);
    // Reset step quando cambia il tipo
    setCurrentStep(0);
  }, []);

  const updateResellerFormData = useCallback((data: Partial<ResellerFormData>) => {
    setResellerFormData((prev) => ({ ...prev, ...data }));
  }, []);

  const setSelectedResellerId = useCallback((id: string | null) => {
    setSelectedResellerIdState(id);
  }, []);

  // Filter steps based on tipoCliente, mode, and userCreationType
  const activeSteps = WIZARD_STEPS.filter((step) => {
    // === SUPERADMIN MODE ===
    if (mode === 'superadmin') {
      // Step selezione tipo utente: sempre visibile per superadmin
      if (step.id === 'selezione-tipo-utente') {
        return true;
      }

      // Se sta creando un RESELLER
      if (userCreationType === 'reseller') {
        // Mostra solo step per creazione reseller
        if (step.isResellerCreation === true) {
          // Skip step azienda se il reseller è persona fisica
          if (step.isConditional && resellerFormData.tipoCliente !== 'azienda') {
            return false;
          }
          return true;
        }
        return false;
      }

      // Se sta creando un CLIENTE
      if (userCreationType === 'cliente') {
        // Skip step reseller creation
        if (step.isResellerCreation) {
          return false;
        }
        // Mostra step selezione reseller (per assegnare cliente)
        if (step.id === 'selezione-reseller') {
          return true;
        }
        // Mostra step cliente
        if (step.isClienteCreation) {
          // Skip azienda se non è azienda
          if (step.isConditional && formData.tipoCliente !== 'azienda') {
            return false;
          }
          return true;
        }
        return false;
      }
    }

    // === RESELLER / ADMIN MODE ===
    if (mode === 'reseller' || mode === 'admin') {
      // Skip step superadmin-only
      if (step.isSuperadminOnly) {
        return false;
      }
      // Skip step reseller creation (solo superadmin può creare reseller)
      if (step.isResellerCreation) {
        return false;
      }
      // Mostra step cliente
      if (step.isClienteCreation || step.isAdminOnly) {
        // Skip azienda se non è azienda
        if (step.isConditional && formData.tipoCliente !== 'azienda') {
          return false;
        }
        return true;
      }
      return false;
    }

    // === SELF MODE ===
    // Skip step superadmin/admin only
    if (step.isSuperadminOnly || step.isAdminOnly || step.isResellerCreation) {
      return false;
    }
    // Skip selezione reseller (non serve per self)
    if (step.id === 'selezione-reseller') {
      return false;
    }
    // Skip azienda se non è azienda
    if (step.isConditional && formData.tipoCliente !== 'azienda') {
      return false;
    }
    // Mostra solo step cliente per self-onboarding
    return step.isClienteCreation === true;
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

      // === SUPERADMIN STEPS ===
      case 'selezione-tipo-utente': {
        // Sempre valido - basta che sia selezionato (default 'cliente')
        break;
      }

      // === RESELLER CREATION STEPS ===
      case 'reseller-account': {
        const { email, password } = resellerFormData;
        if (!email.trim()) {
          newErrors['reseller.email'] = "L'email è obbligatoria";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          newErrors['reseller.email'] = 'Email non valida';
        }
        if (!password.trim()) {
          newErrors['reseller.password'] = 'La password è obbligatoria';
        } else if (password.length < 8) {
          newErrors['reseller.password'] = 'La password deve avere almeno 8 caratteri';
        }
        break;
      }

      case 'reseller-tipo-cliente': {
        // Sempre valido - ha un default ('azienda')
        break;
      }

      case 'reseller-anagrafica': {
        const { nome, cognome, codiceFiscale, telefono } = resellerFormData.anagrafica;
        if (!nome.trim()) newErrors['reseller.anagrafica.nome'] = 'Il nome è obbligatorio';
        if (!cognome.trim()) newErrors['reseller.anagrafica.cognome'] = 'Il cognome è obbligatorio';
        if (!codiceFiscale.trim()) {
          newErrors['reseller.anagrafica.codiceFiscale'] = 'Il codice fiscale è obbligatorio';
        } else if (codiceFiscale.length !== 16) {
          newErrors['reseller.anagrafica.codiceFiscale'] =
            'Il codice fiscale deve essere di 16 caratteri';
        }
        if (!telefono.trim())
          newErrors['reseller.anagrafica.telefono'] = 'Il telefono è obbligatorio';
        break;
      }

      case 'reseller-indirizzo': {
        const { indirizzo, citta, provincia, cap } = resellerFormData.indirizzo;
        if (!indirizzo.trim())
          newErrors['reseller.indirizzo.indirizzo'] = "L'indirizzo è obbligatorio";
        if (!citta.trim()) newErrors['reseller.indirizzo.citta'] = 'La città è obbligatoria';
        if (!provincia.trim())
          newErrors['reseller.indirizzo.provincia'] = 'La provincia è obbligatoria';
        if (!cap.trim()) newErrors['reseller.indirizzo.cap'] = 'Il CAP è obbligatorio';
        break;
      }

      case 'reseller-azienda': {
        if (resellerFormData.tipoCliente === 'azienda') {
          const { ragioneSociale, partitaIva } = resellerFormData.azienda;
          if (!ragioneSociale.trim()) {
            newErrors['reseller.azienda.ragioneSociale'] = 'La ragione sociale è obbligatoria';
          }
          if (!partitaIva.trim()) {
            newErrors['reseller.azienda.partitaIva'] = 'La partita IVA è obbligatoria';
          } else if (partitaIva.length !== 11) {
            newErrors['reseller.azienda.partitaIva'] = 'La partita IVA deve essere di 11 caratteri';
          }
        }
        break;
      }

      case 'reseller-bancari': {
        // Opzionale, nessuna validazione obbligatoria
        break;
      }

      case 'reseller-credito': {
        // Il credito ha un default, sempre valido
        if (resellerFormData.initialCredit < 0) {
          newErrors['reseller.initialCredit'] = 'Il credito non può essere negativo';
        }
        break;
      }

      case 'reseller-riepilogo': {
        // Riepilogo, nessuna validazione
        break;
      }

      case 'selezione-reseller': {
        if (!selectedResellerId) {
          newErrors['selectedReseller'] = 'Seleziona un reseller a cui assegnare il cliente';
        }
        break;
      }

      // bancari e documento sono opzionali, nessuna validazione obbligatoria
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentStepData.id, formData, resellerFormData, selectedResellerId]);

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
    selectedPriceListIds,
    togglePriceListId,
    clearPriceListIds,
    // Superadmin-specific
    userCreationType,
    setUserCreationType,
    resellerFormData,
    updateResellerFormData,
    selectedResellerId,
    setSelectedResellerId,
    // Computed
    steps: WIZARD_STEPS,
    activeSteps,
    currentStepData,
    progress,
    canGoNext,
    canGoPrev,
    isLastStep,
    isFirstStep,
    // Actions
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
