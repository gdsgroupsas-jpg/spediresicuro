/**
 * Courier Adapter Base Interface
 *
 * Interfaccia comune per integrazioni con corrieri
 */

export interface CourierCredentials {
  api_key?: string;
  api_secret?: string;
  customer_code?: string;
  [key: string]: any;
}

export interface TrackingEvent {
  status: string;
  description: string;
  location?: string;
  date: Date;
}

export interface ShippingLabel {
  tracking_number: string;
  label_url?: string;
  label_pdf?: Buffer;
}

export abstract class CourierAdapter {
  protected credentials: CourierCredentials;
  protected courierCode: string;

  constructor(credentials: CourierCredentials, courierCode: string) {
    this.credentials = credentials;
    this.courierCode = courierCode;
  }

  /**
   * Test connessione API corriere
   */
  abstract connect(): Promise<boolean>;

  /**
   * Crea spedizione e ottieni etichetta
   */
  abstract createShipment(data: any): Promise<ShippingLabel>;

  /**
   * Ottieni tracking eventi
   */
  abstract getTracking(trackingNumber: string): Promise<TrackingEvent[]>;

  /**
   * Calcola preventivo (se API lo supporta)
   */
  async calculateQuote?(data: any): Promise<number> {
    throw new Error('calculateQuote not implemented');
  }

  /**
   * Annulla spedizione
   */
  async cancelShipment?(trackingNumber: string): Promise<void> {
    throw new Error('cancelShipment not implemented');
  }
}

/**
 * Mock Courier Adapter (per testing)
 */
export class MockCourierAdapter extends CourierAdapter {
  constructor() {
    super({}, 'mock');
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async createShipment(data: any): Promise<ShippingLabel> {
    const trackingNumber = `MOCK${Date.now()}`;
    return {
      tracking_number: trackingNumber,
      label_url: `https://example.com/label/${trackingNumber}.pdf`,
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    return [
      {
        status: 'in_transit',
        description: 'Pacco in transito',
        location: 'Centro smistamento Milano',
        date: new Date(),
      },
    ];
  }

  async calculateQuote(data: any): Promise<number> {
    return 9.99;
  }
}
