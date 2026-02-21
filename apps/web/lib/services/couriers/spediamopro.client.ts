import {
  BaseCourierClient,
  CourierCreateShipmentRequest,
  CourierCreateShipmentResponse,
  CourierDeleteShipmentRequest,
  CourierClientOptions,
} from './base-courier.interface';

// ============================================
// TIPI API SpediamoPro v1
// ============================================

interface SpediamoProTokenData {
  token: string;
  expiresAt: number; // timestamp ms
}

interface SpediamoProSimulazioneRequest {
  nazioneMittente: string;
  capMittente: string;
  cittaMittente: string;
  provinciaMittente: string;
  nazioneDestinatario: string;
  capDestinatario: string;
  cittaDestinatario: string;
  provinciaDestinatario: string;
  colli: Array<{
    pesoReale: number;
    profondita: number; // length
    larghezza: number; // width
    altezza: number; // height
  }>;
}

interface SpediamoProSimulazioneRate {
  id: number; // ID simulazione, usato per creare la spedizione
  corriere: string; // es. "BRT", "SDA", "UPS"
  tariffCode: string; // es. "BRTEXP", "SDASTD", "UPSSTD"
  tariffa: number; // prezzo totale IVA inclusa
  tariffaBase?: number;
  supplementoCarburante?: number;
  iva?: number;
  ivaEsclusa?: number; // prezzo senza IVA
  dataConsegnaPrevistaIT?: string;
  oreConsegna?: string;
  // Alias per backward compat
  carrier?: string;
  price?: number;
  price_vat?: number;
  delivery_time?: string;
}

interface SpediamoProShipmentData {
  id: number;
  state: number; // 0-12 (vedi SHIPMENT_STATES)
  tracking_number?: string;
  carrier?: string;
  price?: number;
  label_url?: string;
}

interface SpediamoProShipmentUpdateRequest {
  sender_name: string;
  sender_company?: string;
  sender_address: string;
  sender_city: string;
  sender_prov: string;
  sender_cap: string;
  sender_nation: string;
  sender_phone?: string;
  sender_email?: string;
  recipient_name: string;
  recipient_company?: string;
  recipient_address: string;
  recipient_city: string;
  recipient_prov: string;
  recipient_cap: string;
  recipient_nation: string;
  recipient_phone?: string;
  recipient_email?: string;
  insurance_value?: number;
  cod_value?: number;
}

// ============================================
// MAPPING STATI
// ============================================

export const SPEDIAMOPRO_SHIPMENT_STATES: Record<number, string> = {
  0: 'cancelled',
  1: 'inserted',
  2: 'invalid',
  3: 'valid',
  4: 'paid',
  5: 'processed',
  6: 'pickup_requested',
  7: 'shipped',
  8: 'in_transit',
  9: 'out_for_delivery',
  10: 'delivered',
  11: 'exception',
  12: 'at_pickup_point',
};

// Mappa verso gli stati normalizzati del sistema SpedireSicuro
export const SPEDIAMOPRO_TO_NORMALIZED_STATUS: Record<number, string> = {
  0: 'cancelled',
  1: 'pending',
  2: 'error',
  3: 'confirmed',
  4: 'confirmed',
  5: 'processing',
  6: 'pickup_requested',
  7: 'shipped',
  8: 'in_transit',
  9: 'out_for_delivery',
  10: 'delivered',
  11: 'exception',
  12: 'at_destination',
};

// ============================================
// TOKEN MANAGER - gestisce JWT con auto-refresh
// ============================================

class SpediamoProTokenManager {
  private tokenData: SpediamoProTokenData | null = null;
  private refreshPromise: Promise<string> | null = null;
  private authCode: string;
  private baseUrl: string;

  // Buffer di sicurezza: refresh 5 minuti prima della scadenza
  private static readonly EXPIRY_BUFFER_MS = 5 * 60 * 1000;
  // Token dura 1 ora secondo la doc
  private static readonly TOKEN_TTL_MS = 60 * 60 * 1000;

  constructor(authCode: string, baseUrl: string) {
    this.authCode = authCode;
    this.baseUrl = baseUrl;
  }

