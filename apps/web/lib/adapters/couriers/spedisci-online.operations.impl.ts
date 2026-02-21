import type { TrackingEvent } from './base';

export async function getTrackingImpl(
  adapter: any,
  trackingNumber: string
): Promise<TrackingEvent[]> {
  try {
    // Costruisci URL tracking in modo intelligente: se BASE_URL contiene già /api/v2, aggiungi /v1
    let trackingEndpoint = `/v1/tracking/${trackingNumber}`;
    if (adapter.BASE_URL.includes('/api/v2')) {
      // Se BASE_URL contiene già /api/v2, l'endpoint completo dovrebbe essere /api/v2/v1/tracking
      trackingEndpoint = `/v1/tracking/${trackingNumber}`;
    }
    const response = await fetch(`${adapter.BASE_URL}${trackingEndpoint}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adapter.API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Tracking non disponibile: ${response.statusText}`);
    }

    const data = await response.json();

    // Mappa eventi nel formato standard
    return (data.events || []).map((event: any) => ({
      status: event.status || 'unknown',
      description: event.description || event.message || '',
      location: event.location || event.city || '',
      date: event.date ? new Date(event.date) : new Date(),
    }));
  } catch (error) {
    console.error('Errore tracking spedisci.online:', error);
    return [];
  }
}

export function generateUploadEndpointVariationsImpl(adapter: any): string[] {
  const baseUrl = adapter.BASE_URL;
  const endpoints: string[] = [];

  // Se BASE_URL contiene già /api/v2, non duplicarlo negli endpoint
  if (baseUrl.includes('/api/v2')) {
    // BASE_URL è già https://...spedisci.online/api/v2/
    // Quindi gli endpoint devono essere relativi senza ripetere /api/v2
    endpoints.push('shipments/upload'); // -> /api/v2/shipments/upload
    endpoints.push('v1/shipments/upload'); // -> /api/v2/v1/shipments/upload
    endpoints.push('../api/v1/shipments/upload'); // -> /api/v1/shipments/upload
  } else if (baseUrl.includes('/api/v1')) {
    // BASE_URL è https://...spedisci.online/api/v1/
    endpoints.push('shipments/upload'); // -> /api/v1/shipments/upload
    endpoints.push('../v2/shipments/upload'); // -> /v2/shipments/upload (tentativo)
  } else {
    // BASE_URL generico (es: https://...spedisci.online/)
    endpoints.push('api/v2/shipments/upload');
    endpoints.push('api/v1/shipments/upload');
    endpoints.push('v1/shipments/upload');
    endpoints.push('shipments/upload');
  }

  return [...new Set(endpoints)];
}

