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
import { toCarrierCodeFromContract, validateSpedisciOnlineClientConfig } from '@ss/domain-couriers';
import { createShipmentImpl, createShipmentJSONImpl } from './spedisci-online.shipment.impl';
import {
  findContractCodeImpl,
  mapToOpenAPIFormatImpl,
  mapToSpedisciOnlineFormatImpl,
  generateCSVImpl,
  extractTrackingNumberImpl,
  generateTrackingNumberImpl,
} from './spedisci-online-mapper.impl';
import {
  cancelShipmentOnPlatformImpl,
  generateUploadEndpointVariationsImpl,
  getIncrementIdByTrackingImpl,
  getRatesImpl,
  getTrackingImpl,
} from './spedisci-online.operations.impl';

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

    const validatedConfig = validateSpedisciOnlineClientConfig({
      apiKey: credentials.api_key,
      baseUrl: credentials.base_url,
    });
    this.API_KEY = validatedConfig.apiKey;
    const normalizedBaseUrl = validatedConfig.baseUrl;

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
    return createShipmentImpl(this, data);
  }

  /**
   * Ottieni tracking eventi
   */
  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    return getTrackingImpl(this, trackingNumber);
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
    return createShipmentJSONImpl(this, payload, apiVersion);
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
    return generateUploadEndpointVariationsImpl(this);
  }

  /**
   * Trova il codice contratto basato sul corriere selezionato
   */
  private findContractCode(data: Shipment | CreateShipmentInput | any): string | undefined {
    return findContractCodeImpl(this, data);
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
    return mapToOpenAPIFormatImpl(this, data, contractCode);
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
    return mapToSpedisciOnlineFormatImpl(this, data, contractCode);
  }

  /**
   * Genera CSV nel formato spedisci.online (solo per fallback)
   */
  private generateCSV(payload: SpedisciOnlineShipmentPayload): string {
    return generateCSVImpl(this, payload);
  }

  /**
   * Estrae tracking number dai dati
   */
  private extractTrackingNumber(data: any): string | null {
    return extractTrackingNumberImpl(this, data);
  }

  /**
   * Genera tracking number temporaneo
   */
  private generateTrackingNumber(): string {
    return generateTrackingNumberImpl(this);
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
    return getIncrementIdByTrackingImpl(this, trackingNumber);
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
    return cancelShipmentOnPlatformImpl(this, trackingNumber);
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
    return getRatesImpl(this, params);
  }
}
