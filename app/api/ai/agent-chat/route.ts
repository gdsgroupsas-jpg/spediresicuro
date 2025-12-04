/**
 * API Route: Assistente AI Logistico
 * 
 * Endpoint POST per la chat con l'assistente AI.
 * Verifica autenticazione e restituisce risposte mock personalizzate.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';

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

    // Simula una risposta intelligente dell'AI basata sul ruolo e sul messaggio
    let aiResponse = '';
    
    if (!userMessage.trim()) {
      aiResponse = `Ciao ${userName}! 👋 Sono il tuo Assistente Logistico AI (versione mock). Vedo che sei loggato come **${userRole}**. Il tuo ID utente è \`${userId}\`. 

Come posso aiutarti oggi? Posso assisterti con:
- 📦 Gestione spedizioni
- 📋 Consultazione listini corrieri
- 🚚 Calcolo preventivi
- 📊 Analisi statistiche
- ⚙️ Configurazioni e integrazioni

Scrivimi pure la tua domanda!`;
    } else {
      // Risposte contestuali basate su parole chiave nel messaggio
      const messageLower = userMessage.toLowerCase();
      
      if (messageLower.includes('spedizione') || messageLower.includes('spedire')) {
        aiResponse = `Perfetto! Per le spedizioni posso aiutarti a:
- 📦 Creare una nuova spedizione
- 🔍 Cercare una spedizione esistente
- 📊 Visualizzare statistiche delle tue spedizioni
- 💰 Calcolare preventivi

Vuoi che ti guidi nella creazione di una nuova spedizione?`;
      } else if (messageLower.includes('listino') || messageLower.includes('prezzo') || messageLower.includes('costo')) {
        aiResponse = `Ottimo! Per i listini e i prezzi posso aiutarti con:
- 💰 Consultare i listini dei corrieri
- 📊 Confrontare i prezzi tra diversi corrieri
- 🎯 Calcolare il miglior preventivo per la tua spedizione
- 📈 Analizzare i margini di ricarico

Quale corriere ti interessa?`;
      } else if (messageLower.includes('aiuto') || messageLower.includes('help') || messageLower.includes('come')) {
        aiResponse = `Sono qui per aiutarti! 🚀

Come Assistente Logistico, posso supportarti in:
- 📦 **Spedizioni**: Creazione, gestione e tracking
- 💰 **Preventivi**: Calcolo prezzi e confronto corrieri
- 📊 **Dashboard**: Statistiche e analisi
- ⚙️ **Integrazioni**: Configurazione corrieri e e-commerce
- 👥 **Team**: Gestione utenti e permessi

Cosa vorresti fare?`;
      } else if (messageLower.includes('grazie') || messageLower.includes('grazie mille')) {
        aiResponse = `Prego! 😊 Sono sempre qui per aiutarti. Se hai altre domande sulle spedizioni o sui listini, non esitare a chiedere!`;
      } else {
        aiResponse = `Capisco! Come ${userRole}, posso aiutarti con quella richiesta. 

Per darti un supporto migliore, potresti specificare se si tratta di:
- 📦 Una questione relativa alle spedizioni
- 💰 Una domanda sui listini o preventivi
- ⚙️ Una configurazione o integrazione
- 📊 Statistiche o report

Oppure dimmi pure in modo più dettagliato cosa ti serve!`;
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
        isMock: true // Indica che è una risposta mock
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