export async function getIncrementIdByTrackingImpl(
  adapter: any,
  trackingNumber: string
): Promise<{ success: boolean; incrementId?: number; error?: string }> {
  if (!trackingNumber) {
    return { success: false, error: 'Tracking number mancante' };
  }

  try {
    // Secondo openapi.json, l'UNICO endpoint per tracking è GET /tracking/{ldv}
    // Ma questo restituisce solo eventi di tracking, non increment_id
    const url = new URL(`tracking/${trackingNumber}`, adapter.BASE_URL).toString();

    console.log(
      `🔍 [SPEDISCI.ONLINE] Chiamata GET /tracking/{ldv} per verificare spedizione: ${url}`
    );
    console.log(
      `⚠️ [SPEDISCI.ONLINE] NOTA: Secondo openapi.json, questo endpoint NON restituisce increment_id`
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adapter.API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    console.log(`📡 [SPEDISCI.ONLINE] GET /tracking/${trackingNumber} response:`, {
      status: response.status,
      statusText: response.statusText,
    });

    if (response.ok) {
      const result = await response.json();

      // Log COMPLETO della risposta per vedere se ci sono campi non documentati
      console.log('═══════════════════════════════════════════════════════════════════════════');
      console.log('📦 [SPEDISCI.ONLINE] Risposta GET /tracking/{ldv} COMPLETA:');
      console.log(JSON.stringify(result, null, 2));
      console.log('═══════════════════════════════════════════════════════════════════════════');

      // Cerca increment_id in qualsiasi campo (anche se non documentato)
      const incrementId =
        result.increment_id ||
        result.incrementId ||
        result.shipmentId ||
        result.id ||
        result.shipment_id ||
        result.shipment?.increment_id ||
        result.shipment?.shipmentId ||
        result.shipment?.id ||
        result.data?.increment_id ||
        result.data?.shipmentId ||
        null;

      if (incrementId) {
        const incrementIdNum =
          typeof incrementId === 'string' ? parseInt(incrementId, 10) : incrementId;

        console.log(`✅ [SPEDISCI.ONLINE] increment_id trovato in risposta tracking!`, {
          trackingNumber,
          incrementId: incrementIdNum,
          note: 'Campo non documentato in openapi.json ma presente nella risposta',
        });

        return { success: true, incrementId: incrementIdNum };
      }

      // La spedizione esiste (tracking restituisce dati) ma non abbiamo l'increment_id
      console.warn(`⚠️ [SPEDISCI.ONLINE] Spedizione trovata ma increment_id NON disponibile`, {
        trackingNumber,
        hasTrackingDettaglio: !!result.TrackingDettaglio,
        numEventi: result.TrackingDettaglio?.length || 0,
        campiDisponibili: Object.keys(result),
        nota: "L'API di Spedisci.Online non restituisce increment_id nell'endpoint /tracking/{ldv}",
      });

      return {
        success: false,
        error: `Spedizione ${trackingNumber} esiste su Spedisci.Online ma l'increment_id non è disponibile. L'API /tracking/{ldv} non restituisce questo campo. L'increment_id viene fornito SOLO durante la creazione (/shipping/create). Verifica i log della creazione.`,
      };
    } else if (response.status === 404) {
      // La spedizione non esiste su Spedisci.Online
      console.log(`ℹ️ [SPEDISCI.ONLINE] Spedizione ${trackingNumber} non trovata (404)`, {
        note: 'La spedizione potrebbe non essere mai stata creata o è già stata cancellata',
      });

      return {
        success: false,
        error: `Spedizione ${trackingNumber} non trovata su Spedisci.Online (404). Potrebbe non essere mai stata creata o già cancellata.`,
      };
    } else {
      console.warn(`⚠️ [SPEDISCI.ONLINE] Risposta inaspettata:`, {
        status: response.status,
        statusText: response.statusText,
      });

      return {
        success: false,
        error: `Errore API Spedisci.Online: HTTP ${response.status} ${response.statusText}`,
      };
    }
  } catch (error: any) {
    console.error('❌ [SPEDISCI.ONLINE] Errore recupero increment_id:', {
      trackingNumber,
      error: error?.message || error,
    });

    return {
      success: false,
      error: error?.message || "Errore durante il recupero dell'increment_id",
    };
  }
}

export async function cancelShipmentOnPlatformImpl(
  adapter: any,
  trackingNumber: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!trackingNumber) {
    return { success: false, error: 'Tracking number mancante' };
  }

  // Genera fingerprint per log sicuro
  const crypto = require('crypto');
  const keyFingerprint = adapter.API_KEY
    ? crypto.createHash('sha256').update(adapter.API_KEY).digest('hex').substring(0, 8)
    : 'N/A';

  console.log('🗑️ [SPEDISCI.ONLINE] Tentativo cancellazione spedizione:', {
    trackingNumber,
    apiKeyFingerprint: keyFingerprint,
    baseUrl: adapter.BASE_URL,
  });

  try {
    // ⚠️ FIX: Spedisci.Online usa POST /shipping/delete con increment_id, non DELETE /shipping/{tracking}
    // Prova prima con endpoint POST /shipping/delete (metodo corretto)
    const deleteUrl = new URL('shipping/delete', adapter.BASE_URL).toString();

    // ⚠️ NOTA: increment_id deve essere un numero, non il tracking string
    // ⚠️ PRIORITÀ: Se trackingNumber è già un numero puro (solo cifre), usalo direttamente
    // Altrimenti prova a recuperarlo da Spedisci.Online, poi estrai dal tracking come ultimo fallback
    let incrementId: number | null = null;

    // ⚠️ PRIORITÀ 1: Se trackingNumber è SOLO numeri (increment_id diretto da shipment_id_external)
    // ⚠️ FIX: Non usare parseInt() direttamente perché "3UW1LZ1549876" restituirebbe 3 invece di 1549876
    const isPureNumber = /^\d+$/.test(trackingNumber);
    if (isPureNumber) {
      incrementId = parseInt(trackingNumber, 10);
      console.log('✅ [SPEDISCI.ONLINE] Usando increment_id diretto (numero puro):', incrementId);
    } else {
      // ⚠️ PRIORITÀ 2: Prova a recuperare increment_id da Spedisci.Online usando il tracking
      console.log('🔍 [SPEDISCI.ONLINE] Tentativo recupero increment_id da Spedisci.Online...');
      const incrementIdResult = await adapter.getIncrementIdByTracking(trackingNumber);

      if (incrementIdResult.success && incrementIdResult.incrementId) {
        incrementId = incrementIdResult.incrementId;
        console.log(
          '✅ [SPEDISCI.ONLINE] increment_id recuperato da Spedisci.Online:',
          incrementId
        );
      } else {
        // ⚠️ PRIORITÀ 3: Fallback - estrai dal tracking number
        // Estrai numero alla fine del tracking (es: "3UW1LZ1549876" -> 1549876)
        // Cerca l'ultimo gruppo di cifre consecutive alla fine
        const trackingMatch = trackingNumber.match(/(\d+)$/);
        if (trackingMatch) {
          incrementId = parseInt(trackingMatch[1], 10);
          console.warn(
            '⚠️ [SPEDISCI.ONLINE] increment_id NON recuperato da API, estratto dal tracking (potrebbe non essere corretto):',
            {
              tracking: trackingNumber,
              extracted_increment_id: incrementId,
              match: trackingMatch[1],
              warning:
                'Questo increment_id estratto potrebbe non corrispondere a quello reale su Spedisci.Online',
            }
          );
        } else {
          // Fallback: trova il numero più lungo nel tracking (probabilmente l'increment_id)
          const allNumbers = trackingNumber.match(/\d+/g);
          if (allNumbers && allNumbers.length > 0) {
            const longestNumber = allNumbers.reduce((a, b) => (a.length > b.length ? a : b));
            incrementId = parseInt(longestNumber, 10);
            console.warn(
              '⚠️ [SPEDISCI.ONLINE] increment_id estratto (numero più lungo, potrebbe non essere corretto):',
              {
                tracking: trackingNumber,
                extracted_increment_id: incrementId,
                allNumbers,
                warning:
                  'Questo increment_id estratto potrebbe non corrispondere a quello reale su Spedisci.Online',
              }
            );
          }
        }
      }
    }

    if (!incrementId || incrementId === 0) {
      console.error('❌ [SPEDISCI.ONLINE] Impossibile estrarre increment_id valido da:', {
        trackingNumber,
        type: typeof trackingNumber,
        isPureNumber: /^\d+$/.test(trackingNumber),
        parsedValue: parseInt(trackingNumber, 10),
      });
      return {
        success: false,
        error: `Impossibile estrarre increment_id valido da "${trackingNumber}" per la cancellazione. Verifica che shipment_id_external sia salvato correttamente durante la creazione.`,
      };
    }

    console.log('📡 [SPEDISCI.ONLINE] POST /shipping/delete call:', {
      url: deleteUrl,
      trackingNumber,
      incrementId,
    });

    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adapter.API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        increment_id: incrementId,
      }),
    });

    console.log('📡 [SPEDISCI.ONLINE] POST /shipping/delete response:', {
      status: response.status,
      statusText: response.statusText,
      incrementId,
    });

    if (response.ok) {
      let result: any = {};
      try {
        result = await response.json();
      } catch {
        // Risposta vuota OK per DELETE
      }

      console.log('✅ [SPEDISCI.ONLINE] Spedizione cancellata:', trackingNumber);
      return {
        success: true,
        message: result.message || 'Spedizione cancellata con successo su Spedisci.Online',
      };
    }

    // Gestisci errori
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorBody.error || errorMessage;
    } catch {
      // Ignora errori parsing
    }

    // 404 = spedizione non trovata su Spedisci.Online (già cancellata o mai creata)
    // 400 = bad request (increment_id non valido o spedizione non trovata)
    if (response.status === 404 || response.status === 400) {
      const statusMsg =
        response.status === 404 ? 'non trovata' : 'bad request (increment_id non valido?)';

      // ⚠️ CRITICO: Se l'increment_id è stato estratto dal tracking (non da shipment_id_external),
      // il 404 potrebbe indicare che l'increment_id estratto non corrisponde a quello reale
      // In questo caso, NON possiamo considerare successo perché la spedizione potrebbe esistere ancora
      const isExtractedIncrementId = !/^\d+$/.test(trackingNumber); // Se tracking non è solo numeri, è stato estratto

      console.warn(`⚠️ [SPEDISCI.ONLINE] Spedizione ${statusMsg}:`, {
        trackingNumber,
        incrementId,
        status: response.status,
        isExtractedIncrementId,
        warning: isExtractedIncrementId
          ? '⚠️ CRITICO: increment_id estratto dal tracking potrebbe non corrispondere a quello reale. La spedizione potrebbe esistere ancora su Spedisci.Online!'
          : 'increment_id diretto (da shipment_id_external) - più affidabile',
      });

      // ⚠️ CRITICO: Se increment_id è estratto e riceviamo 404, NON consideriamo successo
      // perché la spedizione potrebbe esistere ancora con un increment_id diverso
      if (response.status === 404) {
        if (isExtractedIncrementId) {
          // ⚠️ NON consideriamo successo: l'increment_id estratto potrebbe essere sbagliato
          // La spedizione potrebbe esistere ancora su Spedisci.Online con un increment_id diverso
          return {
            success: false,
            error: `Spedizione non trovata su Spedisci.Online con increment_id estratto ${incrementId} dal tracking ${trackingNumber}. L'increment_id estratto potrebbe non corrispondere a quello reale. La spedizione potrebbe esistere ancora su Spedisci.Online e richiedere cancellazione manuale. Verifica che shipment_id_external sia stato salvato correttamente durante la creazione.`,
          };
        } else {
          // increment_id diretto da shipment_id_external: più affidabile
          return {
            success: true,
            message:
              'Spedizione non trovata su Spedisci.Online (probabilmente già cancellata o mai creata)',
          };
        }
      } else {
        // 400 = errore, non consideriamo successo
        return {
          success: false,
          error: `Bad Request: increment_id ${incrementId} potrebbe non essere valido per tracking ${trackingNumber}`,
        };
      }
    }

    console.error('❌ [SPEDISCI.ONLINE] Errore cancellazione:', {
      trackingNumber,
      status: response.status,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  } catch (error: any) {
    console.error('❌ [SPEDISCI.ONLINE] Eccezione cancellazione:', {
      trackingNumber,
      error: error?.message || error,
    });

    return {
      success: false,
      error: error?.message || 'Errore durante la cancellazione su Spedisci.Online',
    };
  }
}

