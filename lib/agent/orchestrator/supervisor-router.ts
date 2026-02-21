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

import { isAdminOrAbove } from '@/lib/auth-helpers';
import { AgentState } from './state';
import { pricingGraph, createPricingGraphWithCheckpointer } from './pricing-graph';
import { decideNextStep, DecisionInput, SupervisorDecision } from './supervisor';
import { createCheckpointer } from './checkpointer';
import { agentSessionService } from '@/lib/services/agent-session';
import { assertAgentState } from './type-guards';
import {
  detectPricingIntent,
  detectCrmIntent,
  detectOutreachIntent,
  detectShipmentCreationIntent,
} from '@/lib/agent/intent-detector';
import { containsOcrPatterns } from '@/lib/agent/workers/ocr';
import { detectSupportIntent, supportWorker } from '@/lib/agent/workers/support-worker';
import { crmWorker } from '@/lib/agent/workers/crm-worker';
import { outreachWorker } from '@/lib/agent/workers/outreach-worker';
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
import { defaultLogger, type ILogger } from '../logger';
import { ActingContext, AccountType } from '@/lib/safe-auth';
import type { WorkspaceActingContext } from '@/types/workspace';
import { createTypingChannel, type TypingChannel } from '@/lib/realtime/typing-indicators';

// ==================== TIPI ====================

export interface SupervisorInput {
  message: string;
  userId: string;
  userEmail: string;
  traceId: string;
  actingContext: WorkspaceActingContext | ActingContext; // WorkspaceActingContext ha .workspace.id, ActingContext no (WhatsApp)
  /** Nonce per canale typing (opzionale, generato dal client) */
  typingNonce?: string;
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

