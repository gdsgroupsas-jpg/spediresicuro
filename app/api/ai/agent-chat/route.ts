/**
 * API Route: Anne - Executive Business Partner
 * 
 * Endpoint POST per la chat con Anne.
 * Integra Claude 3.5 Sonnet con tools e context building avanzato.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import Anthropic from '@anthropic-ai/sdk';
import { buildContext } from '@/lib/ai/context-builder';
import { buildSystemPrompt, getVoicePrompt, getBasePrompt, getAdminPrompt } from '@/lib/ai/prompts';
import { ANNE_TOOLS, executeTool } from '@/lib/ai/tools';
import { getCachedContext, setCachedContext, getContextCacheKey } from '@/lib/ai/cache';
import { supabaseAdmin } from '@/lib/db/client';
import { detectPricingIntent } from '@/lib/agent/intent-detector';
import { pricingGraph } from '@/lib/agent/orchestrator/pricing-graph';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';

// ⚠️ IMPORTANTE: In Next.js, le variabili d'ambiente vengono caricate al runtime
// Non possiamo inizializzare il client qui perché process.env potrebbe non essere ancora disponibile
// Inizializziamo il client dentro la funzione POST

// Debug: Verifica API key (verrà eseguito ad ogni richiesta)
function getAnthropicClient() {
  // ⚠️ Leggi la variabile ad ogni chiamata (per locale, assicura che sia sempre aggiornata)
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  // ⚠️ LOGGING DETTAGLIATO per debug
  console.log('🔍 [Anne] Verifica Environment Variables (runtime):');
  console.log('   ANTHROPIC_API_KEY presente:', !!anthropicApiKey);
  console.log('   ANTHROPIC_API_KEY lunghezza:', anthropicApiKey?.length || 0);
  console.log('   ANTHROPIC_API_KEY primi 20 char:', anthropicApiKey?.substring(0, 20) || 'NESSUNA');
  console.log('   NODE_ENV:', process.env.NODE_ENV);
  console.log('   Tutte le env keys con ANTHROPIC:', Object.keys(process.env).filter(k => k.includes('ANTHROPIC') || k.includes('CLAUDE')));
  
  if (anthropicApiKey) {
    console.log('✅ [Anne] ANTHROPIC_API_KEY trovata, creo client');
    return new Anthropic({ apiKey: anthropicApiKey });
  } else {
    console.error('❌ [Anne] ANTHROPIC_API_KEY NON TROVATA!');
    console.error('   Verifica:');
    console.error('   1. File .env.local esiste nella root del progetto');
    console.error('   2. Riga: ANTHROPIC_API_KEY=sk-ant-... (senza spazi, non commentata)');
    console.error('   3. Server riavviato dopo aver aggiunto la chiave');
    return null;
  }
}

// Rate limiting semplice (in-memory, per produzione usare Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // Max 20 richieste
const RATE_LIMIT_WINDOW = 60 * 1000; // Per finestra di 1 minuto

/**
 * Verifica rate limiting
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetAt) {
    // Reset o nuova finestra
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

/**
 * Converte tools Anne in formato Anthropic
 */
