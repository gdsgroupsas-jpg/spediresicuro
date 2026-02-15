import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';

/**
 * Endpoint per validare le credenziali SpediamoPro
 *
 * Fa login con authCode, verifica il JWT e controlla il credito disponibile.
 *
 * POST /api/integrations/validate-spediamopro
 * Body: { authCode: string, baseUrl: string }
 *
 * SECURITY:
 * - Richiede autenticazione
 * - L'authCode viene validato ma mai loggato o esposto
 */

export async function POST(request: NextRequest) {
  let cleanBaseUrl: string = '';

  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Leggi dati dal body
    const body = await request.json();
    const { authCode, baseUrl } = body;

    if (!authCode || !baseUrl) {
      return NextResponse.json(
        { success: false, error: 'AuthCode e Base URL sono obbligatori' },
        { status: 400 }
      );
    }

    // 3. Prepara endpoint
    cleanBaseUrl = baseUrl.trim().replace(/\/$/, '');

    // 4. Step 1: Login per ottenere JWT token
    const loginUrl = `${cleanBaseUrl}/api/v1/auth/login`;
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCode: authCode.trim() }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text().catch(() => '');
      let errorMessage = `Errore login HTTP ${loginResponse.status}`;

      if (loginResponse.status === 401 || loginResponse.status === 403) {
        errorMessage = 'AuthCode non valido. Verifica il codice ricevuto da SpediamoPro.';
      } else if (loginResponse.status === 404) {
        errorMessage =
          'Endpoint login non trovato. Verifica che il Base URL sia corretto (es. https://core.spediamopro.com).';
      }

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message || errorJson.error) {
          errorMessage = errorJson.message || errorJson.error;
        }
      } catch {
        // ignora
      }

      return NextResponse.json(
        { success: false, error: errorMessage, step: 'login' },
        { status: 200 }
      );
    }

    const loginData = await loginResponse.json();
    const token = loginData.token || loginData.access_token || loginData;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Login riuscito ma nessun token ricevuto', step: 'login' },
        { status: 200 }
      );
    }

    // 5. Step 2: Verifica credito account
    let credit: number | null = null;
    try {
      const creditUrl = `${cleanBaseUrl}/api/v1/config/credito`;
      const creditResponse = await fetch(creditUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (creditResponse.ok) {
        const creditData = await creditResponse.json();
        credit = creditData.credit ?? creditData.balance ?? null;
      }
    } catch {
      // Il credito e informativo, non blocchiamo la validazione
    }

    // 6. Step 3: Test simulazione per verificare che l'API funzioni end-to-end
    let carriersAvailable: string[] = [];
    try {
      const simUrl = `${cleanBaseUrl}/api/v1/simulazione`;
      const simResponse = await fetch(simUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender_nation: 'IT',
          sender_cap: '00100',
          sender_city: 'Roma',
          sender_prov: 'RM',
          recipient_nation: 'IT',
          recipient_cap: '20100',
          recipient_city: 'Milano',
          recipient_prov: 'MI',
          parcels: [{ weight: 1, length: 30, width: 20, height: 15 }],
        }),
      });

      if (simResponse.ok) {
        const rates = await simResponse.json();
        if (Array.isArray(rates)) {
          carriersAvailable = [...new Set(rates.map((r: any) => r.carrier).filter(Boolean))];
        }
      }
    } catch {
      // La simulazione e informativa
    }

    return NextResponse.json({
      success: true,
      message: 'Connessione verificata con successo!',
      data: {
        credit,
        carriersAvailable,
        carriersCount: carriersAvailable.length,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCause =
      error instanceof Error && 'cause' in error
        ? (error.cause as any)?.message || String(error.cause)
        : null;

    if (errorMessage.includes('fetch failed') || errorMessage.includes('fetch')) {
      let detailedError = 'Errore di connessione. Verifica che il Base URL sia raggiungibile.';

      if (errorCause?.includes('ENOTFOUND') || errorMessage.includes('ENOTFOUND')) {
        const domainMatch = cleanBaseUrl.match(/https?:\/\/([^\/]+)/);
        const domain = domainMatch ? domainMatch[1] : 'il dominio';
        detailedError =
          `Dominio non trovato: "${domain}" non esiste o non raggiungibile.\n\n` +
          `Verifica:\n` +
          `   - Produzione: https://core.spediamopro.com\n` +
          `   - Test: https://core.spediamopro.it`;
      } else if (errorCause?.includes('ECONNREFUSED')) {
        detailedError = 'Connessione rifiutata dal server. Verifica il Base URL.';
      } else if (errorCause?.includes('ETIMEDOUT')) {
        detailedError = 'Timeout di connessione. Il server potrebbe non essere raggiungibile.';
      }

      return NextResponse.json(
        { success: false, error: detailedError, errorType: 'network' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Errore durante la validazione',
        errorType: 'unknown',
      },
      { status: 200 }
    );
  }
}
