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

// Formato payload CORRETTO da API v2 (OpenAPI Spec)
export interface SpedisciOnlineShipmentPayload {
  carrierCode: string; // es: "brt", "gls", "poste"
  contractCode: string; // es: "brt-Test"
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
    phone?: string | null;
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
    phone?: string | null;
    email?: string;
  };
  notes?: string;
  insuranceValue?: number;
  codValue?: number;
  accessoriServices?: string[];
  label_format?: 'PDF' | 'ZPL';
}

// Formato risposta CORRETTO da API v2 (OpenAPI Spec)
export interface SpedisciOnlineResponse {
  success: boolean;
  shipmentId?: number;
  trackingNumber: string; // NOTA: API usa camelCase, non snake_case
  shipmentCost?: string;
  labelData?: string; // Base64 encoded PDF
  labelZPL?: string; // ZPL format (opzionale)
  packages?: Array<any>;
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
    
    this.API_KEY = credentials.api_key;
    // Normalizza BASE_URL rimuovendo slash finale per evitare doppi slash
    const baseUrl = credentials.base_url || 'https://api.spedisci.online';
    this.BASE_URL = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
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
      
      // 2. Mappatura Dati nel formato Spedisci.Online API v2 (include codice contratto)
      const payload = this.mapToSpedisciOnlineFormat(data, contractCode);
      console.log('📦 [SPEDISCI.ONLINE] Payload preparato (API v2):', {
        carrierCode: payload.carrierCode,
        contractCode: payload.contractCode,
        shipTo_name: payload.shipTo.name,
        shipTo_city: payload.shipTo.city,
        packages_count: payload.packages.length,
        base_url: this.BASE_URL,
      });

