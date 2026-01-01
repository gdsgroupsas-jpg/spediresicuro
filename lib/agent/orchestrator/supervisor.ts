/**
 * Supervisor Node
 * 
 * Il "cervello" che decide il routing:
 * - Intent pricing con dati sufficienti -> pricing_worker
 * - Intent pricing senza dati -> END (con clarification_request)
 * - Intent non-pricing -> legacy
 * - Risposta pronta -> END
 */

import { AgentState } from './state';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { detectPricingIntent } from '@/lib/agent/intent-detector';
import { containsOcrPatterns } from '@/lib/agent/workers/ocr';
import { containsBookingConfirmation, preflightCheck } from '@/lib/agent/workers/booking';
import { detectMentorIntent } from '@/lib/agent/workers/mentor';
import { detectDebugIntent } from '@/lib/agent/workers/debug';
import { detectExplainIntent } from '@/lib/agent/workers/explain';
import { defaultLogger, type ILogger } from '../logger';
import { llmConfig } from '@/lib/config';

// Helper per ottenere LLM (stesso pattern di nodes.ts)
const getLLM = (logger: ILogger = defaultLogger) => {
  if (!process.env.GOOGLE_API_KEY) {
    logger.warn('⚠️ GOOGLE_API_KEY mancante - Supervisor userà logica base');
    return null;
  }
  return new ChatGoogleGenerativeAI({
    model: llmConfig.MODEL,
    maxOutputTokens: llmConfig.SUPERVISOR_MAX_OUTPUT_TOKENS,
    temperature: llmConfig.SUPERVISOR_TEMPERATURE,
    apiKey: process.env.GOOGLE_API_KEY,
  });
};

/**
 * Estrae dati spedizione dal messaggio usando LLM (se disponibile) o logica base
 */
