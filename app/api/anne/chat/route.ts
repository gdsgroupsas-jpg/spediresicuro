/**
 * Anne Chat API Endpoint
 *
 * Endpoint dedicato per l'assistente virtuale Anne.
 * Utilizza Claude AI (Anthropic) per generare risposte contestuali
 * e personalizzate in base al ruolo utente e alla pagina corrente.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Inizializza client Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, userRole, currentPage, context } = body;

    // Validazione input
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 });
    }

    // Costruisci il sistema prompt personalizzato per Anne
    const systemPrompt = buildAnneSystemPrompt(userRole, currentPage);

    // Prepara i messaggi per Claude
    const messages = [];

    // Aggiungi contesto dei messaggi precedenti se disponibile
    if (context?.previousMessages && Array.isArray(context.previousMessages)) {
      context.previousMessages.forEach((msg: any) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      });
    }

    // Aggiungi il messaggio corrente
    messages.push({
      role: 'user',
      content: message,
    });

    // Chiama Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages as any,
    });

    // Estrai la risposta
    const assistantMessage = response.content[0];
    const responseText =
      assistantMessage.type === 'text' ? assistantMessage.text : 'Mi dispiace, non ho capito.';

    return NextResponse.json({
      message: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Errore Anne Chat API:', error);

    // Gestisci errori specifici
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Chiave API non configurata correttamente' },
        { status: 500 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Troppi messaggi. Riprova tra qualche secondo.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    );
  }
}

/**
 * Costruisce il system prompt personalizzato per Anne
 */
function buildAnneSystemPrompt(userRole: string, currentPage: string): string {
  const basePrompt = `Sei Anne, un assistente virtuale amichevole e competente per SpedireSicuro.it, una piattaforma di gestione spedizioni.

PERSONALITÀ:
- Sei cordiale, professionale e precisa
- Usi emoji con moderazione per rendere le risposte più friendly (max 1-2 per messaggio)
- Rispondi in italiano in modo conciso ma completo
- Quando non sai qualcosa, lo ammetti onestamente

COMPETENZE:
- Aiuti gli utenti a navigare la dashboard
- Spieghi come creare e gestire spedizioni
- Fornisci consigli sui corrieri e calcoli di costo
- Aiuti con le integrazioni e configurazioni
- Risolvi problemi tecnici comuni

CONTESTO ATTUALE:
- Ruolo utente: ${userRole}
- Pagina corrente: ${currentPage}

`;

  // Aggiungi contesto specifico per ruolo
  const roleContext: Record<string, string> = {
    user: `L'utente è un cliente standard. Concentrati su:
- Aiuto nella creazione spedizioni
- Calcolo costi e scelta corriere
- Tracking spedizioni
- Gestione wallet
`,
    admin: `L'utente è un amministratore. Puoi aiutarlo con:
- Gestione utenti e permessi
- Configurazione listini e pricing
- Analisi business e report
- Configurazioni avanzate sistema
`,
    superadmin: `L'utente è un super amministratore. Oltre alle funzioni admin:
- Gestione completa piattaforma
- Configurazioni di sicurezza
- Gestione reseller e multi-tenancy
- Debug e troubleshooting avanzato
`,
  };

  // Aggiungi contesto specifico per pagina
  const pageContext: Record<string, string> = {
    '/dashboard': 'L\'utente è nella dashboard principale. Può vedere statistiche generali.',
    '/dashboard/spedizioni':
      'L\'utente sta visualizzando l\'elenco delle spedizioni. Può cercare, filtrare e gestire le spedizioni.',
    '/dashboard/spedizioni/nuova':
      'L\'utente sta creando una nuova spedizione. Guidalo passo passo se necessario.',
    '/dashboard/wallet':
      'L\'utente sta gestendo il suo wallet. Puoi aiutarlo con ricariche e transazioni.',
    '/dashboard/impostazioni':
      'L\'utente sta configurando le sue impostazioni. Spiega le varie opzioni disponibili.',
  };

  const fullPrompt =
    basePrompt +
    (roleContext[userRole] || roleContext.user) +
    '\n' +
    (pageContext[currentPage] || '') +
    `
LINEE GUIDA RISPOSTE:
- Mantieni le risposte sotto i 150 parole quando possibile
- Se fornisci istruzioni, usa elenchi puntati
- Suggerisci azioni concrete che l'utente può fare
- Se l'utente chiede di eseguire azioni, spiega come fare (non puoi eseguirle tu)

Rispondi ora alla domanda dell'utente in modo utile e contestuale.`;

  return fullPrompt;
}

/**
 * Endpoint per ottenere suggerimenti proattivi
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '/dashboard';
    const role = searchParams.get('role') || 'user';

    // Genera suggerimento contestuale
    const suggestion = getContextualSuggestion(page, role);

    return NextResponse.json({
      suggestion,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Errore GET suggestions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Helper per generare suggerimenti contestuali semplici
 */
function getContextualSuggestion(page: string, role: string): string | null {
  const suggestions: Record<string, Record<string, string>> = {
    '/dashboard': {
      user: '💡 Da qui puoi monitorare tutte le tue spedizioni attive. Clicca su "Nuova Spedizione" per iniziare!',
      admin:
        '📊 Benvenuto nella dashboard admin. Controlla le metriche di business e gestisci gli utenti.',
    },
    '/dashboard/spedizioni/nuova': {
      user: '🚀 Compila il form per creare una spedizione. Ti calcolerò automaticamente il costo migliore!',
      admin: '🎯 Crea spedizioni per i tuoi clienti. Puoi applicare listini personalizzati.',
    },
  };

  return suggestions[page]?.[role] || null;
}
