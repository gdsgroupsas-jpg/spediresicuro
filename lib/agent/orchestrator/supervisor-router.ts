/**
 * Supervisor Router
 * 
 * Entry point UNICO per la route /api/ai/agent-chat.
 * Decide e gestisce il routing tra:
 * - pricing_worker: Calcolo preventivi via pricing graph
 * - legacy: Handler Claude legacy per messaggi non-pricing
 * - END: Risposta pronta (con pricing_options o clarification_request)
 * 
 * ARCHITETTURA STRANGLER PATTERN:
 * - La route chiama SOLO supervisorRouter()
 * - Il router decide internamente se usare pricing graph o legacy
 * - Nessun branching sparso nella route
 * 
 * GUARDRAIL (Step 2.2):
 * - Se intent = pricing → SEMPRE pricing_graph (legacy solo se graph_error)
 * - Se intent != pricing → legacy (temporaneo, vedi TODO Sprint 3)
 * - 1 evento telemetria finale per ogni richiesta
 */

import { AgentState } from './state';
import { pricingGraph } from './pricing-graph';
import { decideNextStep, DecisionInput, SupervisorDecision } from './supervisor';
import { detectPricingIntent } from '@/lib/agent/intent-detector';
import { containsOcrPatterns } from '@/lib/agent/workers/ocr';
import { HumanMessage } from '@langchain/core/messages';
import { 
  logIntentDetected, 
  logUsingPricingGraph, 
  logGraphFailed, 
  logFallbackToLegacy,
  logSupervisorDecision,
  logSupervisorRouterComplete,
  type IntentType,
  type BackendUsed,
  type FallbackReason,
  type SupervisorRouterTelemetry,
} from '@/lib/telemetry/logger';

// ==================== TIPI ====================

export interface SupervisorInput {
  message: string;
  userId: string;
  userEmail: string;
  traceId: string;
}

export interface SupervisorResult {
  decision: SupervisorDecision;
  // Se decision = 'END' e abbiamo preventivi
  pricingOptions?: AgentState['pricing_options'];
  // Se decision = 'END' e serve chiarimento
  clarificationRequest?: string;
  // Se decision = 'legacy', la route deve chiamare il legacy handler
  // Non restituiamo nulla, la route gestirà
  executionTimeMs: number;
  source: 'pricing_graph' | 'supervisor_only';
  
  // Telemetria Step 2.2 (per test e monitoring)
  telemetry: SupervisorRouterTelemetry;
}

// ==================== ROUTER ====================

/**
 * hasEnoughDataForPricing - Verifica se i dati estratti sono sufficienti
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
 * Supervisor Router - Entry Point Unico
 * 
 * Flusso:
 * 1. Rileva intent (pricing vs non-pricing)
 * 2. Se pricing -> invoca pricing graph completo
 * 3. Se non-pricing -> ritorna 'legacy' (la route chiamerà Claude)
 * 4. Se graph fallisce -> ritorna 'legacy' (fallback safe)
 * 
 * GUARDRAIL Step 2.2:
 * - Pricing intent → SEMPRE pricing_graph prima
 * - Legacy solo se graph_error o non-pricing
 * - 1 evento telemetria finale SEMPRE
 * 
 * @param input - Dati dalla route
 * @returns Risultato con decisione e eventuali dati
 */
