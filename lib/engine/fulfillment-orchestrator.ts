/**
 * Fulfillment Orchestrator
 *
 * Orchestratore intelligente per la creazione di LDV con routing automatico
 * tra adapter diretti (GLS, BRT, etc.) e broker (spedisci.online).
 *
 * Strategia:
 * 1. Prova adapter diretto (massima velocità, margine massimo)
 * 2. Se non disponibile, usa broker (spedisci.online)
 * 3. Se fallisce, genera CSV fallback
 */

import { CourierAdapter, ShippingLabel } from '@/lib/adapters/couriers/base';
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';
import type { Shipment, CreateShipmentInput, CourierServiceType } from '@/types/shipments';
import { calculatePriceWithRules, getApplicablePriceList } from '@/lib/db/price-lists-advanced';
import type { PriceCalculationResult } from '@/types/listini';

export interface ShipmentResult {
  success: boolean;
  tracking_number: string;
  label_url?: string;
  label_pdf?: Buffer;
  carrier: string;
  method: 'direct' | 'broker' | 'fallback';
  error?: string;
  message?: string;
  shipmentId?: string; // ⚠️ CRITICO: shipmentId (increment_id) per cancellazione su Spedisci.Online
  metadata?: {
    [key: string]: any; // Metadati aggiuntivi specifici corriere (es: poste_account_id, waybill_number, ecc.)
  };
}

export interface FulfillmentConfig {
  preferDirect: boolean; // Preferisci adapter diretti se disponibili
  allowBroker: boolean; // Permetti uso broker (spedisci.online)
  allowFallback: boolean; // Genera CSV se tutto fallisce
}

/**
 * Fulfillment Orchestrator
 *
 * Gestisce il routing intelligente per la creazione di LDV
 */
export class FulfillmentOrchestrator {
  private directAdapters: Map<string, CourierAdapter> = new Map();
  private brokerAdapter: SpedisciOnlineAdapter | null = null;
  private config: FulfillmentConfig;

  constructor(config: Partial<FulfillmentConfig> = {}) {
    this.config = {
      preferDirect: config.preferDirect ?? true,
      allowBroker: config.allowBroker ?? true,
      allowFallback: config.allowFallback ?? true,
    };
  }

  /**
   * Registra un adapter diretto per un corriere
   */
  registerDirectAdapter(courierCode: string, adapter: CourierAdapter): void {
    this.directAdapters.set(courierCode.toLowerCase(), adapter);
  }

  /**
   * Registra l'adapter broker (spedisci.online)
   */
  registerBrokerAdapter(adapter: SpedisciOnlineAdapter): void {
    this.brokerAdapter = adapter;
  }

  /**
   * Calcola preventivo usando sistema listini avanzato
   *
   * Recupera listino applicabile e calcola prezzo con regole PriceRule
   *
   * ✨ M3: Aggiunto workspaceId per isolamento multi-tenant
   */
  async calculateQuote(
    userId: string,
    workspaceId: string,
    params: {
      weight: number;
      volume?: number;
      destination: {
        zip?: string;
        province?: string;
        region?: string;
        country?: string;
      };
      courierId?: string;
      serviceType?: CourierServiceType;
      options?: {
        declaredValue?: number;
        cashOnDelivery?: boolean;
        insurance?: boolean;
      };
    },
    priceListId?: string
  ): Promise<PriceCalculationResult | null> {
    try {
      return await calculatePriceWithRules(userId, workspaceId, params, priceListId);
    } catch (error: any) {
      console.error('Errore calcolo preventivo:', error);
      return null;
    }
  }

