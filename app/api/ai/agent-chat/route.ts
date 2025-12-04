/**
 * API Route: Assistente AI Logistico - "Super Segretaria"
 * 
 * Endpoint POST per la chat con l'assistente AI.
 * Integra Claude 3 Haiku per analisi intelligente dei dati logistici.
 * Verifica autenticazione e interroga Supabase per dati reali.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/db/client';

// Inizializza Claude client
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const claudeClient = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;

/**
 * System Prompt "Super Segretaria"
 */
const SYSTEM_PROMPT = `Sei l'Assistente Esecutiva di SpedireSicuro.it. Il tuo ruolo è risolvere problemi, non solo chattare.

**LE TUE REGOLE OPERATIVE:**

1. **Onestà sui Dati:** Prima di rispondere, controlla la data dei dati. Se sono vecchi (>2 ore), avvisa: 'Dati aggiornati alle [ORA]. Attendo il prossimo sync automatico.'

2. **Analisi Logistica:** Se lo status è 'Giacenza' o 'Indirizzo Errato', spiega al cliente cosa significa in italiano semplice e suggerisci l'azione (es. 'Chiama il destinatario').

3. **Analisi Finanziaria:** Se l'utente chiede 'Perché costa X?', analizza il rapporto Peso/Volume e il Prezzo Finale.

4. **Tono:** Professionale, empatico, proattivo.

5. **Linguaggio:** Sempre in italiano, chiaro e semplice. Evita gergo tecnico se non necessario.

6. **Azioni Concrete:** Non limitarti a descrivere, suggerisci sempre azioni pratiche.

Rispondi sempre in modo utile, preciso e orientato alla soluzione.`;

/**
 * Recupera dati spedizioni da Supabase
 */
async function fetchShipmentsData(userId: string, userMessage: string): Promise<{
  shipments: any[];
  dataFreshness: string;
  hoursSinceUpdate: number;
}> {
  try {
    // Cerca tracking number nel messaggio
    const trackingMatch = userMessage.match(/\b[A-Z0-9]{8,}\b/);
    const trackingNumber = trackingMatch ? trackingMatch[0] : null;

    let query = supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (trackingNumber) {
      query = query.eq('tracking_number', trackingNumber);
    }

    const { data: shipments, error } = await query;

    if (error) {
      console.error('❌ [AI] Errore query Supabase:', error);
      return { shipments: [], dataFreshness: 'Errore', hoursSinceUpdate: Infinity };
    }

    // Calcola freschezza dati
    const now = new Date();
    let latestUpdate = new Date(0);
    
    shipments?.forEach((shipment: any) => {
      if (shipment.updated_at) {
        const updated = new Date(shipment.updated_at);
        if (updated > latestUpdate) {
          latestUpdate = updated;
        }
      }
    });

    const hoursSinceUpdate = (now.getTime() - latestUpdate.getTime()) / (1000 * 60 * 60);
    const dataFreshness = latestUpdate.getTime() > 0 
      ? latestUpdate.toLocaleString('it-IT', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        })
      : 'Nessun dato';

    return {
      shipments: shipments || [],
      dataFreshness,
      hoursSinceUpdate,
    };
  } catch (error: any) {
    console.error('❌ [AI] Errore fetch spedizioni:', error);
    return { shipments: [], dataFreshness: 'Errore', hoursSinceUpdate: Infinity };
  }
}

export async function POST(request: NextRequest) {
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

    // Leggi il messaggio dal body della richiesta
    const body = await request.json();
    const userMessage = body.message || '';

    // Recupera dati spedizioni da Supabase (solo se userId valido)
    const { shipments, dataFreshness, hoursSinceUpdate } = userId 
      ? await fetchShipmentsData(userId, userMessage)
      : { shipments: [], dataFreshness: 'N/A', hoursSinceUpdate: Infinity };

    // Prepara contesto per Claude
    let contextData = '';
    if (shipments.length > 0) {
      contextData = `\n\n**DATI SPEDIZIONI DISPONIBILI:**\n`;
      contextData += `- Numero spedizioni trovate: ${shipments.length}\n`;
      contextData += `- Dati aggiornati alle: ${dataFreshness}\n`;
      
      if (hoursSinceUpdate > 2) {
        contextData += `- ⚠️ ATTENZIONE: Dati vecchi di ${Math.round(hoursSinceUpdate)} ore. Avvisa l'utente.\n`;
      }

      contextData += `\n**DETTAGLI SPEDIZIONI:**\n`;
      shipments.slice(0, 5).forEach((shipment: any, index: number) => {
        contextData += `${index + 1}. Tracking: ${shipment.tracking_number || 'N/A'}\n`;
        contextData += `   Status: ${shipment.status || 'N/A'}\n`;
        contextData += `   Destinatario: ${shipment.recipient_name || 'N/A'}\n`;
        contextData += `   Città: ${shipment.recipient_city || 'N/A'}\n`;
        if (shipment.final_price) {
          contextData += `   Prezzo: €${shipment.final_price}\n`;
        }
        if (shipment.weight) {
          contextData += `   Peso: ${shipment.weight} kg\n`;
        }
        contextData += `   Aggiornato: ${shipment.updated_at ? new Date(shipment.updated_at).toLocaleString('it-IT') : 'N/A'}\n\n`;
      });
    } else {
      contextData = `\n\n**DATI:** Nessuna spedizione trovata nel database.`;
    }

    // Usa Claude AI se disponibile, altrimenti fallback mock
    let aiResponse = '';
    let isMock = false;

    if (claudeClient && anthropicApiKey) {
      try {
        // Chiama Claude 3 Haiku
        const message = await claudeClient.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Ciao! Sono ${userName}, ruolo: ${userRole}.${contextData}\n\n**DOMANDA UTENTE:**\n${userMessage || 'Ciao, come posso aiutarti?'}\n\nRispondi in modo professionale, empatico e proattivo. Se i dati sono vecchi (>2 ore), avvisa l'utente.`
            }
          ],
        });

        aiResponse = message.content[0].type === 'text' ? message.content[0].text : 'Errore parsing risposta';
        isMock = false;
      } catch (claudeError: any) {
        console.error('❌ [AI] Errore Claude API:', claudeError);
        // Fallback a risposta mock
        isMock = true;
        aiResponse = `Ciao ${userName}! 👋 Sono il tuo Assistente Logistico AI.${contextData}\n\nMi dispiace, al momento non posso accedere all'AI avanzata. Come posso aiutarti con le tue spedizioni?`;
      }
    } else {
      // Fallback mock se Claude non configurato
      isMock = true;
      if (!userMessage.trim()) {
        aiResponse = `Ciao ${userName}! 👋 Sono il tuo Assistente Logistico AI.${contextData}\n\nCome posso aiutarti oggi? Posso assisterti con:\n- 📦 Gestione spedizioni\n- 📋 Consultazione listini corrieri\n- 🚚 Calcolo preventivi\n- 📊 Analisi statistiche\n\nScrivimi pure la tua domanda!`;
      } else {
        aiResponse = `Ciao ${userName}! 👋${contextData}\n\nHo capito la tua richiesta: "${userMessage}". Per darti una risposta più precisa, configura ANTHROPIC_API_KEY per attivare l'AI avanzata.`;
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
        dataFreshness,
        hoursSinceUpdate: Math.round(hoursSinceUpdate * 10) / 10,
        shipmentsCount: shipments.length,
        usingClaude: !isMock && !!claudeClient,
      }
    });

  } catch (error: any) {
    console.error('❌ [AI AGENT CHAT] Errore:', error);
    
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

