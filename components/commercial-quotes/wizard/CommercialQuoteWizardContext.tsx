'use client';

/**
 * Context per il wizard del preventivatore commerciale.
 *
 * Pattern: segue ShipmentWizardContext (Context + useState + useCallback + useMemo)
 * 5 step: prospect -> carrier -> offerta -> servizi -> riepilogo
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { DeliveryMode, QuoteClause, PriceMatrixSnapshot } from '@/types/commercial-quotes';
import type { AccessoryServiceConfig } from '@/types/supplier-price-list-config';

// ============================================
// TYPES
// ============================================

export type QuoteWizardStep = 'prospect' | 'carrier' | 'offerta' | 'servizi' | 'riepilogo';

export interface ProspectData {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  sector: string;
  estimatedVolume: string;
  notes: string;
}

export interface CarrierSelection {
  contractCode: string;
  carrierCode: string;
  carrierName: string;
  priceListId: string;
}

export interface QuoteCarrierData {
  primaryCarrier: CarrierSelection | null;
  additionalCarriers: Array<{ contractCode: string; marginPercent: string }>;
}

export interface OffertaData {
  marginPercent: string;
  marginFixedEur: string;
  validityDays: string;
  vatMode: 'included' | 'excluded';
  deliveryMode: DeliveryMode;
  pickupFee: string;
  goodsNeedsProcessing: boolean;
  processingFee: string;
  volumetricDivisor: string;
}

export interface AccessoryService {
  id: string;
  service: string;
  enabled: boolean;
  price: number;
  percent: number;
}

export interface ServiziCondizioniData {
  accessoryServices: AccessoryService[];
  storageNotes: string;
  codNotes: string;
  insuranceNotes: string;
  customClauses: QuoteClause[];
}

export interface StepValidation {
  isValid: boolean;
  errors: string[];
}

// ============================================
// INITIAL STATE
// ============================================

const initialProspect: ProspectData = {
  company: '',
  contactName: '',
  email: '',
  phone: '',
  sector: '',
  estimatedVolume: '',
  notes: '',
};

const initialCarrier: QuoteCarrierData = {
  primaryCarrier: null,
  additionalCarriers: [],
};

const initialOfferta: OffertaData = {
  marginPercent: '20',
  marginFixedEur: '',
  validityDays: '30',
  vatMode: 'excluded',
  deliveryMode: 'carrier_pickup',
  pickupFee: '',
  goodsNeedsProcessing: false,
  processingFee: '',
  volumetricDivisor: '5000',
};

const initialServiziCondizioni: ServiziCondizioniData = {
  accessoryServices: [],
  storageNotes: '',
  codNotes: '',
  insuranceNotes: '',
  customClauses: [],
};

// ============================================
// STEP ORDER
// ============================================

export const QUOTE_STEP_ORDER: QuoteWizardStep[] = [
  'prospect',
  'carrier',
  'offerta',
  'servizi',
  'riepilogo',
];

// ============================================
// CONTEXT
// ============================================

interface QuoteWizardContextValue {
  // Data
  prospect: ProspectData;
  carrier: QuoteCarrierData;
  offerta: OffertaData;
  serviziCondizioni: ServiziCondizioniData;

  // Step navigation
  currentStep: QuoteWizardStep;
  setCurrentStep: (step: QuoteWizardStep) => void;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;

  // Data setters
  setProspect: (data: Partial<ProspectData>) => void;
  setCarrier: (data: Partial<QuoteCarrierData>) => void;
  setOfferta: (data: Partial<OffertaData>) => void;
  setServiziCondizioni: (data: Partial<ServiziCondizioniData>) => void;

  // Servizi accessori helpers
  loadAccessoryServices: (services: AccessoryServiceConfig[]) => void;
  toggleAccessoryService: (serviceId: string) => void;

  // Clausole custom helpers
  addCustomClause: () => void;
  removeCustomClause: (index: number) => void;
  updateCustomClause: (index: number, data: Partial<QuoteClause>) => void;

  // Validation
  validateStep: (step: QuoteWizardStep) => StepValidation;
  isStepComplete: (step: QuoteWizardStep) => boolean;
  getCompletionPercentage: () => number;

  // Matrix preview (anteprima editabile nello step Offerta)
  matrixPreview: PriceMatrixSnapshot | null;
  setMatrixPreview: (matrix: PriceMatrixSnapshot | null) => void;
  matrixOverrides: number[][] | null;
  setMatrixOverrides: (overrides: number[][] | null) => void;
  overriddenCells: Set<string>;
  setOverriddenCells: (cells: Set<string>) => void;
  isLoadingMatrix: boolean;
  setIsLoadingMatrix: (value: boolean) => void;

  // Actions
  resetWizard: () => void;

  // Submission
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  submitError: string | null;
  setSubmitError: (error: string | null) => void;
}

const QuoteWizardContext = createContext<QuoteWizardContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export function QuoteWizardProvider({ children }: { children: React.ReactNode }) {
  const [prospect, setProspectState] = useState<ProspectData>(initialProspect);
  const [carrier, setCarrierState] = useState<QuoteCarrierData>(initialCarrier);
  const [offerta, setOffertaState] = useState<OffertaData>(initialOfferta);
  const [serviziCondizioni, setServiziCondizioniState] =
    useState<ServiziCondizioniData>(initialServiziCondizioni);
  const [currentStep, setCurrentStep] = useState<QuoteWizardStep>('prospect');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [matrixPreview, setMatrixPreview] = useState<PriceMatrixSnapshot | null>(null);
  const [matrixOverrides, setMatrixOverrides] = useState<number[][] | null>(null);
  const [overriddenCells, setOverriddenCells] = useState<Set<string>>(new Set());
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);

  // ---- Data Setters ----

  const setProspect = useCallback((updates: Partial<ProspectData>) => {
    setProspectState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setCarrier = useCallback((updates: Partial<QuoteCarrierData>) => {
    setCarrierState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setOfferta = useCallback((updates: Partial<OffertaData>) => {
    setOffertaState((prev) => ({ ...prev, ...updates }));
  }, []);

  const setServiziCondizioni = useCallback((updates: Partial<ServiziCondizioniData>) => {
    setServiziCondizioniState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ---- Servizi Accessori ----

  const loadAccessoryServices = useCallback((services: AccessoryServiceConfig[]) => {
    setServiziCondizioniState((prev) => ({
      ...prev,
      accessoryServices: services.map((s, i) => ({
        id: `svc-${i}`,
        service: s.service,
        enabled: false,
        price: s.price,
        percent: s.percent,
      })),
    }));
  }, []);

  const toggleAccessoryService = useCallback((serviceId: string) => {
    setServiziCondizioniState((prev) => ({
      ...prev,
      accessoryServices: prev.accessoryServices.map((s) =>
        s.id === serviceId ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  }, []);

  // ---- Clausole Custom ----

  const addCustomClause = useCallback(() => {
    setServiziCondizioniState((prev) => ({
      ...prev,
      customClauses: [...prev.customClauses, { title: '', text: '', type: 'custom' as const }],
    }));
  }, []);

  const removeCustomClause = useCallback((index: number) => {
    setServiziCondizioniState((prev) => ({
      ...prev,
      customClauses: prev.customClauses.filter((_, i) => i !== index),
    }));
  }, []);

  const updateCustomClause = useCallback((index: number, data: Partial<QuoteClause>) => {
    setServiziCondizioniState((prev) => ({
      ...prev,
      customClauses: prev.customClauses.map((c, i) => (i === index ? { ...c, ...data } : c)),
    }));
  }, []);

  // ---- Validation ----

  const validateStep = useCallback(
    (step: QuoteWizardStep): StepValidation => {
      const errors: string[] = [];

      switch (step) {
        case 'prospect':
          if (!prospect.company || prospect.company.trim().length < 2) {
            errors.push('Nome azienda deve avere almeno 2 caratteri');
          }
          if (prospect.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prospect.email)) {
            errors.push('Email non valida');
          }
          break;

        case 'carrier':
          if (!carrier.primaryCarrier) {
            errors.push('Seleziona un corriere primario');
          }
          if (carrier.additionalCarriers.length > 3) {
            errors.push('Massimo 3 corrieri alternativi');
          }
          break;

        case 'offerta': {
          const margin = parseFloat(offerta.marginPercent);
          if (isNaN(margin) || margin < 0 || margin > 100) {
            errors.push('Margine deve essere tra 0 e 100');
          }
          if (offerta.marginFixedEur) {
            const fixedEur = parseFloat(offerta.marginFixedEur);
            if (isNaN(fixedEur) || fixedEur < 0) {
              errors.push('Margine fisso deve essere >= 0');
            }
          }
          const validity = parseInt(offerta.validityDays);
          if (isNaN(validity) || validity < 1 || validity > 180) {
            errors.push("Validita' deve essere tra 1 e 180 giorni");
          }
          break;
        }

        case 'servizi':
          // Clausole custom: titolo + testo entrambi presenti
          serviziCondizioni.customClauses.forEach((c, i) => {
            if (c.title && !c.text) {
              errors.push(`Clausola ${i + 1}: testo obbligatorio`);
            }
            if (!c.title && c.text) {
              errors.push(`Clausola ${i + 1}: titolo obbligatorio`);
            }
          });
          break;

        case 'riepilogo': {
          // Valida tutti gli step precedenti
          const prevSteps: QuoteWizardStep[] = ['prospect', 'carrier', 'offerta', 'servizi'];
          for (const s of prevSteps) {
            const v = validateStep(s);
            errors.push(...v.errors);
          }
          break;
        }
      }

      return { isValid: errors.length === 0, errors };
    },
    [prospect, carrier, offerta, serviziCondizioni]
  );

  const isStepComplete = useCallback(
    (step: QuoteWizardStep): boolean => {
      return validateStep(step).isValid;
    },
    [validateStep]
  );

  const getCompletionPercentage = useCallback((): number => {
    const steps: QuoteWizardStep[] = ['prospect', 'carrier', 'offerta', 'servizi'];
    const completed = steps.filter((s) => isStepComplete(s)).length;
    return Math.round((completed / steps.length) * 100);
  }, [isStepComplete]);

  // ---- Navigation ----

  const currentStepIndex = QUOTE_STEP_ORDER.indexOf(currentStep);
  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < QUOTE_STEP_ORDER.length - 1 && isStepComplete(currentStep);

  const goToNextStep = useCallback(() => {
    const idx = QUOTE_STEP_ORDER.indexOf(currentStep);
    if (idx < QUOTE_STEP_ORDER.length - 1) {
      setCurrentStep(QUOTE_STEP_ORDER[idx + 1]);
    }
  }, [currentStep]);

  const goToPrevStep = useCallback(() => {
    const idx = QUOTE_STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(QUOTE_STEP_ORDER[idx - 1]);
    }
  }, [currentStep]);

  // ---- Actions ----

  const resetWizard = useCallback(() => {
    setProspectState(initialProspect);
    setCarrierState(initialCarrier);
    setOffertaState(initialOfferta);
    setServiziCondizioniState(initialServiziCondizioni);
    setCurrentStep('prospect');
    setIsSubmitting(false);
    setSubmitError(null);
    setMatrixPreview(null);
    setMatrixOverrides(null);
    setOverriddenCells(new Set());
    setIsLoadingMatrix(false);
  }, []);

  // ---- Context Value ----

  const value = useMemo<QuoteWizardContextValue>(
    () => ({
      prospect,
      carrier,
      offerta,
      serviziCondizioni,
      currentStep,
      setCurrentStep,
      goToNextStep,
      goToPrevStep,
      canGoNext,
      canGoPrev,
      setProspect,
      setCarrier,
      setOfferta,
      setServiziCondizioni,
      loadAccessoryServices,
      toggleAccessoryService,
      addCustomClause,
      removeCustomClause,
      updateCustomClause,
      validateStep,
      isStepComplete,
      getCompletionPercentage,
      matrixPreview,
      setMatrixPreview,
      matrixOverrides,
      setMatrixOverrides,
      overriddenCells,
      setOverriddenCells,
      isLoadingMatrix,
      setIsLoadingMatrix,
      resetWizard,
      isSubmitting,
      setIsSubmitting,
      submitError,
      setSubmitError,
    }),
    [
      prospect,
      carrier,
      offerta,
      serviziCondizioni,
      currentStep,
      goToNextStep,
      goToPrevStep,
      canGoNext,
      canGoPrev,
      setProspect,
      setCarrier,
      setOfferta,
      setServiziCondizioni,
      loadAccessoryServices,
      toggleAccessoryService,
      addCustomClause,
      removeCustomClause,
      updateCustomClause,
      validateStep,
      isStepComplete,
      getCompletionPercentage,
      matrixPreview,
      matrixOverrides,
      overriddenCells,
      isLoadingMatrix,
      resetWizard,
      isSubmitting,
      submitError,
    ]
  );

  return <QuoteWizardContext.Provider value={value}>{children}</QuoteWizardContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useQuoteWizard() {
  const context = useContext(QuoteWizardContext);
  if (!context) {
    throw new Error('useQuoteWizard deve essere usato dentro QuoteWizardProvider');
  }
  return context;
}
