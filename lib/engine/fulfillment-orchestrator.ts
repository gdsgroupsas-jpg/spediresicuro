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
import type { Shipment, CreateShipmentInput } from '@/types/shipments';

export interface ShipmentResult {
  success: boolean;
  tracking_number: string;
  label_url?: string;
  label_pdf?: Buffer;
  carrier: string;
  method: 'direct' | 'broker' | 'fallback';
  error?: string;
  message?: string;
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
   * Crea spedizione con routing intelligente
   * 
   * Algoritmo O(1) di Dominio:
   * 1. Se adapter diretto disponibile → usa diretto (massima velocità)
   * 2. Se non disponibile → usa broker (spedisci.online)
   * 3. Se fallisce → genera CSV fallback
   */
  async createShipment(
    shipmentData: Shipment | CreateShipmentInput,
    courierCode: string
  ): Promise<ShipmentResult> {
    const normalizedCourier = courierCode.toLowerCase();

    // ===========================================
    // STRATEGIA 1: ADAPTER DIRETTO (Preferito)
    // ===========================================
    if (this.config.preferDirect) {
      const directAdapter = this.directAdapters.get(normalizedCourier);
      
      if (directAdapter) {
        try {
          const result = await directAdapter.createShipment(shipmentData);
          
          return {
            success: true,
            tracking_number: result.tracking_number,
            label_url: result.label_url,
            label_pdf: result.label_pdf,
            carrier: courierCode,
            method: 'direct',
            message: 'LDV creata tramite adapter diretto',
          };
        } catch (error) {
          console.warn(`Adapter diretto ${courierCode} fallito:`, error);
          // Continua con broker
        }
      }
    }

    // ===========================================
    // STRATEGIA 2: BROKER (spedisci.online)
    // ===========================================
    if (this.config.allowBroker && this.brokerAdapter) {
      try {
        const result = await this.brokerAdapter.createShipment(shipmentData);
        
        return {
          success: true,
          tracking_number: result.tracking_number,
          label_url: result.label_url,
          label_pdf: result.label_pdf,
          carrier: courierCode,
          method: 'broker',
          message: 'LDV creata tramite broker spedisci.online',
        };
      } catch (error) {
        console.warn('Broker spedisci.online fallito:', error);
        // Continua con fallback
      }
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
          error: 'Nessun adapter disponibile',
          message: 'CSV generato per upload manuale. Nessun adapter diretto o broker disponibile.',
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

    const header = 'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';
    
    const row = [
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