      // 2. PRIORITÀ 1: Chiamata API JSON sincrona (LDV istantanea)
      // L'URL verrà costruito correttamente in createShipmentJSON
      try {
        const result = await this.createShipmentJSON(payload);
        console.log('✅ [SPEDISCI.ONLINE] Chiamata API JSON riuscita!', {
          success: result.success,
          trackingNumber: result.trackingNumber,
          shipmentId: result.shipmentId,
          has_label: !!result.labelData,
        });

        if (result.success) {
          return {
            tracking_number: result.trackingNumber,
            label_url: undefined, // API v2 non restituisce URL ma solo Base64
            label_pdf: result.labelData ? Buffer.from(result.labelData, 'base64') : undefined,
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

      // 3. PRIORITÀ 2: Upload CSV (se JSON non disponibile)
      // ⚠️ DEPRECATO: Con API v2 usiamo solo endpoint JSON /shipping/create
      // Upload CSV e fallback CSV locale commentati perché ora abbiamo API reale
      /*
      try {
        const csvContent = this.generateCSV(payload);
        const result = await this.uploadCSV(csvContent);

        if (result.success) {
          return {
            tracking_number: result.trackingNumber || this.generateTrackingNumber(),
            label_url: result.label_url,
            label_pdf: result.labelData ? Buffer.from(result.labelData, 'base64') : undefined,
          };
        }
      } catch (csvError: any) {
        console.warn('Upload CSV fallito:', csvError.message);
        // Continua con fallback
      }
      */

      // 4. FALLBACK: Se arriviamo qui, l'API JSON è fallita
      console.error('❌ [SPEDISCI.ONLINE] API JSON fallita - Nessun fallback disponibile');
      throw new Error('Impossibile creare spedizione: API Spedisci.Online non disponibile o credenziali non valide');
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
   * METODO PRIVATO: CREAZIONE JSON (PRIORITÀ 1)
   * ===========================================
   * 
   * Prova automaticamente diversi endpoint fino a trovare quello corretto
   */
  private async createShipmentJSON(payload: SpedisciOnlineShipmentPayload): Promise<SpedisciOnlineResponse> {
    console.log('📡 [SPEDISCI.ONLINE] Payload keys:', Object.keys(payload));
    console.log('📡 [SPEDISCI.ONLINE] Carrier Code:', payload.carrierCode || 'MANCANTE');
    console.log('📡 [SPEDISCI.ONLINE] Contract Code:', payload.contractCode || 'MANCANTE');
    
    // Genera lista di endpoint da provare in ordine di probabilità
    const endpointsToTry = this.generateEndpointVariations();
    
    let lastError: Error | null = null;
    
    // Prova ogni endpoint fino a trovare uno che funziona
    for (const endpoint of endpointsToTry) {
      const url = `${this.BASE_URL}${endpoint}`;
      console.log(`🔍 [SPEDISCI.ONLINE] Tentativo endpoint: ${url}`);
      
      try {
        console.log('📡 [SPEDISCI.ONLINE] ========================================');
        console.log('📡 [SPEDISCI.ONLINE] CHIAMATA API IN CORSO');
        console.log('📡 [SPEDISCI.ONLINE] ========================================');
        console.log('📡 [SPEDISCI.ONLINE] URL:', url);
        console.log('📡 [SPEDISCI.ONLINE] Method: POST');
        console.log('📡 [SPEDISCI.ONLINE] Headers:', {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.API_KEY.substring(0, 20)}...`,
          'Accept': 'application/json',
        });
        console.log('📡 [SPEDISCI.ONLINE] Payload (JSON):', JSON.stringify(payload, null, 2));

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
        console.log('📡 [SPEDISCI.ONLINE] Headers:', Object.fromEntries(response.headers.entries()));

        // Se la risposta è OK (200-299), abbiamo trovato l'endpoint corretto!
        if (response.ok) {
          const result = await response.json();
          console.log('✅ [SPEDISCI.ONLINE] ========================================');
          console.log('✅ [SPEDISCI.ONLINE] ENDPOINT CORRETTO TROVATO!');
          console.log('✅ [SPEDISCI.ONLINE] ========================================');
          console.log('✅ [SPEDISCI.ONLINE] URL:', url);
          console.log('✅ [SPEDISCI.ONLINE] RISPOSTA COMPLETA (INTERO OGGETTO):');
          console.log(JSON.stringify(result, null, 2));
          console.log('✅ [SPEDISCI.ONLINE] ========================================');
          console.log('✅ [SPEDISCI.ONLINE] Analisi campi (OpenAPI format):');
          console.log('  - result.shipmentId:', result.shipmentId);
          console.log('  - result.trackingNumber:', result.trackingNumber);
          console.log('  - result.shipmentCost:', result.shipmentCost);
          console.log('  - result.labelData:', result.labelData ? `(${result.labelData.length} caratteri Base64)` : 'UNDEFINED');
          console.log('  - result.labelZPL:', result.labelZPL ? '(presente)' : 'undefined');
          console.log('  - result.message:', result.message);
          console.log('  - Tutte le chiavi:', Object.keys(result));
          console.log('✅ [SPEDISCI.ONLINE] ========================================');

          return {
            success: true,
            shipmentId: result.shipmentId,
            trackingNumber: result.trackingNumber || this.generateTrackingNumber(),
            shipmentCost: result.shipmentCost,
            labelData: result.labelData, // Base64 encoded PDF
            labelZPL: result.labelZPL,
            message: result.message || 'LDV creata con successo tramite Spedisci.Online',
          };
        }

        // Se non è OK, salva l'errore e prova il prossimo endpoint
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorBody = null;

        try {
          errorBody = await response.json();
          console.log('📡 [SPEDISCI.ONLINE] Body errore (JSON):', JSON.stringify(errorBody, null, 2));
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch {
          const textError = await response.text();
          console.log('📡 [SPEDISCI.ONLINE] Body errore (Text):', textError);
          errorMessage = textError || errorMessage;
        }

        // Se è un errore diverso da 404, potrebbe essere un problema di autenticazione o payload
        // In questo caso, fermiamo qui e restituiamo l'errore
        if (response.status !== 404) {
          console.error('❌ [SPEDISCI.ONLINE] ========================================');
          console.error('❌ [SPEDISCI.ONLINE] ERRORE API');
          console.error('❌ [SPEDISCI.ONLINE] ========================================');
          console.error(`❌ [SPEDISCI.ONLINE] Status: ${response.status}`);
          console.error(`❌ [SPEDISCI.ONLINE] URL: ${url}`);
          console.error(`❌ [SPEDISCI.ONLINE] Errore: ${errorMessage}`);
          console.error(`❌ [SPEDISCI.ONLINE] Body completo:`, errorBody);
          console.error('❌ [SPEDISCI.ONLINE] ========================================');
          throw new Error(`Spedisci.Online Error (${response.status}): ${errorMessage}`);
        }
        
        // Se è 404, continua con il prossimo endpoint
        console.warn(`⚠️ [SPEDISCI.ONLINE] Endpoint ${url} restituisce 404, provo il prossimo...`);
        lastError = new Error(`Endpoint ${url} non trovato (404)`);
        
      } catch (error: any) {
        // Se non è un errore 404, rilanciamo subito
        if (error.message && !error.message.includes('404') && !error.message.includes('not found')) {
          throw error;
        }
        lastError = error;
        console.warn(`⚠️ [SPEDISCI.ONLINE] Errore su ${url}:`, error.message);
        // Continua con il prossimo endpoint
      }
    }
    
    // Se arriviamo qui, tutti gli endpoint hanno fallito
    console.error('❌ [SPEDISCI.ONLINE] Tutti gli endpoint provati hanno fallito');
    throw lastError || new Error('Spedisci.Online: Nessun endpoint valido trovato');
  }

  /**
   * Genera variazioni di endpoint da provare in ordine di probabilità
   *
   * ⚠️ CORRETTO: Usa /shipping/create (non /shipments) come da OpenAPI spec
   */
  private generateEndpointVariations(): string[] {
    const baseUrl = this.BASE_URL;
    const endpoints: string[] = [];

    // Lista di endpoint da provare in ordine di probabilità
    // ENDPOINT CORRETTO da OpenAPI: /api/v2/shipping/create
    if (baseUrl.includes('/api/v2')) {
      // Se BASE_URL contiene già /api/v2, aggiungi solo /shipping/create
      endpoints.push('/shipping/create');
    } else if (baseUrl.includes('/api')) {
      // Se BASE_URL contiene /api ma non /v2, prova /v2/shipping/create
      endpoints.push('/v2/shipping/create');
    } else {
      // Se BASE_URL è il dominio base, usa percorso completo
      endpoints.push('/api/v2/shipping/create');
    }

    // Rimuovi duplicati mantenendo l'ordine
    return [...new Set(endpoints)];
  }

  /**
   * ===========================================
   * METODO PRIVATO: UPLOAD CSV (DEPRECATO)
   * ===========================================
   *
   * ⚠️ DEPRECATO: Non più necessario con API v2 JSON
   * Commentato per evitare errori di compilazione
   */
  /*
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
            trackingNumber: result.trackingNumber || this.generateTrackingNumber(),
            labelData: result.labelData,
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
    console.error('❌ [SPEDISCI.ONLINE] Tutti gli endpoint upload CSV hanno falliti');
    throw lastError || new Error('Spedisci.Online: Nessun endpoint upload CSV valido trovato');
  }
  */

  /**
   * Genera variazioni di endpoint per upload CSV
   * ⚠️ DEPRECATO: Non più necessario con API v2 JSON
   */
  /*
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
  */

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
   * METODO PRIVATO: MAPPATURA DATI
   * ===========================================
   *
   * Mappa i dati interni (Shipment/CreateShipmentInput) al formato Spedisci.Online API v2
   * Formato corretto da OpenAPI specification
   */
  private mapToSpedisciOnlineFormat(
    data: Shipment | CreateShipmentInput | any,
    contractCode?: string
  ): SpedisciOnlineShipmentPayload {
    // Normalizza dati da diverse fonti
    const recipientName = 'recipient_name' in data
      ? data.recipient_name
      : data.destinatario?.nome || data.recipient?.nome || '';

    const recipientCompany = data.destinatario?.azienda || data.recipient?.azienda || '';

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

    const weight = 'weight' in data ? data.weight : data.peso || 1;
    const cashOnDelivery = 'cash_on_delivery' in data ? data.cash_on_delivery : false;
    const cashOnDeliveryAmount = 'cash_on_delivery_amount' in data ? data.cash_on_delivery_amount : 0;
    const notes = 'notes' in data ? data.notes : data.note || '';
    const recipientPhone = 'recipient_phone' in data ? data.recipient_phone : data.destinatario?.telefono || data.recipient?.telefono || '';
    const recipientEmail = 'recipient_email' in data ? data.recipient_email : data.destinatario?.email || data.recipient?.email || '';
    const senderName = 'sender_name' in data ? data.sender_name : data.mittente?.nome || data.sender?.nome || '';
    const senderCompany = data.mittente?.azienda || data.sender?.azienda || '';
    const senderAddress = data.mittente?.indirizzo || data.sender?.indirizzo || 'Via Sender 1';
    const senderCity = data.mittente?.citta || data.sender?.citta || 'Milano';
    const senderZip = data.mittente?.cap || data.sender?.cap || '20100';
    const senderProvince = data.mittente?.provincia || data.sender?.provincia || 'MI';
    const senderPhone = data.mittente?.telefono || data.sender?.telefono || '';
    const senderEmail = data.mittente?.email || data.sender?.email || '';

    // Estrai codice corriere dal contract code o dai dati
    // Es: "postedeliverybusiness-Solution-and-Shipment" -> "poste"
    // Es: "gls-NN6-STANDARD" -> "gls"
    let carrierCode = data.corriere || data.courier_id || '';
    if (contractCode) {
      // Estrai carrier code dal contract code (prima parte prima del trattino)
      const parts = contractCode.toLowerCase().split('-');
      if (parts.length > 0) {
        const firstPart = parts[0];
        // Mappa carrier names comuni
        if (firstPart.includes('poste')) carrierCode = 'poste';
        else if (firstPart.includes('gls')) carrierCode = 'gls';
        else if (firstPart.includes('brt')) carrierCode = 'brt';
        else if (firstPart.includes('sda')) carrierCode = 'sda';
        else if (firstPart.includes('ups')) carrierCode = 'ups';
        else if (firstPart.includes('dhl')) carrierCode = 'dhl';
        else carrierCode = firstPart;
      }
    }

    // Normalizza carrier code
    carrierCode = carrierCode.toLowerCase().trim();
    if (carrierCode === 'poste italiane' || carrierCode === 'posteitaliane') {
      carrierCode = 'poste';
    } else if (carrierCode === 'bartolini') {
      carrierCode = 'brt';
    }

    // Formato payload corretto da OpenAPI v2
    return {
      carrierCode: carrierCode,
      contractCode: contractCode || '',
      packages: [
        {
          length: 1,
          width: 1,
          height: 1,
          weight: Number(weight) || 1,
        }
      ],
      shipFrom: {
        name: senderName || 'Mittente',
        company: senderCompany || undefined,
        street1: senderAddress,
        street2: '',
        city: senderCity,
        state: senderProvince.toUpperCase().slice(0, 2),
        postalCode: senderZip,
        country: 'IT',
        phone: senderPhone || null,
        email: senderEmail || undefined,
      },
      shipTo: {
        name: recipientName,
        company: recipientCompany || undefined,
        street1: recipientAddress,
        street2: '',
        city: recipientCity,
        state: recipientProvince.toUpperCase().slice(0, 2),
        postalCode: recipientZip,
        country: 'IT',
        phone: recipientPhone || null,
        email: recipientEmail || undefined,
      },
      notes: notes,
      insuranceValue: 0,
      codValue: cashOnDelivery ? Number(cashOnDeliveryAmount) || 0 : 0,
      accessoriServices: [],
      label_format: 'PDF',
    };
  }

  /**
   * Genera CSV nel formato spedisci.online (solo per fallback)
   * ⚠️ DEPRECATO: Non più necessario con API v2 JSON che usa payload strutturato
   */
  /*
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

    const row = [
      escapeCSV(payload.shipTo.name),
      escapeCSV(payload.shipTo.street1),
      payload.shipTo.postalCode,
      escapeCSV(payload.shipTo.city),
      payload.shipTo.state,
      payload.shipTo.country,
      payload.packages[0]?.weight || 1,
      payload.packages.length,
      payload.codValue || '',
      escapeCSV(payload.shipFrom.name || ''),
      escapeCSV(payload.shipTo.name || ''),
      escapeCSV(payload.notes || ''),
      payload.shipTo.phone || '',
      payload.shipTo.email || '',
      escapeCSV(''),
      escapeCSV(''),
      '',
    ].join(';') + ';';

    return header + '\n' + row;
  }
  */

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
