/**
 * Spedisci.Online Adapter - Production-Ready
 *
 * Adapter per inviare automaticamente le spedizioni a spedisci.online
 * per la creazione automatica delle LDV tramite API JSON sincrone.
 *
 * ARCHITETTURA:
 * - Priorità 1: API JSON sincrona (LDV istantanea)
 * - Priorità 2: Upload CSV (se JSON non disponibile)
 * - Fallback: CSV locale (solo se tutto fallisce)
 *
 * OBIETTIVO: Eliminare la dipendenza dal CSV per performance production-ready
 */

import type { CreateShipmentInput, Shipment } from '@/types/shipments';
import { CourierAdapter, CourierCredentials, ShippingLabel, TrackingEvent } from './base';

export interface SpedisciOnlineCredentials extends CourierCredentials {
  api_key: string;
  api_secret?: string;
  customer_code?: string;
  base_url?: string; // Default: https://api.spedisci.online
  contract_mapping?: Record<string, string>; // Mapping: codice contratto completo -> nome corriere
}

// Interfaccia legacy (mantenuta per compatibilità CSV fallback)
export interface SpedisciOnlineShipmentPayload {
  destinatario: string;
  indirizzo: string;
  cap: string;
  localita: string;
  provincia: string;
  country: string;
  peso: number | string;
  colli: number | string;
  codValue: number;
  insuranceValue: number;
  accessoriServices: any[];
  rif_mittente?: string;
  rif_destinatario?: string;
  note?: string;
  telefono?: string;
  email_destinatario?: string;
  contenuto?: string;
  order_id?: string;
  totale_ordine?: number | string;
  codice_contratto?: string;
  label_format?: string;
}

// Interfaccia OpenAPI per POST /shipping/create
export interface SpedisciOnlineOpenAPIPayload {
  carrierCode: string; // REQUIRED: es "postedeliverybusiness" (prima parte del contractCode)
  contractCode: string; // REQUIRED: es "postedeliverybusiness-Solution-and-Shipment"
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
    state: string; // Provincia (2 lettere)
    postalCode: string;
    country: string;
    email?: string;
    phone?: string;
  };
  shipTo: {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string; // Provincia (2 lettere)
    postalCode: string;
    country: string;
    email?: string;
    phone?: string;
  };
  notes: string; // REQUIRED, mai vuoto
  insuranceValue: number; // REQUIRED
  codValue: number; // REQUIRED
  accessoriServices: any[]; // REQUIRED
  label_format?: string; // Optional: "PDF" | "ZPL"
}

export interface SpedisciOnlineResponse {
  success: boolean;
  tracking_number: string;
  label_url?: string;
  label_pdf?: string; // Base64 encoded
  error?: string;
  message?: string;
  shipmentId?: string; // ⚠️ CRITICO: shipmentId (increment_id) per cancellazione
  metadata?: {
    [key: string]: any; // Metadati aggiuntivi (es: shipmentId, increment_id, etc.)
  };
}

export class SpedisciOnlineAdapter extends CourierAdapter {
  private readonly API_KEY: string;
  private readonly BASE_URL: string;
  private readonly CONTRACT_MAPPING: Record<string, string>; // Mapping: codice contratto -> corriere

  /**
   * Costruttore che forza le credenziali (Niente credenziali = Niente LDV)
   */
  constructor(credentials: SpedisciOnlineCredentials) {
    super(credentials, 'spedisci-online');

    if (!credentials.api_key) {
      throw new Error('Spedisci.Online: API Key mancante per la creazione LDV.');
    }

    // FIX: Trim API key prima di usarla
    const trimmedApiKey = credentials.api_key.trim();

    // Guard: Verifica che non sia un token demo/example + min length
    const knownDemoTokens = ['qCL7FN2RKFQDngWb6kJ7', '8ZZmDdwA', 'demo', 'example', 'test'];

    const apiKeyLower = trimmedApiKey.toLowerCase();
    const isDemoToken = knownDemoTokens.some(
      (demo) => apiKeyLower.includes(demo.toLowerCase()) || trimmedApiKey.startsWith(demo)
    );

    if (isDemoToken) {
      throw new Error(
        'Spedisci.Online API key not configured correctly (using demo token). Please configure a valid API key in /dashboard/integrazioni'
      );
    }

    // Min length check
    if (trimmedApiKey.length < 10) {
      throw new Error(
        'Spedisci.Online API key too short. Please configure a valid API key in /dashboard/integrazioni'
      );
    }

    // Genera fingerprint SHA256 della key per log production-safe
    const crypto = require('crypto');
    const keyFingerprint = trimmedApiKey
      ? crypto.createHash('sha256').update(trimmedApiKey).digest('hex').substring(0, 8)
      : 'N/A';

    // ⚠️ SEC-1: NO log di API key (anche fingerprint/lunghezza può essere info utile per attacco)

    this.API_KEY = trimmedApiKey; // Usa la key trimmed
    // Normalizza BASE_URL: mantieni trailing slash se presente (serve per new URL())
    // Esempio: https://demo1.spedisci.online/api/v2/ -> mantieni slash finale
    // FIX: Valida baseUrl per evitare mismatch demo vs production
    const baseUrl = credentials.base_url || 'https://api.spedisci.online/api/v2';
    const normalizedBaseUrl = baseUrl.trim().endsWith('/') ? baseUrl.trim() : `${baseUrl.trim()}/`;

    // Validazione baseUrl: deve contenere spedisci.online e /api/v2
    if (!normalizedBaseUrl.includes('spedisci.online')) {
      console.warn('⚠️ [SPEDISCI.ONLINE] Base URL potrebbe essere errato:', normalizedBaseUrl);
    }
    if (!normalizedBaseUrl.includes('/api/v2')) {
      console.warn('⚠️ [SPEDISCI.ONLINE] Base URL potrebbe mancare /api/v2:', normalizedBaseUrl);
    }

    this.BASE_URL = normalizedBaseUrl;
    this.CONTRACT_MAPPING = credentials.contract_mapping || {};

    // Log baseUrl per debug (production-safe)
    console.log('🔧 [SPEDISCI.ONLINE] Base URL configurato:', {
      baseUrl: this.BASE_URL,
      isDemo: this.BASE_URL.includes('demo'),
      isProduction:
        this.BASE_URL.includes('api.spedisci.online') && !this.BASE_URL.includes('demo'),
    });
  }

