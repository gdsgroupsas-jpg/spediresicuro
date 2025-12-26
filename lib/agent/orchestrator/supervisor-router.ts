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
 */

import { AgentState } from './state';
import { pricingGraph } from './pricing-graph';
import { decideNextStep, DecisionInput, SupervisorDecision } from './supervisor';
import { detectPricingIntent } from '@/lib/agent/intent-detector';
import { HumanMessage } from '@langchain/core/messages';
import { 
  logIntentDetected, 
  logUsingPricingGraph, 
  logGraphFailed, 
  logFallbackToLegacy,
  logSupervisorDecision 
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
 * @param input - Dati dalla route
 * @returns Risultato con decisione e eventuali dati
 */
export async function supervisorRouter(input: SupervisorInput): Promise<SupervisorResult> {
  const startTime = Date.now();
  const { message, userId, userEmail, traceId } = input;
  
  // 1. Rileva intent
  let isPricingIntent = false;
  try {
    isPricingIntent = await detectPricingIntent(message, false);
    logIntentDetected(traceId, userId, isPricingIntent);
  } catch (error) {
    console.error('❌ [Supervisor Router] Errore intent detection, fallback legacy');
    logIntentDetected(traceId, userId, false);
    return {
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'supervisor_only',
    };
  }
  
  // 2. Decisione iniziale (prima di invocare graph)
  const initialDecision: DecisionInput = {
    isPricingIntent,
    hasPricingOptions: false,
    hasClarificationRequest: false,
    hasEnoughData: false, // Non sappiamo ancora, il graph lo valuterà
  };
  
  const decision = decideNextStep(initialDecision);
  logSupervisorDecision(traceId, userId, decision, 0);
  
  // Se non è pricing intent -> legacy subito
  if (decision === 'legacy') {
    logFallbackToLegacy(traceId, userId, 'no_pricing_intent');
    return {
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'supervisor_only',
    };
  }
  
  // 3. È pricing intent -> invoca il pricing graph
  console.log('💰 [Supervisor Router] Intent pricing rilevato, invoco pricing graph');
  
  try {
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
    };
    
    const graphStartTime = Date.now();
    const result = await pricingGraph.invoke(initialState) as unknown as AgentState;
    const graphExecutionTime = Date.now() - graphStartTime;
    
    // Log telemetria
    const optionsCount = result.pricing_options?.length ?? 0;
    logUsingPricingGraph(traceId, userId, graphExecutionTime, optionsCount);
    
    // 4. Valuta risultato del graph
    if (result.pricing_options && result.pricing_options.length > 0) {
      // Abbiamo preventivi!
      return {
        decision: 'END',
        pricingOptions: result.pricing_options,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      };
    }
    
    if (result.clarification_request) {
      // Serve chiarimento
      return {
        decision: 'END',
        clarificationRequest: result.clarification_request,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      };
    }
    
    // Nessun risultato chiaro -> fallback legacy
    console.warn('⚠️ [Supervisor Router] Graph completato senza risultati, fallback legacy');
    logFallbackToLegacy(traceId, userId, 'graph_failed');
    return {
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'pricing_graph',
    };
    
  } catch (error: any) {
    // Graph fallito -> fallback legacy
    console.error('❌ [Supervisor Router] Errore pricing graph:', error.message);
    logGraphFailed(traceId, error, userId);
    logFallbackToLegacy(traceId, userId, 'graph_failed');
    
    return {
      decision: 'legacy',
      executionTimeMs: Date.now() - startTime,
      source: 'pricing_graph',
    };
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

