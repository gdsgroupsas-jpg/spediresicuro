/**
 * Pricing Worker
 * 
 * Worker che calcola i preventivi usando il pricing-engine legacy.
 * Input: Dati spedizione grezzi o parziali da shipment_details
 * Output: Lista preventivi standardizzata o richiesta di chiarimenti
 */

import { AgentState } from '../orchestrator/state';
import { calculateOptimalPrice, PricingRequest } from '@/lib/ai/pricing-engine';
import { defaultLogger, type ILogger } from '../logger';

/**
 * Valida se abbiamo abbastanza dati per calcolare un preventivo
 */
function hasMinimumDataForPricing(details: AgentState['shipment_details']): {
  valid: boolean;
  missingFields: string[];
} {
  const missing: string[] = [];
  
  if (!details?.weight || details.weight <= 0) {
    missing.push('peso');
  }
  
  if (!details?.destinationZip || details.destinationZip.length !== 5) {
    missing.push('CAP destinazione');
  }
  
  if (!details?.destinationProvince || details.destinationProvince.length !== 2) {
    missing.push('provincia destinazione');
  }
  
  return {
    valid: missing.length === 0,
    missingFields: missing,
  };
}

/**
 * Estrae dati spedizione dal messaggio utente (base, poi miglioreremo con LLM)
 * Per ora assume che i dati siano già estratti e presenti in shipment_details
 */
function extractPricingDataFromState(state: AgentState): PricingRequest | null {
  const details = state.shipment_details;
  
  if (!details) {
    return null;
  }
  
  const validation = hasMinimumDataForPricing(details);
  if (!validation.valid) {
    return null;
  }
  
  return {
    weight: details.weight!,
    destinationZip: details.destinationZip!,
    destinationProvince: details.destinationProvince!,
    serviceType: details.serviceType,
    cashOnDelivery: details.cashOnDelivery,
    declaredValue: details.declaredValue,
    insurance: details.insurance,
  };
}

/**
 * Pricing Worker Node
 * 
 * Calcola i preventivi usando il pricing-engine esistente.
 * Se mancano dati, restituisce una richiesta di chiarimento.
 */
export async function pricingWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('🔄 [Pricing Worker] Esecuzione...');
  
  try {
    // Estrai dati per il preventivo
    const pricingRequest = extractPricingDataFromState(state);
    
    if (!pricingRequest) {
      const details = state.shipment_details;
      const validation = hasMinimumDataForPricing(details);
      
      return {
        clarification_request: `Per calcolare un preventivo preciso, ho bisogno di: ${validation.missingFields.join(', ')}. Puoi fornirmi questi dati?`,
        next_step: 'END', // Termina con clarification_request popolato
        processingStatus: 'error',
      };
    }
    
    // Chiama il pricing-engine legacy
    logger.log('💰 [Pricing Worker] Calcolo preventivo con:', pricingRequest);
    const pricingOptions = await calculateOptimalPrice(pricingRequest);
    
    if (pricingOptions.length === 0) {
      return {
        clarification_request: 'Non sono riuscito a calcolare preventivi per questa destinazione. Verifica che il CAP e la provincia siano corretti.',
        next_step: 'END', // Termina con clarification_request popolato
        processingStatus: 'error',
      };
    }
    
    logger.log(`✅ [Pricing Worker] Trovati ${pricingOptions.length} preventivi`);
    
    // Restituisci i preventivi e indica che il supervisor deve decidere il prossimo step
    return {
      pricing_options: pricingOptions,
      next_step: 'END', // Il supervisor deciderà se servono più iterazioni
      processingStatus: 'complete',
    };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Pricing Worker] Errore:', errorMessage);
    return {
      clarification_request: `Errore nel calcolo preventivo: ${errorMessage}. Riprova o contatta il supporto.`,
      next_step: 'END', // Termina con clarification_request popolato
      processingStatus: 'error',
      validationErrors: [...(state.validationErrors || []), errorMessage],
    };
  }
}