  /**
   * Ottiene un token valido, facendo login se necessario.
   * Thread-safe: se un refresh e gia in corso, riusa la stessa promise.
   */
  async getToken(): Promise<string> {
    if (this.tokenData && !this.isExpired()) {
      return this.tokenData.token;
    }

    // Evita race condition: se un refresh e gia in corso, aspetta quello
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.login();
    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private isExpired(): boolean {
    if (!this.tokenData) return true;
    return Date.now() >= this.tokenData.expiresAt - SpediamoProTokenManager.EXPIRY_BUFFER_MS;
  }

  private async login(): Promise<string> {
    const url = `${this.baseUrl}/api/v1/auth/login`;

    console.log('[SPEDIAMOPRO] Login per ottenere JWT token...');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authCode: this.authCode }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[SPEDIAMOPRO] Login fallito:', {
        status: response.status,
        error: errorText.substring(0, 200),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('AuthCode SpediamoPro non valido o scaduto. Verifica le credenziali.');
      }
      throw new Error(`SpediamoPro login fallito: HTTP ${response.status}`);
    }

    const data = await response.json();
    // La risposta contiene il token JWT
    const token = data.token || data.access_token || data;

    if (!token || typeof token !== 'string') {
      throw new Error('SpediamoPro login: risposta senza token valido');
    }

    this.tokenData = {
      token,
      expiresAt: Date.now() + SpediamoProTokenManager.TOKEN_TTL_MS,
    };

    console.log('[SPEDIAMOPRO] Login riuscito, token valido per 1h');
    return token;
  }

  /** Invalida il token corrente (utile dopo un 401 per forzare re-login) */
  invalidate(): void {
    this.tokenData = null;
  }
}

// ============================================
// CLIENT SpediamoPro
// ============================================

export class SpediamoProClient extends BaseCourierClient {
  private tokenManager: SpediamoProTokenManager;

  constructor(config: {
    apiKey: string; // authCode di SpediamoPro
    baseUrl: string; // https://core.spediamopro.com (prod) o .it (test)
    contractId?: string;
    carrier?: string;
  }) {
    super(config);
    // apiKey contiene l'authCode di SpediamoPro
    this.tokenManager = new SpediamoProTokenManager(config.apiKey, config.baseUrl);
  }

