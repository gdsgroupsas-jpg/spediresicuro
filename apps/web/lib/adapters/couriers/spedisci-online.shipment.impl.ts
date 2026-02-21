import type { CreateShipmentInput, Shipment } from '@/types/shipments';

import type { ShippingLabel } from './base';

import type { SpedisciOnlineOpenAPIPayload, SpedisciOnlineResponse } from './spedisci-online';

export async function createShipmentImpl(
  adapter: any,
  data: Shipment | CreateShipmentInput | any
): Promise<ShippingLabel> {
  console.log('🚀 [SPEDISCI.ONLINE] ========================================');
  // ⚠️ SEC-1: NO log di API key info
  console.log('🚀 [SPEDISCI.ONLINE] INIZIO CREAZIONE SPEDIZIONE');
  console.log(
    '🚀 [SPEDISCI.ONLINE] CONTRACT_MAPPING disponibili:',
    Object.keys(adapter.CONTRACT_MAPPING || {}).length
  );

  try {
    // 1. Trova codice contratto basato sul corriere selezionato
    const corriereDaData = data.corriere || data.courier_id || 'NON TROVATO';
    console.log('🔍 [SPEDISCI.ONLINE] ========================================');
    console.log('🔍 [SPEDISCI.ONLINE] RICERCA CONTRATTO');
    console.log('🔍 [SPEDISCI.ONLINE] ========================================');
    console.log('🔍 [SPEDISCI.ONLINE] Corriere richiesto:', corriereDaData);
    const contractCode = adapter.findContractCode(data);
    console.log('🔍 [SPEDISCI.ONLINE] ========================================');
    console.log(
      '🔍 [SPEDISCI.ONLINE] RISULTATO: Codice contratto trovato:',
      contractCode || '❌ NESSUNO'
    );
    console.log('🔍 [SPEDISCI.ONLINE] ========================================');

    // 2. Mappatura Dati nel formato OpenAPI Spedisci.Online
    const openApiPayload = adapter.mapToOpenAPIFormat(data, contractCode);
    console.log('📦 [SPEDISCI.ONLINE] Payload OpenAPI preparato:', {
      carrierCode: openApiPayload.carrierCode,
      contractCode: openApiPayload.contractCode,
      base_url: adapter.BASE_URL,
      // ✨ DEBUG: Verifica servizi accessori
      accessoriServices: openApiPayload.accessoriServices,
      accessoriServices_count: Array.isArray(openApiPayload.accessoriServices)
        ? openApiPayload.accessoriServices.length
        : 0,
    });

    // 2. PRIORITÀ 1: Chiamata API OpenAPI (POST /shipping/create)
    let jsonError: any = null;
    let csvError: any = null;

    try {
      const result = await adapter.createShipmentJSON(openApiPayload);
      console.log('✅ [SPEDISCI.ONLINE] Chiamata API JSON riuscita!', {
        success: result.success,
        tracking_number: result.tracking_number,
        has_label: !!result.label_pdf,
        has_metadata: !!result.metadata,
        metadata_keys: result.metadata ? Object.keys(result.metadata) : [],
        shipmentId_in_result:
          result.metadata?.shipmentId || result.metadata?.increment_id || 'NON TROVATO',
      });

      if (result.success) {
        const shippingLabel = {
          tracking_number: result.tracking_number,
          label_url: result.label_url,
          label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
          // ⚠️ CRITICO: Includi shipmentId direttamente nel ShippingLabel (oltre che nel metadata)
          shipmentId: result.shipmentId ? String(result.shipmentId) : undefined,
          // ⚠️ FIX: Includi metadata con shipmentId per cancellazione futura
          metadata: result.metadata || {},
        };

        console.log('📦 [SPEDISCI.ONLINE] ShippingLabel creato:', {
          has_metadata: !!shippingLabel.metadata,
          metadata_keys: shippingLabel.metadata ? Object.keys(shippingLabel.metadata) : [],
          shipmentId_diretto: shippingLabel.shipmentId || 'NON TROVATO',
          shipmentId_in_metadata:
            shippingLabel.metadata?.shipmentId ||
            shippingLabel.metadata?.increment_id ||
            'NON TROVATO',
        });

        return shippingLabel;
      }
    } catch (err: any) {
      jsonError = err;
      const is401 = jsonError?.message?.includes('401');
      const isImplodeError = jsonError?.message?.includes('implode');
      // ✨ FIX: Cattura anche errori "Property [value] does not exist" relativi a accessoriServices
      const isPropertyError =
        jsonError?.message?.includes('Property') && jsonError?.message?.includes('does not exist');
      const isAccessoryServiceError = isImplodeError || isPropertyError;

      console.error('❌ [SPEDISCI.ONLINE] Creazione JSON fallita:', {
        message: jsonError?.message,
        is401Unauthorized: is401,
        isImplodeError,
        isPropertyError,
        isAccessoryServiceError,
        base_url: adapter.BASE_URL,
      });

      // ✨ FIX: Se errore relativo a servizi accessori, prova diversi formati
      // L'API potrebbe accettare formati diversi (stringhe, oggetti con name/code/service/id)
      if (isAccessoryServiceError && openApiPayload.accessoriServices.length > 0) {
        const originalServices = openApiPayload.accessoriServices;

        // ✨ Se gli ID sono già numeri, prova anche come stringhe numeriche
        // (alcune API preferiscono stringhe anche per numeri)
        const serviceIds = originalServices
          .map((s: any) => {
            if (typeof s === 'number') return s;
            if (typeof s === 'string' && /^\d+$/.test(s)) return parseInt(s, 10);
            return null;
          })
          .filter((id: any): id is number => id !== null);

        console.warn(
          `⚠️ [SPEDISCI.ONLINE] Errore servizi accessori (formato number[]) - provo formato string[]...`
        );

        // ✨ FORMATI DA PROVARE (solo fallback per ID numerici):
        const formatsToTry = [
          // Prova array di stringhe numeriche (fallback)
          {
            name: 'string_numbers',
            format: serviceIds.map((id: number) => String(id)),
          },
          // Prova array di oggetti con id (ultimo tentativo)
          {
            name: 'object_with_id',
            format: serviceIds.map((id: number) => ({ id: id })),
          },
        ];

        // Prova ogni formato
        for (const format of formatsToTry) {
          try {
            console.log(`🔄 [SPEDISCI.ONLINE] Provo formato "${format.name}":`, format.format);
            const payloadWithFormat = {
              ...openApiPayload,
              accessoriServices: format.format,
            };
            const result = await adapter.createShipmentJSON(payloadWithFormat);
            if (result.success) {
              console.log(`✅ [SPEDISCI.ONLINE] Successo con formato "${format.name}"!`);
              return {
                tracking_number: result.tracking_number,
                label_url: result.label_url,
                label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
                shipmentId: result.shipmentId ? String(result.shipmentId) : undefined,
                metadata: {
                  ...(result.metadata || {}),
                  accessoriServices_format: format.name,
                },
              };
            }
          } catch (formatError: any) {
            console.warn(
              `⚠️ [SPEDISCI.ONLINE] Formato "${format.name}" fallito:`,
              formatError.message?.substring(0, 100)
            );
            continue; // Prova formato successivo
          }
        }

        // ✨ FALLBACK FINALE: Se tutti i formati falliscono, prova SENZA servizi accessori
        console.warn(
          '⚠️ [SPEDISCI.ONLINE] Tutti i formati falliti - riprovo SENZA servizi accessori...'
        );
        const payloadSenzaServizi = {
          ...openApiPayload,
          accessoriServices: [], // Array vuoto
        };
        try {
          const result = await adapter.createShipmentJSON(payloadSenzaServizi);
          if (result.success) {
            console.log('✅ [SPEDISCI.ONLINE] Successo SENZA servizi accessori!');
            console.warn(
              "⚠️ [SPEDISCI.ONLINE] NOTA: I servizi accessori non sono stati applicati perché l'API non supporta nessun formato testato."
            );
            return {
              tracking_number: result.tracking_number,
              label_url: result.label_url,
              label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
              shipmentId: result.shipmentId ? String(result.shipmentId) : undefined,
              metadata: {
                ...(result.metadata || {}),
                accessoriServices_warning:
                  'Servizi accessori non applicati - nessun formato API supportato (testati: string[], {name}, {code}, {service}, {id}, {value})',
              },
            };
          }
        } catch (noServicesError: any) {
          console.warn(
            '⚠️ [SPEDISCI.ONLINE] Anche senza servizi accessori fallito:',
            noServicesError.message
          );
        }
      }

      // Se 401, prova endpoint /v1 invece di /v2 (alcuni account usano API v1)
      if (is401 && adapter.BASE_URL.includes('/api/v2')) {
        console.warn(
          '⚠️ [SPEDISCI.ONLINE] Provo endpoint /v1/shipping/create (alcuni account Spedisci.Online usano v1)...'
        );
        try {
          const result = await adapter.createShipmentJSON(openApiPayload, 'v1');
          if (result.success) {
            console.log('✅ [SPEDISCI.ONLINE] Successo con endpoint /v1!');
            return {
              tracking_number: result.tracking_number,
              label_url: result.label_url,
              label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
              // ⚠️ CRITICO: Includi shipmentId direttamente nel ShippingLabel
              shipmentId: result.shipmentId ? String(result.shipmentId) : undefined,
              // ⚠️ FIX: Includi metadata con shipmentId per cancellazione futura
              metadata: result.metadata || {},
            };
          }
        } catch (v1Error: any) {
          console.warn('⚠️ [SPEDISCI.ONLINE] Anche endpoint /v1 fallito:', v1Error.message);
        }
      }

      console.warn('⚠️ [SPEDISCI.ONLINE] Provo CSV upload...');
      // Continua con CSV upload
    }

    // 3. PRIORITÀ 2: Upload CSV (se JSON non disponibile) - usa formato legacy
    try {
      const legacyPayload = adapter.mapToSpedisciOnlineFormat(data, contractCode);
      const csvContent = adapter.generateCSV(legacyPayload);
      const result = await adapter.uploadCSV(csvContent);

      if (result.success) {
        return {
          tracking_number: result.tracking_number || adapter.generateTrackingNumber(),
          label_url: result.label_url,
          label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
        };
      }
    } catch (err: any) {
      csvError = err;
      console.warn('Upload CSV fallito:', csvError?.message);
      // Continua con fallback
    }

    // 4. FALLBACK: Genera CSV locale (solo se tutto fallisce) - usa formato legacy
    // ⚠️ CRITICO: Se tutte le chiamate API falliscono, NON restituire un ShippingLabel valido
    // Lancia un errore invece, così l'orchestrator può gestirlo correttamente come fallback
    console.error(
      '❌ [SPEDISCI.ONLINE] TUTTE LE CHIAMATE API FALLITE - Impossibile creare LDV realmente'
    );
    console.error('❌ [SPEDISCI.ONLINE] Dettagli errori:', {
      jsonError: jsonError?.message || 'Chiamata POST /shipping/create fallita',
      csvError: csvError?.message || 'Upload CSV fallito (tutti gli endpoint 404)',
    });

    // ⚠️ CRITICO: Lancia errore invece di restituire CSV fallback
    // L'orchestrator gestirà questo come fallback CSV se necessario
    const lastError = jsonError || csvError;
    throw new Error(
      `Impossibile creare LDV su Spedisci.Online: tutte le chiamate API sono fallite. ` +
        `Verifica la configurazione API e i dati della spedizione. ` +
        `Errore JSON: ${jsonError?.message || 'N/A'}. ` +
        `Errore CSV: ${csvError?.message || 'N/A'}`
    );
  } catch (error) {
    console.error('Errore creazione spedizione spedisci.online:', error);

    // Messaggio di errore più dettagliato
    let errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';

    // Verifica se è un errore di contratto mancante
    const courier = (data.corriere || data.courier_id || '').toLowerCase().trim();
    if (!adapter.CONTRACT_MAPPING || Object.keys(adapter.CONTRACT_MAPPING).length === 0) {
      errorMessage = `Nessun contratto configurato. Configura i contratti nel wizard Spedisci.online.`;
    } else if (courier && !adapter.findContractCode(data)) {
      errorMessage = `Contratto non trovato per corriere "${courier}". Verifica il mapping contratti nel wizard Spedisci.online. Contratti disponibili: ${Object.keys(
        adapter.CONTRACT_MAPPING
      ).join(', ')}`;
    }

    throw new Error(errorMessage);
  }
}