export async function supervisorRouter(input: SupervisorInput): Promise<SupervisorResult> {
  const startTime = Date.now();
  const { message, userId, userEmail, traceId } = input;
  
  // Telemetria da costruire progressivamente
  let intentDetected: IntentType = 'unknown';
  let supervisorDecision: 'pricing_worker' | 'address_worker' | 'ocr_worker' | 'legacy' | 'end' = 'legacy';
  let backendUsed: BackendUsed = 'legacy';
  let fallbackToLegacy = false;
  let fallbackReason: FallbackReason = null;
  let pricingOptionsCount = 0;
  let hasClarification = false;
  let success = true;
  // Sprint 2.3: Address Worker telemetry
  let workerRun: 'address' | 'pricing' | 'ocr' | null = null;
  let missingFieldsCount = 0;
  let addressNormalized = false;
  
  // Sprint 2.4: OCR telemetry
  let ocrSource: 'image' | 'text' | null = null;
  let ocrExtractedFieldsCount = 0;
  
  // Helper per emettere evento finale e restituire risultato
  const emitFinalTelemetryAndReturn = (result: Omit<SupervisorResult, 'telemetry'>): SupervisorResult => {
    const telemetryData: SupervisorRouterTelemetry = {
      intentDetected,
      supervisorDecision,
      backendUsed,
      fallbackToLegacy,
      fallbackReason,
      duration_ms: Date.now() - startTime,
      pricingOptionsCount,
      hasClarification,
      success,
      // Sprint 2.3
      workerRun,
      missingFieldsCount,
      addressNormalized,
    };
    
    // Emetti SEMPRE 1 evento finale per request
    logSupervisorRouterComplete(traceId, userId, telemetryData);
    
    return {
      ...result,
      telemetry: telemetryData,
    };
  };
  
  // 1. Rileva intent + pattern OCR
  let isPricingIntent = false;
  let hasOcrPatterns = false;
  
  try {
    // Sprint 2.4: Rileva pattern OCR nel messaggio
    hasOcrPatterns = containsOcrPatterns(message);
    if (hasOcrPatterns) {
      console.log('📸 [Supervisor Router] Pattern OCR rilevati nel messaggio');
    }
    
    isPricingIntent = await detectPricingIntent(message, false);
    intentDetected = isPricingIntent ? 'pricing' : 'non_pricing';
    logIntentDetected(traceId, userId, isPricingIntent);
  } catch (error) {
    console.error('❌ [Supervisor Router] Errore intent detection, fallback legacy');
    intentDetected = 'unknown';
    fallbackToLegacy = true;
    fallbackReason = 'intent_error';
    logIntentDetected(traceId, userId, false);
    
    // LEGACY PATH (temporary). Remove after Sprint 3 when all intents are handled.
    return emitFinalTelemetryAndReturn({
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'supervisor_only',
    });
  }
  
  // 2. Decisione iniziale (prima di invocare graph)
  const initialDecision: DecisionInput = {
    isPricingIntent,
    hasPricingOptions: false,
    hasClarificationRequest: false,
    hasEnoughData: false, // Non sappiamo ancora, il graph lo valuterà
    hasOcrPatterns, // Sprint 2.4
  };
  
  const decision = decideNextStep(initialDecision);
  logSupervisorDecision(traceId, userId, decision, 0);
  
  // Se non è pricing intent e non ha OCR patterns -> legacy subito
  // LEGACY PATH (temporary). Remove after Sprint 3 when all intents are handled.
  if (decision === 'legacy') {
    supervisorDecision = 'legacy';
    backendUsed = 'legacy';
    fallbackToLegacy = true;
    fallbackReason = 'non_pricing';
    
    logFallbackToLegacy(traceId, userId, 'no_pricing_intent');
    return emitFinalTelemetryAndReturn({
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'supervisor_only',
    });
  }
  
  // Sprint 2.4: Traccia decisione per telemetria
  // NOTA: Il routing effettivo è deciso da supervisor.ts, non qui.
  // Qui registriamo solo la decisione iniziale per telemetria.
  if (decision === 'ocr_worker') {
    supervisorDecision = 'ocr_worker';
    console.log('📸 [Supervisor Router] Pattern OCR rilevati, invoco pricing graph (supervisor deciderà routing)');
  } else {
    // 3. È pricing intent -> DEVE usare pricing_graph (GUARDRAIL)
    // Legacy è consentito SOLO se pricing_graph fallisce
    supervisorDecision = 'pricing_worker';
    console.log('💰 [Supervisor Router] Intent pricing rilevato, invoco pricing graph (supervisor deciderà routing)');
  }
  
  try {
    // ARCHITETTURA: supervisor-router NON imposta next_step.
    // Il routing è deciso ESCLUSIVAMENTE da supervisor.ts basandosi sullo stato.
    // supervisor-router rileva solo segnali (intent, OCR patterns) e li passa al graph.
    const initialState: Partial<AgentState> = {
      messages: [new HumanMessage(message)],
      userId,
      userEmail,
      shipmentData: {},
      processingStatus: 'idle',
      validationErrors: [],
      confidenceScore: 0,
      needsHumanReview: false,
      iteration_count: 0,
      // next_step è undefined: supervisor deciderà il routing
    };
    
    const graphStartTime = Date.now();
    const result = await pricingGraph.invoke(initialState) as unknown as AgentState;
    const graphExecutionTime = Date.now() - graphStartTime;
    
    // Pricing graph usato con successo
    backendUsed = 'pricing_graph';
    pricingOptionsCount = result.pricing_options?.length ?? 0;
    hasClarification = !!result.clarification_request;
    
    // Sprint 2.3: Traccia worker usati e campi mancanti
    if (result.shipmentDraft) {
      missingFieldsCount = result.shipmentDraft.missingFields?.length ?? 0;
      addressNormalized = true; // Se abbiamo un draft, l'address è stato processato
    }
    // Determina quale worker è stato eseguito in base al risultato
    if (pricingOptionsCount > 0) {
      workerRun = 'pricing';
    } else if (result.shipmentDraft || hasClarification) {
      workerRun = 'address';
    }
    
    // Log telemetria intermedia
    logUsingPricingGraph(traceId, userId, graphExecutionTime, pricingOptionsCount);
    
    // 4. Valuta risultato del graph
    if (result.pricing_options && result.pricing_options.length > 0) {
      // Abbiamo preventivi!
      supervisorDecision = 'end';
      workerRun = 'pricing';
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        pricingOptions: result.pricing_options,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }
    
    if (result.clarification_request) {
      // Serve chiarimento (gestito dal graph, potrebbe essere da address_worker)
      supervisorDecision = 'end';
      // Se c'è shipmentDraft ma mancano campi, è address_worker che chiede
      if (result.shipmentDraft && missingFieldsCount > 0) {
        workerRun = 'address';
      }
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: result.clarification_request,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }
    
    // Graph completato ma senza risultati utili -> fallback legacy
    // LEGACY PATH (temporary). Remove after Sprint 3 when graph handles all cases.
    console.warn('⚠️ [Supervisor Router] Graph completato senza risultati, fallback legacy');
    supervisorDecision = 'legacy';
    backendUsed = 'legacy';
    fallbackToLegacy = true;
    fallbackReason = 'graph_error'; // No results = graph didn't handle correctly
    
    logFallbackToLegacy(traceId, userId, 'graph_failed');
    return emitFinalTelemetryAndReturn({
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'pricing_graph',
    });
    
  } catch (error: any) {
    // Graph fallito -> fallback legacy (UNICO CASO LEGITTIMO per pricing intent)
    // LEGACY PATH (temporary). Remove after Sprint 3 when graph is stable.
    console.error('❌ [Supervisor Router] Errore pricing graph:', error.message);
    
    supervisorDecision = 'legacy';
    backendUsed = 'legacy';
    fallbackToLegacy = true;
    fallbackReason = 'graph_error';
    success = true; // La richiesta non fallirà, useremo legacy
    
    logGraphFailed(traceId, error, userId);
    logFallbackToLegacy(traceId, userId, 'graph_failed');
    
    return emitFinalTelemetryAndReturn({
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'pricing_graph',
    });
  }
}

