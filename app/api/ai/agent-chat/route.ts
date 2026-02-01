/**
 * API Route: Anne - Executive Business Partner
 *
 * Endpoint POST per la chat con Anne.
 * Integra Claude 3.5 Sonnet con tools e context building avanzato.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth as getLegacySafeAuth } from '@/lib/safe-auth';
import { buildContext, formatContextForPrompt } from '@/lib/ai/context-builder';
import { runLocalCopilot } from '@/lib/agent/copilot';
import { buildSystemPrompt, getVoicePrompt, getBasePrompt, getAdminPrompt } from '@/lib/ai/prompts';
import { ANNE_TOOLS, executeTool } from '@/lib/ai/tools';
import { getCachedContext, setCachedContext, getContextCacheKey } from '@/lib/ai/cache';
import { supabaseAdmin } from '@/lib/db/client';
import { generateTraceId, logFallbackToLegacy } from '@/lib/telemetry/logger';
import { rateLimit } from '@/lib/security/rate-limit';
import {
  supervisorRouter,
  formatPricingResponse,
} from '@/lib/agent/orchestrator/supervisor-router';
import { getSafeAuth } from '@/lib/safe-auth';
import {
  createAIClient,
  getConfiguredAIProvider,
  getAPIKeyForProvider,
  type AIMessage,
  type AITool,
} from '@/lib/ai/provider-adapter';

// ⚠️ IMPORTANTE: In Next.js, le variabili d'ambiente vengono caricate al runtime
// Non possiamo inizializzare il client qui perché process.env potrebbe non essere ancora disponibile
// Inizializziamo il client dentro la funzione POST

// Rate limiting distribuito (Upstash Redis) - importato da @/lib/rate-limit

/**
 * Converte tools Anne in formato standard per adapter
 */
