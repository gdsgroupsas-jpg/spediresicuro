'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ============================================
// TYPES
// ============================================

export interface AddressData {
  nome: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  telefono: string;
  email: string;
  company?: string;
}

export interface PackageData {
  id: string;
  peso: number;
  lunghezza: number;
  larghezza: number;
  altezza: number;
  contenuto?: string;
}

export interface ServicesData {
  contrassegnoEnabled: boolean;
  contrassegnoAmount: number;
  assicurazioneEnabled: boolean;
  assicurazioneValue: number;
  serviziAccessori: string[];
  note: string;
}

export interface PickupData {
  requestPickup: boolean;
  pickupDate: string; // DD/MM/YYYY
  pickupTime: 'AM' | 'PM' | '';
}

export interface CarrierData {
  carrierCode: string;
  contractCode: string;
  displayName: string;
  configId?: string;
  finalPrice?: number;
  supplierPrice?: number;
  vatMode?: 'included' | 'excluded';
  vatRate?: number;
}

export interface ShipmentWizardData {
  mittente: AddressData;
  destinatario: AddressData;
  packages: PackageData[];
  services: ServicesData;
  pickup: PickupData;
  carrier: CarrierData | null;
}

export type WizardStep =
  | 'sender'
  | 'recipient'
  | 'packages'
  | 'services'
  | 'pickup'
  | 'carrier'
  | 'confirm';

export interface StepValidation {
  isValid: boolean;
  errors: string[];
}

// ============================================
// INITIAL STATE
// ============================================

const initialAddressData: AddressData = {
  nome: '',
  indirizzo: '',
  citta: '',
  provincia: '',
  cap: '',
  telefono: '',
  email: '',
  company: '',
};

const initialPackage: PackageData = {
  id: crypto.randomUUID(),
  peso: 1,
  lunghezza: 20,
  larghezza: 20,
  altezza: 10,
  contenuto: '',
};

const initialServicesData: ServicesData = {
  contrassegnoEnabled: false,
  contrassegnoAmount: 0,
  assicurazioneEnabled: false,
  assicurazioneValue: 0,
  serviziAccessori: [],
  note: '',
};

const initialPickupData: PickupData = {
  requestPickup: false,
  pickupDate: '',
  pickupTime: '',
};

const initialWizardData: ShipmentWizardData = {
  mittente: initialAddressData,
  destinatario: initialAddressData,
  packages: [initialPackage],
  services: initialServicesData,
  pickup: initialPickupData,
  carrier: null,
};

// ============================================
// CONTEXT
// ============================================

interface ShipmentWizardContextValue {
  // Data
  data: ShipmentWizardData;

  // Step navigation
  currentStep: WizardStep;
  setCurrentStep: (step: WizardStep) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;

  // Data setters
  setMittente: (data: Partial<AddressData>) => void;
  setDestinatario: (data: Partial<AddressData>) => void;
  setPackages: (packages: PackageData[]) => void;
  addPackage: () => void;
  removePackage: (id: string) => void;
  updatePackage: (id: string, data: Partial<PackageData>) => void;
  setServices: (data: Partial<ServicesData>) => void;
  setPickup: (data: Partial<PickupData>) => void;
  setCarrier: (carrier: CarrierData | null) => void;

  // Validation
  validateStep: (step: WizardStep) => StepValidation;
  isStepComplete: (step: WizardStep) => boolean;
  getCompletionPercentage: () => number;

  // Actions
  resetWizard: () => void;
  loadDefaultSender: (sender: Partial<AddressData>) => void;

  // Submission
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  submitError: string | null;
  setSubmitError: (error: string | null) => void;
}

const ShipmentWizardContext = createContext<ShipmentWizardContextValue | null>(null);

// ============================================
// STEP ORDER
// ============================================

const STEP_ORDER: WizardStep[] = [
  'sender',
  'recipient',
  'packages',
  'services',
  'pickup',
  'carrier',
  'confirm',
];

