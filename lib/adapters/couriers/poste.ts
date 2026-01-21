import {
  CourierAdapter,
  CourierCredentials,
  ShippingLabel,
  TrackingEvent,
} from '@/lib/adapters/couriers/base';
import axios from 'axios';

export interface PosteCredentials extends CourierCredentials {
  api_key?: string; // Legacy/Alternative
  client_id: string;
  client_secret: string;
  base_url: string; // e.g. 'https://api.poste.it'
  cost_center_code?: string; // CDC
}

export class PosteAdapter extends CourierAdapter {
  protected credentials: PosteCredentials;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(credentials: PosteCredentials) {
    super(credentials, 'poste');
    this.credentials = credentials;
    // Ensure base_url doesn't have trailing slash for consistency
    this.credentials.base_url = this.credentials.base_url.replace(/\/$/, '');
  }

  /**
   * Authenticates with Poste API using OAuth2 client_credentials flow.
   * Returns a valid Bearer token.
   *
   * FIXED: Strict adherence to manual and sanitization to prevent 401/404 errors.
   */
  private async getAuthToken(): Promise<string> {
    // Return cached token if valid (with 5 min buffer)
    if (this.token && Date.now() < this.tokenExpiry - 300000) {
      return this.token;
    }

    try {
      const authUrl = `${this.credentials.base_url}/user/sessions`;

      const response = await axios.post(
        authUrl,
        {
          clientId: this.credentials.client_id,
          secretId: this.credentials.client_secret, // Note: Manual says 'secretId' in body
          grantType: 'client_credentials',
          scope: 'default', // Using default scope needed for general access
        },
        {
          headers: {
            POSTE_clientID: this.credentials.client_id,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data && response.data.access_token) {
        this.token = response.data.access_token;
        // expires_in is in seconds (usually 3599)
        this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
        return this.token!;
      } else {
        throw new Error('No access_token received');
      }
    } catch (error: any) {
      console.error('Poste Auth Failed:', error.response?.data || error.message);
      throw new Error(
        'Authentication failed: ' + (error.response?.data?.errorDescription || error.message)
      );
    }
  }

  async connect(): Promise<boolean> {
    try {
      await this.getAuthToken();
      return true;
    } catch (e) {
      console.error('Poste API connection failed', e);
      return false;
    }
  }

  /**
   * Normalizza i dati dal formato form al formato API Poste
   */
  private normalizeShipmentData(data: any): any {
    // Estrai mittente (supporta sia formato form che formato standard)
    const mittente = data.mittente || data.sender || {};
    const sender = {
      name: mittente.nome || mittente.name || data.mittenteNome || 'Mittente',
      address: mittente.indirizzo || mittente.address || data.mittenteIndirizzo || 'Via Roma 1',
      zip: mittente.cap || mittente.zip || data.mittenteCap || '00100',
      city: mittente.citta || mittente.city || data.mittenteCitta || 'Roma',
      country: mittente.country || 'IT',
      province: mittente.provincia || mittente.province || data.mittenteProvincia || 'RM',
    };

    // Estrai destinatario (supporta sia formato form che formato standard)
    const destinatario = data.destinatario || {};
    const recipient = {
      name: destinatario.nome || data.destinatarioNome || data.recipient_name || '',
      address: destinatario.indirizzo || data.destinatarioIndirizzo || data.recipient_address || '',
      zip: destinatario.cap || data.destinatarioCap || data.recipient_postal_code || '',
      city: destinatario.citta || data.destinatarioCitta || data.recipient_city || '',
      country: destinatario.country || data.recipient_country || 'IT',
      province:
        destinatario.provincia || data.destinatarioProvincia || data.recipient_province || '',
    };

    // Estrai dimensioni (supporta sia formato form che formato standard)
    const dimensioni = data.dimensioni || data.dimensions || {};
    const dimensions = {
      length: dimensioni.lunghezza || dimensioni.length || data.lunghezza || 0,
      width: dimensioni.larghezza || dimensioni.width || data.larghezza || 0,
      height: dimensioni.altezza || dimensioni.height || data.altezza || 0,
    };

    // Estrai peso e servizio
    const weight = data.peso || data.weight || 0;
    const service = data.tipoSpedizione === 'express' ? 'express' : data.service || 'standard';

    return {
      sender,
      recipient_name: recipient.name,
      recipient_address: recipient.address,
      recipient_postal_code: recipient.zip,
      recipient_city: recipient.city,
      recipient_country: recipient.country,
      recipient_province: recipient.province,
      weight,
      dimensions,
      service,
    };
  }

  /**
   * Mappa il codice servizio al codice prodotto Poste Delivery Business
   * Secondo manuale v1.9:
   * - APT000901: PosteDelivery Business Express
   * - APT000902: PosteDelivery Business Standard
   * - APT000903: PosteDelivery Business Internazionale Express
   * - APT000904: PosteDelivery Business Internazionale Standard
   * - APT001013: PosteDelivery Business International Plus
   */
  private getProductCode(service: string): string {
    const productCodeMap: Record<string, string> = {
      express: 'APT000901', // Express
      standard: 'APT000902', // Standard
      international_express: 'APT000903', // Internazionale Express
      international_standard: 'APT000904', // Internazionale Standard
      international_plus: 'APT001013', // International Plus
      economy: 'APT000902', // Economy mappato a Standard
      international: 'APT000904', // Internazionale mappato a Standard
    };

    return productCodeMap[service] || 'APT000902'; // Default: Standard
  }

  /**
   * Converte codice paese da ISO2/ISO3 a ISO4 (richiesto da Poste)
   * IT -> ITA1, DE -> DEU1, FR -> FRA1, US -> USA1, ecc.
   */
  private convertCountryToISO4(country: string): string {
    const countryMap: Record<string, string> = {
      IT: 'ITA1',
      ITA: 'ITA1',
      DE: 'DEU1',
      DEU: 'DEU1',
      GER: 'DEU1',
      FR: 'FRA1',
      FRA: 'FRA1',
      ES: 'ESP1',
      ESP: 'ESP1',
      GB: 'GBR1',
      GBR: 'GBR1',
      UK: 'GBR1',
      US: 'USA1',
      USA: 'USA1',
      CH: 'CHE1',
      CHE: 'CHE1',
      AT: 'AUT1',
      AUT: 'AUT1',
      BE: 'BEL1',
      BEL: 'BEL1',
      NL: 'NLD1',
      NLD: 'NLD1',
      PT: 'PRT1',
      PRT: 'PRT1',
    };

    const upper = country.toUpperCase();
    return countryMap[upper] || upper.endsWith('1') ? upper : `${upper}1`;
  }

  /**
   * Formatta data in formato UTC richiesto da Poste: YYYY-MM-DDTHH:mm:ss.SSS+0000
   */
  private formatShipmentDate(date?: Date): string {
    const d = date || new Date();
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000+0000`;
  }

  async createShipment(data: any): Promise<ShippingLabel> {
    const token = await this.getAuthToken();

    // Product codes mapping based on service
    let productCode = 'APT000902'; // Standard default
    if (data.service === 'express') productCode = 'APT000901';
    if (data.service === 'international') productCode = 'APT000904';

    const payload = {
      costCenterCode: this.credentials.cost_center_code || 'CDC-DEFAULT',
      shipmentDate: new Date().toISOString(),
      waybills: [
        {
          printFormat: 'A4',
          product: productCode,
          data: {
            sender: {
              nameSurname: data.sender?.name || 'Mittente',
              address: data.sender?.address || 'Via Roma 1',
              zipCode: data.sender?.zip || '00100',
              city: data.sender?.city || 'Roma',
              country: data.sender?.country || 'IT',
              province: data.sender?.province || 'RM',
            },
            receiver: {
              nameSurname: data.recipient_name,
              address: data.recipient_address,
              zipCode: data.recipient_postal_code,
              city: data.recipient_city,
              country: data.recipient_country || 'IT', // Assumed standard
              province: data.recipient_province,
            },
            content: 'Spedizione e-commerce',
            declared: [
              {
                weight: Math.ceil(data.weight * 1000), // g
                length: Math.ceil(data.dimensions.length), // cm
                width: Math.ceil(data.dimensions.width), // cm
                height: Math.ceil(data.dimensions.height), // cm
              },
            ],
          },
        },
      ],
    };

    const response = await axios.post(
      `${this.credentials.base_url}/postalandlogistics/parcel/waybill`,
      payload,
      {
        headers: {
          POSTE_clientID: this.credentials.client_id,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Poste returns a list of waybills
    const waybill = response.data.waybills?.[0];
    if (!waybill) throw new Error('No waybill generated');

    return {
      tracking_number: waybill.code,
      label_url: waybill.downloadURL,
    };
  }

  async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
    const token = await this.getAuthToken();

    try {
      // Endpoint tracking secondo manuale v1.9: /postalandlogistics/parcel/tracking
      // Parametri query: waybillNumber, lastTracingState (S/N), customerType (DQ), statusDescription (E)
      const endpoint = `${this.credentials.base_url}/postalandlogistics/parcel/tracking`;

      const response = await axios.get(endpoint, {
        params: {
          waybillNumber: trackingNumber,
          lastTracingState: 'N', // N = storico completo, S = solo ultimo stato
          customerType: 'DQ',
          statusDescription: 'E',
        },
        headers: {
          POSTE_clientID: this.credentials.client_id,
          Authorization: `Bearer ${token}`,
        },
      });

      // Mappa risposta API secondo formato manuale
      // Response: { return: { outcome, result, shipment: [{ waybillNumber, product, tracking: [...] }] } }
      const responseData = response.data;

      if (!responseData.return || responseData.return.outcome !== 'OK') {
        throw new Error(responseData.return?.result || 'Errore recupero tracking');
      }

      const shipments = responseData.return.shipment || [];
      if (shipments.length === 0) {
        return [
          {
            status: 'NOT_FOUND',
            description: 'Spedizione non trovata',
            date: new Date(),
          },
        ];
      }

      const shipment = shipments[0];
      const trackingEvents = shipment.tracking || [];

      return trackingEvents.map((e: any) => ({
        status: e.status || 'UNKNOWN',
        description: e.statusDescription || e.description || '',
        location: e.officeDescription || e.location || undefined,
        date: e.data ? new Date(e.data.replace(' ', 'T')) : new Date(),
        phase: e.phase || undefined,
      }));
    } catch (error: any) {
      console.error('❌ [POSTE TRACKING] Errore:', error.response?.data || error.message);
      // In caso di errore, restituisci almeno un evento base
      return [
        {
          status: 'ERROR',
          description: error.response?.data?.error || error.message || 'Errore recupero tracking',
          date: new Date(),
        },
      ];
    }
  }
}