  /**
   * Test connessione API spedisci.online
   */
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/v1/auth/test`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Errore connessione spedisci.online:', error);
      return false;
    }
  }

  /**
   * ===========================================
   * METODO CRITICO: CREAZIONE LDV (SINCRONO)
   * ===========================================
   *
   * Priorità:
   * 1. POST JSON sincrono (LDV istantanea) ← PREFERITO
   * 2. Upload CSV (se JSON non disponibile)
   * 3. Fallback CSV locale (solo se tutto fallisce)
   */
  async createShipment(data: Shipment | CreateShipmentInput | any): Promise<ShippingLabel> {
    console.log('🚀 [SPEDISCI.ONLINE] ========================================');
    // ⚠️ SEC-1: NO log di API key info
    console.log('🚀 [SPEDISCI.ONLINE] INIZIO CREAZIONE SPEDIZIONE');
    console.log(
      '🚀 [SPEDISCI.ONLINE] CONTRACT_MAPPING disponibili:',
      Object.keys(this.CONTRACT_MAPPING || {}).length
    );

    try {
      // 1. Trova codice contratto basato sul corriere selezionato
      const corriereDaData = data.corriere || data.courier_id || 'NON TROVATO';
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      console.log('🔍 [SPEDISCI.ONLINE] RICERCA CONTRATTO');
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      console.log('🔍 [SPEDISCI.ONLINE] Corriere richiesto:', corriereDaData);
      const contractCode = this.findContractCode(data);
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      console.log(
        '🔍 [SPEDISCI.ONLINE] RISULTATO: Codice contratto trovato:',
        contractCode || '❌ NESSUNO'
      );
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');

      // 2. Mappatura Dati nel formato OpenAPI Spedisci.Online
      const openApiPayload = this.mapToOpenAPIFormat(data, contractCode);
      console.log('📦 [SPEDISCI.ONLINE] Payload OpenAPI preparato:', {
        carrierCode: openApiPayload.carrierCode,
        contractCode: openApiPayload.contractCode,
        base_url: this.BASE_URL,
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
        const result = await this.createShipmentJSON(openApiPayload);
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
          jsonError?.message?.includes('Property') &&
          jsonError?.message?.includes('does not exist');
        const isAccessoryServiceError = isImplodeError || isPropertyError;

        console.error('❌ [SPEDISCI.ONLINE] Creazione JSON fallita:', {
          message: jsonError?.message,
          is401Unauthorized: is401,
          isImplodeError,
          isPropertyError,
          isAccessoryServiceError,
          base_url: this.BASE_URL,
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
              format: serviceIds.map((id) => String(id)),
            },
            // Prova array di oggetti con id (ultimo tentativo)
            {
              name: 'object_with_id',
              format: serviceIds.map((id) => ({ id: id })),
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
              const result = await this.createShipmentJSON(payloadWithFormat);
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
            const result = await this.createShipmentJSON(payloadSenzaServizi);
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
        if (is401 && this.BASE_URL.includes('/api/v2')) {
          console.warn(
            '⚠️ [SPEDISCI.ONLINE] Provo endpoint /v1/shipping/create (alcuni account Spedisci.Online usano v1)...'
          );
          try {
            const result = await this.createShipmentJSON(openApiPayload, 'v1');
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
        const legacyPayload = this.mapToSpedisciOnlineFormat(data, contractCode);
        const csvContent = this.generateCSV(legacyPayload);
        const result = await this.uploadCSV(csvContent);

        if (result.success) {
          return {
            tracking_number: result.tracking_number || this.generateTrackingNumber(),
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
      if (!this.CONTRACT_MAPPING || Object.keys(this.CONTRACT_MAPPING).length === 0) {
        errorMessage = `Nessun contratto configurato. Configura i contratti nel wizard Spedisci.online.`;
      } else if (courier && !this.findContractCode(data)) {
        errorMessage = `Contratto non trovato per corriere "${courier}". Verifica il mapping contratti nel wizard Spedisci.online. Contratti disponibili: ${Object.keys(
          this.CONTRACT_MAPPING
        ).join(', ')}`;
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Ottieni tracking eventi
   */
  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    try {
      // Costruisci URL tracking in modo intelligente: se BASE_URL contiene già /api/v2, aggiungi /v1
      let trackingEndpoint = `/v1/tracking/${trackingNumber}`;
      if (this.BASE_URL.includes('/api/v2')) {
        // Se BASE_URL contiene già /api/v2, l'endpoint completo dovrebbe essere /api/v2/v1/tracking
        trackingEndpoint = `/v1/tracking/${trackingNumber}`;
      }
      const response = await fetch(`${this.BASE_URL}${trackingEndpoint}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
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