  // P4: AgentState finale (per componenti P4)
  agentState?: AgentState;

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
export async function supervisorRouter(
  input: SupervisorInput,
  logger: ILogger = defaultLogger
): Promise<SupervisorResult> {
  const startTime = Date.now();
  const { message, userId, userEmail, traceId, actingContext, typingNonce } = input;

  // Telemetria da costruire progressivamente
  let intentDetected: IntentType = 'unknown';
  let supervisorDecision: 'pricing_worker' | 'address_worker' | 'ocr_worker' | 'legacy' | 'end' =
    'legacy';
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

  // Typing indicator: canale persistente per tutta la request
  // Solo se il client ha inviato un nonce (opt-in, backward compatible)
  let typing: TypingChannel | null = null;
  if (typingNonce) {
    try {
      typing = await createTypingChannel(userId, typingNonce);
      typing.emit('thinking', 'Analizzo la richiesta...').catch(() => {});
    } catch {
      // Fire-and-forget: non bloccare il router se il canale fallisce
    }
  }

  // Helper per emettere evento finale e restituire risultato
  const emitFinalTelemetryAndReturn = (
    result: Omit<SupervisorResult, 'telemetry'>
  ): SupervisorResult => {
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

    // Typing indicator: ANNE ha finito + cleanup canale
    typing?.done().catch(() => {});

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
      logger.log('📸 [Supervisor Router] Pattern OCR rilevati nel messaggio');
    }

    isPricingIntent = await detectPricingIntent(message, false);
    intentDetected = isPricingIntent ? 'pricing' : 'non_pricing';
    logIntentDetected(traceId, userId, isPricingIntent);
  } catch (error) {
    logger.error('❌ [Supervisor Router] Errore intent detection, fallback legacy');
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

  // Estrai workspaceId e ruolo reale dall'actingContext (usato da tutti i worker)
  const wsId =
    ('workspace' in actingContext ? actingContext.workspace?.id : undefined) || undefined;
  const effectiveRole = actingContext.target.role;
  const workerRole: 'admin' | 'user' | 'reseller' =
    effectiveRole === 'admin' || effectiveRole === 'superadmin'
      ? 'admin'
      : effectiveRole === 'reseller'
        ? 'reseller'
        : 'user';

  // 1.5. Support intent check (PRIMA del pricing, gestito direttamente)
  const isSupportIntent = detectSupportIntent(message);
  if (isSupportIntent) {
    logger.log('🎧 [Supervisor Router] Intent supporto rilevato, invoco support worker');
    intentDetected = 'non_pricing'; // Telemetria: non e pricing

    // Typing indicator: ANNE verifica spedizioni
    typing?.emit('working', 'Verifico le tue spedizioni...', 'support').catch(() => {});

    try {
      const supportResult = await supportWorker(
        {
          message,
          userId,
          userRole: workerRole,
          workspaceId: wsId,
        },
        logger
      );

      supervisorDecision = 'end';
      backendUsed = 'pricing_graph'; // Reuse field, means "handled internally"
      success = true;

      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: supportResult.response,
        agentState: {
          messages: [new HumanMessage(message)],
          userId,
          userEmail,
          shipmentData: {},
          processingStatus: 'complete',
          validationErrors: [],
          confidenceScore: 100,
          needsHumanReview: false,
          support_response: {
            message: supportResult.response,
            toolsUsed: supportResult.toolsUsed,
          },
          pendingAction: supportResult.pendingAction,
        } as AgentState,
        executionTimeMs: Date.now() - startTime,
        source: 'supervisor_only',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ [Supervisor Router] Errore support worker, fallback legacy:', errorMessage);
      // Fallthrough al legacy handler
    }
  }

  // 1.6. CRM intent check (DOPO support, PRIMA di pricing)
  const isCrmIntent = detectCrmIntent(message);
  if (isCrmIntent) {
    logger.log('📊 [Supervisor Router] Intent CRM rilevato, invoco crm worker');
    intentDetected = 'crm';

    // Typing indicator: ANNE analizza la pipeline
    typing?.emit('working', 'Analizzo la pipeline commerciale...', 'crm').catch(() => {});

    try {
      const crmResult = await crmWorker(
        {
          message,
          userId,
          userRole: workerRole,
          workspaceId: wsId,
        },
        logger
      );

      supervisorDecision = 'end';
      backendUsed = 'pricing_graph'; // "handled internally"
      success = true;

      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: crmResult.response,
        agentState: {
          messages: [new HumanMessage(message)],
          userId,
          userEmail,
          shipmentData: {},
          processingStatus: 'complete',
          validationErrors: [],
          confidenceScore: 100,
          needsHumanReview: false,
          crm_response: {
            message: crmResult.response,
            toolsUsed: crmResult.toolsUsed,
          },
        } as AgentState,
        executionTimeMs: Date.now() - startTime,
        source: 'supervisor_only',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ [Supervisor Router] Errore crm worker, fallback legacy:', errorMessage);
      // Fallthrough al pricing/legacy handler
    }
  }

  // 1.7. Outreach intent check (DOPO CRM, PRIMA di pricing)
  const isOutreachIntent = detectOutreachIntent(message);
  if (isOutreachIntent) {
    logger.log('📨 [Supervisor Router] Intent outreach rilevato, invoco outreach worker');
    intentDetected = 'outreach' as IntentType;

    // Typing indicator
    typing?.emit('working', 'Gestisco la richiesta outreach...', 'outreach').catch(() => {});

    try {
      const outreachResult = await outreachWorker(
        {
          message,
          userId,
          userRole: workerRole,
          workspaceId: wsId,
        },
        logger
      );

      supervisorDecision = 'end';
      backendUsed = 'pricing_graph'; // "handled internally"
      success = true;

      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: outreachResult.response,
        agentState: {
          messages: [new HumanMessage(message)],
          userId,
          userEmail,
          shipmentData: {},
          processingStatus: 'complete',
          validationErrors: [],
          confidenceScore: 100,
          needsHumanReview: false,
          outreach_response: {
            message: outreachResult.response,
            toolsUsed: outreachResult.toolsUsed,
          },
        } as AgentState,
        executionTimeMs: Date.now() - startTime,
        source: 'supervisor_only',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ [Supervisor Router] Errore outreach worker, fallback legacy:', errorMessage);
      // Fallthrough al pricing/legacy handler
    }
  }

  // 1.8. Shipment Creation intent check (DOPO outreach, PRIMA di pricing)
  // Sessione in corso o nuovo intent → instrada al pricing graph
  // Il supervisor interno routerà al worker corretto
  const existingCreationPhase = (await agentSessionService.getSession(userId, traceId))
    ?.shipment_creation_phase;
  const isShipmentCreationIntent =
    existingCreationPhase === 'collecting' ||
    existingCreationPhase === 'ready' ||
    detectShipmentCreationIntent(message);

  if (isShipmentCreationIntent) {
    logger.log(
      `📦 [Supervisor Router] Intent creazione spedizione (fase: ${existingCreationPhase || 'new'})`
    );
    intentDetected = 'shipment_creation';
    isPricingIntent = true; // Forza passaggio al pricing graph
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
    logger.log(
      '📸 [Supervisor Router] Pattern OCR rilevati, invoco pricing graph (supervisor deciderà routing)'
    );
  } else {
    // 3. È pricing intent -> DEVE usare pricing_graph (GUARDRAIL)
    // Legacy è consentito SOLO se pricing_graph fallisce
    supervisorDecision = 'pricing_worker';
    logger.log(
      '💰 [Supervisor Router] Intent pricing rilevato, invoco pricing graph (supervisor deciderà routing)'
    );
  }

  // Typing indicator: ANNE calcola i prezzi
  const typingMsg =
    supervisorDecision === 'ocr_worker'
      ? 'Analizzo il documento...'
      : 'Calcolo i prezzi migliori...';
  typing?.emit('working', typingMsg, supervisorDecision).catch(() => {});

  try {
    // ARCHITETTURA: supervisor-router NON imposta next_step.
    // Il routing è deciso ESCLUSIVAMENTE da supervisor.ts basandosi sullo stato.
    // supervisor-router rileva solo segnali (intent, OCR patterns) e li passa al graph.
    // ⚠️ ActingContext iniettato in agent_context per accesso worker
    const sessionId = traceId; // Usa traceId come session_id

    // P3 Task 1: Recupera stato esistente se presente (checkpoint)
    let existingState = await agentSessionService.getSession(userId, sessionId);

    const initialState: Partial<AgentState> = existingState || {
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
      // ⚠️ AI AGENT: Inietta ActingContext in agent_context
      agent_context: {
        session_id: sessionId,
        conversation_history: [new HumanMessage(message)],
        user_role: (actingContext.target.role || 'user') as AccountType,
        is_impersonating: actingContext.isImpersonating,
        acting_context: actingContext,
      },
    };

    // P3 Task 1: Se stato esistente, aggiungi nuovo messaggio + AGGIORNA SEMPRE agent_context
    // ⚠️ CRIT-1 FIX: agent_context DEVE essere fresco ad ogni request.
    // Senza questo fix, sessioni riprese usano acting_context stale
    // (es. impersonation terminata, ruolo cambiato).
    if (existingState) {
      initialState.messages = [...(existingState.messages || []), new HumanMessage(message)];
      initialState.agent_context = {
        session_id: sessionId,
        conversation_history: initialState.messages!,
        user_role: (actingContext.target.role || 'user') as AccountType,
        is_impersonating: actingContext.isImpersonating,
        acting_context: actingContext,
      };
    }

    // P3 Task 1: Crea checkpointer e graph con persistenza
    const checkpointer = createCheckpointer();
    const graphWithCheckpointer = createPricingGraphWithCheckpointer(checkpointer);

    const graphStartTime = Date.now();
    // P3 Task 1: Usa graph con checkpointer, passa thread_id e user_id in config
    const graphResult = await graphWithCheckpointer.invoke(initialState, {
      configurable: {
        thread_id: sessionId,
        user_id: userId,
      },
    });
    // P3 Task 5: Usa type guard per validazione type-safe invece di cast diretto
    const result = assertAgentState(graphResult);
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

    // Creazione spedizione: booking completato
    if (result.booking_result && result.booking_result.status === 'success') {
      supervisorDecision = 'end';
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: result.booking_result.user_message,
        agentState: result,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    // Creazione spedizione: booking fallito
    if (result.booking_result && result.booking_result.status !== 'success') {
      supervisorDecision = 'end';
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: result.booking_result.user_message,
        agentState: result,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    // Creazione spedizione: riepilogo pronto (fase ready)
    if (result.shipment_creation_summary) {
      supervisorDecision = 'end';
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: result.shipment_creation_summary,
        pricingOptions: result.pricing_options,
        agentState: result,
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    if (result.pricing_options && result.pricing_options.length > 0) {
      // Abbiamo preventivi!
      supervisorDecision = 'end';
      workerRun = 'pricing';
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        pricingOptions: result.pricing_options,
        agentState: result, // P4: Includi AgentState per componenti P4
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    // P2: Se abbiamo risposta explain, restituiscila
    if (result.explain_response) {
      supervisorDecision = 'end';
      workerRun = null; // Explain non è un worker standard
      // Formatta risposta explain con explanation e diagram
      const explainMessage = `${result.explain_response.explanation}${result.explain_response.diagram ? `\n\n${result.explain_response.diagram}` : ''}`;
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: explainMessage,
        agentState: result, // P4: Includi AgentState per componenti P4
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    // P2: Se abbiamo risposta debug, restituiscila
    if (result.debug_response) {
      supervisorDecision = 'end';
      workerRun = null; // Debug non è un worker standard
      // Formatta risposta debug con analysis e suggestions
      const debugMessage = `${result.debug_response.analysis}\n\n**Suggerimenti:**\n${result.debug_response.suggestions.map((s) => `• ${s}`).join('\n')}`;
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: debugMessage,
        agentState: result, // P4: Includi AgentState per componenti P4
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    // P1: Se abbiamo risposta mentor, restituiscila
    if (result.mentor_response) {
      supervisorDecision = 'end';
      workerRun = null; // Mentor non è un worker standard
      return emitFinalTelemetryAndReturn({
        decision: 'END',
        clarificationRequest: result.mentor_response.answer, // Usa answer come messaggio
        agentState: result, // P4: Includi AgentState per componenti P4
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
        agentState: result, // P4: Includi AgentState per componenti P4
        executionTimeMs: Date.now() - startTime,
        source: 'pricing_graph',
      });
    }

    // Graph completato ma senza risultati utili -> fallback legacy
    // LEGACY PATH (temporary). Remove after Sprint 3 when graph handles all cases.
    logger.warn('⚠️ [Supervisor Router] Graph completato senza risultati, fallback legacy');
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
  } catch (error: unknown) {
    // Graph fallito -> fallback legacy (UNICO CASO LEGITTIMO per pricing intent)
    // LEGACY PATH (temporary). Remove after Sprint 3 when graph is stable.
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Supervisor Router] Errore pricing graph:', errorMessage);

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
