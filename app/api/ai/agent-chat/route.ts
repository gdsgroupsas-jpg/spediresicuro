/**
 * API Route: Anne - Executive Business Partner
 *
 * Endpoint POST per la chat con Anne.
 * Unica configurazione: Ollama in locale (OLLAMA_BASE_URL, OLLAMA_MODEL).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth as getLegacyWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { generateTraceId, logAnneFlowComplete } from '@/lib/telemetry/logger';
import { rateLimit } from '@/lib/security/rate-limit';
import { formatPricingResponse } from '@/lib/agent/format-pricing';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supervisorRoute } from '@/lib/agent/supervisor';
import { runFlow } from '@/lib/agent/flows';

/**
 * Sanitizza AgentState per invio al client.
 * Rimuove dati interni/sensibili (userId, email, agent_context, messages LangChain).
 * Espone solo i campi necessari al rendering delle card e componenti UI.
 */
function sanitizeAgentStateForClient(state: any): Record<string, any> {
  // PendingAction: esponi solo campi UI (NO params che puo' contenere dati interni)
  const pendingAction = state.pendingAction
    ? {
        id: state.pendingAction.id,
        type: state.pendingAction.type,
        description: state.pendingAction.description,
        cost: state.pendingAction.cost,
        expiresAt: state.pendingAction.expiresAt,
      }
    : undefined;

  // BookingResult: esponi solo campi UI (NO error_code interno)
  const bookingResult = state.booking_result
    ? {
        status: state.booking_result.status,
        shipment_id: state.booking_result.shipment_id,
        carrier_reference: state.booking_result.carrier_reference,
        user_message: state.booking_result.user_message,
      }
    : undefined;

  return {
    // Dati per card interattive
    pricing_options: state.pricing_options,
    booking_result: bookingResult,
    shipment_details: state.shipment_details,
    // Dati per componenti P4
    pendingAction,
    autoProceed: state.autoProceed,
    suggestProceed: state.suggestProceed,
    userMessage: state.userMessage,
    // Risposte worker (testo, non dati interni)
    support_response: state.support_response,
    clarification_request: state.clarification_request,
    processingStatus: state.processingStatus,
    // NO: userId, userEmail, messages, agent_context, shipmentData, shipmentDraft, params
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const traceId = generateTraceId(); // Genera trace_id per telemetria
  let session: any = null;

  try {
    // ⚠️ AI AGENT: Usa getWorkspaceAuth() per ActingContext (supporta impersonation)
    const actingContext = await getWorkspaceAuth();
    if (!actingContext) {
      return NextResponse.json(
        {
          success: false,
          error: 'Non autenticato',
        },
        { status: 401 }
      );
    }

    // Estrai dati utente da ActingContext (usa target, non actor)
    const userId = actingContext.target.id;
    const userEmail = actingContext.target.email || '';
    // Converti UserRole a 'admin' | 'user'
    const targetRole = actingContext.target.role || 'user';
    const userRole: 'admin' | 'user' =
      targetRole === 'admin' || targetRole === 'superadmin' || targetRole === 'reseller'
        ? 'admin'
        : 'user';
    const userName = actingContext.target.name || userEmail || 'Utente';
    const isAdmin = userRole === 'admin';

    // Verifica che userId sia definito
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID utente non trovato nel contesto',
        },
        { status: 401 }
      );
    }

    // Mantieni session per compatibilità con codice legacy
    const legacyContext = await getLegacyWorkspaceAuth();
    session = legacyContext ? { user: legacyContext.actor } : null;

    // Rate limiting distribuito (Upstash Redis con fallback in-memory)
    const rateLimitResult = await rateLimit('agent-chat', userId as string);
    if (!rateLimitResult.allowed) {
      // Log structured event (no PII)
      console.log(
        `[TELEMETRY] {"event":"rateLimited","trace_id":"${traceId}","route":"agent-chat","source":"${rateLimitResult.source}"}`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Troppe richieste. Attendi un minuto prima di riprovare.',
          retryAfter: 60,
        },
        { status: 429 }
      );
    }

    // Leggi il messaggio dal body della richiesta
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('❌ [Anne] Errore parsing body richiesta:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Richiesta non valida: body JSON non valido',
        },
        { status: 400 }
      );
    }

    const userMessage = body.message || '';
    const messages = body.messages || []; // Storia conversazione
    // Typing nonce: solo alfanumerici e trattini, max 64 char (previene injection nel channel name)
    const rawNonce = typeof body.typingNonce === 'string' ? body.typingNonce : '';
    const typingNonce = /^[a-zA-Z0-9\-]{8,64}$/.test(rawNonce) ? rawNonce : undefined;
    const isVoiceInput = userMessage.startsWith('[VOX]');
    const cleanMessage = isVoiceInput ? userMessage.replace('[VOX]', '') : userMessage;

    // ===== SUPERVISOR UNICO (Entry Point) =====
    // Classifica sempre in un flusso; nessuna chat generale
    const { flowId } = await supervisorRoute({ message: cleanMessage, userId: userId as string });
    console.log(`🤖 [Anne] Flusso selezionato: ${flowId}`);

    const flowResult = await runFlow(flowId, {
      message: cleanMessage,
      userId: userId as string,
      userEmail,
      userRole,
      traceId,
      actingContext,
      existingSessionState: undefined,
    });

    let responseMessage = flowResult.message;
    if (flowResult.pricingOptions && flowResult.pricingOptions.length > 0) {
      responseMessage = formatPricingResponse(flowResult.pricingOptions);
    } else if (flowResult.clarificationRequest) {
      responseMessage = flowResult.clarificationRequest;
    }

    if (!responseMessage || responseMessage.trim().length === 0) {
      responseMessage = `Ciao ${userName}! 👋 Non sono riuscita a elaborare la richiesta. Riprova.`;
    }

    if (isAdmin) {
      try {
        const wsId = actingContext.workspace?.id || null;
        const db = wsId ? workspaceQuery(wsId) : supabaseAdmin;
        await db.from('audit_logs').insert({
          user_id: userId,
          workspace_id: wsId,
          severity: 'info',
          message: 'Anne conversation completed',
          metadata: {
            trace_id: traceId,
            userRole,
            flowId,
            executionTime: Date.now() - startTime,
          },
        });
      } catch (logError) {
        console.error('Errore log audit:', logError);
      }
    }

    const executionTime = Date.now() - startTime;
    logAnneFlowComplete(traceId, userId as string, {
      flowId,
      specificFlowId: 'specificFlowId' in flowResult ? flowResult.specificFlowId : undefined,
      duration_ms: executionTime,
      pricing_options_count: flowResult.pricingOptions?.length ?? 0,
    });

    const responseMetadata: any = {
      trace_id: traceId,
      userRole,
      timestamp: new Date().toISOString(),
      executionTime,
      rateLimitRemaining: rateLimitResult.remaining,
      flowId,
      pricingOptionsCount: flowResult.pricingOptions?.length ?? 0,
    };
    if ('specificFlowId' in flowResult && flowResult.specificFlowId) {
      responseMetadata.specificFlowId = flowResult.specificFlowId;
    }
    if (flowResult.agentState) {
      responseMetadata.agentState = sanitizeAgentStateForClient(flowResult.agentState);
    }

    return NextResponse.json(
      {
        success: true,
        message: responseMessage,
        metadata: responseMetadata,
      },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error: any) {
    // ⚠️ LOGGING DETTAGLIATO per debug locale
    console.error('❌ [Anne] Errore Generale:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      cause: error?.cause,
    });
    // ⚠️ SEC-1: NO log di API key info o userId (PII)
    console.error(
      '❌ [Anne] Context: hasSession:',
      !!session,
      'userRole:',
      (session?.user as any)?.role
    );

    // ⚠️ In sviluppo, mostra dettagli completi dell'errore
    const errorDetails =
      process.env.NODE_ENV === 'development'
        ? {
            message: error?.message,
            name: error?.name,
            stack: error?.stack?.split('\n').slice(0, 5).join('\n'), // Prime 5 righe dello stack
          }
        : undefined;

    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        details: errorDetails,
        // ⚠️ In sviluppo, aggiungi suggerimenti
        hint:
          process.env.NODE_ENV === 'development'
            ? "Controlla i log del server per dettagli completi. Verifica che le variabili d'ambiente API siano corrette e che il server sia stato riavviato."
            : undefined,
      },
      { status: 500 }
    );
  }
}