  /**
   * ===========================================
   * METODO PRIVATO: CREAZIONE JSON (OpenAPI)
   * ===========================================
   *
   * Usa POST /shipping/create secondo OpenAPI
   *
   * @param payload - Payload OpenAPI
   * @param apiVersion - Versione API da usare ('v2' default, 'v1' fallback)
   */
  private async createShipmentJSON(
    payload: SpedisciOnlineOpenAPIPayload,
    apiVersion: 'v1' | 'v2' = 'v2'
  ): Promise<SpedisciOnlineResponse> {
    // Costruisci URL corretto con versione API specificata
    // Esempio v2: https://demo1.spedisci.online/api/v2/ -> https://demo1.spedisci.online/api/v2/shipping/create
    // Esempio v1: https://demo1.spedisci.online/api/v2/ -> https://demo1.spedisci.online/api/v1/shipping/create
    let baseUrlNormalized = this.BASE_URL.endsWith('/') ? this.BASE_URL : `${this.BASE_URL}/`;

    // Se richiesta v1 ma BASE_URL contiene v2, sostituisci
    if (apiVersion === 'v1' && baseUrlNormalized.includes('/api/v2/')) {
      baseUrlNormalized = baseUrlNormalized.replace('/api/v2/', '/api/v1/');
      console.log('🔄 [SPEDISCI.ONLINE] Usando endpoint API v1:', baseUrlNormalized);
    }

    const url = new URL('shipping/create', baseUrlNormalized).toString();

    // Genera fingerprint SHA256 per log production-safe
    const crypto = require('crypto');
    const keyFingerprint = this.API_KEY
      ? crypto.createHash('sha256').update(this.API_KEY).digest('hex').substring(0, 8)
      : 'N/A';

    // FIX: OpenAPI spec richiede SOLO Bearer token - rimuove strategie fallback
    // Secondo documentazione: Authorization: Bearer {api_key}
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.API_KEY}`,
    };

    // Log pre-request per debug (production-safe)
    console.log('📡 [SPEDISCI.ONLINE] API call:', {
      method: 'POST',
      url: url,
      baseUrl: this.BASE_URL,
      apiKeyFingerprint: keyFingerprint,
      apiKeyLength: this.API_KEY.length,
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
          result.trackingNumber || result.tracking_number || this.generateTrackingNumber();
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
        apiKeyLength: this.API_KEY.length,
        baseUrl: this.BASE_URL,
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
            `2. Base URL corretto: ${this.BASE_URL}\n` +
            `3. Formato Authorization header: Bearer {api_key}`
        );
      }

      throw new Error(`Spedisci.Online Error (${response.status}): ${errorMessage}`);
    } catch (error: any) {
      // Errore di rete o parsing
      console.error('❌ [SPEDISCI.ONLINE] Request error:', {
        apiKeyFingerprint: keyFingerprint,
        baseUrl: this.BASE_URL,
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

  /**
   * ===========================================
   * METODO PRIVATO: UPLOAD CSV (PRIORITÀ 2)
   * ===========================================
   *
   * Prova automaticamente diversi endpoint per l'upload CSV
   */
  private async uploadCSV(csvContent: string): Promise<SpedisciOnlineResponse> {
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    formData.append('file', blob, 'spedizione.csv');
    formData.append('format', 'csv');

    // Genera lista di endpoint per upload CSV
    const uploadEndpoints = this.generateUploadEndpointVariations();

    let lastError: Error | null = null;

    // Prova ogni endpoint fino a trovare uno che funziona
    for (const endpoint of uploadEndpoints) {
      // FIX: Usa new URL() per evitare doppio slash
      const baseUrlNormalized = this.BASE_URL.endsWith('/') ? this.BASE_URL : `${this.BASE_URL}/`;
      const url = new URL(endpoint, baseUrlNormalized).toString();
      console.log(`🔍 [SPEDISCI.ONLINE] Tentativo upload CSV su: ${url}`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
          },
          body: formData,
        });

        console.log('📡 [SPEDISCI.ONLINE] Risposta upload CSV:', {
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ [SPEDISCI.ONLINE] Upload CSV riuscito su:', url);

          return {
            success: true,
            tracking_number: result.tracking_number || this.generateTrackingNumber(),
            label_url: result.label_url,
            label_pdf: result.label_pdf,
            message: result.message || 'CSV caricato con successo',
          };
        }

        // Se non è OK, salva l'errore e prova il prossimo endpoint
        if (response.status !== 404) {
          const errorText = await response.text();
          throw new Error(`Upload CSV fallito (${response.status}): ${errorText}`);
        }

        console.warn(
          `⚠️ [SPEDISCI.ONLINE] Endpoint upload ${url} restituisce 404, provo il prossimo...`
        );
        lastError = new Error(`Endpoint upload ${url} non trovato (404)`);
      } catch (error: any) {
        if (
          error.message &&
          !error.message.includes('404') &&
          !error.message.includes('not found')
        ) {
          throw error;
        }
        lastError = error;
        console.warn(`⚠️ [SPEDISCI.ONLINE] Errore upload su ${url}:`, error.message);
      }
    }

    // Se arriviamo qui, tutti gli endpoint hanno fallito
    console.error('❌ [SPEDISCI.ONLINE] Tutti gli endpoint upload CSV hanno fallito');
    throw lastError || new Error('Spedisci.Online: Nessun endpoint upload CSV valido trovato');
  }

  /**
   * Genera variazioni di endpoint per upload CSV
   * FIX: Non duplicare /api/v2 se già presente in BASE_URL
   */
  private generateUploadEndpointVariations(): string[] {
    const baseUrl = this.BASE_URL;
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

  /**
   * Trova il codice contratto basato sul corriere selezionato
   */
  private findContractCode(data: Shipment | CreateShipmentInput | any): string | undefined {
    // Estrai il corriere dai dati
    const courier = (
      data.corriere ||
      data.courier_id ||
      data.courier?.code ||
      data.courier?.name ||
      ''
    )
      .toLowerCase()
      .trim();

    if (!courier || !this.CONTRACT_MAPPING || Object.keys(this.CONTRACT_MAPPING).length === 0) {
      console.warn('⚠️ [SPEDISCI.ONLINE] Nessun contratto configurato o corriere mancante');
      return undefined;
    }

    // Normalizza nomi corrieri comuni (generico, non specifico per utente)
    const courierAliases: Record<string, string[]> = {
      poste: ['poste', 'poste italiane', 'posteitaliane'],
      gls: ['gls'],
      brt: ['brt', 'bartolini'],
      sda: ['sda'],
      ups: ['ups'],
      dhl: ['dhl'],
    };

    // Trova il nome base del corriere
    let normalizedCourier = courier;
    for (const [baseName, aliases] of Object.entries(courierAliases)) {
      if (aliases.some((alias) => courier.includes(alias) || alias.includes(courier))) {
        normalizedCourier = baseName;
        break;
      }
    }

    console.log(
      `🔍 [SPEDISCI.ONLINE] Cerca contratto per corriere: "${courier}" (normalizzato: "${normalizedCourier}")`
    );
    console.log(
      `🔍 [SPEDISCI.ONLINE] Mapping disponibile:`,
      Object.keys(this.CONTRACT_MAPPING).map((k) => `${k} -> ${this.CONTRACT_MAPPING[k]}`)
    );

    // Cerca un contratto che corrisponde al corriere
    // Il mapping è: codice contratto -> nome corriere (es: "postedeliverybusiness-Solution-and-Shipment" -> "PosteDeliveryBusiness")
    // Ogni utente ha i propri contratti personali nel proprio account Spedisci.online

    // STRATEGIA 1: Cerca match esatto nel VALORE (nome corriere nel mapping)
    // Es: "Poste Italiane" -> cerca valore che contiene "poste" o simile
    for (const [contractCode, courierName] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedCourierName = String(courierName).toLowerCase().trim();

      // Match esatto
      if (normalizedCourierName === courier || normalizedCourierName === normalizedCourier) {
        console.log(
          `✅ Codice contratto trovato (match esatto valore) per ${courier}: ${contractCode}`
        );
        return contractCode;
      }

      // Match intelligente: se il corriere normalizzato è "poste" e il valore contiene "poste"
      // Questo funziona per qualsiasi utente che ha un contratto con "poste" nel nome
      if (normalizedCourier === 'poste' && normalizedCourierName.includes('poste')) {
        console.log(
          `✅ Codice contratto trovato (match Poste generico) per ${courier}: ${contractCode} (valore: ${courierName})`
        );
        return contractCode;
      }

      // Match intelligente generico: se il corriere contiene parte del nome corriere nel mapping
      // Es: "GLS" trova "Gls", "GLS Express", ecc.
      const courierWords = courier.split(/\s+/).filter((w: string) => w.length > 2); // Parole significative
      const courierNameWords = normalizedCourierName
        .split(/\s+/)
        .filter((w: string) => w.length > 2);

      // Se una parola significativa del corriere è nel nome corriere del mapping
      if (
        courierWords.some((word: string) => normalizedCourierName.includes(word.toLowerCase())) ||
        courierNameWords.some((word: string) => courier.includes(word.toLowerCase()))
      ) {
        console.log(
          `✅ Codice contratto trovato (match parziale parole) per ${courier}: ${contractCode} (valore: ${courierName})`
        );
        return contractCode;
      }
    }

    // STRATEGIA 2: Cerca match esatto nella CHIAVE (codice contratto che contiene il nome corriere)
    for (const [contractCode] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedContractCode = contractCode.toLowerCase();
      if (
        normalizedContractCode === courier ||
        normalizedContractCode === normalizedCourier ||
        normalizedContractCode.startsWith(courier + '-') ||
        normalizedContractCode.startsWith(normalizedCourier + '-')
      ) {
        console.log(`✅ Codice contratto trovato (match chiave) per ${courier}: ${contractCode}`);
        return contractCode;
      }
    }

    // STRATEGIA 3: Cerca match parziale nel codice contratto (es: "sda" in "sda-XXX-YYY")
    for (const [contractCode] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedContractCode = contractCode.toLowerCase();
      // Cerca se il codice contratto inizia con il nome del corriere o lo contiene dopo un trattino
      if (
        normalizedContractCode.includes(courier) ||
        normalizedContractCode.includes(normalizedCourier)
      ) {
        if (
          normalizedContractCode.startsWith(courier) ||
          normalizedContractCode.startsWith(normalizedCourier) ||
          normalizedContractCode.includes('-' + courier + '-') ||
          normalizedContractCode.includes('-' + normalizedCourier + '-') ||
          normalizedContractCode.endsWith('-' + courier) ||
          normalizedContractCode.endsWith('-' + normalizedCourier)
        ) {
          console.log(`✅ Codice contratto trovato (parziale) per ${courier}: ${contractCode}`);
          return contractCode;
        }
      }
    }

    // STRATEGIA 4: Cerca match parziale nel nome corriere (generico per tutti gli utenti)
    // Funziona per qualsiasi nome corriere, non hardcoded
    for (const [contractCode, courierName] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedCourierName = String(courierName).toLowerCase();

      // Match parziale standard: se il nome corriere contiene il corriere o viceversa
      if (
        normalizedCourierName.includes(courier) ||
        courier.includes(normalizedCourierName.split(' ')[0])
      ) {
        console.log(
          `✅ Codice contratto trovato (match parziale nome) per ${courier}: ${contractCode}`
        );
        return contractCode;
      }

      // Match per parole chiave comuni: estrai la prima parola significativa
      const courierFirstWord = courier.split(/\s+/)[0].toLowerCase();
      const courierNameFirstWord = normalizedCourierName.split(/\s+/)[0].toLowerCase();

      if (courierFirstWord.length > 2 && courierNameFirstWord.length > 2) {
        if (
          courierFirstWord === courierNameFirstWord ||
          courierFirstWord.includes(courierNameFirstWord) ||
          courierNameFirstWord.includes(courierFirstWord)
        ) {
          console.log(
            `✅ Codice contratto trovato (match prima parola) per ${courier}: ${contractCode} (valore: ${courierName})`
          );
          return contractCode;
        }
      }
    }

    // STRATEGIA 5: Se c'è un solo contratto disponibile, usalo come fallback
    // (alcuni contratti sono unici e servono per tutti i corrieri)
    const contractKeys = Object.keys(this.CONTRACT_MAPPING);
    if (contractKeys.length === 1) {
      const fallbackContract = contractKeys[0];
      console.warn(
        `⚠️ Nessun match specifico trovato per ${courier}, uso contratto unico disponibile: ${fallbackContract}`
      );
      return fallbackContract;
    }

    // Se non trovato, log warning con dettagli
    console.warn(`⚠️ Nessun codice contratto trovato per corriere: ${courier}`);
    console.warn(`⚠️ Mapping disponibile:`, contractKeys);
    return undefined;
  }

  /**
   * ===========================================
   * METODO PRIVATO: MAPPATURA DATI OPENAPI
   * ===========================================
   *
   * Mappa i dati interni al formato OpenAPI Spedisci.Online (POST /shipping/create)
   */
  private mapToOpenAPIFormat(
    data: Shipment | CreateShipmentInput | any,
    contractCode?: string
  ): SpedisciOnlineOpenAPIPayload {
    if (!contractCode) {
      throw new Error(
        'Spedisci.Online: Codice contratto mancante. Configura i contratti nel wizard.'
      );
    }

    // Estrai carrierCode dal contractCode (prima parte prima del primo '-')
    const carrierCode = contractCode.split('-')[0];

    // Estrai dati mittente
    const senderName =
      'sender_name' in data
        ? data.sender_name
        : data.mittente?.nome || data.sender?.nome || 'Mittente';
    const senderAddress =
      'sender_address' in data
        ? data.sender_address
        : data.mittente?.indirizzo || data.sender?.indirizzo || '';
    const senderCity =
      'sender_city' in data ? data.sender_city : data.mittente?.citta || data.sender?.citta || '';
    const senderZip =
      'sender_zip' in data ? data.sender_zip : data.mittente?.cap || data.sender?.cap || '';
    const senderProvince =
      'sender_province' in data
        ? data.sender_province
        : data.mittente?.provincia || data.sender?.provincia || '';
    const senderPhone =
      'sender_phone' in data
        ? data.sender_phone
        : data.mittente?.telefono || data.sender?.telefono || '';
    const senderEmail =
      'sender_email' in data ? data.sender_email : data.mittente?.email || data.sender?.email || '';

    // Estrai dati destinatario
    const recipientName =
      'recipient_name' in data
        ? data.recipient_name
        : data.destinatario?.nome || data.recipient?.nome || '';
    const recipientAddress =
      'recipient_address' in data
        ? data.recipient_address
        : data.destinatario?.indirizzo || data.recipient?.indirizzo || '';
    const recipientCity =
      'recipient_city' in data
        ? data.recipient_city
        : data.destinatario?.citta || data.recipient?.citta || '';
    const recipientZip =
      'recipient_zip' in data
        ? data.recipient_zip
        : data.destinatario?.cap || data.recipient?.cap || '';
    const recipientProvince =
      'recipient_province' in data
        ? data.recipient_province
        : data.destinatario?.provincia || data.recipient?.provincia || '';
    const recipientPhone =
      'recipient_phone' in data
        ? data.recipient_phone
        : data.destinatario?.telefono || data.recipient?.telefono || '';
    const recipientEmail =
      'recipient_email' in data
        ? data.recipient_email
        : data.destinatario?.email || data.recipient?.email || '';

    // Estrai dimensioni e peso
    const weight = 'weight' in data ? Number(data.weight) || 1 : Number(data.peso) || 1;
    const length =
      'length' in data ? Number(data.length) || 10 : Number(data.dimensioni?.lunghezza) || 10;
    const width =
      'width' in data ? Number(data.width) || 10 : Number(data.dimensioni?.larghezza) || 10;
    const height =
      'height' in data ? Number(data.height) || 10 : Number(data.dimensioni?.altezza) || 10;

    // Determina COD e Insurance
    let codAmount = 0;
    if ('codValue' in data && data.codValue != null) {
      codAmount = Number(data.codValue) || 0;
    } else if ('contrassegnoAmount' in data && data.contrassegnoAmount != null) {
      codAmount = parseFloat(String(data.contrassegnoAmount)) || 0;
    } else if ('cash_on_delivery_amount' in data && data.cash_on_delivery_amount != null) {
      codAmount = Number(data.cash_on_delivery_amount) || 0;
    } else if ('contrassegno' in data && typeof data.contrassegno === 'number') {
      codAmount = Number(data.contrassegno) || 0;
    }

    const insuranceValue =
      'declared_value' in data && data.declared_value
        ? Number(data.declared_value)
        : 'assicurazione' in data && data.assicurazione && typeof data.assicurazione === 'number'
          ? Number(data.assicurazione)
          : 'insurance' in data && data.insurance && typeof data.insurance === 'number'
            ? Number(data.insurance)
            : 0;

    const notes = 'notes' in data ? data.notes || 'N/A' : data.note || 'N/A';

    return {
      carrierCode: carrierCode,
      contractCode: contractCode,
      packages: [
        {
          length: length,
          width: width,
          height: height,
          weight: weight,
        },
      ],
      shipFrom: {
        name: senderName || 'Mittente',
        street1: senderAddress || 'N/A',
        city: senderCity || 'N/A',
        state: senderProvince ? senderProvince.toUpperCase().slice(0, 2) : 'RM',
        postalCode: senderZip || '00000',
        country: 'IT',
        email: senderEmail || undefined,
        phone: senderPhone || undefined,
      },
      shipTo: {
        name: recipientName || 'Destinatario',
        street1: recipientAddress || 'N/A',
        city: recipientCity || 'N/A',
        state: recipientProvince ? recipientProvince.toUpperCase().slice(0, 2) : 'RM',
        postalCode: recipientZip || '00000',
        country: 'IT',
        email: recipientEmail || undefined,
        phone: recipientPhone || undefined,
      },
      notes: notes,
      insuranceValue: insuranceValue,
      codValue: codAmount,
      // ✨ FIX: Servizi accessori per /shipping/create
      // 🎯 SCOPERTA: I servizi accessori usano ID NUMERICI, non nomi stringa!
      // Dal pannello Spedisci.Online: Exchange=200001, Document Return=200002, etc.
      accessoriServices: (() => {
        // Mappatura nome servizio → ID numerico (dal pannello Spedisci.Online)
        const SERVICE_NAME_TO_ID: Record<string, number> = {
          Exchange: 200001,
          exchange: 200001,
          EXCHANGE: 200001,
          'Document Return': 200002,
          'document return': 200002,
          'DOCUMENT RETURN': 200002,
          'Saturday Service': 200003,
          'saturday service': 200003,
          'SATURDAY SERVICE': 200003,
          Express12: 200004,
          express12: 200004,
          EXPRESS12: 200004,
          'Preavviso Telefonico': 200005,
          'preavviso telefonico': 200005,
          'PREAVVISO TELEFONICO': 200005,
        };

        const services = Array.isArray(data.serviziAccessori)
          ? data.serviziAccessori
          : Array.isArray(data.accessoriServices)
            ? data.accessoriServices
            : [];

        if (services.length === 0) {
          return []; // Nessun servizio richiesto
        }

        // ✨ CONVERSIONE: Nome servizio → ID numerico
        const serviceIds = services
          .map((s: any) => {
            // Se già un numero, usalo direttamente
            if (typeof s === 'number') {
              return s;
            }
            // Se stringa numerica, converti
            if (typeof s === 'string' && /^\d+$/.test(s)) {
              return parseInt(s, 10);
            }
            // Se oggetto con id numerico, estrai
            if (s && typeof s === 'object') {
              if (typeof s.id === 'number') return s.id;
              if (typeof s.value === 'number') return s.value;
              if (typeof s.service_id === 'number') return s.service_id;
              if (typeof s.vector_service_id === 'number') return s.vector_service_id;
              // Se ha un nome, convertilo
              const name = s.name || s.service || s.value || s.code || String(s);
              if (typeof name === 'string' && SERVICE_NAME_TO_ID[name]) {
                return SERVICE_NAME_TO_ID[name];
              }
            }
            // Se è una stringa con nome, convertila
            if (typeof s === 'string') {
              return SERVICE_NAME_TO_ID[s] || null;
            }
            return null;
          })
          .filter((id: any): id is number => id !== null && typeof id === 'number');

        if (serviceIds.length === 0) {
          console.warn(
            '⚠️ [SPEDISCI.ONLINE] Nessun servizio accessorio valido trovato dopo conversione:',
            { original: services }
          );
          return [];
        }

        console.log('📋 [SPEDISCI.ONLINE] Servizi accessori convertiti (nome → ID numerico):', {
          original: services,
          converted: serviceIds,
          format_type: 'number[]',
        });

        // ✨ FORMATO CORRETTO: Array di numeri [200001, 200002, ...]
        return serviceIds;
      })(),
      label_format: 'PDF',
    };
  }

  /**
   * ===========================================
   * METODO PRIVATO: MAPPATURA DATI (LEGACY)
   * ===========================================
   *
   * Mappa i dati interni (Shipment/CreateShipmentInput) al formato legacy Spedisci.Online (per CSV fallback)
   */
  private mapToSpedisciOnlineFormat(
    data: Shipment | CreateShipmentInput | any,
    contractCode?: string
  ): SpedisciOnlineShipmentPayload {
    // Normalizza dati da diverse fonti
    const recipientName =
      'recipient_name' in data
        ? data.recipient_name
        : data.destinatario?.nome || data.recipient?.nome || '';

    const recipientAddress =
      'recipient_address' in data
        ? data.recipient_address
        : data.destinatario?.indirizzo || data.recipient?.indirizzo || '';

    const recipientCity =
      'recipient_city' in data
        ? data.recipient_city
        : data.destinatario?.citta || data.recipient?.citta || '';

    const recipientZip =
      'recipient_zip' in data
        ? data.recipient_zip
        : data.destinatario?.cap || data.recipient?.cap || '';

    const recipientProvince =
      'recipient_province' in data
        ? data.recipient_province
        : data.destinatario?.provincia || data.recipient?.provincia || '';

    const weight = 'weight' in data ? data.weight : data.peso || 0;

    // Determina importo COD leggendo in ordine: codValue -> contrassegnoAmount -> cash_on_delivery_amount -> contrassegno (se numero)
    let codAmount = 0;
    if ('codValue' in data && data.codValue != null) {
      codAmount = Number(data.codValue) || 0;
    } else if ('contrassegnoAmount' in data && data.contrassegnoAmount != null) {
      codAmount = parseFloat(String(data.contrassegnoAmount)) || 0;
    } else if ('cash_on_delivery_amount' in data && data.cash_on_delivery_amount != null) {
      codAmount = Number(data.cash_on_delivery_amount) || 0;
    } else if ('contrassegno' in data && typeof data.contrassegno === 'number') {
      codAmount = Number(data.contrassegno) || 0;
    } else if ('cash_on_delivery' in data && data.cash_on_delivery === true) {
      // Se cash_on_delivery è true ma non c'è importo, usa 0
      codAmount = 0;
    }

    // cashOnDelivery è true se l'importo COD > 0
    const cashOnDelivery = codAmount > 0;

    // codValue: REQUIRED, sempre presente (0 se non attivo, importo se attivo)
    const codValue = cashOnDelivery ? Number(codAmount) : 0;

    // insuranceValue: REQUIRED, sempre presente (0 se non presente)
    const insuranceValue =
      'declared_value' in data && data.declared_value
        ? Number(data.declared_value)
        : 'assicurazione' in data && data.assicurazione && typeof data.assicurazione === 'number'
          ? Number(data.assicurazione)
          : 'insurance' in data && data.insurance && typeof data.insurance === 'number'
            ? Number(data.insurance)
            : 0;

    const notes = 'notes' in data ? data.notes : data.note || '';
    const recipientPhone =
      'recipient_phone' in data
        ? data.recipient_phone
        : data.destinatario?.telefono || data.recipient?.telefono || '';
    const recipientEmail =
      'recipient_email' in data
        ? data.recipient_email
        : data.destinatario?.email || data.recipient?.email || '';
    const senderName =
      'sender_name' in data ? data.sender_name : data.mittente?.nome || data.sender?.nome || '';
    const tracking = 'tracking_number' in data ? data.tracking_number : data.tracking || '';
    const finalPrice = 'final_price' in data ? data.final_price : data.prezzoFinale || 0;

    // Helper per formattare valori (virgola -> punto per decimali)
    const formatValue = (value: any): string => {
      if (value === null || value === undefined || value === '') return '';
      if (typeof value === 'number') return String(value).replace(',', '.');
      if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
        return value.replace(',', '.');
      }
      return String(value);
    };

    return {
      destinatario: recipientName,
      indirizzo: recipientAddress,
      cap: recipientZip,
      localita: recipientCity,
      provincia: recipientProvince.toUpperCase().slice(0, 2),
      country: 'IT',
      peso: formatValue(weight),
      colli: '1', // Default 1 collo
      codValue: codValue, // REQUIRED: number, sempre presente (0 se non attivo)
      insuranceValue: insuranceValue, // REQUIRED: number, sempre presente (0 se non presente)
      // ✨ FIX: Leggi servizi accessori da data (serviziAccessori o accessoriServices)
      accessoriServices: Array.isArray(data.serviziAccessori)
        ? data.serviziAccessori
        : Array.isArray(data.accessoriServices)
          ? data.accessoriServices
          : [], // REQUIRED: array, sempre presente (vuoto se non ci sono servizi aggiuntivi)
      rif_mittente: senderName,
      rif_destinatario: recipientName,
      note: notes,
      telefono: recipientPhone,
      email_destinatario: recipientEmail,
      contenuto: '',
      order_id: tracking,
      totale_ordine: formatValue(finalPrice),
      codice_contratto: contractCode, // Codice contratto completo (es: "gls-NN6-STANDARD-(TR-VE)")
      label_format: 'PDF', // Optional: formato etichetta per /shipping/create
    };
  }

  /**
   * Genera CSV nel formato spedisci.online (solo per fallback)
   */
  private generateCSV(payload: SpedisciOnlineShipmentPayload): string {
    const header =
      'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';

    // Helper per escape CSV
    const escapeCSV = (value: string | undefined): string => {
      if (!value) return '';
      if (value.includes(';') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Mappa codValue a contrassegno per formato CSV legacy
    const contrassegnoValue = payload.codValue > 0 ? String(payload.codValue) : '0';

    const row =
      [
        escapeCSV(payload.destinatario),
        escapeCSV(payload.indirizzo),
        payload.cap,
        escapeCSV(payload.localita),
        payload.provincia,
        payload.country,
        payload.peso,
        payload.colli,
        contrassegnoValue,
        escapeCSV(payload.rif_mittente || ''),
        escapeCSV(payload.rif_destinatario || ''),
        escapeCSV(payload.note || ''),
        payload.telefono || '',
        payload.email_destinatario || '',
        escapeCSV(payload.contenuto || ''),
        escapeCSV(payload.order_id || ''),
        payload.totale_ordine || '',
      ].join(';') + ';';

    return header + '\n' + row;
  }

  /**
   * Estrae tracking number dai dati
   */
  private extractTrackingNumber(data: any): string | null {
    return data.tracking_number || data.tracking || null;
  }

  /**
   * Genera tracking number temporaneo
   */
  private generateTrackingNumber(): string {
    return `SPED${Date.now().toString().slice(-8)}${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;
  }