async function extractShipmentDetailsFromMessage(
  message: string,
  existingDetails?: AgentState['shipment_details'],
  logger: ILogger = defaultLogger
): Promise<AgentState['shipment_details']> {
  const llm = getLLM(logger);
  
  // Se abbiamo già dati completi, non serve ri-estrarre
  if (existingDetails?.weight && existingDetails?.destinationZip && existingDetails?.destinationProvince) {
    return existingDetails;
  }
  
  // Prova con LLM se disponibile
  if (llm) {
    try {
      const prompt = `Analizza questo messaggio dell'utente e estrai i dati per un preventivo spedizione.

Messaggio: "${message}"

Dati già noti: ${JSON.stringify(existingDetails || {}, null, 2)}

Estrai SOLO i dati presenti nel messaggio. Rispondi ESCLUSIVAMENTE con JSON valido:
{
  "weight": number | null,  // Peso in kg
  "destinationZip": string | null,  // CAP destinazione (5 cifre)
  "destinationProvince": string | null,  // Provincia (2 lettere, es. "RM")
  "serviceType": "standard" | "express" | "economy" | null,
  "cashOnDelivery": number | null,  // Importo contrassegno (0 = no)
  "declaredValue": number | null,  // Valore dichiarato
  "insurance": boolean | null
}

Se un dato non è presente, usa null.`;

      const result = await llm.invoke([new HumanMessage(prompt)]);
      const jsonText = result.content.toString().replace(/```json/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(jsonText);
      
      // Merge con dati esistenti (priorità ai nuovi se presenti)
      return {
        ...existingDetails,
        weight: extracted.weight ?? existingDetails?.weight,
        destinationZip: extracted.destinationZip ?? existingDetails?.destinationZip,
        destinationProvince: extracted.destinationProvince ?? existingDetails?.destinationProvince,
        serviceType: extracted.serviceType ?? existingDetails?.serviceType,
        cashOnDelivery: extracted.cashOnDelivery ?? existingDetails?.cashOnDelivery,
        declaredValue: extracted.declaredValue ?? existingDetails?.declaredValue,
        insurance: extracted.insurance ?? existingDetails?.insurance,
      };
    } catch (error) {
      logger.warn('⚠️ [Supervisor] Errore estrazione LLM, uso logica base:', error);
    }
  }
  
  // Fallback: logica base (regex semplice)
  // TODO: Migliorare con regex più sofisticate se necessario
  const details: AgentState['shipment_details'] = { ...existingDetails };
  
  // Estrai peso (es. "2 kg", "2kg", "peso 5")
  const weightMatch = message.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili|peso)/i) || 
                      message.match(/peso\s*(\d+(?:[.,]\d+)?)/i);
  if (weightMatch) {
    details.weight = parseFloat(weightMatch[1].replace(',', '.'));
  }
  
  // Estrai CAP (5 cifre)
  const zipMatch = message.match(/\b(\d{5})\b/);
  if (zipMatch) {
    details.destinationZip = zipMatch[1];
  }
  
  // Estrai provincia (2 lettere maiuscole)
  const provinceMatch = message.match(/\b([A-Z]{2})\b/);
  if (provinceMatch) {
    details.destinationProvince = provinceMatch[1];
  }
  
  return details;
}

/**
 * Verifica se abbiamo abbastanza dati per calcolare un preventivo
 */
function hasEnoughDataForPricing(details?: AgentState['shipment_details']): boolean {
  if (!details) return false;
  
  return !!(
    details.weight &&
    details.weight > 0 &&
    details.destinationZip &&
    details.destinationZip.length === 5 &&
    details.destinationProvince &&
    details.destinationProvince.length === 2
  );
}

/**
 * Supervisor Node
 * 
 * Decide il routing basandosi sullo stato:
 * - Se abbiamo preventivi già calcolati -> END
 * - Se abbiamo abbastanza dati -> pricing_worker
 * - Se mancano dati -> END (con clarification_request)
 */
export async function supervisor(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('🧠 [Supervisor] Decisione routing...');
  
  try {
    // Sprint 2.6: Se abbiamo già un booking result, termina
    if (state.booking_result) {
      logger.log('✅ [Supervisor] Booking già eseguito, termino');
      return {
        next_step: 'END',
        processingStatus: 'complete',
      };
    }
    
    // Estrai ultimo messaggio utente
    const lastMessage = state.messages[state.messages.length - 1];
    const messageText = lastMessage && 'content' in lastMessage 
      ? String(lastMessage.content) 
      : '';
    
    // Sprint 2.6: Controlla se l'utente sta confermando un booking
    // REQUISITI per booking_worker:
    // 1. Abbiamo preventivi calcolati
    // 2. L'utente ha confermato esplicitamente
    // 3. I dati sono completi (preflight check)
    if (state.pricing_options && state.pricing_options.length > 0 && containsBookingConfirmation(messageText)) {
      logger.log('📦 [Supervisor] Conferma booking rilevata, verifico preflight...');
      
      // Verifica pre-flight
      const selectedOption = state.pricing_options[0]; // TODO: permettere selezione
      const idempotencyKey = state.shipmentId || `booking-${state.userId}-${Date.now()}`;
      const preflight = preflightCheck(state.shipmentDraft, selectedOption, idempotencyKey);
      
      if (preflight.passed) {
        logger.log('✅ [Supervisor] Preflight OK, routing a booking_worker');
        return {
          next_step: 'booking_worker',
          processingStatus: 'calculating',
          iteration_count: (state.iteration_count || 0) + 1,
        };
      } else {
        logger.log('⚠️ [Supervisor] Preflight fallito, mancano:', preflight.missing);
        return {
          clarification_request: `Per procedere con la prenotazione, ho bisogno di: ${preflight.missing.join(', ')}.`,
          next_step: 'END',
          processingStatus: 'idle',
        };
      }
    }
    
    // Se abbiamo già preventivi calcolati MA non c'è conferma, termina (aspetta conferma)
    if (state.pricing_options && state.pricing_options.length > 0) {
      logger.log('✅ [Supervisor] Preventivi già calcolati, attendo conferma utente');
      return {
        next_step: 'END',
        processingStatus: 'complete',
      };
    }
    
    // Sprint 2.4: UNICO PUNTO DECISIONALE per OCR routing
    // Il supervisor è l'autorità ESCLUSIVA per decidere next_step='ocr_worker'
    if (containsOcrPatterns(messageText)) {
      logger.log('📸 [Supervisor] Pattern OCR rilevati, routing a ocr_worker');
      return {
        next_step: 'ocr_worker',
        processingStatus: 'extracting',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }
    
    // P2: Explain Intent - Richieste di spiegazione business flows
    if (detectExplainIntent(messageText)) {
      logger.log('📚 [Supervisor] Intent explain rilevato, routing a explain_worker');
      return {
        next_step: 'explain_worker',
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }
    
    // P2: Debug Intent - Richieste di debug e troubleshooting
    if (detectDebugIntent(messageText)) {
      logger.log('🐛 [Supervisor] Intent debug rilevato, routing a debug_worker');
      return {
        next_step: 'debug_worker',
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }
    
    // P1: Mentor Intent - Domande tecniche su architettura, wallet, RLS
    if (detectMentorIntent(messageText)) {
      logger.log('🎓 [Supervisor] Intent mentor rilevato, routing a mentor_worker');
      return {
        next_step: 'mentor_worker',
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }
    
    // Estrai/aggiorna dati spedizione dal messaggio
    const shipmentDetails = await extractShipmentDetailsFromMessage(
      messageText,
      state.shipment_details,
      logger
    );
    
    // Verifica se abbiamo abbastanza dati
    const hasEnoughData = hasEnoughDataForPricing(shipmentDetails);
    
    if (hasEnoughData) {
      logger.log('✅ [Supervisor] Dati sufficienti, routing a pricing_worker');
      return {
        shipment_details: shipmentDetails,
        next_step: 'pricing_worker',
        processingStatus: 'calculating',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    } else {
      // Determina cosa manca
      const missing: string[] = [];
      if (!shipmentDetails?.weight || shipmentDetails.weight <= 0) missing.push('peso');
      if (!shipmentDetails?.destinationZip || shipmentDetails.destinationZip.length !== 5) missing.push('CAP destinazione');
      if (!shipmentDetails?.destinationProvince || shipmentDetails.destinationProvince.length !== 2) missing.push('provincia destinazione');
      
      logger.log(`⚠️ [Supervisor] Dati insufficienti, mancano: ${missing.join(', ')}`);
      
      return {
        shipment_details: shipmentDetails,
        clarification_request: `Per calcolare un preventivo preciso, ho bisogno di: ${missing.join(', ')}. Puoi fornirmi questi dati?`,
        next_step: 'END', // Termina con clarification_request popolato
        processingStatus: 'idle',
      };
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Supervisor] Errore:', errorMessage);
    return {
      clarification_request: `Errore nell'analisi della richiesta: ${errorMessage}. Riprova.`,
      next_step: 'legacy', // Fallback a legacy in caso di errore
      processingStatus: 'error',
      validationErrors: [...(state.validationErrors || []), errorMessage],
    };
  }
}

// ==================== FUNZIONE PURA PER TESTING ====================

export interface DecisionInput {
  isPricingIntent: boolean;
  hasPricingOptions: boolean;
  hasClarificationRequest: boolean;
  hasEnoughData: boolean;
  /** Sprint 2.3: true se ci sono dati indirizzo parziali da completare */
  hasPartialAddressData?: boolean;
  /** Sprint 2.4: true se il messaggio contiene pattern OCR tipici */
  hasOcrPatterns?: boolean;
  /** Sprint 2.6: true se l'utente ha confermato esplicitamente il booking */
  hasBookingConfirmation?: boolean;
  /** Sprint 2.6: true se il booking è già stato eseguito */
  hasBookingResult?: boolean;
  /** Sprint 2.6: true se il preflight check è passato */
  preflightPassed?: boolean;
}

export type SupervisorDecision = 'pricing_worker' | 'address_worker' | 'ocr_worker' | 'booking_worker' | 'legacy' | 'END';

/**
 * Funzione PURA per decidere il prossimo step.
 * Facile da testare senza mock di LLM/DB.
 * 
 * @param input - Dati di input per la decisione
 * @returns 'pricing_worker' | 'address_worker' | 'ocr_worker' | 'booking_worker' | 'legacy' | 'END'
 * 
 * ROUTING LOGIC (Sprint 2.6):
 * - hasBookingResult → END (booking già fatto)
 * - hasPricingOptions + hasBookingConfirmation + preflightPassed → booking_worker
 * - hasPricingOptions → END (aspetta conferma utente)
 * - hasClarificationRequest → END
 * - hasOcrPatterns → ocr_worker (Sprint 2.4)
 * - !isPricingIntent → legacy
 * - isPricingIntent + hasEnoughData → pricing_worker
 * - isPricingIntent + !hasEnoughData → address_worker
 */
export function decideNextStep(input: DecisionInput): SupervisorDecision {
  // Sprint 2.6: Se booking già eseguito -> END
  if (input.hasBookingResult) {
    return 'END';
  }
  
  // Sprint 2.6: Se abbiamo preventivi + conferma utente + preflight OK -> booking_worker
  if (input.hasPricingOptions && input.hasBookingConfirmation && input.preflightPassed) {
    return 'booking_worker';
  }
  
  // Se abbiamo già preventivi calcolati -> END (aspetta conferma)
  if (input.hasPricingOptions) {
    return 'END';
  }
  
  // Se c'è già una richiesta di chiarimento -> END (mostra al client)
  if (input.hasClarificationRequest) {
    return 'END';
  }
  
  // Sprint 2.4: Se contiene pattern OCR tipici -> ocr_worker
  if (input.hasOcrPatterns) {
    return 'ocr_worker';
  }
  
  // Se NON è un intent pricing -> legacy handler (Claude)
  if (!input.isPricingIntent) {
    return 'legacy';
  }
  
  // È un intent pricing...
  if (input.hasEnoughData) {
    // Ha abbastanza dati -> pricing_worker
    return 'pricing_worker';
  } else {
    // Mancano dati -> address_worker per provare a estrarre/chiedere
    // Sprint 2.3: address_worker gestisce estrazione e clarification
    return 'address_worker';
  }
}