export async function createShipmentJSONImpl(
  adapter: any,
  payload: SpedisciOnlineOpenAPIPayload,
  apiVersion: 'v1' | 'v2' = 'v2'
): Promise<SpedisciOnlineResponse> {
  // Costruisci URL corretto con versione API specificata
  // Esempio v2: https://demo1.spedisci.online/api/v2/ -> https://demo1.spedisci.online/api/v2/shipping/create
  // Esempio v1: https://demo1.spedisci.online/api/v2/ -> https://demo1.spedisci.online/api/v1/shipping/create
  let baseUrlNormalized = adapter.BASE_URL.endsWith('/')
    ? adapter.BASE_URL
    : `${adapter.BASE_URL}/`;

  // Se richiesta v1 ma BASE_URL contiene v2, sostituisci
  if (apiVersion === 'v1' && baseUrlNormalized.includes('/api/v2/')) {
    baseUrlNormalized = baseUrlNormalized.replace('/api/v2/', '/api/v1/');
    console.log('🔄 [SPEDISCI.ONLINE] Usando endpoint API v1:', baseUrlNormalized);
  }

  const url = new URL('shipping/create', baseUrlNormalized).toString();

  // Genera fingerprint SHA256 per log production-safe
  const crypto = require('crypto');
  const keyFingerprint = adapter.API_KEY
    ? crypto.createHash('sha256').update(adapter.API_KEY).digest('hex').substring(0, 8)
    : 'N/A';

  // FIX: OpenAPI spec richiede SOLO Bearer token - rimuove strategie fallback
  // Secondo documentazione: Authorization: Bearer {api_key}
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${adapter.API_KEY}`,
  };

  // Log pre-request per debug (production-safe)
  console.log('📡 [SPEDISCI.ONLINE] API call:', {
    method: 'POST',
    url: url,
    baseUrl: adapter.BASE_URL,
    apiKeyFingerprint: keyFingerprint,
    apiKeyLength: adapter.API_KEY.length,
    authHeader: 'Bearer [REDACTED]', // Non loggare API key
    // ✨ DEBUG: Verifica servizi accessori nel payload
    accessoriServices: payload.accessoriServices,
    accessoriServices_count: Array.isArray(payload.accessoriServices)
      ? payload.accessoriServices.length
      : 0,
    accessoriServices_type:
      Array.isArray(payload.accessoriServices) && payload.accessoriServices.length > 0
        ? typeof payload.accessoriServices[0]
        : 'empty',
    accessoriServices_sample:
      Array.isArray(payload.accessoriServices) && payload.accessoriServices.length > 0
        ? payload.accessoriServices[0]
        : null,
  });

  // Log payload (solo metadati non sensibili)
  console.log('📡 [SPEDISCI.ONLINE] Payload:', {
    carrierCode: payload.carrierCode,
    contractCode: payload.contractCode,
    packages_count: payload.packages?.length || 0,
    accessoriServices_count: Array.isArray(payload.accessoriServices)
      ? payload.accessoriServices.length
      : 0,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    // Log response production-safe
    console.log('📡 [SPEDISCI.ONLINE] API response:', {
      status: response.status,
      statusText: response.statusText,
      apiKeyFingerprint: keyFingerprint,
      url: url,
    });

    if (response.ok) {
      const result = await response.json();

      // Log risposta (solo flag booleani, nessun valore sensibile)
      console.log('📦 [SPEDISCI.ONLINE] Risposta ricevuta:', {
        status: response.status,
        apiKeyFingerprint: keyFingerprint,
        response_keys: Object.keys(result),
        has_shipmentId: !!result.shipmentId,
        has_increment_id: !!result.increment_id,
        has_incrementId: !!result.incrementId,
        has_id: !!result.id,
        has_nested_shipmentId: !!(result.shipment?.shipmentId || result.data?.shipmentId),
      });

      // Log successo production-safe
      console.log('✅ [SPEDISCI.ONLINE] Success:', {
        status: response.status,
        apiKeyFingerprint: keyFingerprint,
        hasTracking: !!(result.trackingNumber || result.tracking_number),
        hasLabel: !!(result.labelData || result.label_pdf || result.label),
      });

      // Parsing risposta OpenAPI
      const trackingNumber =
        result.trackingNumber || result.tracking_number || adapter.generateTrackingNumber();
      // labelData può essere in diversi formati nella risposta
      const labelData = result.labelData || result.label_pdf || result.label || result.labelPdf; // Base64 encoded

      // ⚠️ FIX: Estrai shipmentId dalla risposta (secondo OpenAPI spec, questo è l'increment_id per cancellazione)
      // Secondo openapi.json: POST /shipping/create restituisce "shipmentId" (integer) - riga 592-593
      // Questo shipmentId è l'increment_id da usare per POST /shipping/delete - riga 704-705
      let shipmentId =
        result.shipmentId || result.increment_id || result.incrementId || result.id || null;

      // ⚠️ FALLBACK: Se shipmentId non è nella risposta, prova a estrarlo dal tracking number
      // Questo è necessario perché alcune API di Spedisci.Online potrebbero non restituire shipmentId
      if (!shipmentId && trackingNumber) {
        // Estrai numero alla fine del tracking (es: "3UW1LZ1549876" -> 1549876)
        const trackingMatch = trackingNumber.match(/(\d+)$/);
        if (trackingMatch) {
          shipmentId = trackingMatch[1];
          console.warn(
            '⚠️ [SPEDISCI.ONLINE] shipmentId NON nella risposta API, estratto dal tracking come fallback:',
            {
              trackingNumber,
              extracted_shipmentId: shipmentId,
              warning:
                "Questo potrebbe non essere corretto se il tracking number non contiene l'increment_id reale",
            }
          );
        }
      }

      if (shipmentId) {
        console.log('✅ [SPEDISCI.ONLINE] shipmentId (increment_id) trovato:', {
          shipmentId,
          type: typeof shipmentId,
          source: result.shipmentId
            ? 'shipmentId (API)'
            : result.increment_id
              ? 'increment_id (API)'
              : result.incrementId
                ? 'incrementId (API)'
                : result.id
                  ? 'id (API)'
                  : 'estratto dal tracking (FALLBACK)',
        });
      } else {
        console.error(
          '❌ [SPEDISCI.ONLINE] shipmentId NON TROVATO nella risposta e impossibile estrarlo dal tracking!',
          {
            trackingNumber,
            chiavi_disponibili: Object.keys(result),
            response_sample: JSON.stringify(result).substring(0, 300),
            warning: 'La cancellazione futura potrebbe non funzionare correttamente',
          }
        );
      }

      return {
        success: true,
        tracking_number: trackingNumber,
        label_url: result.labelUrl || result.label_url,
        label_pdf: labelData, // Base64 encoded, sarà convertito in Buffer in createShipment
        message: result.message || 'LDV creata con successo',
        // ⚠️ CRITICO: Includi shipmentId sia nel metadata che direttamente nel risultato
        shipmentId: shipmentId ? String(shipmentId) : undefined, // Aggiunto anche direttamente
        metadata: {
          ...(result.metadata || {}),
          shipmentId: shipmentId ? String(shipmentId) : undefined,
          increment_id: shipmentId ? String(shipmentId) : undefined, // Alias per compatibilità
        },
      };
    }

    // Gestisci errore
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorBody = null;

    try {
      errorBody = await response.json();
      errorMessage = errorBody.message || errorBody.error || errorMessage;
    } catch {
      const textError = await response.text();
      errorMessage = textError || errorMessage;
    }

    // Log errore production-safe con dettagli diagnostici
    console.error('❌ [SPEDISCI.ONLINE] API error:', {
      status: response.status,
      statusText: response.statusText,
      apiKeyFingerprint: keyFingerprint,
      apiKeyLength: adapter.API_KEY.length,
      baseUrl: adapter.BASE_URL,
      url: url,
      error: errorMessage,
      hint:
        response.status === 401
          ? 'Verifica: 1) API key valida, 2) Base URL corretto (demo vs production), 3) Bearer token formato corretto'
          : undefined,
    });

    // Messaggio errore più dettagliato per 401
    if (response.status === 401) {
      throw new Error(
        `Spedisci.Online Authentication Failed (401): ${errorMessage}\n` +
          `Verifica:\n` +
          `1. API Key valida e aggiornata\n` +
          `2. Base URL corretto: ${adapter.BASE_URL}\n` +
          `3. Formato Authorization header: Bearer {api_key}`
      );
    }

    throw new Error(`Spedisci.Online Error (${response.status}): ${errorMessage}`);
  } catch (error: any) {
    // Errore di rete o parsing
    console.error('❌ [SPEDISCI.ONLINE] Request error:', {
      apiKeyFingerprint: keyFingerprint,
      baseUrl: adapter.BASE_URL,
      url: url,
      error: error.message,
    });

    // Se è già un errore formattato, rilancialo
    if (error.message?.includes('Spedisci.Online')) {
      throw error;
    }

    throw new Error(`Errore di connessione Spedisci.Online: ${error.message}`);
  }
}
