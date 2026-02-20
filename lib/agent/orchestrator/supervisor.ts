/**
 * Supervisor Node
 *
 * Il "cervello" che decide il routing:
 * - Intent pricing con dati sufficienti -> pricing_worker
 * - Intent pricing senza dati -> END (con clarification_request)
 * - Intent non-pricing -> legacy
 * - Risposta pronta -> END
 */

import { containsBookingConfirmation, preflightCheck } from '@/lib/agent/workers/booking';
import { detectDebugIntent } from '@/lib/agent/workers/debug';
import { detectExplainIntent } from '@/lib/agent/workers/explain';
import { detectMentorIntent } from '@/lib/agent/workers/mentor';
import { containsOcrPatterns } from '@/lib/agent/workers/ocr';
import { detectPriceListIntent } from '@/lib/agent/workers/price-list-manager';
import {
  detectShipmentCreationIntent,
  detectCancelCreationIntent,
} from '@/lib/agent/intent-detector';
import { autoProceedConfig, llmConfig } from '@/lib/config';
import { getPlatformFeeSafe } from '@/lib/services/pricing/platform-fee';
import {
  checkCreditBeforeBooking,
  formatInsufficientCreditMessage,
} from '@/lib/wallet/credit-check';
import { HumanMessage } from '@langchain/core/messages';
import { defaultLogger, type ILogger } from '../logger';
import { createGraphLLM } from '../llm-factory';
import { AgentState } from './state';

/**
 * Estrae dati spedizione dal messaggio usando LLM (se disponibile) o logica base
 */
