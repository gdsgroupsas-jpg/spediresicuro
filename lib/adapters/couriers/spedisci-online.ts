/**
 * Spedisci.Online Adapter
 * 
 * Adapter per inviare automaticamente le spedizioni a spedisci.online
 * per la creazione automatica delle LDV tramite le loro API.
 * 
 * Formato CSV richiesto da spedisci.online:
 * destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;
 * rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;
 * order_id;totale_ordine;
 */

import { CourierAdapter, CourierCredentials, ShippingLabel } from './base';

export interface SpedisciOnlineCredentials extends CourierCredentials {
  api_key: string;
  api_secret?: string;
  customer_code?: string;
  base_url?: string; // Default: https://api.spedisci.online
}

export interface SpedisciOnlineShipmentData {
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
}

export class SpedisciOnlineAdapter extends CourierAdapter {
  private baseUrl: string;
  private apiKey: string;

  constructor(credentials: SpedisciOnlineCredentials) {
    super(credentials, 'spedisci-online');
    this.apiKey = credentials.api_key;
    this.baseUrl = credentials.base_url || 'https://api.spedisci.online';
  }

  /**
   * Test connessione API spedisci.online
   */
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/auth/test`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
   * Crea spedizione su spedisci.online e ottieni LDV
   * 
   * Metodo 1: Upload CSV (se API supporta)
   * Metodo 2: POST JSON (se API supporta)
   * Metodo 3: Fallback - genera CSV locale per upload manuale
   */
  async createShipment(data: any): Promise<ShippingLabel> {
    try {
      // Normalizza i dati nel formato spedisci.online
      const shipmentData = this.normalizeShipmentData(data);

      // Prova metodo 1: Upload CSV via API
      try {
        const csvContent = this.generateCSV(shipmentData);
        const result = await this.uploadCSV(csvContent);
        
        if (result.success) {
          return {
            tracking_number: result.tracking_number || data.tracking || this.generateTrackingNumber(),
            label_url: result.label_url,
            label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
          };
        }
      } catch (csvError) {
        console.warn('Upload CSV fallito, provo metodo JSON:', csvError);
      }

      // Prova metodo 2: POST JSON (se API supporta)
      try {
        const result = await this.createShipmentJSON(shipmentData);
        
        if (result.success) {
          return {
            tracking_number: result.tracking_number || data.tracking || this.generateTrackingNumber(),
            label_url: result.label_url,
            label_pdf: result.label_pdf ? Buffer.from(result.label_pdf, 'base64') : undefined,
          };
        }
      } catch (jsonError) {
        console.warn('Creazione JSON fallita:', jsonError);
      }

      // Metodo 3: Fallback - genera CSV locale
      // L'utente dovrà caricarlo manualmente su spedisci.online
      const csvContent = this.generateCSV(shipmentData);
      
      return {
        tracking_number: data.tracking || this.generateTrackingNumber(),
        label_url: undefined, // Non disponibile senza upload riuscito
        label_pdf: Buffer.from(csvContent, 'utf-8'), // CSV come fallback
      };
    } catch (error) {
      console.error('Errore creazione spedizione spedisci.online:', error);
      throw new Error(`Errore creazione spedizione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    }
  }

  /**
   * Ottieni tracking eventi (se API supporta)
   */
  async getTracking(trackingNumber: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/tracking/${trackingNumber}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Tracking non disponibile: ${response.statusText}`);
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('Errore tracking spedisci.online:', error);
      return [];
    }
  }

  /**
   * Normalizza i dati spedizione nel formato spedisci.online
   */
  private normalizeShipmentData(data: any): SpedisciOnlineShipmentData {
    // Helper per formattare valori (virgola -> punto per decimali)
    const formatValue = (value: any): string => {
      if (value === null || value === undefined || value === '') return '';
      if (typeof value === 'number') return String(value).replace(',', '.');
      if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
        return value.replace(',', '.');
      }
      return String(value);
    };

    // Helper per escape CSV
    const escapeCSV = (value: string): string => {
      if (!value) return '';
      if (value.includes(';') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    return {
      destinatario: escapeCSV(data.destinatario?.nome || data.recipient_name || ''),
      indirizzo: escapeCSV(data.destinatario?.indirizzo || data.recipient_address || ''),
      cap: data.destinatario?.cap || data.recipient_zip || '',
      localita: escapeCSV(data.destinatario?.citta || data.recipient_city || ''),
      provincia: (data.destinatario?.provincia || data.recipient_province || '').toUpperCase().slice(0, 2),
      country: 'IT',
      peso: formatValue(data.peso || data.weight || 0),
      colli: formatValue(data.colli || 1),
      contrassegno: formatValue(data.contrassegno || ''),
      rif_mittente: escapeCSV(data.rif_mittente || data.mittente?.nome || data.sender_name || ''),
      rif_destinatario: escapeCSV(data.rif_destinatario || data.destinatario?.nome || data.recipient_name || ''),
      note: escapeCSV(data.note || ''),
      telefono: data.destinatario?.telefono || data.recipient_phone || '',
      email_destinatario: data.destinatario?.email || data.recipient_email || '',
      contenuto: escapeCSV(data.contenuto || ''),
      order_id: escapeCSV(data.order_id || data.tracking || ''),
      totale_ordine: formatValue(data.totale_ordine || data.prezzoFinale || ''),
    };
  }

  /**
   * Genera CSV nel formato spedisci.online
   */
  private generateCSV(data: SpedisciOnlineShipmentData): string {
    const header = 'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';
    
    const row = [
      data.destinatario,
      data.indirizzo,
      data.cap,
      data.localita,
      data.provincia,
      data.country,
      data.peso,
      data.colli,
      data.contrassegno || '',
      data.rif_mittente || '',
      data.rif_destinatario || '',
      data.note || '',
      data.telefono || '',
      data.email_destinatario || '',
      data.contenuto || '',
      data.order_id || '',
      data.totale_ordine || '',
    ].join(';') + ';';

    return header + '\n' + row;
  }

  /**
   * Upload CSV a spedisci.online (se API supporta)
   */
  private async uploadCSV(csvContent: string): Promise<any> {
    const formData = new FormData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    formData.append('file', blob, 'spedizione.csv');
    formData.append('format', 'csv');

    const response = await fetch(`${this.baseUrl}/v1/shipments/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload CSV fallito: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Crea spedizione via JSON (se API supporta)
   */
  private async createShipmentJSON(data: SpedisciOnlineShipmentData): Promise<any> {
    const response = await fetch(`${this.baseUrl}/v1/shipments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Creazione spedizione fallita: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Genera tracking number temporaneo
   */
  private generateTrackingNumber(): string {
    return `SPED${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
}