  /**
   * Crea spedizione con routing intelligente
   *
   * Algoritmo O(1) di Dominio:
   * 1. Se adapter diretto disponibile → usa diretto (massima velocità)
   * 2. Se non disponibile → usa broker (spedisci.online)
   * 3. Se fallisce → genera CSV fallback
   *
   * AGGIORNATO: Calcola anche prezzo usando sistema listini avanzato
   */
  async createShipment(
    shipmentData: Shipment | CreateShipmentInput,
    courierCode: string,
    userId?: string
  ): Promise<ShipmentResult> {
    const normalizedCourier = courierCode.toLowerCase();

    // ===========================================
    // STRATEGIA 1: ADAPTER DIRETTO (Preferito)
    // ===========================================
    // ===========================================
    // STRATEGIA 1: ADAPTER DIRETTO (Preferito)
    // ===========================================
    let directError: string | null = null;

    if (this.config.preferDirect) {
      const directAdapter = this.directAdapters.get(normalizedCourier);

      console.log(`🔍 [ORCHESTRATOR] Cerca adapter diretto con chiave: "${normalizedCourier}"`);
      console.log(`🔍 [ORCHESTRATOR] Chiavi disponibili:`, Array.from(this.directAdapters.keys()));

      if (directAdapter) {
        console.log(
          `✅ [ORCHESTRATOR] Adapter diretto trovato per ${normalizedCourier}, creo spedizione...`
        );
        try {
          const result = await directAdapter.createShipment(shipmentData);
          console.log(`✅ [ORCHESTRATOR] Spedizione creata con successo:`, {
            tracking: result.tracking_number,
            has_label_url: !!result.label_url,
            has_metadata: !!result.metadata,
          });

          return {
            success: true,
            tracking_number: result.tracking_number,
            label_url: result.label_url,
            label_pdf: result.label_pdf,
            carrier: courierCode,
            method: 'direct',
            message: 'LDV creata tramite adapter diretto',
            metadata: result.metadata, // Passa metadati aggiuntivi (es: poste_account_id, waybill_number)
          };
        } catch (error: any) {
          console.error(`❌ [ORCHESTRATOR] Adapter diretto ${courierCode} fallito:`, error);

          // ⚠️ SICUREZZA: 401/403 = Hard fail (no fallback CSV)
          const isAuthError =
            error?.message?.includes('401') ||
            error?.message?.includes('403') ||
            error?.message?.includes('Authentication Failed') ||
            error?.message?.includes('Unauthorized');

          if (isAuthError) {
            console.error(
              '🔐 [SECURITY] Errore autenticazione adapter diretto - HARD FAIL (no fallback)'
            );
            throw new Error(
              `Errore autenticazione corriere ${courierCode}: ${error?.message || 'Credenziali invalide'}\n` +
                `Verifica le credenziali API nella configurazione.`
            );
          }

          directError = error instanceof Error ? error.message : 'Errore sconosciuto';
          // Continua con broker solo se non è errore auth
        }
      } else {
        console.log(`ℹ️ [ORCHESTRATOR] Nessun adapter diretto trovato per "${normalizedCourier}"`);
      }
    }

    // ===========================================
    // STRATEGIA 2: BROKER (spedisci.online)
    // ===========================================
    console.log('🔍 [ORCHESTRATOR] Controllo broker adapter...', {
      allowBroker: this.config.allowBroker,
      hasBrokerAdapter: !!this.brokerAdapter,
    });

    if (this.config.allowBroker && this.brokerAdapter) {
      console.log('✅ [ORCHESTRATOR] Broker adapter disponibile, uso Spedisci.Online');
      console.log(
        '✅ [ORCHESTRATOR] Broker path: Utente ha selezionato corriere "' +
          courierCode +
          '" → Orchestrator usa broker Spedisci.Online (stessa config DB)'
      );
      try {
        // Assicura che il corriere sia presente nei dati per il mapping del codice contratto
        const shipmentDataWithCourier = {
          ...shipmentData,
          corriere: courierCode, // Aggiungi il corriere ai dati
          courier_id: shipmentData.courier_id || courierCode,
        };

        console.log('📦 [ORCHESTRATOR] Chiamo broker adapter con corriere:', courierCode);
        console.log(
          "📦 [ORCHESTRATOR] Broker adapter usa la STESSA configurazione DB caricata all'avvio (configId/providerId/baseUrl visibili nei log precedenti)"
        );
        const result = await this.brokerAdapter.createShipment(shipmentDataWithCourier);

        // ⚠️ CRITICO: Estrai shipmentId dal risultato dell'adapter (può essere nel metadata o direttamente)
        const shipmentId =
          (result as any).shipmentId ||
          result.metadata?.shipmentId ||
          result.metadata?.increment_id;

        console.log('✅ [ORCHESTRATOR] Broker adapter ha restituito:', {
          has_tracking: !!result.tracking_number,
          has_label: !!result.label_pdf,
          has_metadata: !!result.metadata,
          metadata_keys: result.metadata ? Object.keys(result.metadata) : [],
          shipmentId_trovato: shipmentId || 'NON TROVATO',
          shipmentId_source: (result as any).shipmentId
            ? 'direct'
            : result.metadata?.shipmentId
              ? 'metadata.shipmentId'
              : result.metadata?.increment_id
                ? 'metadata.increment_id'
                : 'NON TROVATO',
        });

        return {
          success: true,
          tracking_number: result.tracking_number,
          label_url: result.label_url,
          label_pdf: result.label_pdf,
          carrier: courierCode,
          method: 'broker',
          message: 'LDV creata tramite broker spedisci.online',
          // ⚠️ CRITICO: Passa shipmentId sia direttamente che nel metadata
          shipmentId: shipmentId ? String(shipmentId) : undefined,
          metadata: {
            ...(result.metadata || {}),
            shipmentId: shipmentId ? String(shipmentId) : undefined,
            increment_id: shipmentId ? String(shipmentId) : undefined,
          },
        };
      } catch (error: any) {
        console.error('❌ [ORCHESTRATOR] Broker spedisci.online fallito:', {
          message: error?.message,
          stack: error?.stack,
        });

        // ⚠️ SICUREZZA: 401/403 = Hard fail (no fallback CSV)
        const isAuthError =
          error?.message?.includes('401') ||
          error?.message?.includes('403') ||
          error?.message?.includes('Authentication Failed') ||
          error?.message?.includes('Unauthorized');

        if (isAuthError) {
          console.error('🔐 [SECURITY] Errore autenticazione provider - HARD FAIL (no fallback)');
          throw new Error(
            `Errore autenticazione Spedisci.Online: ${error?.message || 'Credenziali invalide'}\n` +
              `Verifica le credenziali API nella configurazione.`
          );
        }

        // Salva l'errore per passarlo al fallback (solo per errori non-auth)
        directError = error?.message || 'Errore durante la creazione tramite Spedisci.online';
        // Continua con fallback solo se non è errore auth
      }
    } else {
      console.warn('⚠️ [ORCHESTRATOR] Broker adapter NON disponibile:', {
        allowBroker: this.config.allowBroker,
        hasBrokerAdapter: !!this.brokerAdapter,
      });
    }

    // ===========================================
    // STRATEGIA 3: FALLBACK CSV
    // ===========================================
    if (this.config.allowFallback) {
      try {
        // Genera CSV per upload manuale
        const csvContent = this.generateFallbackCSV(shipmentData);
        const trackingNumber = this.generateTrackingNumber(courierCode);

        return {
          success: false,
          tracking_number: trackingNumber,
          label_pdf: Buffer.from(csvContent, 'utf-8'),
          carrier: courierCode,
          method: 'fallback',
          error: directError ? `Errore API: ${directError}` : 'Nessun adapter disponibile',
          message: directError
            ? `Errore API: ${directError}`
            : 'CSV generato per upload manuale. Nessun adapter diretto o broker disponibile.',
        };
      } catch (error) {
        return {
          success: false,
          tracking_number: this.generateTrackingNumber(courierCode),
          carrier: courierCode,
          method: 'fallback',
          error: error instanceof Error ? error.message : 'Errore generazione fallback',
          message: 'Impossibile generare LDV. Verifica configurazione adapter.',
        };
      }
    }

    // Tutte le strategie fallite
    return {
      success: false,
      tracking_number: this.generateTrackingNumber(courierCode),
      carrier: courierCode,
      method: 'fallback',
      error: 'Nessuna strategia disponibile',
      message: 'Impossibile creare LDV. Configura almeno un adapter o broker.',
    };
  }