async function extractShipmentDetailsFromMessage(
  message: string,
  existingDetails?: AgentState['shipment_details'],
  logger: ILogger = defaultLogger
): Promise<AgentState['shipment_details']> {
  const llm = createGraphLLM({ maxOutputTokens: llmConfig.SUPERVISOR_MAX_OUTPUT_TOKENS, logger });

  // Se abbiamo già dati completi, non serve ri-estrarre
  if (
    existingDetails?.weight &&
    existingDetails?.destinationZip &&
    existingDetails?.destinationProvince
  ) {
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
      const jsonText = result.content
        .toString()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
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
  const weightMatch =
    message.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili|peso)/i) ||
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
    const messageText = lastMessage && 'content' in lastMessage ? String(lastMessage.content) : '';

    // === CREAZIONE SPEDIZIONE ===

    // HIGH-2 FIX: escape hatch — l'utente può annullare la creazione in qualsiasi momento
    if (state.shipment_creation_phase && detectCancelCreationIntent(messageText)) {
      logger.log('📦 [Supervisor] Annullamento creazione spedizione richiesto');
      return {
        shipment_creation_phase: undefined,
        shipmentDraft: undefined,
        pricing_options: undefined,
        shipment_creation_summary: undefined,
        clarification_request: 'Creazione spedizione annullata. Come posso aiutarti?',
        next_step: 'END',
        processingStatus: 'idle',
      };
    }

    // Se fase ready + conferma utente → shipment_booking_worker
    if (
      state.shipment_creation_phase === 'ready' &&
      state.pricing_options &&
      state.pricing_options.length > 0 &&
      containsBookingConfirmation(messageText)
    ) {
      logger.log(
        '🚀 [Supervisor] Conferma creazione spedizione, routing a shipment_booking_worker'
      );

      // Credit check prima del booking
      try {
        const selectedOption = state.pricing_options[0];
        const platformFee = await getPlatformFeeSafe(state.userId);
        const estimatedCost = (selectedOption.finalPrice || 0) + platformFee;

        const creditCheck = await checkCreditBeforeBooking(
          state.userId,
          estimatedCost,
          state.agent_context?.acting_context
        );

        if (!creditCheck.sufficient) {
          logger.log(`⚠️ [Supervisor] Credito insufficiente per creazione spedizione`);
          return {
            clarification_request: formatInsufficientCreditMessage(creditCheck),
            next_step: 'END',
            processingStatus: 'idle',
          };
        }
      } catch (error) {
        logger.warn('⚠️ [Supervisor] Errore credit check creazione, procedo comunque');
      }

      return {
        next_step: 'shipment_booking_worker',
        processingStatus: 'calculating',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }

    // CRIT-2 FIX: Fase ready ma pricing vuoto (pricing engine fallito) → reset e ritenta
    if (
      state.shipment_creation_phase === 'ready' &&
      (!state.pricing_options || state.pricing_options.length === 0)
    ) {
      logger.log('📦 [Supervisor] Fase ready ma pricing vuoto, reset a collecting per ritentare');
      return {
        next_step: 'shipment_creation_worker',
        shipment_creation_phase: undefined,
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }

    // Se fase collecting in corso → shipment_creation_worker (continua raccolta dati)
    if (state.shipment_creation_phase === 'collecting') {
      logger.log('📦 [Supervisor] Fase collecting in corso, routing a shipment_creation_worker');
      return {
        next_step: 'shipment_creation_worker',
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }

    // Nuovo intent creazione spedizione (nessuna fase attiva)
    if (!state.shipment_creation_phase && detectShipmentCreationIntent(messageText)) {
      logger.log(
        '📦 [Supervisor] Intent creazione spedizione rilevato, routing a shipment_creation_worker'
      );
      return {
        next_step: 'shipment_creation_worker',
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }

    // === FINE CREAZIONE SPEDIZIONE ===

    // Sprint 2.6: Controlla se l'utente sta confermando un booking
    // REQUISITI per booking_worker:
    // 1. Abbiamo preventivi calcolati
    // 2. L'utente ha confermato esplicitamente
    // 3. I dati sono completi (preflight check)
    if (
      state.pricing_options &&
      state.pricing_options.length > 0 &&
      containsBookingConfirmation(messageText)
    ) {
      logger.log('📦 [Supervisor] Conferma booking rilevata, verifico preflight...');

      // Verifica pre-flight
      const selectedOption = state.pricing_options[0]; // TODO: permettere selezione
      const idempotencyKey = state.shipmentId || `booking-${state.userId}-${Date.now()}`;
      const preflight = preflightCheck(state.shipmentDraft, selectedOption, idempotencyKey);

      if (preflight.passed) {
        // P3 Task 2: Verifica credito PRIMA di routing a booking_worker
        try {
          // Calcola costo stimato (prezzo corriere + platform fee)
          const courierCost = selectedOption.finalPrice || 0;
          const platformFee = await getPlatformFeeSafe(state.userId);
          const estimatedCost = courierCost + platformFee;

          // Verifica credito disponibile
          const creditCheck = await checkCreditBeforeBooking(
            state.userId,
            estimatedCost,
            state.agent_context?.acting_context
          );

          if (!creditCheck.sufficient) {
            logger.log(
              `⚠️ [Supervisor] Credito insufficiente: €${creditCheck.currentBalance.toFixed(
                2
              )} disponibili, €${creditCheck.required.toFixed(2)} richiesti`
            );
            return {
              clarification_request: formatInsufficientCreditMessage(creditCheck),
              next_step: 'END',
              processingStatus: 'idle',
            };
          }

          logger.log(
            `✅ [Supervisor] Preflight OK + credito sufficiente (€${creditCheck.currentBalance.toFixed(
              2
            )}), routing a booking_worker`
          );
          return {
            next_step: 'booking_worker',
            processingStatus: 'calculating',
            iteration_count: (state.iteration_count || 0) + 1,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`❌ [Supervisor] Errore verifica credito: ${errorMessage}`);
          // In caso di errore, procedi comunque (booking_worker farà il check)
          logger.warn('⚠️ [Supervisor] Procedo comunque, booking_worker farà il check');
          return {
            next_step: 'booking_worker',
            processingStatus: 'calculating',
            iteration_count: (state.iteration_count || 0) + 1,
          };
        }
      } else {
        logger.log('⚠️ [Supervisor] Preflight fallito, mancano:', preflight.missing);
        return {
          clarification_request: `Per procedere con la prenotazione, ho bisogno di: ${preflight.missing.join(
            ', '
          )}.`,
          next_step: 'END',
          processingStatus: 'idle',
        };
      }
    }

    // Se abbiamo già preventivi calcolati MA non c'è conferma, verifica auto-proceed (P4 Task 2)
    if (state.pricing_options && state.pricing_options.length > 0) {
      // P4 Task 2: Auto-Proceed per operazioni sicure (pricing)
      // ⚠️ CRITICO: Auto-proceed SOLO per pricing (calcolo preventivi), MAI per booking/wallet/LDV
      const confidenceScore = state.confidenceScore || 0;
      const hasValidationErrors = state.validationErrors && state.validationErrors.length > 0;

      // Auto-proceed se confidence > soglia E nessun errore di validazione
      if (
        confidenceScore >= autoProceedConfig.AUTO_PROCEED_CONFIDENCE_THRESHOLD &&
        !hasValidationErrors
      ) {
        logger.log(
          `✅ [Supervisor] Auto-proceed attivato (confidence: ${confidenceScore}%, no errors)`
        );
        return {
          next_step: 'END',
          processingStatus: 'complete',
          // Flag per UI: mostra banner auto-proceed
          autoProceed: true,
          userMessage: '✅ Dati verificati, procedo automaticamente',
        };
      }

      // Suggerimento se confidence > soglia suggerimento ma < auto-proceed
      if (
        confidenceScore >= autoProceedConfig.SUGGEST_PROCEED_CONFIDENCE_THRESHOLD &&
        confidenceScore < autoProceedConfig.AUTO_PROCEED_CONFIDENCE_THRESHOLD &&
        !hasValidationErrors
      ) {
        logger.log(`💡 [Supervisor] Suggerimento procedura (confidence: ${confidenceScore}%)`);
        return {
          next_step: 'END',
          processingStatus: 'complete',
          // Flag per UI: mostra suggerimento
          suggestProceed: true,
          userMessage: '💡 Dati quasi completi, vuoi procedere?',
        };
      }

      // Comportamento standard: attendo conferma utente
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

    // P1: Mentor Intent - Domande tecniche su architettura, wallet, RLS (priorità su explain)
    // Mentor è più generico, quindi controlliamo prima per evitare conflitti
    if (detectMentorIntent(messageText)) {
      logger.log('🎓 [Supervisor] Intent mentor rilevato, routing a mentor_worker');
      return {
        next_step: 'mentor_worker',
        processingStatus: 'idle',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    }

    // P2: Explain Intent - Richieste di spiegazione business flows (più specifico)
    // Controllato dopo mentor per evitare conflitti con domande tecniche
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

    // P3: Price List Intent - Gestione listini (clone, assign)
    if (detectPriceListIntent(messageText)) {
      logger.log('🏷️ [Supervisor] Intent listini rilevato, routing a price_list_worker');
      return {
        next_step: 'price_list_worker',
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
      if (!shipmentDetails?.destinationZip || shipmentDetails.destinationZip.length !== 5)
        missing.push('CAP destinazione');
      if (!shipmentDetails?.destinationProvince || shipmentDetails.destinationProvince.length !== 2)
        missing.push('provincia destinazione');

      logger.log(`⚠️ [Supervisor] Dati insufficienti, mancano: ${missing.join(', ')}`);

      return {
        shipment_details: shipmentDetails,
        clarification_request: `Per calcolare un preventivo preciso, ho bisogno di: ${missing.join(
          ', '
        )}. Puoi fornirmi questi dati?`,
        next_step: 'END', // Termina con clarification_request popolato
        processingStatus: 'idle',
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Supervisor] Errore:', errorMessage);
    // MED-1 FIX: mai esporre error.message al client — può contenere dettagli interni
    return {
      clarification_request: "Si è verificato un errore nell'analisi della richiesta. Riprova.",
      next_step: 'legacy',
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

export type SupervisorDecision =
  | 'pricing_worker'
  | 'address_worker'
  | 'ocr_worker'
  | 'booking_worker'
  | 'shipment_creation_worker'
  | 'shipment_booking_worker'
  | 'mentor_worker'
  | 'explain_worker'
  | 'debug_worker'
  | 'legacy'
  | 'price_list_worker'
  | 'support_worker'
  | 'END';

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
