/**
 * API Route: Anne Chat (DEPRECATED - Redirect to unified endpoint)
 *
 * ⚠️ DEPRECATED: Questo endpoint è deprecato in favore di /api/ai/agent-chat.
 * Mantenuto per compatibilità retroattiva, ma tutte le nuove richieste
 * dovrebbero usare /api/ai/agent-chat che usa supervisorRouter().
 *
 * Ref: PROMPT_IMPLEMENTAZIONE_AI_AGENT.md Task 5
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import {
  supervisorRouter,
  formatPricingResponse,
} from '@/lib/agent/orchestrator/supervisor-router';
import { generateTraceId } from '@/lib/telemetry/logger';
import { rateLimit } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const traceId = generateTraceId();

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

    // Rate limiting distribuito
    const rateLimitResult = await rateLimit('agent-chat', userId);
    if (!rateLimitResult.allowed) {
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
      return NextResponse.json(
        {
          success: false,
          error: 'Richiesta non valida: body JSON non valido',
        },
        { status: 400 }
      );
    }

    const userMessage = body.message || '';
    const cleanMessage = userMessage.startsWith('[VOX]')
      ? userMessage.replace('[VOX]', '')
      : userMessage;

    // ===== SUPERVISOR ROUTER (Entry Point Unico) =====
    // Il supervisor decide se usare pricing graph, mentor worker, o legacy handler
    const supervisorResult = await supervisorRouter({
      message: cleanMessage,
      userId: userId as string,
      userEmail: userEmail,
      traceId,
      actingContext, // ⚠️ ActingContext iniettato
    });

    // Se il supervisor ha una risposta pronta (END con pricing, clarification, o mentor)
    if (supervisorResult.decision === 'END') {
      let responseMessage = '';

      if (supervisorResult.pricingOptions && supervisorResult.pricingOptions.length > 0) {
        // Formatta risposta pricing
        responseMessage = formatPricingResponse(supervisorResult.pricingOptions);
      } else if (supervisorResult.clarificationRequest) {
        // Serve chiarimento
        responseMessage = supervisorResult.clarificationRequest;
      } else {
        // Fallback
        responseMessage =
          'Mi dispiace, non sono riuscita a elaborare la richiesta. Come posso aiutarti?';
      }

      return NextResponse.json({
        success: true,
        message: responseMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          trace_id: traceId,
          executionTime: Date.now() - startTime,
          usingPricingGraph: supervisorResult.source === 'pricing_graph',
        },
      });
    }

    // Se decision === 'legacy' -> continua con legacy handler (per compatibilità)
    // NOTA: Il legacy handler originale è stato rimosso, quindi restituiamo un messaggio
    // che indica che la funzionalità è stata migrata al nuovo sistema
    return NextResponse.json({
      success: true,
      message:
        'La richiesta è stata processata dal nuovo sistema AI Agent. Se hai bisogno di funzionalità fiscali specifiche, contatta il supporto.',
      timestamp: new Date().toISOString(),
      metadata: {
        trace_id: traceId,
        executionTime: Date.now() - startTime,
        deprecated: true,
        redirect_to: '/api/ai/agent-chat',
      },
    });
  } catch (error: any) {
    console.error('❌ [Anne Chat] Errore Generale:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