  /**
   * Genera CSV fallback per upload manuale
   */
  private generateFallbackCSV(data: Shipment | CreateShipmentInput): string {
    // Normalizza dati - entrambi i tipi hanno gli stessi campi
    const recipientName = (data as any).recipient_name || '';
    const recipientAddress = (data as any).recipient_address || '';
    const recipientCity = (data as any).recipient_city || '';
    const recipientZip = (data as any).recipient_zip || '';
    const recipientProvince = (data as any).recipient_province || '';
    const weight = (data as any).weight || 0;
    const cashOnDelivery = (data as any).cash_on_delivery || false;
    const cashOnDeliveryAmount = (data as any).cash_on_delivery_amount || 0;
    const notes = (data as any).notes || '';
    const recipientPhone = (data as any).recipient_phone || '';
    const recipientEmail = (data as any).recipient_email || '';

    // Helper per escape CSV
    const escapeCSV = (value: string): string => {
      if (!value) return '';
      if (value.includes(';') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Helper per formattare valori
    const formatValue = (value: any): string => {
      if (value === null || value === undefined || value === '') return '';
      if (typeof value === 'number') return String(value).replace(',', '.');
      if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
        return value.replace(',', '.');
      }
      return String(value);
    };

    const header =
      'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';

    const row =
      [
        escapeCSV(recipientName),
        escapeCSV(recipientAddress),
        recipientZip,
        escapeCSV(recipientCity),
        recipientProvince.toUpperCase().slice(0, 2),
        'IT',
        formatValue(weight),
        '1',
        formatValue(cashOnDelivery ? cashOnDeliveryAmount : ''),
        escapeCSV(''),
        escapeCSV(recipientName),
        escapeCSV(notes),
        recipientPhone,
        recipientEmail,
        escapeCSV(''),
        '',
        formatValue(''),
      ].join(';') + ';';

    return header + '\n' + row;
  }

  /**
   * Genera tracking number temporaneo
   */
  private generateTrackingNumber(courierCode: string): string {
    const prefix = courierCode.substring(0, 3).toUpperCase();
    return `${prefix}${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
}

/**
 * Singleton instance per uso globale
 */
let orchestratorInstance: FulfillmentOrchestrator | null = null;

export function getFulfillmentOrchestrator(): FulfillmentOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new FulfillmentOrchestrator();
  }
  return orchestratorInstance;
}