function formatToolsForAnthropic() {
  return ANNE_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let session: any = null;
  let anthropicApiKey: string | undefined = undefined;
  
  try {
    // Verifica sessione utente
    session = await auth();
    
    if (!session || !session.user) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Non autenticato' 
        },
        { status: 401 }
      );
    }

    // Estrai dati utente dalla sessione
    const userId = session.user.id;
    const userRole = (session.user as any).role || 'user';
    const userName = session.user.name || session.user.email || 'Utente';
    const isAdmin = userRole === 'admin';

    // Verifica che userId sia definito
    if (!userId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID utente non trovato nella sessione',
        },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimit = checkRateLimit(userId as string);
    if (!rateLimit.allowed) {
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
          error: 'Richiesta non valida: body JSON non valido'
        },
        { status: 400 }
      );
    }
    
    const userMessage = body.message || '';
    const messages = body.messages || []; // Storia conversazione
    const isVoiceInput = userMessage.startsWith('[VOX]');
    const cleanMessage = isVoiceInput ? userMessage.replace('[VOX]', '') : userMessage;

    // ===== FASE 5: INTEGRAZIONE PRICING GRAPH =====
    // Rileva se l'intento è "preventivo" (SAFE: con try/catch)
    let isPricingIntent = false;
    try {
      isPricingIntent = await detectPricingIntent(cleanMessage, false); // Usa pattern matching veloce
    } catch (intentError: any) {
      console.error('❌ [Anne] Errore intent detector, fallback a legacy:', intentError);
      isPricingIntent = false; // SAFE: In caso di errore, usa legacy
    }
    
    if (isPricingIntent) {
      console.log('💰 [Anne] Rilevato intento preventivo, uso Pricing Graph');
      
      try {
        // Prepara stato iniziale per il grafo (formato canali LangGraph)
        const initialState = {
          messages: [new HumanMessage(cleanMessage)],
          userId: userId,
          userEmail: session.user.email || '',
          shipmentData: {},
          processingStatus: 'idle' as const,
          validationErrors: [],
          confidenceScore: 0,
          needsHumanReview: false,
          iteration_count: 0,
        };
        
        // Esegui il grafo
        const result = await pricingGraph.invoke(initialState) as unknown as AgentState;
        
        // Formatta risposta
        let responseMessage = '';
        
        if (result.pricing_options && Array.isArray(result.pricing_options) && result.pricing_options.length > 0) {
          // Abbiamo preventivi!
          const bestOption = result.pricing_options[0];
          const otherOptions = result.pricing_options.slice(1, 4); // Mostra max 3 alternative
          
          responseMessage = `💰 **Preventivo Spedizione**\n\n`;
          responseMessage += `**Opzione Consigliata:**\n`;
          responseMessage += `• Corriere: ${bestOption.courier}\n`;
          responseMessage += `• Servizio: ${bestOption.serviceType}\n`;
          responseMessage += `• Prezzo: €${bestOption.finalPrice.toFixed(2)}\n`;
          responseMessage += `• Consegna stimata: ${bestOption.estimatedDeliveryDays.min}-${bestOption.estimatedDeliveryDays.max} giorni\n\n`;
          
          if (otherOptions.length > 0) {
            responseMessage += `**Altre opzioni disponibili:**\n`;
            otherOptions.forEach((opt: typeof bestOption, idx: number) => {
              responseMessage += `${idx + 2}. ${opt.courier} (${opt.serviceType}): €${opt.finalPrice.toFixed(2)}\n`;
            });
          }
          
          responseMessage += `\n💡 *Prezzi calcolati con margine applicato. I dati sono indicativi.*`;
        } else if (result.clarification_request && typeof result.clarification_request === 'string') {
          // Serve chiarimento
          responseMessage = result.clarification_request;
        } else {
          // Errore generico
          responseMessage = 'Mi dispiace, non sono riuscito a calcolare un preventivo. Puoi fornirmi peso, CAP e provincia di destinazione?';
        }
        
        // Restituisci risposta
        return NextResponse.json({
          success: true,
          message: responseMessage,
          metadata: {
            userId,
            userRole,
            timestamp: new Date().toISOString(),
            isMock: false,
            toolCalls: 0,
            executionTime: Date.now() - startTime,
            rateLimitRemaining: rateLimit.remaining,
            usingPricingGraph: true,
            pricingOptionsCount: (result.pricing_options && Array.isArray(result.pricing_options)) ? result.pricing_options.length : 0,
          }
        });
        
      } catch (pricingError: any) {
        console.error('❌ [Anne] Errore Pricing Graph:', pricingError);
        // Fallback a codice legacy se il grafo fallisce
        console.log('⚠️ [Anne] Fallback a codice legacy dopo errore Pricing Graph');
        // Continua con il codice legacy sotto
      }
    }
    // ===== FINE INTEGRAZIONE PRICING GRAPH =====

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
              recentShipments: []
            } 
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
          recentShipments: []
        } 
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
          recentShipments: []
        } 
      };
    }

    // Costruisci system prompt
    // ⚠️ Verifica che context abbia la struttura corretta
    let systemPrompt: string;
    try {
      if (isVoiceInput) {
        systemPrompt = getVoicePrompt();
      } else {
        // ⚠️ Assicura che context abbia almeno la struttura minima
        const safeContext = context && context.user 
          ? context 
          : { 
              user: { 
                userId, 
                userRole, 
                userName,
                recentShipments: []
              } 
            };
        systemPrompt = buildSystemPrompt(safeContext as any, isAdmin);
      }
    } catch (promptError: any) {
      console.error('❌ [Anne] Errore costruzione system prompt:', promptError);
      // Usa prompt di base come fallback
      systemPrompt = isAdmin ? getAdminPrompt() : getBasePrompt();
    }    // Prepara messaggi per Claude
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

    // ⚠️ Ottieni il client Anthropic (inizializzato ad ogni richiesta per locale)
    anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const claudeClient = getAnthropicClient();

    // Usa Claude AI se disponibile
    let aiResponse = '';
    let toolCalls: any[] = [];
    let isMock = false;

    if (claudeClient && anthropicApiKey) {
      try {
        console.log('🤖 [Anne] Chiamata Claude API in corso...');
        console.log('   API Key presente:', anthropicApiKey ? 'SI (lunghezza: ' + anthropicApiKey.length + ')' : 'NO');
        console.log('   API Key inizia con:', anthropicApiKey?.substring(0, 15) || 'NESSUNA');
        console.log('   Model:', 'claude-3-haiku-20240307');
        console.log('   Messages count:', claudeMessages.length);
        console.log('   System prompt length:', systemPrompt.length);
        console.log('   User message:', userMessage.substring(0, 100) + (userMessage.length > 100 ? '...' : ''));
        
        // Chiama Claude 3 Haiku con tools (3.5 Sonnet non disponibile con questa API key)
        // ⚠️ Verifica che systemPrompt e claudeMessages siano validi
        if (!systemPrompt || systemPrompt.trim().length === 0) {
          throw new Error('System prompt vuoto o non valido');
        }
        if (!claudeMessages || claudeMessages.length === 0) {
          throw new Error('Nessun messaggio da inviare a Claude');
        }
        
        const response = await claudeClient.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 4096,
          system: systemPrompt,
          messages: claudeMessages,
          tools: formatToolsForAnthropic(),
        });
        
        // ⚠️ Verifica che response sia valida
        if (!response || !response.content) {
          throw new Error('Risposta Claude non valida: content mancante');
        }
        
        console.log('✅ [Anne] Risposta Claude ricevuta:', response.content.length, 'blocks');

        // Processa risposta
        // ⚠️ Verifica che response.content esista
        if (!response || !response.content || !Array.isArray(response.content)) {
          throw new Error('Risposta Claude non valida: content mancante o non array');
        }
        
        const contentBlocks = response.content;
        
        for (const block of contentBlocks) {
          if (block && block.type === 'text' && (block as any).text) {
            aiResponse += (block as any).text;
          } else if (block && block.type === 'tool_use') {
            // Anne vuole usare un tool
            toolCalls.push({
              id: (block as any).id,
              name: (block as any).name,
              arguments: (block as any).input || {},
            });
          }
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
                content: result.success && result.result
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

          // Seconda chiamata a Claude con risultati tools
          // ⚠️ Verifica che contentBlocks sia definito prima di usarlo
          const textBlocks = contentBlocks
            .filter((b: any) => b && b.type === 'text' && b.text)
            .map((b: any) => ({
              type: 'text',
              text: b.text,
            }));

          // ⚠️ Formatta correttamente i tool results per Claude API
          const formattedToolResults = toolResults.map(result => ({
            type: 'tool_result',
            tool_use_id: result.tool_use_id,
            content: result.content,
          }));

          const followUpResponse = await claudeClient.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
              ...claudeMessages,
              {
                role: 'assistant',
                content: contentBlocks, // Usa contentBlocks originali (include tool_use)
              },
              {
                role: 'user',
                content: formattedToolResults,
              },
            ],
          });

          // Aggiungi risposta finale
          // ⚠️ Verifica che followUpResponse.content esista
          if (followUpResponse && followUpResponse.content && Array.isArray(followUpResponse.content)) {
            const finalText = followUpResponse.content
              .filter((b: any) => b && b.type === 'text' && b.text)
              .map((b: any) => b.text)
              .join('\n');
            
            aiResponse = finalText || aiResponse;
          }
        }

        isMock = false;
      } catch (claudeError: any) {
        // ⚠️ LOGGING DETTAGLIATO per debug locale
        // ⚠️ APPROCCIO ULTRA-SICURO: Zero accesso diretto a proprietà potenzialmente problematiche
        const errorDetails: any = {
          message: 'Errore API Claude',
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
        errorDetails.message = safeGetProp(claudeError, 'message', 'Errore API Claude');
        errorDetails.status = safeGetProp(claudeError, 'status', safeGetProp(claudeError, 'statusCode', undefined));
        errorDetails.statusCode = errorDetails.status;
        errorDetails.type = safeGetProp(claudeError, 'type', 'api_error');
        errorDetails.name = safeGetProp(claudeError, 'name', 'APIError');
        errorDetails.error = errorDetails.message;
        
        // Log sicuro
        console.error('❌ [Anne] Errore Claude API:', {
          message: errorDetails.message,
          status: errorDetails.status,
          type: errorDetails.type,
        });
        
        console.error('❌ [Anne] API Key presente:', !!anthropicApiKey);
        console.error('❌ [Anne] API Key lunghezza:', anthropicApiKey?.length || 0);
        console.error('❌ [Anne] API Key inizia con:', anthropicApiKey?.substring(0, 10) || 'NESSUNA');
        
        // ⚠️ Messaggio di errore più specifico in base al tipo di errore
        let errorMessage = '';
        const statusCode = errorDetails.statusCode || errorDetails.status;
        
        if (statusCode === 401) {
          errorMessage = '🔑 Errore autenticazione API: verifica che ANTHROPIC_API_KEY sia corretta';
        } else if (statusCode === 429) {
          errorMessage = '⏱️ Troppe richieste: hai raggiunto il limite di rate. Riprova tra qualche minuto.';
        } else if (statusCode === 400) {
          errorMessage = '⚠️ Richiesta non valida: verifica il formato dei messaggi.';
        } else {
          const safeMessage = errorDetails.message || 'Errore sconosciuto';
          errorMessage = `⚠️ Errore tecnico: ${safeMessage}. Verifica i log del server per dettagli.`;
        }
        
        // Fallback a risposta mock con messaggio di errore più utile
        isMock = true;
        const userName = (session?.user?.name || 'utente').split(' ')[0];
        aiResponse = `Ciao ${userName}! 👋 Sono Anne, il tuo Executive Business Partner.\n\n${errorMessage}\n\n💡 Suggerimenti:\n- Verifica che ANTHROPIC_API_KEY sia configurata correttamente\n- Riavvia il server dopo modifiche alle variabili d'ambiente\n- Controlla che la chiave sia valida e non scaduta\n\nCome posso aiutarti?`;
      }
    } else {
      // Fallback mock se Claude non configurato
      const userName = (session?.user?.name || 'utente').split(' ')[0];
      
      console.warn('⚠️ [Anne] Claude non disponibile:', {
        hasClient: !!claudeClient,
        hasApiKey: !!anthropicApiKey,
        apiKeyLength: anthropicApiKey?.length || 0,
        nodeEnv: process.env.NODE_ENV,
      });
      
      isMock = true;
      if (!userMessage.trim()) {
        const roleMessage = isAdmin 
          ? '\n\nMonitoro business, finanza e sistemi. Posso analizzare margini, diagnosticare errori tecnici e proporre strategie di ottimizzazione.' 
          : '\n\nSono qui per aiutarti con le tue spedizioni, calcolare costi ottimali e risolvere problemi operativi.';
        aiResponse = `Ciao ${userName}! 👋 Sono Anne, il tuo Executive Business Partner.${roleMessage}\n\n💡 Per attivare l'AI avanzata, configura ANTHROPIC_API_KEY e riavvia il server.\n\nCome posso aiutarti oggi?`;
      } else {
        aiResponse = `Ciao ${userName}! 👋\n\nHo capito la tua richiesta: "${userMessage}".\n\n💡 Per darti una risposta più precisa, configura ANTHROPIC_API_KEY e riavvia il server.`;
      }
    }

    // Log audit (solo se admin o in caso di errori)
    if (isAdmin || !isMock) {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          severity: 'info',
          message: 'Anne conversation completed',
          metadata: {
            userRole,
            isMock,
            toolCallsCount: toolCalls.length,
            executionTime: Date.now() - startTime,
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

    // Restituisci risposta JSON
    return NextResponse.json({
      success: true,
      message: aiResponse,
      metadata: {
        userId,
        userRole,
        timestamp: new Date().toISOString(),
        isMock,
        toolCalls: toolCalls.length,
        executionTime: Date.now() - startTime,
        rateLimitRemaining: rateLimit.remaining,
        usingClaude: !isMock && !!claudeClient,
      }
    }, {
      // ⚠️ Assicura che la risposta sia sempre JSON valido
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

  } catch (error: any) {
    // ⚠️ LOGGING DETTAGLIATO per debug locale
    console.error('❌ [Anne] Errore Generale:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      cause: error?.cause,
    });
    console.error('❌ [Anne] Context:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userRole: (session?.user as any)?.role,
      hasApiKey: !!anthropicApiKey,
      apiKeyLength: anthropicApiKey?.length || 0,
    });
    
    // ⚠️ In sviluppo, mostra dettagli completi dell'errore
    const errorDetails = process.env.NODE_ENV === 'development' 
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
        hint: process.env.NODE_ENV === 'development' 
          ? 'Controlla i log del server per dettagli completi. Verifica che ANTHROPIC_API_KEY sia corretta e che il server sia stato riavviato.'
          : undefined
      },
      { status: 500 }
    );
  }
}
