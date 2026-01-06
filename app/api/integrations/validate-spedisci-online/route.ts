import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';

/**
 * Endpoint per validare le credenziali Spedisci.online
 * 
 * Fa una chiamata API reale a Spedisci.online per verificare che:
 * - L'API Key sia valida
 * - L'endpoint sia corretto
 * - Le credenziali funzionino
 * 
 * POST /api/integrations/validate-spedisci-online
 * Body: { apiKey: string, baseUrl: string }
 * 
 * ⚠️ SECURITY: 
 * - Richiede autenticazione
 * - L'API key viene validata ma mai loggata o esposta
 * - Rate limiting gestito a livello di middleware/edge
 */

export async function POST(request: NextRequest) {
  let cleanBaseUrl: string = '';
  
  try {
    // 1. Verifica autenticazione (obbligatoria)
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Leggi dati dal body
    const body = await request.json();
    const { apiKey, baseUrl } = body;

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        { success: false, error: 'API Key e Base URL sono obbligatori' },
        { status: 400 }
      );
    }

    // 3. Prepara endpoint
    cleanBaseUrl = baseUrl.trim().replace(/\/$/, '');
    const apiUrl = cleanBaseUrl.includes('/api/v2')
      ? `${cleanBaseUrl}/shipping/rates`
      : `${cleanBaseUrl}/api/v2/shipping/rates`;

    // 4. Payload minimo per test (secondo documentazione API)
    const testPayload = {
      packages: [{
        length: 10,
        width: 10,
        height: 10,
        weight: 1
      }],
      shipFrom: {
        name: "Test",
        company: "Test Company",
        street1: "Via Test 1",
        street2: "",
        city: "Roma",
        state: "RM",
        postalCode: "00100",
        country: "IT",
        phone: null,
        email: "test@example.com"
      },
      shipTo: {
        name: "Test Dest",
        company: "",
        street1: "Via Test 2",
        street2: "",
        city: "Milano",
        state: "MI",
        postalCode: "20100",
        country: "IT",
        phone: null,
        email: "test@example.com"
      },
      notes: "Test connessione API",
      insuranceValue: 0,
      codValue: 0,
      accessoriServices: []
    };

    // 5. Chiamata API reale a Spedisci.online
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    // 6. Gestisci risposta
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Errore HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      }

      // Messaggi di errore specifici
      if (response.status === 401) {
        errorMessage = 'API Key non valida o scaduta. Verifica le credenziali.';
      } else if (response.status === 404) {
        errorMessage = 'Endpoint non trovato. Verifica che il Base URL sia corretto.';
      } else if (response.status === 403) {
        errorMessage = 'Accesso negato. Verifica i permessi dell\'API Key.';
      }

      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          status: response.status 
        },
        { status: 200 } // Ritorna 200 per permettere al client di gestire l'errore
      );
    }

    // 7. Se la risposta è OK, la connessione funziona
    const data = await response.json().catch(() => ({}));
    
    return NextResponse.json({
      success: true,
      message: 'Connessione verificata con successo!',
      data: data, // Opzionale: ritorna i dati della risposta (es: tariffe disponibili)
    });

  } catch (error: unknown) {
    // Gestisci errori di rete (no PII nei log)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCause = error instanceof Error && 'cause' in error ? (error.cause as any)?.message || String(error.cause) : null;
    
    // Analisi dettagliata degli errori di rete
    if (errorMessage.includes('fetch failed') || errorMessage.includes('fetch')) {
      let detailedError = 'Errore di connessione. Verifica che il Base URL sia raggiungibile e che non ci siano problemi di rete.';
      
      // Distingui tra diversi tipi di errori di rete
      if (errorCause?.includes('ENOTFOUND') || errorMessage.includes('ENOTFOUND')) {
        // Dominio non trovato (DNS)
        const domainMatch = cleanBaseUrl.match(/https?:\/\/([^\/]+)/);
        const domain = domainMatch ? domainMatch[1] : 'il dominio';
        
        detailedError = `Dominio non trovato: "${domain}" non esiste o non è raggiungibile.\n\n` +
          `💡 Verifica:\n` +
          `   • Il dominio è scritto correttamente (controlla eventuali errori di battitura)\n` +
          `   • Il formato è: https://tuodominio.spedisci.online/api/v2\n` +
          `   • Esempi comuni: ecommerceitalia, infinity, ecc. (senza "s" in più)\n` +
          `   • Se hai copiato da documentazione, verifica che sia identico`;
      } else if (errorCause?.includes('ECONNREFUSED') || errorMessage.includes('ECONNREFUSED')) {
        detailedError = 'Connessione rifiutata dal server. Il Base URL potrebbe essere errato o il server non è raggiungibile.';
      } else if (errorCause?.includes('CERT') || errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
        detailedError = 'Problema certificato SSL. Verifica che il Base URL usi HTTPS e che il certificato sia valido.';
      } else if (errorCause?.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
        detailedError = 'Timeout di connessione. Il server potrebbe essere lento o non raggiungibile.';
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: detailedError,
          errorType: 'network',
          errorDetails: {
            message: errorMessage,
            cause: errorCause,
          }
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage || 'Errore durante il test di connessione',
        errorType: 'unknown'
      },
      { status: 200 }
    );
  }
}
