/**
 * Test: Commercial Quote Wizard Context
 *
 * Verifica state management, validazione, navigazione,
 * servizi accessori e clausole custom del wizard preventivatore.
 *
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  QuoteWizardProvider,
  useQuoteWizard,
  QUOTE_STEP_ORDER,
} from '@/components/commercial-quotes/wizard/CommercialQuoteWizardContext';
import type { AccessoryServiceConfig } from '@/types/supplier-price-list-config';

// Wrapper per renderHook
function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QuoteWizardProvider, null, children);
}

describe('QuoteWizardContext', () => {
  // ---- Inizializzazione ----

  it('dovrebbe inizializzarsi con step "prospect"', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.currentStep).toBe('prospect');
  });

  it('dovrebbe avere 5 step in ordine', () => {
    expect(QUOTE_STEP_ORDER).toEqual(['prospect', 'carrier', 'offerta', 'servizi', 'riepilogo']);
  });

  it('dovrebbe avere prospect data iniziale vuota', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.prospect.company).toBe('');
    expect(result.current.prospect.email).toBe('');
  });

  it('dovrebbe avere carrier data iniziale null', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.carrier.primaryCarrier).toBeNull();
    expect(result.current.carrier.additionalCarriers).toHaveLength(0);
  });

  it('dovrebbe avere offerta con margine 20%, validita 30gg e divisore 5000', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.offerta.marginPercent).toBe('20');
    expect(result.current.offerta.validityDays).toBe('30');
    expect(result.current.offerta.vatMode).toBe('excluded');
    expect(result.current.offerta.volumetricDivisor).toBe('5000');
  });

  // ---- Data Setters ----

  it('dovrebbe aggiornare prospect con setProspect', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setProspect({ company: 'SELFIE SRL', email: 'info@selfie.it' });
    });
    expect(result.current.prospect.company).toBe('SELFIE SRL');
    expect(result.current.prospect.email).toBe('info@selfie.it');
  });

  it('dovrebbe aggiornare carrier con setCarrier', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setCarrier({
        primaryCarrier: {
          contractCode: 'gls-GLS-5000',
          carrierCode: 'gls',
          carrierName: 'GLS',
          priceListId: 'pl-123',
        },
      });
    });
    expect(result.current.carrier.primaryCarrier?.carrierName).toBe('GLS');
  });

  it('dovrebbe aggiornare offerta con setOfferta', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setOfferta({ marginPercent: '25', deliveryMode: 'own_fleet' });
    });
    expect(result.current.offerta.marginPercent).toBe('25');
    expect(result.current.offerta.deliveryMode).toBe('own_fleet');
  });

  it('dovrebbe aggiornare divisore volumetrico', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setOfferta({ volumetricDivisor: '6000' });
    });
    expect(result.current.offerta.volumetricDivisor).toBe('6000');
  });

  // ---- Validazione ----

  it('prospect NON valido senza company', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    const v = result.current.validateStep('prospect');
    expect(v.isValid).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });

  it('prospect valido con company >= 2 chars', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setProspect({ company: 'AB' });
    });
    const v = result.current.validateStep('prospect');
    expect(v.isValid).toBe(true);
  });

  it('prospect invalido con email malformata', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setProspect({ company: 'Test SRL', email: 'not-an-email' });
    });
    const v = result.current.validateStep('prospect');
    expect(v.isValid).toBe(false);
  });

  it('carrier NON valido senza primaryCarrier', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    const v = result.current.validateStep('carrier');
    expect(v.isValid).toBe(false);
  });

  it('carrier valido con primaryCarrier', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setCarrier({
        primaryCarrier: {
          contractCode: 'gls-GLS-5000',
          carrierCode: 'gls',
          carrierName: 'GLS',
          priceListId: 'pl-123',
        },
      });
    });
    const v = result.current.validateStep('carrier');
    expect(v.isValid).toBe(true);
  });

  it('offerta invalida con margine > 100', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setOfferta({ marginPercent: '150' });
    });
    const v = result.current.validateStep('offerta');
    expect(v.isValid).toBe(false);
  });

  it('offerta invalida con validita > 180', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setOfferta({ validityDays: '200' });
    });
    const v = result.current.validateStep('offerta');
    expect(v.isValid).toBe(false);
  });

  it('offerta valida con margine e validita corretti', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    // Default: 20% e 30gg sono validi
    const v = result.current.validateStep('offerta');
    expect(v.isValid).toBe(true);
  });

  it('servizi invalido con clausola custom incompleta', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.addCustomClause();
      result.current.updateCustomClause(0, { title: 'Titolo' });
    });
    const v = result.current.validateStep('servizi');
    expect(v.isValid).toBe(false);
  });

  it('servizi valido senza clausole custom', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    const v = result.current.validateStep('servizi');
    expect(v.isValid).toBe(true);
  });

  // ---- Navigazione ----

  it('non puo andare indietro dal primo step', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.canGoPrev).toBe(false);
  });

  it('puo avanzare se step corrente valido', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setProspect({ company: 'Test SRL' });
    });
    expect(result.current.canGoNext).toBe(true);
  });

  it('non puo avanzare se step corrente non valido', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    // Prospect vuoto
    expect(result.current.canGoNext).toBe(false);
  });

  it('goToNextStep avanza allo step successivo', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setProspect({ company: 'Test SRL' });
    });
    act(() => {
      result.current.goToNextStep();
    });
    expect(result.current.currentStep).toBe('carrier');
  });

  it('goToPrevStep torna allo step precedente', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setCurrentStep('carrier');
    });
    act(() => {
      result.current.goToPrevStep();
    });
    expect(result.current.currentStep).toBe('prospect');
  });

  // ---- Servizi Accessori ----

  it('loadAccessoryServices carica servizi con enabled=false', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    const services: AccessoryServiceConfig[] = [
      { service: 'Preavviso Telefonico', price: 0.61, percent: 0 },
      { service: 'Saturday Service', price: 122.0, percent: 0 },
    ];
    act(() => {
      result.current.loadAccessoryServices(services);
    });
    expect(result.current.serviziCondizioni.accessoryServices).toHaveLength(2);
    expect(result.current.serviziCondizioni.accessoryServices[0].enabled).toBe(false);
    expect(result.current.serviziCondizioni.accessoryServices[0].service).toBe(
      'Preavviso Telefonico'
    );
  });

  it('toggleAccessoryService abilita/disabilita servizio', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.loadAccessoryServices([{ service: 'Test', price: 1.0, percent: 0 }]);
    });
    const svcId = result.current.serviziCondizioni.accessoryServices[0].id;

    act(() => {
      result.current.toggleAccessoryService(svcId);
    });
    expect(result.current.serviziCondizioni.accessoryServices[0].enabled).toBe(true);

    act(() => {
      result.current.toggleAccessoryService(svcId);
    });
    expect(result.current.serviziCondizioni.accessoryServices[0].enabled).toBe(false);
  });

  // ---- Clausole Custom ----

  it('addCustomClause aggiunge clausola vuota', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.addCustomClause();
    });
    expect(result.current.serviziCondizioni.customClauses).toHaveLength(1);
    expect(result.current.serviziCondizioni.customClauses[0].type).toBe('custom');
  });

  it('removeCustomClause rimuove clausola per indice', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.addCustomClause();
      result.current.addCustomClause();
    });
    expect(result.current.serviziCondizioni.customClauses).toHaveLength(2);

    act(() => {
      result.current.removeCustomClause(0);
    });
    expect(result.current.serviziCondizioni.customClauses).toHaveLength(1);
  });

  it('updateCustomClause aggiorna clausola', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.addCustomClause();
    });
    act(() => {
      result.current.updateCustomClause(0, {
        title: 'Pagamento',
        text: '30 giorni data fattura',
      });
    });
    expect(result.current.serviziCondizioni.customClauses[0].title).toBe('Pagamento');
    expect(result.current.serviziCondizioni.customClauses[0].text).toBe('30 giorni data fattura');
  });

  // ---- Completion e Reset ----

  it('getCompletionPercentage calcola correttamente', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    // All'inizio: prospect invalido, carrier invalido, offerta valida (default), servizi valido
    // => 2 su 4 = 50%
    expect(result.current.getCompletionPercentage()).toBe(50);

    act(() => {
      result.current.setProspect({ company: 'Test SRL' });
    });
    // Ora: prospect valido, carrier invalido, offerta valida, servizi valido
    // => 3 su 4 = 75%
    expect(result.current.getCompletionPercentage()).toBe(75);
  });

  it('resetWizard riporta tutto allo stato iniziale', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setProspect({ company: 'Test SRL' });
      result.current.setCurrentStep('offerta');
      result.current.setIsSubmitting(true);
    });
    act(() => {
      result.current.resetWizard();
    });
    expect(result.current.currentStep).toBe('prospect');
    expect(result.current.prospect.company).toBe('');
    expect(result.current.isSubmitting).toBe(false);
  });

  // ---- Submission state ----

  it('dovrebbe gestire isSubmitting e submitError', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });

    act(() => {
      result.current.setIsSubmitting(true);
    });
    expect(result.current.isSubmitting).toBe(true);

    act(() => {
      result.current.setSubmitError('Errore test');
    });
    expect(result.current.submitError).toBe('Errore test');
  });

  // ---- setServiziCondizioni ----

  it('dovrebbe aggiornare note informative', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setServiziCondizioni({
        storageNotes: 'Riconsegna: 5 EUR',
        codNotes: 'COD fino a 500 EUR',
        insuranceNotes: 'Assicurazione max 3000 EUR',
      });
    });
    expect(result.current.serviziCondizioni.storageNotes).toBe('Riconsegna: 5 EUR');
    expect(result.current.serviziCondizioni.codNotes).toBe('COD fino a 500 EUR');
    expect(result.current.serviziCondizioni.insuranceNotes).toBe('Assicurazione max 3000 EUR');
  });

  // ---- Margine fisso EUR ----

  it('marginFixedEur vuoto inizialmente', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.offerta.marginFixedEur).toBe('');
  });

  it('setOfferta con marginFixedEur', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setOfferta({ marginFixedEur: '2.50' });
    });
    expect(result.current.offerta.marginFixedEur).toBe('2.50');
  });

  it('offerta invalida con marginFixedEur negativo', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    act(() => {
      result.current.setOfferta({ marginFixedEur: '-1' });
    });
    const v = result.current.validateStep('offerta');
    expect(v.isValid).toBe(false);
    expect(v.errors.some((e: string) => e.includes('Margine fisso'))).toBe(true);
  });

  it('offerta valida con marginFixedEur vuoto', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    // Default: marginFixedEur '' non genera errore
    const v = result.current.validateStep('offerta');
    expect(v.isValid).toBe(true);
  });

  // ---- Matrix Preview State ----

  it('matrixPreview null inizialmente', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.matrixPreview).toBeNull();
  });

  it('overriddenCells Set iniziale vuoto', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.overriddenCells.size).toBe(0);
  });

  it('resetWizard resetta matrixPreview e overrides', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    // Simula stato con matrice caricata
    act(() => {
      result.current.setMatrixPreview({
        zones: ['Italia'],
        weight_ranges: [{ from: 0, to: 5, label: '0 - 5 kg' }],
        prices: [[6.0]],
        services_included: [],
        carrier_display_name: 'GLS',
        vat_mode: 'excluded',
        vat_rate: 22,
        pickup_fee: null,
        delivery_mode: 'carrier_pickup',
        goods_needs_processing: false,
        processing_fee: null,
        generated_at: new Date().toISOString(),
      });
      result.current.setMatrixOverrides([[6.0]]);
      result.current.setOverriddenCells(new Set(['0-0']));
    });
    expect(result.current.matrixPreview).not.toBeNull();
    expect(result.current.overriddenCells.size).toBe(1);

    act(() => {
      result.current.resetWizard();
    });
    expect(result.current.matrixPreview).toBeNull();
    expect(result.current.matrixOverrides).toBeNull();
    expect(result.current.overriddenCells.size).toBe(0);
  });

  it('isLoadingMatrix false inizialmente', () => {
    const { result } = renderHook(() => useQuoteWizard(), { wrapper });
    expect(result.current.isLoadingMatrix).toBe(false);
  });
});
