import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';

/**
 * Endpoint per testare connessione Spedisci.online
 * 
 * Fa una chiamata API reale a Spedisci.online per verificare che:
 * - L'API Key sia valida
 * - L'endpoint sia corretto
 * - Le credenziali funzionino
 * 
 * POST /api/test-spedisci-online
 * Body: { apiKey: string, baseUrl: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
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
    const cleanBaseUrl = baseUrl.trim().replace(/\/$/, '');
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

  } catch (error: any) {
    console.error('❌ [TEST API] Errore test connessione:', error);
    
    // Gestisci errori di rete
    if (error.message?.includes('fetch')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Errore di connessione. Verifica che il Base URL sia raggiungibile e che non ci siano problemi di rete.' 
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Errore durante il test di connessione' 
      },
      { status: 200 }
    );
  }
}

