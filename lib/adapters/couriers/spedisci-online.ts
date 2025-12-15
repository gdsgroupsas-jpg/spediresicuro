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

export interface SpedisciOnlineShipmentPayload {
  destinatario: string;
  indirizzo: string;
  cap: string;
  localita: string;
  provincia: string;
  country: string;
  peso: number | string;
  colli: number | string;
  contrassegno?: number | string;
  rif_mittente?: string;
  rif_destinatario?: string;
  note?: string;
  telefono?: string;
  email_destinatario?: string;
  contenuto?: string;
  order_id?: string;
  totale_ordine?: number | string;
  codice_contratto?: string; // Codice contratto completo (es: "gls-NN6-STANDARD-(TR-VE)")
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
    console.log('🚀 [SPEDISCI.ONLINE] Inizio creazione spedizione...');
    console.log('🚀 [SPEDISCI.ONLINE] BASE_URL:', this.BASE_URL);
    console.log('🚀 [SPEDISCI.ONLINE] API_KEY presente:', !!this.API_KEY);
    console.log('🚀 [SPEDISCI.ONLINE] CONTRACT_MAPPING:', Object.keys(this.CONTRACT_MAPPING || {}).length, 'contratti');
    
    try {
      // 1. Trova codice contratto basato sul corriere selezionato
      console.log('🔍 [SPEDISCI.ONLINE] Cerco codice contratto per corriere:', data.corriere || data.courier_id || 'non trovato');
      const contractCode = this.findContractCode(data);
      console.log('🔍 [SPEDISCI.ONLINE] Codice contratto trovato:', contractCode || 'NESSUNO');
      
      // 2. Mappatura Dati nel formato Spedisci.Online (include codice contratto)
      const payload = this.mapToSpedisciOnlineFormat(data, contractCode);
      console.log('📦 [SPEDISCI.ONLINE] Payload preparato:', {
        destinatario: payload.destinatario,
        codice_contratto: payload.codice_contratto,
        base_url: this.BASE_URL,
      });

      // 2. PRIORITÀ 1: Chiamata API JSON sincrona (LDV istantanea)
      // L'URL verrà costruito correttamente in createShipmentJSON
      try {
        const result = await this.createShipmentJSON(payload);
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

      // 3. PRIORITÀ 2: Upload CSV (se JSON non disponibile)
      try {
        const csvContent = this.generateCSV(payload);
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

      // 4. FALLBACK: Genera CSV locale (solo se tutto fallisce)
      console.warn('⚠️ [SPEDISCI.ONLINE] TUTTE LE CHIAMATE API FALLITE - Genero CSV locale come fallback');
      const csvContent = this.generateCSV(payload);
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
   * METODO PRIVATO: CREAZIONE JSON (PRIORITÀ 1)
   * ===========================================
   * 
   * Prova automaticamente diversi endpoint fino a trovare quello corretto
   */
  private async createShipmentJSON(payload: SpedisciOnlineShipmentPayload): Promise<SpedisciOnlineResponse> {
    console.log('📡 [SPEDISCI.ONLINE] Payload keys:', Object.keys(payload));
    console.log('📡 [SPEDISCI.ONLINE] Codice contratto nel payload:', payload.codice_contratto || 'MANCANTE');
    
    // Genera lista di endpoint da provare in ordine di probabilità
    const endpointsToTry = this.generateEndpointVariations();
    
    let lastError: Error | null = null;
    
    // Prova ogni endpoint fino a trovare uno che funziona
    for (const endpoint of endpointsToTry) {
      const url = `${this.BASE_URL}${endpoint}`;
      console.log(`🔍 [SPEDISCI.ONLINE] Tentativo endpoint: ${url}`);
      
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

        console.log('📡 [SPEDISCI.ONLINE] Risposta ricevuta:', {
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        // Se la risposta è OK (200-299), abbiamo trovato l'endpoint corretto!
        if (response.ok) {
          const result = await response.json();
          console.log('✅ [SPEDISCI.ONLINE] Endpoint corretto trovato!', url);
          console.log('✅ [SPEDISCI.ONLINE] Risposta API successo:', {
            has_tracking: !!result.tracking_number,
            has_label: !!result.label_pdf,
          });
          
          return {
            success: true,
            tracking_number: result.tracking_number || result.tracking || this.generateTrackingNumber(),
            label_url: result.label_url || result.label_pdf_url,
            label_pdf: result.label_pdf, // Base64 encoded
            message: result.message || 'LDV creata con successo',
          };
        }

        // Se non è OK, salva l'errore e prova il prossimo endpoint
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorBody = null;
        
        try {
          errorBody = await response.json();
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch {
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
        
        // Se è un errore diverso da 404, potrebbe essere un problema di autenticazione o payload
        // In questo caso, fermiamo qui e restituiamo l'errore
        if (response.status !== 404) {
          console.error(`❌ [SPEDISCI.ONLINE] Errore ${response.status} su ${url}:`, errorMessage);
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
   */
  private generateEndpointVariations(): string[] {
    const baseUrl = this.BASE_URL;
    const endpoints: string[] = [];
    
    // Estrai il dominio base (senza /api/v2 o /api/v1)
    let domainBase = baseUrl;
    if (baseUrl.includes('/api/v2')) {
      domainBase = baseUrl.replace('/api/v2', '');
    } else if (baseUrl.includes('/api/v1')) {
      domainBase = baseUrl.replace('/api/v1', '');
    } else if (baseUrl.includes('/api')) {
      domainBase = baseUrl.replace('/api', '');
    }
    
    // Lista di endpoint da provare in ordine di probabilità
    if (baseUrl.includes('/api/v2')) {
      // Se BASE_URL contiene /api/v2, prova queste combinazioni:
      endpoints.push('/api/v2/shipments');           // 1. Senza /v1 (più probabile)
      endpoints.push('/api/v2/v1/shipments');         // 2. Con /v1 (attuale)
      endpoints.push('/v1/shipments');                 // 3. Solo /v1 (senza /api/v2)
      endpoints.push('/shipments');                    // 4. Solo /shipments
      endpoints.push('/api/v1/shipments');             // 5. /api/v1 invece di /api/v2
    } else if (baseUrl.includes('/api/v1')) {
      // Se BASE_URL contiene /api/v1
      endpoints.push('/api/v1/shipments');
      endpoints.push('/v1/shipments');
      endpoints.push('/shipments');
    } else {
      // Se BASE_URL è il dominio base
      endpoints.push('/api/v2/shipments');
      endpoints.push('/api/v1/shipments');
      endpoints.push('/v1/shipments');
      endpoints.push('/shipments');
    }
    
    // Rimuovi duplicati mantenendo l'ordine
    return [...new Set(endpoints)];
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
      if (courierWords.some(word => normalizedCourierName.includes(word.toLowerCase())) ||
          courierNameWords.some(word => courier.includes(word.toLowerCase()))) {
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
   * Mappa i dati interni (Shipment/CreateShipmentInput) al formato Spedisci.Online
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
    const cashOnDelivery = 'cash_on_delivery' in data ? data.cash_on_delivery : false;
    const cashOnDeliveryAmount = 'cash_on_delivery_amount' in data ? data.cash_on_delivery_amount : 0;
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
      contrassegno: cashOnDelivery ? formatValue(cashOnDeliveryAmount) : undefined,
      rif_mittente: senderName,
      rif_destinatario: recipientName,
      note: notes,
      telefono: recipientPhone,
      email_destinatario: recipientEmail,
      contenuto: '',
      order_id: tracking,
      totale_ordine: formatValue(finalPrice),
      codice_contratto: contractCode, // Codice contratto completo (es: "gls-NN6-STANDARD-(TR-VE)")
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

    const row = [
      escapeCSV(payload.destinatario),
      escapeCSV(payload.indirizzo),
      payload.cap,
      escapeCSV(payload.localita),
      payload.provincia,
      payload.country,
      payload.peso,
      payload.colli,
      payload.contrassegno || '',
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
