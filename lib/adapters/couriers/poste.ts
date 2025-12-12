import { CourierAdapter, CourierCredentials, ShippingLabel, TrackingEvent } from '@/lib/adapters/couriers/base';
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
                    scope: 'default' // Using default scope needed for general access
                },
                {
                    headers: {
                        'POSTE_clientID': this.credentials.client_id,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.access_token) {
                this.token = response.data.access_token;
                // expires_in is in seconds (usually 3599)
                this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
                return this.token!;
            } else {
                throw new Error('No access_token received');
            }
        } catch (error: any) {
            console.error('Poste Auth Failed:', error.response?.data || error.message);
            throw new Error('Authentication failed: ' + (error.response?.data?.errorDescription || error.message));
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
            province: mittente.provincia || mittente.province || data.mittenteProvincia || 'RM'
        };

        // Estrai destinatario (supporta sia formato form che formato standard)
        const destinatario = data.destinatario || {};
        const recipient = {
            name: destinatario.nome || data.destinatarioNome || data.recipient_name || '',
            address: destinatario.indirizzo || data.destinatarioIndirizzo || data.recipient_address || '',
            zip: destinatario.cap || data.destinatarioCap || data.recipient_postal_code || '',
            city: destinatario.citta || data.destinatarioCitta || data.recipient_city || '',
            country: destinatario.country || data.recipient_country || 'IT',
            province: destinatario.provincia || data.destinatarioProvincia || data.recipient_province || ''
        };

        // Estrai dimensioni (supporta sia formato form che formato standard)
        const dimensioni = data.dimensioni || data.dimensions || {};
        const dimensions = {
            length: dimensioni.lunghezza || dimensioni.length || data.lunghezza || 0,
            width: dimensioni.larghezza || dimensioni.width || data.larghezza || 0,
            height: dimensioni.altezza || dimensioni.height || data.altezza || 0
        };

        // Estrai peso e servizio
        const weight = data.peso || data.weight || 0;
        const service = data.tipoSpedizione === 'express' ? 'express' : 
                       data.service || 'standard';

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
            service
        };
    }

    /**
     * Mappa il codice servizio al codice prodotto Poste Delivery Business
     */
    private getProductCode(service: string): string {
        // Mapping servizi -> codici prodotto Poste
        const productCodeMap: Record<string, string> = {
            'express': 'APT000901',      // Crono Express
            'standard': 'APT000902',      // Standard
            'economy': 'APT000903',       // Economy
            'international': 'APT000904' // Internazionale
        };
        
        return productCodeMap[service] || 'APT000902'; // Default: Standard
    }

    async createShipment(data: any): Promise<ShippingLabel> {
        const token = await this.getAuthToken();

        // Normalizza i dati dal formato form al formato API
        const normalizedData = this.normalizeShipmentData(data);

        // Determina codice prodotto in base al servizio
        const codiceProdotto = this.getProductCode(normalizedData.service);

        // Estrai servizi accessori (contrassegno, assicurazione)
        const serviziAccessori: any = {};
        if (data.cash_on_delivery || data.contrassegno) {
            serviziAccessori.contrassegno = {
                importo: data.cash_on_delivery_amount || data.contrassegno || 0
            };
        }
        if (data.insurance || data.assicurazione) {
            serviziAccessori.assicurazione = {
                valore: data.declared_value || data.assicurazione || 0
            };
        }

        // Costruisci payload secondo specifiche API Poste Delivery Business
        // Struttura: spedizione.mittente, spedizione.destinatario, spedizione.dati_spedizione
        const payload = {
            spedizione: {
                mittente: {
                    nome: normalizedData.sender.name,
                    indirizzo: normalizedData.sender.address,
                    cap: normalizedData.sender.zip,
                    citta: normalizedData.sender.city,
                    provincia: normalizedData.sender.province,
                    paese: normalizedData.sender.country || 'IT',
                    telefono: data.mittenteTelefono || data.sender?.phone || '',
                    email: data.mittenteEmail || data.sender?.email || ''
                },
                destinatario: {
                    nome: normalizedData.recipient_name,
                    indirizzo: normalizedData.recipient_address,
                    cap: normalizedData.recipient_postal_code,
                    citta: normalizedData.recipient_city,
                    provincia: normalizedData.recipient_province,
                    paese: normalizedData.recipient_country || 'IT',
                    telefono: data.destinatarioTelefono || data.recipient_phone || '',
                    email: data.destinatarioEmail || data.recipient_email || ''
                },
                dati_spedizione: {
                    codice_prodotto: codiceProdotto,
                    peso: normalizedData.weight, // Kg
                    colli: data.colli || data.packages_count || 1,
                    contenuto: data.contenuto || data.content || 'Spedizione e-commerce',
                    // Dimensioni (se disponibili)
                    ...(normalizedData.dimensions.length > 0 && {
                        lunghezza: Math.ceil(normalizedData.dimensions.length), // cm
                        larghezza: Math.ceil(normalizedData.dimensions.width), // cm
                        altezza: Math.ceil(normalizedData.dimensions.height) // cm
                    })
                },
                // Servizi accessori (se presenti)
                ...(Object.keys(serviziAccessori).length > 0 && {
                    servizi_accessori: serviziAccessori
                })
            }
        };

        try {
            // Endpoint per creazione waybill (da verificare con credenziali reali)
            // Possibili endpoint: /waybill, /spedizioni, /parcel/waybill
            const endpoint = `${this.credentials.base_url}/waybill`; // Endpoint standard secondo manuale
            
            const response = await axios.post(
                endpoint,
                payload,
                {
                    headers: {
                        'POSTE_clientID': this.credentials.client_id,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    // Gestione retry per errori 5xx
                    validateStatus: (status) => status < 500 || status >= 600
                }
            );

            // Gestione errori 4xx (dati mancanti, indirizzo errato)
            if (response.status >= 400 && response.status < 500) {
                const errorMsg = response.data?.error || response.data?.message || 'Errore validazione dati';
                throw new Error(`Errore API Poste (${response.status}): ${errorMsg}`);
            }

            // Estrai dati risposta
            // La risposta dovrebbe contenere: waybill_number, label_pdf_url (o base64)
            const responseData = response.data;
            
            // Supporta diversi formati di risposta
            const waybillNumber = responseData.waybill_number || 
                                 responseData.waybill?.numero || 
                                 responseData.numero ||
                                 responseData.tracking_number;
            
            const labelUrl = responseData.label_pdf_url || 
                           responseData.label_url ||
                           responseData.etichetta_url ||
                           responseData.downloadURL;

            // Se non c'è URL ma c'è base64, lo gestiamo separatamente
            const labelBase64 = responseData.label_pdf_base64 || 
                               responseData.etichetta_base64;

            if (!waybillNumber) {
                throw new Error('Numero waybill non ricevuto dalla risposta API');
            }

            return {
                tracking_number: waybillNumber,
                label_url: labelUrl || undefined,
                label_pdf: labelBase64 ? Buffer.from(labelBase64, 'base64') : undefined,
                // Metadati aggiuntivi per salvare nel DB
                metadata: {
                    poste_account_id: this.credentials.client_id,
                    poste_product_code: codiceProdotto,
                    waybill_number: waybillNumber,
                    label_pdf_url: labelUrl
                }
            };
        } catch (error: any) {
            // Gestione errori con retry per 5xx
            if (error.response?.status >= 500) {
                console.error('Errore servizio Poste (5xx), implementare retry:', error.response?.data);
                throw new Error('Servizio Poste temporaneamente non disponibile. Riprova più tardi.');
            }
            
            // Rilancia altri errori
            if (error.response?.data) {
                console.error('Errore API Poste:', error.response.data);
                throw new Error(error.response.data.error || error.response.data.message || 'Errore creazione spedizione Poste');
            }
            
            throw error;
        }
    }

    async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
        const token = await this.getAuthToken();

        try {
            // Endpoint tracking secondo specifiche API Poste Delivery Business
            const endpoint = `${this.credentials.base_url}/tracking?waybillNumber=${trackingNumber}`;
            
            const response = await axios.get(
                endpoint,
                {
                    headers: {
                        'POSTE_clientID': this.credentials.client_id,
                        'Authorization': `Bearer ${token}`
                    },
                }
            );

            // Mappa risposta API al formato TrackingEvent
            // La risposta dovrebbe contenere: stato_spedizione, data_evento, descrizione_evento
            const trackingData = response.data;
            
            // Supporta diversi formati di risposta
            const events = Array.isArray(trackingData) 
                ? trackingData 
                : trackingData.eventi || trackingData.events || [trackingData];

            return events.map((e: any) => ({
                status: e.stato_spedizione || e.status || e.stato || 'UNKNOWN',
                description: e.descrizione_evento || e.description || e.descrizione || '',
                location: e.luogo || e.location || e.localita || undefined,
                date: e.data_evento 
                    ? new Date(e.data_evento) 
                    : e.date 
                        ? new Date(e.date) 
                        : new Date(),
                // Campi aggiuntivi per feature Green (se presenti)
                ...(e.tot_emissioni && { tot_emissioni: e.tot_emissioni }),
                ...(e.media_emissioni_spedizione && { media_emissioni: e.media_emissioni_spedizione })
            }));
        } catch (error: any) {
            console.error('Errore tracking Poste:', error.response?.data || error.message);
            // In caso di errore, restituisci almeno un evento base
            return [{
                status: 'ERROR',
                description: error.response?.data?.error || error.message || 'Errore recupero tracking',
                date: new Date()
            }];
        }
    }
}