  /**
   * Crea una spedizione con il flusso a 3 step di SpediamoPro:
   * 1. POST /simulazione → ottiene rates e ID simulazione
   * 2. POST /spedizione/{id} → crea spedizione dalla simulazione
   * 3. PUT /spedizione/{id} → completa con dati mittente/destinatario
   * 4. POST /spedizione/{id}/can_pay → paga e conferma
   * 5. GET /spedizione/{id}/ldv → scarica etichetta
   */
  async createShipping(
    request: CourierCreateShipmentRequest,
    options: CourierClientOptions = {}
  ): Promise<CourierCreateShipmentResponse> {
    const { timeout = 60000 } = options; // timeout piu alto per il flusso multi-step
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // STEP 1: Simulazione (preventivo)
      console.log('[SPEDIAMOPRO] Step 1/5: Simulazione preventivo...');
      const simulazionePayload: SpediamoProSimulazioneRequest = {
        nazioneMittente: request.sender.country || 'IT',
        capMittente: request.sender.postalCode,
        cittaMittente: request.sender.city,
        provinciaMittente: request.sender.province,
        nazioneDestinatario: request.recipient.country || 'IT',
        capDestinatario: request.recipient.postalCode,
        cittaDestinatario: request.recipient.city,
        provinciaDestinatario: request.recipient.province,
        colli: request.packages.map((pkg) => ({
          pesoReale: pkg.weight,
          profondita: pkg.length,
          larghezza: pkg.width,
          altezza: pkg.height,
        })),
      };

      const simResponse = await this.apiCall<any>(
        'POST',
        '/api/v1/simulazione',
        simulazionePayload,
        controller.signal
      );

      // Estrai array rates dalla risposta
      let rates: SpediamoProSimulazioneRate[];
      if (Array.isArray(simResponse)) {
        rates = simResponse;
      } else if (simResponse?.simulazione?.spedizioni) {
        rates = simResponse.simulazione.spedizioni;
      } else {
        rates = [];
      }

      if (!rates || rates.length === 0) {
        throw new Error('SpediamoPro: nessun servizio disponibile per questa tratta');
      }

      // Seleziona il rate corretto in base al carrier/contractId richiesto
      const selectedRate = this.selectRate(rates);
      if (!selectedRate) {
        const availableCarriers = rates
          .map((r) => r.tariffCode || r.corriere || r.carrier)
          .join(', ');
        throw new Error(
          `SpediamoPro: corriere "${this.carrier || this.contractId}" non disponibile. ` +
            `Disponibili: ${availableCarriers}`
        );
      }

      console.log('[SPEDIAMOPRO] Step 1 completato:', {
        simulazioneId: selectedRate.id,
        carrier: selectedRate.tariffCode || selectedRate.corriere || selectedRate.carrier,
        price: selectedRate.ivaEsclusa || selectedRate.tariffa || selectedRate.price,
      });

      // STEP 2: Crea spedizione dalla simulazione
      console.log('[SPEDIAMOPRO] Step 2/5: Creazione spedizione...');
      const shipment = await this.apiCall<SpediamoProShipmentData>(
        'POST',
        `/api/v1/spedizione/${selectedRate.id}`,
        {},
        controller.signal
      );

      if (!shipment || !shipment.id) {
        throw new Error('SpediamoPro: creazione spedizione fallita');
      }

      console.log('[SPEDIAMOPRO] Step 2 completato, shipmentId:', shipment.id);

      // STEP 3: Completa con dati mittente/destinatario
      console.log('[SPEDIAMOPRO] Step 3/5: Aggiornamento dati spedizione...');
      const updatePayload: SpediamoProShipmentUpdateRequest = {
        sender_name: request.sender.name,
        sender_company: request.sender.company,
        sender_address: request.sender.address,
        sender_city: request.sender.city,
        sender_prov: request.sender.province,
        sender_cap: request.sender.postalCode,
        sender_nation: request.sender.country || 'IT',
        sender_phone: request.sender.phone,
        sender_email: request.sender.email || 'noemail@spediresicuro.it',
        recipient_name: request.recipient.name,
        recipient_company: request.recipient.company,
        recipient_address: request.recipient.address,
        recipient_city: request.recipient.city,
        recipient_prov: request.recipient.province,
        recipient_cap: request.recipient.postalCode,
        recipient_nation: request.recipient.country || 'IT',
        recipient_phone: request.recipient.phone,
        recipient_email: request.recipient.email,
        insurance_value: request.insurance || 0,
        cod_value: request.cod || 0,
      };

      const updatedShipment = await this.apiCall<SpediamoProShipmentData>(
        'PUT',
        `/api/v1/spedizione/${shipment.id}`,
        updatePayload,
        controller.signal
      );

      console.log('[SPEDIAMOPRO] Step 3 completato, stato:', updatedShipment?.state);

      // STEP 4: Pagamento
      console.log('[SPEDIAMOPRO] Step 4/5: Pagamento...');
      const payResult = await this.apiCall<{ can_pay: boolean }>(
        'POST',
        `/api/v1/spedizione/${shipment.id}/can_pay`,
        {},
        controller.signal
      );

      if (!payResult?.can_pay) {
        throw new Error(
          'SpediamoPro: credito insufficiente o pagamento rifiutato. Verificare il saldo account.'
        );
      }

      console.log('[SPEDIAMOPRO] Step 4 completato, pagamento confermato');

      // STEP 5: Scarica etichetta
      console.log('[SPEDIAMOPRO] Step 5/5: Download etichetta...');
      let labelData = '';
      try {
        const labelResponse = await this.apiCall<any>(
          'GET',
          `/api/v1/spedizione/${shipment.id}/ldv`,
          undefined,
          controller.signal
        );
        // L'etichetta arriva in base64
        if (typeof labelResponse === 'string') {
          labelData = labelResponse;
        } else if (labelResponse?.data) {
          labelData = labelResponse.data;
        } else if (labelResponse?.label) {
          labelData = labelResponse.label;
        }
      } catch (labelError: any) {
        console.warn('[SPEDIAMOPRO] Etichetta non disponibile immediatamente:', labelError.message);
        // Non blocchiamo la spedizione se l'etichetta non e pronta subito
      }

      // Recupera dati finali della spedizione
      const finalShipment = await this.apiCall<SpediamoProShipmentData>(
        'GET',
        `/api/v1/spedizione/${shipment.id}`,
        undefined,
        controller.signal
      );

      const trackingNumber = finalShipment?.tracking_number || '';
      const cost =
        finalShipment?.price ||
        selectedRate.ivaEsclusa ||
        selectedRate.tariffa ||
        selectedRate.price ||
        0;
      const carrierLabel =
        selectedRate.tariffCode || selectedRate.corriere || selectedRate.carrier || '';

      console.log('[SPEDIAMOPRO] Spedizione completata:', {
        shipmentId: shipment.id,
        trackingNumber,
        cost,
        carrier: carrierLabel,
      });

      return {
        success: true,
        shipmentId: shipment.id.toString(),
        trackingNumber,
        cost: typeof cost === 'string' ? parseFloat(cost) : cost,
        labelData,
        carrier: carrierLabel,
        rawResponse: finalShipment,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('SpediamoPro: timeout durante la creazione della spedizione');
      }

      // Se 401, invalida il token per forzare re-login al prossimo tentativo
      if (error.statusCode === 401) {
        this.tokenManager.invalidate();
      }

      console.error('[SPEDIAMOPRO] Errore creazione spedizione:', {
        message: error.message,
        statusCode: error.statusCode,
      });

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ottiene i preventivi (simulazione) senza creare la spedizione.
   * Usato dal sistema quotes per mostrare i prezzi all'utente.
   */
  async getQuotes(params: {
    senderCap: string;
    senderCity: string;
    senderProv: string;
    senderNation?: string;
    recipientCap: string;
    recipientCity: string;
    recipientProv: string;
    recipientNation?: string;
    parcels: Array<{ weight: number; length: number; width: number; height: number }>;
    insuranceValue?: number;
    codValue?: number;
  }): Promise<SpediamoProSimulazioneRate[]> {
    const payload: SpediamoProSimulazioneRequest = {
      nazioneMittente: params.senderNation || 'IT',
      capMittente: params.senderCap,
      cittaMittente: params.senderCity,
      provinciaMittente: params.senderProv,
      nazioneDestinatario: params.recipientNation || 'IT',
      capDestinatario: params.recipientCap,
      cittaDestinatario: params.recipientCity,
      provinciaDestinatario: params.recipientProv,
      colli: params.parcels.map((p) => ({
        pesoReale: p.weight,
        profondita: p.length,
        larghezza: p.width,
        altezza: p.height,
      })),
    };

    const response = await this.apiCall<any>('POST', '/api/v1/simulazione', payload);

    // L'API ritorna { simulazione: { spedizioni: [...], id, codice, ... } }
    let rates: SpediamoProSimulazioneRate[];
    if (Array.isArray(response)) {
      rates = response;
    } else if (response?.simulazione?.spedizioni) {
      rates = response.simulazione.spedizioni;
    } else if (response?.data && Array.isArray(response.data)) {
      rates = response.data;
    } else {
      console.log(
        '[SPEDIAMOPRO] Risposta simulazione non riconosciuta:',
        JSON.stringify(response).substring(0, 500)
      );
      rates = [];
    }

    return rates;
  }

  /**
   * Ottiene il credito disponibile sull'account SpediamoPro.
   * Usato per validazione e monitoraggio.
   */
  async getCredit(): Promise<{ credit: number }> {
    const result = await this.apiCall<{ credit: number }>('GET', '/api/v1/config/credito');
    return result || { credit: 0 };
  }

  async deleteShipping(request: CourierDeleteShipmentRequest): Promise<void> {
    // SpediamoPro non ha un endpoint di cancellazione documentato
    // La spedizione si puo solo "annullare" se lo stato lo consente
    console.warn(
      '[SPEDIAMOPRO] Delete non supportato direttamente. Spedizione:',
      request.shipmentId
    );
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Tenta login + richiesta credito per validare tutto il flusso
      const credit = await this.getCredit();
      console.log('[SPEDIAMOPRO] Credenziali valide, credito:', credit.credit);
      return true;
    } catch (error: any) {
      console.error('[SPEDIAMOPRO] Validazione credenziali fallita:', error.message);
      return false;
    }
  }

