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
import { buildSystemPrompt, getVoicePrompt } from '@/lib/ai/prompts';
import { ANNE_TOOLS, executeTool } from '@/lib/ai/tools';
import { getCachedContext, setCachedContext, getContextCacheKey } from '@/lib/ai/cache';
import { supabaseAdmin } from '@/lib/db/client';

// Inizializza Claude client
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const claudeClient = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

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
  
  try {
    // Verifica sessione utente
    const session = await auth();
    
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
    const body = await request.json();
    const userMessage = body.message || '';
    const messages = body.messages || []; // Storia conversazione
    const isVoiceInput = userMessage.startsWith('[VOX]');

    // Costruisci contesto (con cache)
    const contextCacheKey = getContextCacheKey(userId, userRole);
    let context = getCachedContext(contextCacheKey);
    
    if (!context) {
      context = await buildContext(userId, userRole, userName);
      // Cache contesto per 5 minuti
      setCachedContext(contextCacheKey, context, 300);
    }

    // Costruisci system prompt
    const systemPrompt = isVoiceInput 
      ? getVoicePrompt() 
      : buildSystemPrompt(context, isAdmin);

    // Prepara messaggi per Claude
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

    // Usa Claude AI se disponibile
    let aiResponse = '';
    let toolCalls: any[] = [];
    let isMock = false;

    if (claudeClient && anthropicApiKey) {
      try {
        // Chiama Claude 3.5 Sonnet con tools
        const response = await claudeClient.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: claudeMessages,
          tools: formatToolsForAnthropic(),
        });

        // Processa risposta
        const contentBlocks = response.content;
        
        for (const block of contentBlocks) {
          if (block.type === 'text') {
            aiResponse += block.text;
          } else if (block.type === 'tool_use') {
            // Anne vuole usare un tool
            toolCalls.push({
              id: block.id,
              name: block.name,
              arguments: block.input,
            });
          }
        }

        // Esegui tool calls se presenti
        if (toolCalls.length > 0) {
          const toolResults: any[] = [];
          
          for (const toolCall of toolCalls) {
            const result = await executeTool(
              {
                name: toolCall.name,
                arguments: toolCall.arguments,
              },
              userId,
              userRole
            );
            
            toolResults.push({
              tool_use_id: toolCall.id,
              content: result.success
                ? JSON.stringify(result.result)
                : `Errore: ${result.error}`,
            });
          }

          // Seconda chiamata a Claude con risultati tools
          const followUpResponse = await claudeClient.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
              ...claudeMessages,
              {
                role: 'assistant',
                content: contentBlocks.filter(b => b.type === 'text').map(b => ({
                  type: 'text',
                  text: (b as any).text,
                })),
              },
              {
                role: 'user',
                content: toolResults,
              },
            ],
          });

          // Aggiungi risposta finale
          const finalText = followUpResponse.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n');
          
          aiResponse = finalText || aiResponse;
        }

        isMock = false;
      } catch (claudeError: any) {
        console.error('❌ [Anne] Errore Claude API:', claudeError);
        
        // Fallback a risposta mock
        isMock = true;
        aiResponse = `Ciao ${userName}! 👋 Sono Anne, il tuo Executive Business Partner.${isAdmin ? '\n\nMi dispiace, al momento non posso accedere all\'AI avanzata. Come posso aiutarti?' : '\n\nMi dispiace, al momento non posso accedere all\'AI avanzata. Come posso aiutarti con le tue spedizioni?'}`;
      }
    } else {
      // Fallback mock se Claude non configurato
      isMock = true;
      if (!userMessage.trim()) {
        aiResponse = `Ciao ${userName}! 👋 Sono Anne, il tuo Executive Business Partner.${isAdmin ? '\n\nMonitoro business, finanza e sistemi. Posso analizzare margini, diagnosticare errori tecnici e proporre strategie di ottimizzazione.' : '\n\nSono qui per aiutarti con le tue spedizioni, calcolare costi ottimali e risolvere problemi operativi.'}\n\nCome posso aiutarti oggi?`;
      } else {
        aiResponse = `Ciao ${userName}! 👋\n\nHo capito la tua richiesta: "${userMessage}". Per darti una risposta più precisa, configura ANTHROPIC_API_KEY per attivare l'AI avanzata.`;
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
    });

  } catch (error: any) {
    console.error('❌ [Anne] Errore:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Errore interno del server',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
