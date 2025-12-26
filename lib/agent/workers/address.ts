/**
 * Address Worker (Sprint 2.3)
 * 
 * Worker che valida e normalizza indirizzi italiani.
 * Produce uno "shipmentDraft" coerente con campi mancanti identificati.
 * 
 * INPUT: AgentState + ultimo messaggio utente
 * OUTPUT:
 * - Aggiorna state.shipmentDraft (merge non distruttivo)
 * - Calcola missingFields
 * - Setta next_step = "pricing_worker" se pronto, altrimenti "END" con clarification
 * 
 * ⚠️ NO PII nei log (no addressLine1, fullName, etc.)
 */

import { AgentState } from '../orchestrator/state';
import { 
  ShipmentDraft, 
  calculateMissingFieldsForPricing,
  hasEnoughDataForPricing,
} from '@/lib/address/shipment-draft';
import { extractAndMerge, extractAddressDataFromText } from '@/lib/address/normalize-it-address';
import { defaultLogger, type ILogger } from '../logger';

// ==================== TIPI ====================

export interface AddressWorkerResult {
  shipmentDraft: ShipmentDraft;
  missingFields: string[];
  clarificationQuestion?: string;
  nextStep: 'pricing_worker' | 'END';
  addressNormalized: boolean;
}

// ==================== CLARIFICATION QUESTIONS ====================

/**
 * Genera domanda di chiarimento basata sui campi mancanti
 */
function generateClarificationQuestion(missingFields: string[]): string {
  const fieldLabels: Record<string, string> = {
    'recipient.postalCode': 'CAP',
    'recipient.province': 'provincia (es. MI, RM)',
    'recipient.city': 'città',
    'recipient.addressLine1': 'indirizzo (via/piazza)',
    'recipient.fullName': 'nome destinatario',
    'parcel.weightKg': 'peso del pacco in kg',
  };
  
  const missingLabels = missingFields
    .map(f => fieldLabels[f] || f)
    .filter(Boolean);
  
  if (missingLabels.length === 0) {
    return 'Per procedere con il preventivo, ho bisogno di qualche dato in più.';
  }
  
  if (missingLabels.length === 1) {
    return `Per calcolare il preventivo, mi serve ancora: **${missingLabels[0]}**.`;
  }
  
  if (missingLabels.length === 2) {
    return `Per il preventivo mi servono: **${missingLabels[0]}** e **${missingLabels[1]}**.`;
  }
  
  const lastLabel = missingLabels.pop();
  return `Per procedere ho bisogno di: **${missingLabels.join(', ')}** e **${lastLabel}**.`;
}

// ==================== CORE LOGIC (CONSOLIDATA) ====================

/**
 * Logica core condivisa per estrazione e decisione next step.
 * Elimina duplicazione tra versione async e sync.
 */
function processAddressCore(
  messageText: string,
  existingDraft?: ShipmentDraft
): {
  updatedDraft: ShipmentDraft;
  missingFields: string[];
  extractedAnything: boolean;
  readyForPricing: boolean;
} {
  const updatedDraft = extractAndMerge(messageText, existingDraft);
  const { extractedAnything } = extractAddressDataFromText(messageText);
  const missingFields = calculateMissingFieldsForPricing(updatedDraft);
  const readyForPricing = hasEnoughDataForPricing(updatedDraft);
  
  return {
    updatedDraft,
    missingFields,
    extractedAnything,
    readyForPricing,
  };
}

// ==================== MAIN WORKER ====================

/**
 * Address Worker
 * 
 * Estrae e normalizza dati indirizzo dal messaggio utente.
 * Merge con dati esistenti (non distruttivo).
 * Determina se procedere a pricing o chiedere chiarimenti.
 */
export async function addressWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('📍 [Address Worker] Esecuzione...');
  
  try {
    // Estrai ultimo messaggio utente
    const lastMessage = state.messages[state.messages.length - 1];
    const messageText = lastMessage && 'content' in lastMessage 
      ? String(lastMessage.content) 
      : '';
    
    if (!messageText.trim()) {
      logger.warn('⚠️ [Address Worker] Messaggio vuoto');
      return {
        clarification_request: 'Non ho ricevuto informazioni. Puoi indicarmi CAP, città e peso del pacco?',
        next_step: 'END',
      };
    }
    
    // Usa logica core condivisa
    const { updatedDraft, missingFields, extractedAnything } = processAddressCore(
      messageText,
      state.shipmentDraft
    );
    
    // Log telemetria (NO PII)
    logger.log(`📍 [Address Worker] Estratto: ${extractedAnything ? 'sì' : 'no'}, campi mancanti: ${updatedDraft.missingFields.length}`);
    
    // Decidi prossimo step usando logica core
    const readyForPricing = hasEnoughDataForPricing(updatedDraft);
    
    if (readyForPricing) {
      // Abbiamo abbastanza dati -> pricing worker
      logger.log('✅ [Address Worker] Dati sufficienti, routing a pricing_worker');
      
      // Sincronizza shipment_details per compatibilità con pricing worker
      return {
        shipmentDraft: updatedDraft,
        shipment_details: {
          weight: updatedDraft.parcel?.weightKg,
          destinationZip: updatedDraft.recipient?.postalCode,
          destinationProvince: updatedDraft.recipient?.province,
        },
        next_step: 'pricing_worker',
        processingStatus: 'calculating',
      };
    }
    
    // Mancano dati -> genera clarification
    const clarificationQuestion = generateClarificationQuestion(missingFields);
    logger.log(`⚠️ [Address Worker] Dati insufficienti, chiedo: ${missingFields.join(', ')}`);
    
    return {
      shipmentDraft: updatedDraft,
      clarification_request: clarificationQuestion,
      next_step: 'END',
      processingStatus: 'idle',
    };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Address Worker] Errore:', errorMessage);
    return {
      clarification_request: 'Mi dispiace, non sono riuscita a elaborare i dati. Puoi riprovare indicando CAP, città e peso?',
      next_step: 'END',
      processingStatus: 'error',
      validationErrors: [...(state.validationErrors || []), errorMessage],
    };
  }
}

/**
 * Versione sincrona per uso in unit test o pre-elaborazione
 * Usa la stessa logica core della versione async
 */
export function processAddressSync(
  message: string, 
  existingDraft?: ShipmentDraft
): AddressWorkerResult {
  const { updatedDraft, missingFields, extractedAnything, readyForPricing } = 
    processAddressCore(message, existingDraft);
  
  return {
    shipmentDraft: updatedDraft,
    missingFields,
    clarificationQuestion: readyForPricing ? undefined : generateClarificationQuestion(missingFields),
    nextStep: readyForPricing ? 'pricing_worker' : 'END',
    addressNormalized: extractedAnything,
  };
}