/**
 * Formatta la risposta pricing per il client.
 * Mantiene lo stesso formato della route attuale.
 */
export function formatPricingResponse(
  pricingOptions: NonNullable<AgentState['pricing_options']>
): string {
  if (pricingOptions.length === 0) {
    return 'Non sono riuscita a calcolare preventivi. Puoi fornirmi peso, CAP e provincia di destinazione?';
  }
  
  const bestOption = pricingOptions[0];
  const otherOptions = pricingOptions.slice(1, 4); // Max 3 alternative
  
  let response = `💰 **Preventivo Spedizione**\n\n`;
  response += `**Opzione Consigliata:**\n`;
  response += `• Corriere: ${bestOption.courier}\n`;
  response += `• Servizio: ${bestOption.serviceType}\n`;
  response += `• Prezzo: €${bestOption.finalPrice.toFixed(2)}\n`;
  response += `• Consegna stimata: ${bestOption.estimatedDeliveryDays.min}-${bestOption.estimatedDeliveryDays.max} giorni\n\n`;
  
  if (otherOptions.length > 0) {
    response += `**Altre opzioni disponibili:**\n`;
    otherOptions.forEach((opt, idx) => {
      response += `${idx + 2}. ${opt.courier} (${opt.serviceType}): €${opt.finalPrice.toFixed(2)}\n`;
    });
  }
  
  response += `\n💡 *Prezzi calcolati con margine applicato. I dati sono indicativi.*`;
  
  return response;
}