function formatToolsForAdapter(): AITool[] {
  return ANNE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const traceId = generateTraceId(); // Genera trace_id per telemetria
  let session: any = null;
  let anthropicApiKey: string | undefined = undefined;

  try {
    // ⚠️ AI AGENT: Usa getSafeAuth() per ActingContext (supporta impersonation)
    const actingContext = await getSafeAuth();
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
    // Converti UserRole a 'admin' | 'user' per buildContext
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
    const legacyContext = await getLegacySafeAuth();
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

    // ===== SUPERVISOR ROUTER (Entry Point Unico) =====
    // Il supervisor decide se usare pricing graph o legacy handler
    // ⚠️ AI AGENT: Passa ActingContext a supervisorRouter
    const supervisorResult = await supervisorRouter({
      message: cleanMessage,
      userId: userId as string,
      userEmail: userEmail,
      traceId,
      actingContext, // ⚠️ NUOVO: ActingContext iniettato
      typingNonce, // Typing indicators: nonce dal client
    });

    // Se il supervisor ha una risposta pronta (END con pricing o clarification)
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

      // P2: Aggiungi telemetria per admin/superadmin
      const responseMetadata: any = {
        trace_id: traceId,
        userRole,
        timestamp: new Date().toISOString(),
        isMock: false,
        toolCalls: 0,
        executionTime: Date.now() - startTime,
        rateLimitRemaining: rateLimitResult.remaining,
        usingPricingGraph: supervisorResult.source === 'pricing_graph',
        pricingOptionsCount: supervisorResult.pricingOptions?.length ?? 0,
        supervisorDecision: supervisorResult.decision,
      };

      // Aggiungi telemetria completa solo per admin/superadmin
      if (isAdmin) {
        responseMetadata.telemetry = supervisorResult.telemetry;
      }

      // P4: Includi AgentState nei metadata (per componenti P4)
      if (supervisorResult.agentState) {
        responseMetadata.agentState = supervisorResult.agentState;
      }

      return NextResponse.json({
        success: true,
        message: responseMessage,
        metadata: responseMetadata,
      });
    }

    // Se decision === 'legacy' o 'pricing_worker' senza risultato -> continua con legacy handler
    // (Il supervisor ha già loggato il fallback)
    // ===== FINE SUPERVISOR ROUTER =====

    // Costruisci contesto (con cache)
    let context: any = null;
    try {
      const contextCacheKey = getContextCacheKey(userId, userRole);
      context = getCachedContext(contextCacheKey);

      if (!context) {
        try {
          context = await buildContext(userId, userRole, userName);
          // Cache contesto per 5 minuti
          if (context) {
            setCachedContext(contextCacheKey, context, 300);
          }
        } catch (buildError: any) {
          console.error('⚠️ [Anne] Errore buildContext:', buildError);
          console.error('   Stack:', buildError?.stack);
          // Usa contesto minimo
          context = {
            user: {
              userId,
              userRole,
              userName,
              recentShipments: [],
            },
          };
        }
      }
    } catch (contextError: any) {
      console.error('⚠️ [Anne] Errore costruzione contesto (continuo comunque):', contextError);
      console.error('   Stack:', contextError?.stack);
      // Continua anche se il contesto fallisce
      context = {
        user: {
          userId,
          userRole,
          userName,
          recentShipments: [],
        },
      };
    }

    // ⚠️ Verifica che context sia valido
    if (!context || !context.user) {
      console.warn('⚠️ [Anne] Context non valido, uso default');
      context = {
        user: {
          userId,
          userRole,
          userName,
          recentShipments: [],
        },
      };
    }

    // ===== COPILOT LOCALE (TinyLlama/Qwen) =====
    // Prova prima il LLM locale, fallback a Claude se non disponibile
    try {
      const contextSummary = formatContextForPrompt(context);
      const localCopilotResult = await runLocalCopilot({
        message: cleanMessage,
        history: messages,
        contextSummary,
        userId: userId as string,
        userRole,
        isAdmin,
        actingContext,
      });

      if (localCopilotResult.status === 'handled' && localCopilotResult.message) {
        const responseMetadata: any = {
          trace_id: traceId,
          userRole,
          timestamp: new Date().toISOString(),
          isMock: false,
          toolCalls: localCopilotResult.toolCalls?.length ?? 0,
          executionTime: Date.now() - startTime,
          rateLimitRemaining: rateLimitResult.remaining,
          usingLocalLLM: true,
        };

        if (localCopilotResult.metadata) {
          responseMetadata.copilot = localCopilotResult.metadata;
        }

        console.log(`✅ [Anne] Risposta da copilot locale (${Date.now() - startTime}ms)`);
        return NextResponse.json({
          success: true,
          message: localCopilotResult.message,
          metadata: responseMetadata,
        });
      }

      // status === 'fallback' -> continua con Claude API
      if (localCopilotResult.fallbackReason) {
        console.log(`🔄 [Anne] Copilot fallback: ${localCopilotResult.fallbackReason}`);
      }
    } catch (copilotError: any) {
      // LLM locale non disponibile, fallback silenzioso a Claude
      console.log(
        `🔄 [Anne] Copilot non disponibile: ${copilotError?.message || 'errore sconosciuto'}`
      );
    }
    // ===== FINE COPILOT LOCALE =====

    // Costruisci system prompt
    // ⚠️ Verifica che context abbia la struttura corretta
    let systemPrompt: string;
    try {
      if (isVoiceInput) {
        systemPrompt = getVoicePrompt();
      } else {
        // ⚠️ Assicura che context abbia almeno la struttura minima
        const safeContext =
          context && context.user
            ? context
            : {
                user: {
                  userId,
                  userRole,
                  userName,
                  recentShipments: [],
                },
              };
        systemPrompt = buildSystemPrompt(safeContext as any, isAdmin);
      }
    } catch (promptError: any) {
      console.error('❌ [Anne] Errore costruzione system prompt:', promptError);
      // Usa prompt di base come fallback
      systemPrompt = isAdmin ? getAdminPrompt() : getBasePrompt();
    } // Prepara messaggi per Claude
    const claudeMessages: any[] = [];

    // Aggiungi storia conversazione (ultimi 10 messaggi per limitare token)
    const recentMessages = messages.slice(-10);
    for (const msg of recentMessages) {
      if (msg.role === 'user') {
        claudeMessages.push({
          role: 'user',
          content: msg.content.replace('[VOX]', ''),
        });
      } else if (msg.role === 'assistant') {
        claudeMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    // Aggiungi messaggio corrente
    claudeMessages.push({
      role: 'user',
      content: isVoiceInput ? userMessage.replace('[VOX]', '') : userMessage,
    });

    // ⚠️ Validazione: Claude richiede almeno un messaggio non vuoto
    if (claudeMessages.length === 0 || !claudeMessages[claudeMessages.length - 1].content.trim()) {
      console.warn('⚠️ [Anne] Messaggio vuoto, uso greeting di default');
      claudeMessages[claudeMessages.length - 1].content = 'Ciao Anne, come va?';
    }

    // ⚠️ Ottieni provider AI configurato dal database
    const { provider: aiProvider, model: aiModel } = await getConfiguredAIProvider();
    const apiKey = getAPIKeyForProvider(aiProvider);

    // Usa AI se disponibile
    let aiResponse = '';
    let toolCalls: any[] = [];
    let isMock = false;
    let aiClient = null;

    if (apiKey) {
      try {
        // ⚠️ SEC-1: NO log di API key - solo info non sensibili
        console.log(`🤖 [Anne] Chiamata ${aiProvider.toUpperCase()} API in corso...`);

        // Crea client AI usando adapter
        aiClient = await createAIClient(aiProvider, apiKey, aiModel);

        // ⚠️ Verifica che systemPrompt e claudeMessages siano validi
        if (!systemPrompt || systemPrompt.trim().length === 0) {
          throw new Error('System prompt vuoto o non valido');
        }
        if (!claudeMessages || claudeMessages.length === 0) {
          throw new Error("Nessun messaggio da inviare all'AI");
        }

        // Converte messaggi in formato adapter
        const adapterMessages: AIMessage[] = claudeMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        }));

        // Chiama AI con adapter
        const response = await aiClient.chat({
          model: aiModel,
          maxTokens: 4096,
          system: systemPrompt,
          messages: adapterMessages,
          tools: formatToolsForAdapter(),
        });

        // ⚠️ Verifica che response sia valida
        if (!response || !response.content) {
          throw new Error('Risposta AI non valida: content mancante');
        }

        console.log(`✅ [Anne] Risposta ${aiProvider.toUpperCase()} ricevuta`);

        // Estrae contenuto e tool calls dalla risposta
        aiResponse = response.content;
        if (response.toolCalls && response.toolCalls.length > 0) {
          toolCalls = response.toolCalls.map((tc, index) => ({
            id: `tool_${index}_${Date.now()}`,
            name: tc.name,
            arguments: tc.arguments || {},
          }));
        }

        // Esegui tool calls se presenti
        if (toolCalls.length > 0) {
          const toolResults: any[] = [];

          for (const toolCall of toolCalls) {
            try {
              // ⚠️ Verifica che toolCall sia valido
              if (!toolCall || !toolCall.name) {
                console.error('❌ [Anne] Tool call non valido:', toolCall);
                toolResults.push({
                  tool_use_id: toolCall?.id || 'unknown',
                  content: 'Errore: tool call non valido',
                });
                continue;
              }

              const result = await executeTool(
                {
                  name: toolCall.name,
                  arguments: toolCall.arguments || {},
                },
                userId,
                userRole
              );

              // ⚠️ Verifica che result sia valido
              if (!result) {
                console.error('❌ [Anne] Result tool è undefined per:', toolCall.name);
                toolResults.push({
                  tool_use_id: toolCall.id,
                  content: 'Errore: risultato tool non valido',
                });
                continue;
              }

              toolResults.push({
                tool_use_id: toolCall.id,
                content:
                  result.success && result.result
                    ? JSON.stringify(result.result)
                    : `Errore: ${result.error || 'Errore sconosciuto'}`,
              });
            } catch (toolError: any) {
              console.error('❌ [Anne] Errore esecuzione tool:', {
                toolName: toolCall?.name,
                error: toolError?.message,
                stack: toolError?.stack,
              });
              toolResults.push({
                tool_use_id: toolCall?.id || 'unknown',
                content: `Errore esecuzione tool: ${toolError?.message || 'Errore sconosciuto'}`,
              });
            }
          }

          // Seconda chiamata all'AI con risultati tools
          if (aiClient) {
            // Aggiungi messaggio assistant con tool calls e risultati
            const followUpMessages: AIMessage[] = [
              ...adapterMessages,
              {
                role: 'assistant',
                content: `Ho eseguito ${toolCalls.length} tool(s).`,
              },
              {
                role: 'user',
                content: `Risultati tools:\n${toolResults.map((r) => r.content).join('\n\n')}`,
              },
            ];

            const followUpResponse = await aiClient.chat({
              model: aiModel,
              maxTokens: 4096,
              system: systemPrompt,
              messages: followUpMessages,
            });

            // Aggiungi risposta finale
            if (followUpResponse && followUpResponse.content) {
              aiResponse = followUpResponse.content || aiResponse;
            }
          }
        }

        isMock = false;
      } catch (aiError: any) {
        // ⚠️ LOGGING DETTAGLIATO per debug locale
        // ⚠️ APPROCCIO ULTRA-SICURO: Zero accesso diretto a proprietà potenzialmente problematiche
        const apiKeyEnv = aiProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'DEEPSEEK_API_KEY';
        const errorDetails: any = {
          message: `Errore API ${aiProvider}`,
          status: undefined,
          statusCode: undefined,
          type: 'unknown',
          error: undefined,
          name: 'APIError',
        };

        // ⚠️ Usa una funzione helper sicura per estrarre proprietà
        const safeGetProp = (obj: any, prop: string, defaultVal: any = undefined): any => {
          try {
            if (obj && typeof obj === 'object' && prop in obj) {
              const val = obj[prop];
              // Verifica che il valore non sia un oggetto complesso o getter problematico
              if (val !== null && val !== undefined && typeof val !== 'object') {
                return val;
              }
            }
          } catch {
            // Ignora qualsiasi errore
          }
          return defaultVal;
        };

        // Estrai proprietà in modo sicuro
        errorDetails.message = safeGetProp(aiError, 'message', `Errore API ${aiProvider}`);
        errorDetails.status = safeGetProp(
          aiError,
          'status',
          safeGetProp(aiError, 'statusCode', undefined)
        );
        errorDetails.statusCode = errorDetails.status;
        errorDetails.type = safeGetProp(aiError, 'type', 'api_error');
        errorDetails.name = safeGetProp(aiError, 'name', 'APIError');
        errorDetails.error = errorDetails.message;

        // Log sicuro
        // ⚠️ SEC-1: NO log di API key - solo info non sensibili
        console.error(`❌ [Anne] Errore ${aiProvider.toUpperCase()} API:`, {
          message: errorDetails.message,
          status: errorDetails.status,
          type: errorDetails.type,
        });

        // ⚠️ Messaggio di errore più specifico in base al tipo di errore
        let errorMessage = '';
        const statusCode = errorDetails.statusCode || errorDetails.status;

        if (statusCode === 401) {
          errorMessage = `🔑 Errore autenticazione API: verifica che ${apiKeyEnv} sia corretta`;
        } else if (statusCode === 429) {
          errorMessage =
            '⏱️ Troppe richieste: hai raggiunto il limite di rate. Riprova tra qualche minuto.';
        } else if (statusCode === 400) {
          errorMessage = '⚠️ Richiesta non valida: verifica il formato dei messaggi.';
        } else {
          const safeMessage = errorDetails.message || 'Errore sconosciuto';
          errorMessage = `⚠️ Errore tecnico: ${safeMessage}. Verifica i log del server per dettagli.`;
        }

        // Fallback a risposta mock con messaggio di errore più utile
        isMock = true;
        const userName = (session?.user?.name || 'utente').split(' ')[0];
        aiResponse = `Ciao ${userName}! 👋 Sono Anne, il tuo Executive Business Partner.\n\n${errorMessage}\n\n💡 Suggerimenti:\n- Verifica che ${apiKeyEnv} sia configurata correttamente\n- Riavvia il server dopo modifiche alle variabili d'ambiente\n- Controlla che la chiave sia valida e non scaduta\n\nCome posso aiutarti?`;
      }
    } else {
      // Fallback mock se AI non configurato
      const userName = (session?.user?.name || 'utente').split(' ')[0];
      const apiKeyEnv = aiProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'DEEPSEEK_API_KEY';

      // ⚠️ SEC-1: NO log di API key info
      console.warn(
        `⚠️ [Anne] ${aiProvider.toUpperCase()} non disponibile - verificare configurazione`
      );

      isMock = true;
      if (!userMessage.trim()) {
        const roleMessage = isAdmin
          ? '\n\nMonitoro business, finanza e sistemi. Posso analizzare margini, diagnosticare errori tecnici e proporre strategie di ottimizzazione.'
          : '\n\nSono qui per aiutarti con le tue spedizioni, calcolare costi ottimali e risolvere problemi operativi.';
        aiResponse = `Ciao ${userName}! 👋 Sono Anne, il tuo Executive Business Partner.${roleMessage}\n\n💡 Per attivare l'AI avanzata, configura ${apiKeyEnv} e riavvia il server.\n\nCome posso aiutarti oggi?`;
      } else {
        aiResponse = `Ciao ${userName}! 👋\n\nHo capito la tua richiesta: "${userMessage}".\n\n💡 Per darti una risposta più precisa, configura ${apiKeyEnv} e riavvia il server.`;
      }
    }

    // Log audit (solo se admin o in caso di errori)
    // NOTA: user_id nel DB è OK (necessario per audit), ma non va nei log strutturati
    if (isAdmin || !isMock) {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          severity: 'info',
          message: 'Anne conversation completed',
          metadata: {
            trace_id: traceId, // Trace ID per telemetria
            userRole, // Role è OK (non PII)
            isMock,
            toolCallsCount: toolCalls.length,
            executionTime: Date.now() - startTime,
            // NO email, NO userName nei metadata (PII)
          },
        });
      } catch (logError) {
        // Non bloccare la risposta per errori di log
        console.error('Errore log audit:', logError);
      }
    }

    // ⚠️ Verifica che aiResponse non sia vuoto
    if (!aiResponse || aiResponse.trim().length === 0) {
      console.warn('⚠️ [Anne] Risposta vuota, uso messaggio di fallback');
      aiResponse = `Ciao ${userName}! 👋\n\nMi dispiace, non sono riuscita a generare una risposta. Riprova tra qualche secondo.`;
    }

    // Telemetria: log fallback legacy (supervisor ha già loggato)

    // P2: Aggiungi telemetria per admin/superadmin (se disponibile da supervisor)
    const legacyMetadata: any = {
      trace_id: traceId, // Trace ID per telemetria
      userRole, // Role è OK (non PII)
      timestamp: new Date().toISOString(),
      isMock,
      toolCalls: toolCalls.length,
      executionTime: Date.now() - startTime,
      rateLimitRemaining: rateLimitResult.remaining,
      usingAI: !isMock && !!aiClient,
      aiProvider: aiProvider,
      usingPricingGraph: false, // Legacy path
      // NO userId, NO email nei metadata (PII)
    };

    // Aggiungi telemetria completa solo per admin/superadmin (se supervisorResult esiste)
    // Nota: Nel path legacy puro, supervisorResult potrebbe non esistere
    if (isAdmin && typeof supervisorResult !== 'undefined' && supervisorResult?.telemetry) {
      legacyMetadata.telemetry = supervisorResult.telemetry;
    }

    // Restituisci risposta JSON (NO PII nei metadata)
    return NextResponse.json(
      {
        success: true,
        message: aiResponse,
        metadata: legacyMetadata,
      },
      {
        // ⚠️ Assicura che la risposta sia sempre JSON valido
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
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