  // ============================================
  // METODI PRIVATI
  // ============================================

  /**
   * Chiamata API generica con gestione token JWT e retry su 401.
   */
  private async apiCall<T>(
    method: string,
    path: string,
    body?: any,
    signal?: AbortSignal
  ): Promise<T> {
    const token = await this.tokenManager.getToken();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      ...(signal && { signal }),
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    let response = await fetch(url, fetchOptions);

    // Retry una volta su 401 (token scaduto)
    if (response.status === 401) {
      console.log('[SPEDIAMOPRO] Token scaduto, re-login...');
      this.tokenManager.invalidate();
      const newToken = await this.tokenManager.getToken();
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, { ...fetchOptions, headers });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMessage = `SpediamoPro API error: HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText.substring(0, 300);
        }
      }

      const error = new Error(errorMessage);
      (error as any).statusCode = response.status;
      throw error;
    }

    // Gestisci risposte vuote (204 No Content, ecc.)
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 204 || !contentType.includes('application/json')) {
      const text = await response.text();
      if (!text) return {} as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    }

    return response.json() as Promise<T>;
  }

  /**
   * Seleziona il rate migliore dalla simulazione in base al carrier/contractId configurato.
   */
  private selectRate(rates: SpediamoProSimulazioneRate[]): SpediamoProSimulazioneRate | null {
    const getCode = (r: SpediamoProSimulazioneRate) =>
      (r.tariffCode || r.corriere || r.carrier || '').toUpperCase();

    // Se abbiamo un contractId specifico (es. "BRTEXP"), cerca match esatto
    if (this.contractId) {
      const exact = rates.find((r) => getCode(r) === this.contractId!.toUpperCase());
      if (exact) return exact;
    }

    // Se abbiamo un carrier generico (es. "BRT"), cerca match parziale
    if (this.carrier) {
      const carrierUpper = this.carrier.toUpperCase();
      const match = rates.find((r) => {
        const code = getCode(r);
        return code === carrierUpper || code.startsWith(carrierUpper);
      });
      if (match) return match;
    }

    // Fallback: ritorna il rate piu economico
    const getPrice = (r: SpediamoProSimulazioneRate) =>
      r.ivaEsclusa || r.tariffa || r.price || 999999;
    return rates.sort((a, b) => getPrice(a) - getPrice(b))[0] || null;
  }
}