// ============================================
// PROVIDER
// ============================================

export function ShipmentWizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<ShipmentWizardData>(initialWizardData);
  const [currentStep, setCurrentStep] = useState<WizardStep>('sender');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Data Setters ----

  const setMittente = useCallback((updates: Partial<AddressData>) => {
    setData((prev) => ({
      ...prev,
      mittente: { ...prev.mittente, ...updates },
    }));
  }, []);

  const setDestinatario = useCallback((updates: Partial<AddressData>) => {
    setData((prev) => ({
      ...prev,
      destinatario: { ...prev.destinatario, ...updates },
    }));
  }, []);

  const setPackages = useCallback((packages: PackageData[]) => {
    setData((prev) => ({ ...prev, packages }));
  }, []);

  const addPackage = useCallback(() => {
    const newPackage: PackageData = {
      id: crypto.randomUUID(),
      peso: 1,
      lunghezza: 20,
      larghezza: 20,
      altezza: 10,
      contenuto: '',
    };
    setData((prev) => ({
      ...prev,
      packages: [...prev.packages, newPackage],
    }));
  }, []);

  const removePackage = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      packages: prev.packages.filter((p) => p.id !== id),
    }));
  }, []);

  const updatePackage = useCallback((id: string, updates: Partial<PackageData>) => {
    setData((prev) => ({
      ...prev,
      packages: prev.packages.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  }, []);

  const setServices = useCallback((updates: Partial<ServicesData>) => {
    setData((prev) => ({
      ...prev,
      services: { ...prev.services, ...updates },
    }));
  }, []);

  const setPickup = useCallback((updates: Partial<PickupData>) => {
    setData((prev) => ({
      ...prev,
      pickup: { ...prev.pickup, ...updates },
    }));
  }, []);

  const setCarrier = useCallback((carrier: CarrierData | null) => {
    setData((prev) => ({ ...prev, carrier }));
  }, []);

  // ---- Validation ----

  const validateAddress = useCallback((address: AddressData, isRecipient = false): string[] => {
    const errors: string[] = [];

    if (!address.nome || address.nome.length < 2) {
      errors.push('Nome deve avere almeno 2 caratteri');
    }
    if (!address.indirizzo || address.indirizzo.length < 5) {
      errors.push('Indirizzo deve avere almeno 5 caratteri');
    }
    if (!address.citta) {
      errors.push('Città obbligatoria');
    }
    if (!address.provincia || address.provincia.length !== 2) {
      errors.push('Provincia deve essere di 2 caratteri (es. MI)');
    }
    if (!address.cap || !/^\d{5}$/.test(address.cap)) {
      errors.push('CAP deve essere di 5 cifre');
    }
    if (!address.telefono || address.telefono.length < 8) {
      errors.push('Telefono deve avere almeno 8 caratteri');
    }
    // Email opzionale per destinatario, ma se presente deve essere valida
    if (address.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      errors.push('Email non valida');
    }

    return errors;
  }, []);

  const validateStep = useCallback(
    (step: WizardStep): StepValidation => {
      let errors: string[] = [];

      switch (step) {
        case 'sender':
          errors = validateAddress(data.mittente);
          break;

        case 'recipient':
          errors = validateAddress(data.destinatario, true);
          break;

        case 'packages':
          if (data.packages.length === 0) {
            errors.push('Aggiungi almeno un collo');
          }
          data.packages.forEach((pkg, index) => {
            if (pkg.peso <= 0) {
              errors.push(`Collo ${index + 1}: peso deve essere maggiore di 0`);
            }
            if (pkg.lunghezza <= 0 || pkg.larghezza <= 0 || pkg.altezza <= 0) {
              errors.push(`Collo ${index + 1}: dimensioni devono essere maggiori di 0`);
            }
          });
          break;

        case 'services':
          if (data.services.contrassegnoEnabled && data.services.contrassegnoAmount <= 0) {
            errors.push('Importo contrassegno deve essere maggiore di 0');
          }
          if (data.services.contrassegnoEnabled && !data.destinatario.telefono) {
            errors.push('Telefono destinatario obbligatorio per contrassegno');
          }
          if (data.services.assicurazioneEnabled && data.services.assicurazioneValue <= 0) {
            errors.push('Valore assicurazione deve essere maggiore di 0');
          }
          break;

        case 'pickup':
          if (data.pickup.requestPickup) {
            if (!data.pickup.pickupDate) {
              errors.push('Data ritiro obbligatoria');
            }
            if (!data.pickup.pickupTime) {
              errors.push('Fascia oraria obbligatoria');
            }
          }
          break;

        case 'carrier':
          if (!data.carrier) {
            errors.push('Seleziona un corriere');
          }
          break;

        case 'confirm':
          // Validate all previous steps
          const allSteps: WizardStep[] = [
            'sender',
            'recipient',
            'packages',
            'services',
            'pickup',
            'carrier',
          ];
          allSteps.forEach((s) => {
            const stepValidation = validateStep(s);
            errors = [...errors, ...stepValidation.errors];
          });
          break;
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    },
    [data, validateAddress]
  );

  const isStepComplete = useCallback(
    (step: WizardStep): boolean => {
      return validateStep(step).isValid;
    },
    [validateStep]
  );

  const getCompletionPercentage = useCallback((): number => {
    const steps: WizardStep[] = ['sender', 'recipient', 'packages', 'services', 'carrier'];
    const completedSteps = steps.filter((step) => isStepComplete(step)).length;
    return Math.round((completedSteps / steps.length) * 100);
  }, [isStepComplete]);

  // ---- Navigation ----

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < STEP_ORDER.length - 1 && isStepComplete(currentStep);

  const goToNextStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      setCurrentStep(STEP_ORDER[currentIndex + 1]);
    }
  }, [currentStep]);

  const goToPrevStep = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEP_ORDER[currentIndex - 1]);
    }
  }, [currentStep]);

  // ---- Actions ----

  const resetWizard = useCallback(() => {
    setData(initialWizardData);
    setCurrentStep('sender');
    setIsSubmitting(false);
    setSubmitError(null);
  }, []);

  const loadDefaultSender = useCallback((sender: Partial<AddressData>) => {
    setData((prev) => ({
      ...prev,
      mittente: { ...prev.mittente, ...sender },
    }));
  }, []);

  // ---- Context Value ----

  const value = useMemo<ShipmentWizardContextValue>(
    () => ({
      data,
      currentStep,
      setCurrentStep,
      goToNextStep,
      goToPrevStep,
      canGoNext,
      canGoPrev,
      setMittente,
      setDestinatario,
      setPackages,
      addPackage,
      removePackage,
      updatePackage,
      setServices,
      setPickup,
      setCarrier,
      validateStep,
      isStepComplete,
      getCompletionPercentage,
      resetWizard,
      loadDefaultSender,
      isSubmitting,
      setIsSubmitting,
      submitError,
      setSubmitError,
    }),
    [
      data,
      currentStep,
      goToNextStep,
      goToPrevStep,
      canGoNext,
      canGoPrev,
      setMittente,
      setDestinatario,
      setPackages,
      addPackage,
      removePackage,
      updatePackage,
      setServices,
      setPickup,
      setCarrier,
      validateStep,
      isStepComplete,
      getCompletionPercentage,
      resetWizard,
      loadDefaultSender,
      isSubmitting,
      submitError,
    ]
  );

  return <ShipmentWizardContext.Provider value={value}>{children}</ShipmentWizardContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useShipmentWizard() {
  const context = useContext(ShipmentWizardContext);
  if (!context) {
    throw new Error('useShipmentWizard must be used within a ShipmentWizardProvider');
  }
  return context;
}

// ============================================
// EXPORTS
// ============================================

export { STEP_ORDER };
export type { ShipmentWizardContextValue };
