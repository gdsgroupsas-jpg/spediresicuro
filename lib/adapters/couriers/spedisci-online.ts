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

import { CourierAdapter, CourierCredentials, ShippingLabel, TrackingEvent } from './base';
import type { Shipment, CreateShipmentInput } from '@/types/shipments';

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
    
    // HARD FAIL GUARD: Verifica che la key NON sia un token demo/legacy
    const expectedPrefix = 'c6HE'; // Prefix atteso per la key corretta
    const knownInvalidPrefixes = ['8ZZm', 'qCL7', 'demo', 'test', 'example'];
    
    const apiKeyPrefix = credentials.api_key?.substring(0, 4) || '';
    const isInvalidPrefix = knownInvalidPrefixes.some(prefix => 
      apiKeyPrefix.toLowerCase().startsWith(prefix.toLowerCase())
    );
    
    if (isInvalidPrefix) {
      console.error('❌ [SPEDISCI.ONLINE] API Key mismatch - using invalid or legacy token');
      console.error(`❌ [SPEDISCI.ONLINE] Key prefix: "${apiKeyPrefix}" (expected: "${expectedPrefix}")`);
      throw new Error(`Spedisci.Online API key mismatch – using invalid or legacy token. Key starts with "${apiKeyPrefix}" but expected "${expectedPrefix}". Please update the configuration in /dashboard/admin/configurations`);
    }
    
    // Guard aggiuntiva: Verifica che non sia un token demo/example (pattern matching)
    const knownDemoTokens = [
      'qCL7FN2RKFQDngWb6kJ7',
      '8ZZmDdwA',
      'demo',
      'example',
      'test',
    ];
    
    const apiKeyLower = credentials.api_key.toLowerCase();
    const isDemoToken = knownDemoTokens.some(demo => 
      apiKeyLower.includes(demo.toLowerCase()) || 
      credentials.api_key.startsWith(demo)
    );
    
    if (isDemoToken) {
      throw new Error('Spedisci.Online API key not configured correctly (using demo token). Please configure a valid API key in /dashboard/integrazioni');
    }
    
    // Genera fingerprint SHA256 della key per log production-safe
    const crypto = require('crypto');
    const keyFingerprint = credentials.api_key 
      ? crypto.createHash('sha256').update(credentials.api_key).digest('hex').substring(0, 8)
      : 'N/A';
    
    // Log production-safe: sempre (dev + production)
    console.log(`🔑 [SPEDISCI.ONLINE] API Key loaded:`, {
      apiKeyFingerprint: keyFingerprint, // SHA256 primi 8 caratteri (production-safe)
      apiKeyLength: credentials.api_key.length,
      baseUrl: credentials.base_url || 'default',
    });
    
    // TEMP log: solo in dev (NODE_ENV !== production) - primi 4 caratteri
    if (process.env.NODE_ENV !== 'production') {
      const keyPreview = credentials.api_key.length > 4 
        ? `${credentials.api_key.substring(0, 4)}***` 
        : '****';
      const expectedPrefix = 'c6HE';
      console.log(`🔑 [SPEDISCI.ONLINE] TEMP Dev preview (first 4 chars): ${keyPreview}`);
      console.log(`🔑 [SPEDISCI.ONLINE] Expected prefix: ${expectedPrefix}, Match: ${keyPreview.startsWith(expectedPrefix)}`);
    }
    
    this.API_KEY = credentials.api_key;
    // Normalizza BASE_URL: mantieni trailing slash se presente (serve per new URL())
    // Esempio: https://demo1.spedisci.online/api/v2/ -> mantieni slash finale
    const baseUrl = credentials.base_url || 'https://api.spedisci.online/api/v2';
    this.BASE_URL = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.CONTRACT_MAPPING = credentials.contract_mapping || {};
  }

  /**
   * Test connessione API spedisci.online
   */
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.BASE_URL}/v1/auth/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
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
    console.log('🚀 [SPEDISCI.ONLINE] INIZIO CREAZIONE SPEDIZIONE');
    console.log('🚀 [SPEDISCI.ONLINE] ========================================');
    console.log('🚀 [SPEDISCI.ONLINE] BASE_URL:', this.BASE_URL);
    console.log('🚀 [SPEDISCI.ONLINE] API_KEY presente:', !!this.API_KEY);
    console.log('🚀 [SPEDISCI.ONLINE] API_KEY lunghezza:', this.API_KEY?.length || 0);
    console.log('🚀 [SPEDISCI.ONLINE] CONTRACT_MAPPING disponibili:', Object.keys(this.CONTRACT_MAPPING || {}).length);
    console.log('🚀 [SPEDISCI.ONLINE] Contratti configurati:', JSON.stringify(this.CONTRACT_MAPPING, null, 2));

    try {
      // 1. Trova codice contratto basato sul corriere selezionato
      const corriereDaData = data.corriere || data.courier_id || 'NON TROVATO';
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      console.log('🔍 [SPEDISCI.ONLINE] RICERCA CONTRATTO');
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      console.log('🔍 [SPEDISCI.ONLINE] Corriere richiesto:', corriereDaData);
      const contractCode = this.findContractCode(data);
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      console.log('🔍 [SPEDISCI.ONLINE] RISULTATO: Codice contratto trovato:', contractCode || '❌ NESSUNO');
      console.log('🔍 [SPEDISCI.ONLINE] ========================================');
      
      // 2. Mappatura Dati nel formato OpenAPI Spedisci.Online
      const openApiPayload = this.mapToOpenAPIFormat(data, contractCode);
      console.log('📦 [SPEDISCI.ONLINE] Payload OpenAPI preparato:', {
        carrierCode: openApiPayload.carrierCode,
        contractCode: openApiPayload.contractCode,
        base_url: this.BASE_URL,
      });

      // 2. PRIORITÀ 1: Chiamata API OpenAPI (POST /shipping/create)
      try {
        const result = await this.createShipmentJSON(openApiPayload);
        console.log('✅ [SPEDISCI.ONLINE] Chiamata API JSON riuscita!', {
          success: result.success,
          tracking_number: result.tracking_number,
          has_label: !!result.label_pdf,
        });
        
        if (result.success) {
          return {
            tracking_number: result.tracking_number,
            label_url: result.label_url,
            label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
          };
        }
      } catch (jsonError: any) {
        console.error('❌ [SPEDISCI.ONLINE] Creazione JSON fallita:', {
          message: jsonError.message,
          stack: jsonError.stack,
          base_url: this.BASE_URL,
        });
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
      } catch (csvError: any) {
        console.warn('Upload CSV fallito:', csvError.message);
        // Continua con fallback
      }

      // 4. FALLBACK: Genera CSV locale (solo se tutto fallisce) - usa formato legacy
      console.warn('⚠️ [SPEDISCI.ONLINE] TUTTE LE CHIAMATE API FALLITE - Genero CSV locale come fallback');
      const legacyPayload = this.mapToSpedisciOnlineFormat(data, contractCode);
      const csvContent = this.generateCSV(legacyPayload);
      const trackingNumber = this.extractTrackingNumber(data) || this.generateTrackingNumber();
      
      console.warn('⚠️ [SPEDISCI.ONLINE] CSV locale generato. Tracking:', trackingNumber);
      
      return {
        tracking_number: trackingNumber,
        label_url: undefined, // Non disponibile senza upload riuscito
        label_pdf: Buffer.from(csvContent, 'utf-8'), // CSV come fallback
      };
    } catch (error) {
      console.error('Errore creazione spedizione spedisci.online:', error);
      
      // Messaggio di errore più dettagliato
      let errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
      
      // Verifica se è un errore di contratto mancante
      const courier = (data.corriere || data.courier_id || '').toLowerCase().trim();
      if (!this.CONTRACT_MAPPING || Object.keys(this.CONTRACT_MAPPING).length === 0) {
        errorMessage = `Nessun contratto configurato. Configura i contratti nel wizard Spedisci.online.`;
      } else if (courier && !this.findContractCode(data)) {
        errorMessage = `Contratto non trovato per corriere "${courier}". Verifica il mapping contratti nel wizard Spedisci.online. Contratti disponibili: ${Object.keys(this.CONTRACT_MAPPING).join(', ')}`;
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
          'Authorization': `Bearer ${this.API_KEY}`,
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
   */
  private async createShipmentJSON(payload: SpedisciOnlineOpenAPIPayload): Promise<SpedisciOnlineResponse> {
    // Costruisci URL corretto: BASE_URL può avere trailing slash, non duplicare /api/v2
    // Esempio: https://demo1.spedisci.online/api/v2/ -> https://demo1.spedisci.online/api/v2/shipping/create
    // Usa new URL() per gestire correttamente path relativi
    const baseUrlNormalized = this.BASE_URL.endsWith('/') ? this.BASE_URL : `${this.BASE_URL}/`;
    const url = new URL('shipping/create', baseUrlNormalized).toString();
    
    // Log sicuro (NON loggare Authorization)
    console.log('📡 [SPEDISCI.ONLINE] ========================================');
    console.log('📡 [SPEDISCI.ONLINE] CHIAMATA API OPENAPI');
    console.log('📡 [SPEDISCI.ONLINE] ========================================');
    console.log('📡 [SPEDISCI.ONLINE] URL:', url);
    console.log('📡 [SPEDISCI.ONLINE] Method: POST');
    console.log('📡 [SPEDISCI.ONLINE] Status: In corso...');
    console.log('📡 [SPEDISCI.ONLINE] Payload keys:', Object.keys(payload));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📡 [SPEDISCI.ONLINE] ========================================');
      console.log('📡 [SPEDISCI.ONLINE] RISPOSTA API');
      console.log('📡 [SPEDISCI.ONLINE] ========================================');
      console.log('📡 [SPEDISCI.ONLINE] Status:', response.status, response.statusText);
      console.log('📡 [SPEDISCI.ONLINE] OK:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [SPEDISCI.ONLINE] Label creata con successo!');
        console.log('✅ [SPEDISCI.ONLINE] Tracking:', result.trackingNumber || result.tracking_number || 'N/A');
        console.log('✅ [SPEDISCI.ONLINE] Has label:', !!result.labelData || !!result.label_pdf || !!result.label);
        
        // Parsing risposta OpenAPI
        const trackingNumber = result.trackingNumber || result.tracking_number || this.generateTrackingNumber();
        // labelData può essere in diversi formati nella risposta
        const labelData = result.labelData || result.label_pdf || result.label || result.labelPdf; // Base64 encoded
        
        return {
          success: true,
          tracking_number: trackingNumber,
          label_url: result.labelUrl || result.label_url,
          label_pdf: labelData, // Base64 encoded, sarà convertito in Buffer in createShipment
          message: result.message || 'LDV creata con successo',
        };
      }

      // Gestione errore
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorBody = null;

      try {
        errorBody = await response.json();
        errorMessage = errorBody.message || errorBody.error || errorMessage;
      } catch {
        const textError = await response.text();
        errorMessage = textError || errorMessage;
      }

      console.error('❌ [SPEDISCI.ONLINE] ========================================');
      console.error('❌ [SPEDISCI.ONLINE] ERRORE API');
      console.error('❌ [SPEDISCI.ONLINE] ========================================');
      console.error(`❌ [SPEDISCI.ONLINE] Status: ${response.status}`);
      console.error(`❌ [SPEDISCI.ONLINE] URL: ${url}`);
      console.error(`❌ [SPEDISCI.ONLINE] Errore: ${errorMessage}`);
      console.error('❌ [SPEDISCI.ONLINE] ========================================');
      
      throw new Error(`Spedisci.Online Error (${response.status}): ${errorMessage}`);
    } catch (error: any) {
      if (error.message && error.message.includes('Spedisci.Online Error')) {
        throw error;
      }
      console.error('❌ [SPEDISCI.ONLINE] Errore di rete:', error.message);
      throw new Error(`Errore di connessione: ${error.message}`);
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
      const url = `${this.BASE_URL}${endpoint}`;
      console.log(`🔍 [SPEDISCI.ONLINE] Tentativo upload CSV su: ${url}`);
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`,
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
        
        console.warn(`⚠️ [SPEDISCI.ONLINE] Endpoint upload ${url} restituisce 404, provo il prossimo...`);
        lastError = new Error(`Endpoint upload ${url} non trovato (404)`);
        
      } catch (error: any) {
        if (error.message && !error.message.includes('404') && !error.message.includes('not found')) {
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
   */
  private generateUploadEndpointVariations(): string[] {
    const baseUrl = this.BASE_URL;
    const endpoints: string[] = [];
    
    if (baseUrl.includes('/api/v2')) {
      endpoints.push('/api/v2/shipments/upload');
      endpoints.push('/api/v2/v1/shipments/upload');
      endpoints.push('/v1/shipments/upload');
      endpoints.push('/shipments/upload');
      endpoints.push('/api/v1/shipments/upload');
    } else if (baseUrl.includes('/api/v1')) {
      endpoints.push('/api/v1/shipments/upload');
      endpoints.push('/v1/shipments/upload');
      endpoints.push('/shipments/upload');
    } else {
      endpoints.push('/api/v2/shipments/upload');
      endpoints.push('/api/v1/shipments/upload');
      endpoints.push('/v1/shipments/upload');
      endpoints.push('/shipments/upload');
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
    ).toLowerCase().trim();

    if (!courier || !this.CONTRACT_MAPPING || Object.keys(this.CONTRACT_MAPPING).length === 0) {
      console.warn('⚠️ [SPEDISCI.ONLINE] Nessun contratto configurato o corriere mancante');
      return undefined;
    }

    // Normalizza nomi corrieri comuni (generico, non specifico per utente)
    const courierAliases: Record<string, string[]> = {
      'poste': ['poste', 'poste italiane', 'posteitaliane'],
      'gls': ['gls'],
      'brt': ['brt', 'bartolini'],
      'sda': ['sda'],
      'ups': ['ups'],
      'dhl': ['dhl'],
    };

    // Trova il nome base del corriere
    let normalizedCourier = courier;
    for (const [baseName, aliases] of Object.entries(courierAliases)) {
      if (aliases.some(alias => courier.includes(alias) || alias.includes(courier))) {
        normalizedCourier = baseName;
        break;
      }
    }

    console.log(`🔍 [SPEDISCI.ONLINE] Cerca contratto per corriere: "${courier}" (normalizzato: "${normalizedCourier}")`);
    console.log(`🔍 [SPEDISCI.ONLINE] Mapping disponibile:`, Object.keys(this.CONTRACT_MAPPING).map(k => `${k} -> ${this.CONTRACT_MAPPING[k]}`));

    // Cerca un contratto che corrisponde al corriere
    // Il mapping è: codice contratto -> nome corriere (es: "postedeliverybusiness-Solution-and-Shipment" -> "PosteDeliveryBusiness")
    // Ogni utente ha i propri contratti personali nel proprio account Spedisci.online
    
    // STRATEGIA 1: Cerca match esatto nel VALORE (nome corriere nel mapping)
    // Es: "Poste Italiane" -> cerca valore che contiene "poste" o simile
    for (const [contractCode, courierName] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedCourierName = String(courierName).toLowerCase().trim();
      
      // Match esatto
      if (normalizedCourierName === courier || normalizedCourierName === normalizedCourier) {
        console.log(`✅ Codice contratto trovato (match esatto valore) per ${courier}: ${contractCode}`);
        return contractCode;
      }
      
      // Match intelligente: se il corriere normalizzato è "poste" e il valore contiene "poste"
      // Questo funziona per qualsiasi utente che ha un contratto con "poste" nel nome
      if (normalizedCourier === 'poste' && normalizedCourierName.includes('poste')) {
        console.log(`✅ Codice contratto trovato (match Poste generico) per ${courier}: ${contractCode} (valore: ${courierName})`);
        return contractCode;
      }
      
      // Match intelligente generico: se il corriere contiene parte del nome corriere nel mapping
      // Es: "GLS" trova "Gls", "GLS Express", ecc.
      const courierWords = courier.split(/\s+/).filter((w: string) => w.length > 2); // Parole significative
      const courierNameWords = normalizedCourierName.split(/\s+/).filter((w: string) => w.length > 2);
      
      // Se una parola significativa del corriere è nel nome corriere del mapping
      if (courierWords.some((word: string) => normalizedCourierName.includes(word.toLowerCase())) ||
          courierNameWords.some((word: string) => courier.includes(word.toLowerCase()))) {
        console.log(`✅ Codice contratto trovato (match parziale parole) per ${courier}: ${contractCode} (valore: ${courierName})`);
        return contractCode;
      }
    }

    // STRATEGIA 2: Cerca match esatto nella CHIAVE (codice contratto che contiene il nome corriere)
    for (const [contractCode] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedContractCode = contractCode.toLowerCase();
      if (normalizedContractCode === courier || 
          normalizedContractCode === normalizedCourier ||
          normalizedContractCode.startsWith(courier + '-') ||
          normalizedContractCode.startsWith(normalizedCourier + '-')) {
        console.log(`✅ Codice contratto trovato (match chiave) per ${courier}: ${contractCode}`);
        return contractCode;
      }
    }

    // STRATEGIA 3: Cerca match parziale nel codice contratto (es: "sda" in "sda-XXX-YYY")
    for (const [contractCode] of Object.entries(this.CONTRACT_MAPPING)) {
      const normalizedContractCode = contractCode.toLowerCase();
      // Cerca se il codice contratto inizia con il nome del corriere o lo contiene dopo un trattino
      if (normalizedContractCode.includes(courier) || normalizedContractCode.includes(normalizedCourier)) {
        if (normalizedContractCode.startsWith(courier) ||
            normalizedContractCode.startsWith(normalizedCourier) ||
            normalizedContractCode.includes('-' + courier + '-') ||
            normalizedContractCode.includes('-' + normalizedCourier + '-') ||
            normalizedContractCode.endsWith('-' + courier) ||
            normalizedContractCode.endsWith('-' + normalizedCourier)) {
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
      if (normalizedCourierName.includes(courier) || courier.includes(normalizedCourierName.split(' ')[0])) {
        console.log(`✅ Codice contratto trovato (match parziale nome) per ${courier}: ${contractCode}`);
        return contractCode;
      }
      
      // Match per parole chiave comuni: estrai la prima parola significativa
      const courierFirstWord = courier.split(/\s+/)[0].toLowerCase();
      const courierNameFirstWord = normalizedCourierName.split(/\s+/)[0].toLowerCase();
      
      if (courierFirstWord.length > 2 && courierNameFirstWord.length > 2) {
        if (courierFirstWord === courierNameFirstWord || 
            courierFirstWord.includes(courierNameFirstWord) ||
            courierNameFirstWord.includes(courierFirstWord)) {
          console.log(`✅ Codice contratto trovato (match prima parola) per ${courier}: ${contractCode} (valore: ${courierName})`);
          return contractCode;
        }
      }
    }

    // STRATEGIA 5: Se c'è un solo contratto disponibile, usalo come fallback
    // (alcuni contratti sono unici e servono per tutti i corrieri)
    const contractKeys = Object.keys(this.CONTRACT_MAPPING);
    if (contractKeys.length === 1) {
      const fallbackContract = contractKeys[0];
      console.warn(`⚠️ Nessun match specifico trovato per ${courier}, uso contratto unico disponibile: ${fallbackContract}`);
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
      throw new Error('Spedisci.Online: Codice contratto mancante. Configura i contratti nel wizard.');
    }

    // Estrai carrierCode dal contractCode (prima parte prima del primo '-')
    const carrierCode = contractCode.split('-')[0];

    // Estrai dati mittente
    const senderName = 'sender_name' in data ? data.sender_name : data.mittente?.nome || data.sender?.nome || 'Mittente';
    const senderAddress = 'sender_address' in data ? data.sender_address : data.mittente?.indirizzo || data.sender?.indirizzo || '';
    const senderCity = 'sender_city' in data ? data.sender_city : data.mittente?.citta || data.sender?.citta || '';
    const senderZip = 'sender_zip' in data ? data.sender_zip : data.mittente?.cap || data.sender?.cap || '';
    const senderProvince = 'sender_province' in data ? data.sender_province : data.mittente?.provincia || data.sender?.provincia || '';
    const senderPhone = 'sender_phone' in data ? data.sender_phone : data.mittente?.telefono || data.sender?.telefono || '';
    const senderEmail = 'sender_email' in data ? data.sender_email : data.mittente?.email || data.sender?.email || '';

    // Estrai dati destinatario
    const recipientName = 'recipient_name' in data ? data.recipient_name : data.destinatario?.nome || data.recipient?.nome || '';
    const recipientAddress = 'recipient_address' in data ? data.recipient_address : data.destinatario?.indirizzo || data.recipient?.indirizzo || '';
    const recipientCity = 'recipient_city' in data ? data.recipient_city : data.destinatario?.citta || data.recipient?.citta || '';
    const recipientZip = 'recipient_zip' in data ? data.recipient_zip : data.destinatario?.cap || data.recipient?.cap || '';
    const recipientProvince = 'recipient_province' in data ? data.recipient_province : data.destinatario?.provincia || data.recipient?.provincia || '';
    const recipientPhone = 'recipient_phone' in data ? data.recipient_phone : data.destinatario?.telefono || data.recipient?.telefono || '';
    const recipientEmail = 'recipient_email' in data ? data.recipient_email : data.destinatario?.email || data.recipient?.email || '';

    // Estrai dimensioni e peso
    const weight = 'weight' in data ? Number(data.weight) || 1 : Number(data.peso) || 1;
    const length = 'length' in data ? Number(data.length) || 10 : Number(data.dimensioni?.lunghezza) || 10;
    const width = 'width' in data ? Number(data.width) || 10 : Number(data.dimensioni?.larghezza) || 10;
    const height = 'height' in data ? Number(data.height) || 10 : Number(data.dimensioni?.altezza) || 10;

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

    const insuranceValue = 'declared_value' in data && data.declared_value 
      ? Number(data.declared_value) 
      : ('assicurazione' in data && data.assicurazione && typeof data.assicurazione === 'number')
        ? Number(data.assicurazione)
        : ('insurance' in data && data.insurance && typeof data.insurance === 'number')
          ? Number(data.insurance)
          : 0;

    const notes = 'notes' in data ? (data.notes || 'N/A') : (data.note || 'N/A');

    return {
      carrierCode: carrierCode,
      contractCode: contractCode,
      packages: [{
        length: length,
        width: width,
        height: height,
        weight: weight,
      }],
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
      accessoriServices: [],
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
    const recipientName = 'recipient_name' in data 
      ? data.recipient_name 
      : data.destinatario?.nome || data.recipient?.nome || '';
    
    const recipientAddress = 'recipient_address' in data 
      ? data.recipient_address 
      : data.destinatario?.indirizzo || data.recipient?.indirizzo || '';
    
    const recipientCity = 'recipient_city' in data 
      ? data.recipient_city 
      : data.destinatario?.citta || data.recipient?.citta || '';
    
    const recipientZip = 'recipient_zip' in data 
      ? data.recipient_zip 
      : data.destinatario?.cap || data.recipient?.cap || '';
    
    const recipientProvince = 'recipient_province' in data 
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
    const insuranceValue = 'declared_value' in data && data.declared_value 
      ? Number(data.declared_value) 
      : ('assicurazione' in data && data.assicurazione && typeof data.assicurazione === 'number')
        ? Number(data.assicurazione)
        : ('insurance' in data && data.insurance && typeof data.insurance === 'number')
          ? Number(data.insurance)
          : 0;
    
    const notes = 'notes' in data ? data.notes : data.note || '';
    const recipientPhone = 'recipient_phone' in data ? data.recipient_phone : data.destinatario?.telefono || data.recipient?.telefono || '';
    const recipientEmail = 'recipient_email' in data ? data.recipient_email : data.destinatario?.email || data.recipient?.email || '';
    const senderName = 'sender_name' in data ? data.sender_name : data.mittente?.nome || data.sender?.nome || '';
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
      accessoriServices: [], // REQUIRED: array, sempre presente (vuoto se non ci sono servizi aggiuntivi)
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
    const header = 'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';
    
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
    
    const row = [
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
    return `SPED${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
}