  /**
   * Recupera l'increment_id da Spedisci.Online usando il tracking number
   *
   * ⚠️ NOTA IMPORTANTE: Secondo openapi.json, l'endpoint `/tracking/{ldv}` restituisce
   * SOLO eventi di tracking (Data, Stato, Luogo), NON l'increment_id.
   * L'increment_id viene restituito SOLO durante la creazione (/shipping/create).
   *
   * Questo metodo prova comunque a recuperare informazioni per verificare se ci sono
   * campi non documentati che potrebbero contenere l'increment_id.
   *
   * @param trackingNumber - Tracking number della spedizione (ldv)
   * @returns Promise<{ success: boolean, incrementId?: number, error?: string }>
   */
  async getIncrementIdByTracking(
    trackingNumber: string
  ): Promise<{ success: boolean; incrementId?: number; error?: string }> {
    if (!trackingNumber) {
      return { success: false, error: 'Tracking number mancante' };
    }

    try {
      // Secondo openapi.json, l'UNICO endpoint per tracking è GET /tracking/{ldv}
      // Ma questo restituisce solo eventi di tracking, non increment_id
      const url = new URL(`tracking/${trackingNumber}`, this.BASE_URL).toString();

      console.log(
        `🔍 [SPEDISCI.ONLINE] Chiamata GET /tracking/{ldv} per verificare spedizione: ${url}`
      );
      console.log(
        `⚠️ [SPEDISCI.ONLINE] NOTA: Secondo openapi.json, questo endpoint NON restituisce increment_id`
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
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

  /**
   * Cancella una spedizione su Spedisci.Online
   *
   * @param trackingNumber - Tracking number della spedizione da cancellare
   * @returns Promise<{ success: boolean, message?: string, error?: string }>
   */
  async cancelShipmentOnPlatform(
    trackingNumber: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!trackingNumber) {
      return { success: false, error: 'Tracking number mancante' };
    }

    // Genera fingerprint per log sicuro
    const crypto = require('crypto');
    const keyFingerprint = this.API_KEY
      ? crypto.createHash('sha256').update(this.API_KEY).digest('hex').substring(0, 8)
      : 'N/A';

    console.log('🗑️ [SPEDISCI.ONLINE] Tentativo cancellazione spedizione:', {
      trackingNumber,
      apiKeyFingerprint: keyFingerprint,
      baseUrl: this.BASE_URL,
    });

    try {
      // ⚠️ FIX: Spedisci.Online usa POST /shipping/delete con increment_id, non DELETE /shipping/{tracking}
      // Prova prima con endpoint POST /shipping/delete (metodo corretto)
      const deleteUrl = new URL('shipping/delete', this.BASE_URL).toString();

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
        const incrementIdResult = await this.getIncrementIdByTracking(trackingNumber);

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
          Authorization: `Bearer ${this.API_KEY}`,
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

  /**
   * ===========================================
   * METODO: GET RATES (Preventivi/Tariffe)
   * ===========================================
   *
   * Ottiene i prezzi disponibili per una spedizione specifica
   * usando l'endpoint POST /shipping/rates
   *
   * @param params - Parametri per il calcolo dei rates
   * @returns Array di tariffe disponibili con prezzi dettagliati
   */
  async getRates(params: {
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
  }): Promise<{
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
      const url = new URL('shipping/rates', this.BASE_URL).toString();

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
          Authorization: `Bearer ${this.API_KEY}`,
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
          console.log(
            '🔍 [SPEDISCI.ONLINE] SERVIZI ACCESSORI RICHIESTI:',
            payload.accessoriServices
          );
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
}