export async function getRatesImpl(
  adapter: any,
  params: {
    packages: Array<{
      length: number;
      width: number;
      height: number;
      weight: number;
    }>;
    shipFrom: {
      name: string;
      company?: string;
      street1: string;
      street2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
      email?: string;
    };
    shipTo: {
      name: string;
      company?: string;
      street1: string;
      street2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone?: string;
      email?: string;
    };
    notes: string;
    insuranceValue?: number;
    codValue?: number;
    accessoriServices?: string[];
  }
): Promise<{
  success: boolean;
  rates?: Array<{
    carrierCode: string;
    contractCode: string;
    weight_price: string;
    insurance_price: string;
    cod_price: string;
    services_price: string;
    fuel: string;
    total_price: string;
  }>;
  error?: string;
}> {
  try {
    const url = new URL('shipping/rates', adapter.BASE_URL).toString();

    // Prepara payload secondo OpenAPI spec
    const payload = {
      packages: params.packages,
      shipFrom: {
        name: params.shipFrom.name,
        company: params.shipFrom.company || params.shipFrom.name,
        street1: params.shipFrom.street1,
        street2: params.shipFrom.street2 || '',
        city: params.shipFrom.city,
        state: params.shipFrom.state,
        postalCode: params.shipFrom.postalCode,
        country: params.shipFrom.country,
        phone: params.shipFrom.phone || null,
        email: params.shipFrom.email || 'email@example.com',
      },
      shipTo: {
        name: params.shipTo.name,
        company: params.shipTo.company || '',
        street1: params.shipTo.street1,
        street2: params.shipTo.street2 || '',
        city: params.shipTo.city,
        state: params.shipTo.state,
        postalCode: params.shipTo.postalCode,
        country: params.shipTo.country,
        phone: params.shipTo.phone || null,
        email: params.shipTo.email || 'email@example.com',
      },
      notes: params.notes || 'N/A',
      insuranceValue: params.insuranceValue || 0,
      codValue: params.codValue || 0,
      // ⚠️ FIX: Non passare accessoriServices a /shipping/rates
      // L'API sembra usarli come FILTRI (esclude corrieri che non li supportano)
      // invece di aggiungerli al prezzo. I servizi vanno passati solo a /shipping/create
      // TODO: Verificare con Spedisci.Online il comportamento corretto
      accessoriServices: [], // Sempre vuoto per rates, servizi applicati in creazione
    };

    console.log('📊 [SPEDISCI.ONLINE] Chiamata GET RATES:', {
      url,
      packages_count: payload.packages.length,
      shipFrom: payload.shipFrom.city,
      shipTo: payload.shipTo.city,
      insuranceValue: payload.insuranceValue,
      codValue: payload.codValue,
      // ⚠️ Servizi richiesti dall'utente (non passati all'API, saranno applicati in creazione)
      requestedServices: params.accessoriServices || [],
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adapter.API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📊 [SPEDISCI.ONLINE] GET RATES response:', {
      status: response.status,
      statusText: response.statusText,
    });

    if (response.ok) {
      const rates = await response.json();

      console.log('✅ [SPEDISCI.ONLINE] Rates ottenuti:', {
        count: Array.isArray(rates) ? rates.length : 0,
        carriers: Array.isArray(rates)
          ? rates
              .map((r: any) => r.carrierCode)
              .filter((v: any, i: number, a: any[]) => a.indexOf(v) === i)
          : [],
      });

      // ✨ DEBUG: Mostra services_price per verificare se i servizi accessori funzionano
      if (
        Array.isArray(rates) &&
        rates.length > 0 &&
        payload.accessoriServices &&
        payload.accessoriServices.length > 0
      ) {
        console.log('🔍 [SPEDISCI.ONLINE] SERVIZI ACCESSORI RICHIESTI:', payload.accessoriServices);
        console.log('🔍 [SPEDISCI.ONLINE] DETTAGLIO RATES CON SERVICES_PRICE:');
        rates.forEach((r: any, i: number) => {
          console.log(
            `   Rate ${i + 1}: ${r.carrierCode}/${
              r.contractCode
            } - services_price: ${r.services_price}, total: ${r.total_price}`
          );
        });
      }

      return {
        success: true,
        rates: Array.isArray(rates) ? rates : [],
      };
    }

    // Gestisci errori
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorBody.error || errorMessage;
    } catch {
      const textError = await response.text();
      errorMessage = textError || errorMessage;
    }

    console.error('❌ [SPEDISCI.ONLINE] Errore GET RATES:', {
      status: response.status,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  } catch (error: any) {
    console.error('❌ [SPEDISCI.ONLINE] Eccezione GET RATES:', {
      error: error?.message || error,
    });

    return {
      success: false,
      error: error?.message || 'Errore durante il recupero dei rates',
    };
  }
}
