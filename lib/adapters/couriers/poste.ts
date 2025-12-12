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
            // Prova prima /user/sessions, poi /oauth/token come fallback
            // Alcune implementazioni Poste usano endpoint diversi
            const possibleEndpoints = [
                `${this.credentials.base_url}/user/sessions`,
                `${this.credentials.base_url}/oauth/token`,
                `${this.credentials.base_url}/auth/token`
            ];
            
            let lastError: any = null;
            
            const authPayload = {
                clientId: this.credentials.client_id,
                secretId: this.credentials.client_secret,
                grantType: 'client_credentials',
                scope: 'https://postemarketplace.onmicrosoft.com/d6a78063-5570-487-bbd7-07326e6855d1/.default' // Scope corretto secondo manuale v1.9
            };
            
            const authHeaders = {
                'POSTE_clientID': this.credentials.client_id, // Header richiesto dal manuale
                'Content-Type': 'application/json'
            };

            // Log dettagliato per debug (senza esporre valori completi)
            console.log('🔑 [POSTE AUTH] Configurazione autenticazione:', {
                endpoint: `${this.credentials.base_url}/user/sessions`,
                client_id_preview: this.credentials.client_id ? `${this.credentials.client_id.substring(0, 20)}...` : 'MANCANTE',
                client_id_length: this.credentials.client_id?.length || 0,
                secret_preview: this.credentials.client_secret ? `${this.credentials.client_secret.substring(0, 20)}...` : 'MANCANTE',
                secret_length: this.credentials.client_secret?.length || 0,
                scope: authPayload.scope,
                cdc: this.credentials.cost_center_code || 'NON CONFIGURATO'
            });

            for (const authUrl of possibleEndpoints) {
                try {
                    console.log('🔑 [POSTE AUTH] Tentativo endpoint:', authUrl);

                    const response = await axios.post(
                        authUrl,
                        authPayload,
                        {
                            headers: authHeaders
                        }
                    );

                    console.log('🔑 [POSTE AUTH] Risposta ricevuta:', {
                        url: authUrl,
                        status: response.status,
                        statusText: response.statusText,
                        has_data: !!response.data,
                        data_keys: response.data ? Object.keys(response.data) : [],
                        has_access_token: !!response.data?.access_token,
                        response_data: response.data
                    });

                    if (response.data && response.data.access_token) {
                        this.token = response.data.access_token;
                        // expires_in is in seconds (usually 3599)
                        this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
                        console.log('✅ [POSTE AUTH] Token ottenuto con successo da:', authUrl);
                        console.log('✅ [POSTE AUTH] expires_in:', response.data.expires_in);
                        return this.token!;
                    } else {
                        console.warn('⚠️ [POSTE AUTH] No access_token nella risposta da:', authUrl);
                        lastError = new Error('No access_token received');
                        continue; // Prova il prossimo endpoint
                    }
                } catch (error: any) {
                    console.warn(`⚠️ [POSTE AUTH] Errore con endpoint ${authUrl}:`, {
                        message: error.message,
                        status: error.response?.status,
                        statusText: error.response?.statusText
                    });
                    lastError = error;
                    continue; // Prova il prossimo endpoint
                }
            }
            
            // Se tutti gli endpoint hanno fallito, lancia l'ultimo errore
            console.error('❌ [POSTE AUTH] Tutti gli endpoint hanno fallito');
            
            // Se l'errore principale è AADSTS700016, fornisci istruzioni chiare
            const firstError = lastError?.response?.data;
            if (firstError?.error === 'unauthorized_client' || 
                firstError?.error_description?.includes('AADSTS700016')) {
                const clientIdPreview = this.credentials.client_id 
                    ? `${this.credentials.client_id.substring(0, 30)}...` 
                    : 'MANCANTE';
                throw new Error(
                    `Client ID non valido o applicazione non registrata nel tenant Azure AD di Poste Italiane.\n` +
                    `Client ID usato: ${clientIdPreview}\n` +
                    `Errore: ${firstError.error_description?.substring(0, 150) || 'Application not found in directory'}\n\n` +
                    `SOLUZIONE:\n` +
                    `1. Vai su /dashboard/integrazioni\n` +
                    `2. Verifica che Client ID e Secret ID siano corretti\n` +
                    `3. Se necessario, ricrea la configurazione con le credenziali dal portale Poste\n` +
                    `4. Assicurati che l'applicazione sia registrata nel tenant "Poste Italiane S.p.A."`
                );
            }
            
            throw lastError || new Error('Authentication failed: All endpoints failed');
        } catch (error: any) {
            const errorData = error.response?.data || {};
            const errorCode = errorData.error;
            const errorDescription = errorData.error_description || errorData.errorDescription || '';
            
            // Analizza errori specifici Azure AD
            let userFriendlyMessage = 'Authentication failed';
            
            if (errorCode === 'unauthorized_client' || errorDescription.includes('AADSTS700016')) {
                userFriendlyMessage = 'Client ID non valido o applicazione non registrata nel tenant Poste Italiane. Verifica le credenziali in /dashboard/integrazioni';
            } else if (errorCode === 'invalid_client' || errorDescription.includes('AADSTS7000215')) {
                userFriendlyMessage = 'Client Secret non valido. Verifica le credenziali in /dashboard/integrazioni';
            } else if (errorDescription.includes('wrong tenant')) {
                userFriendlyMessage = 'Credenziali configurate per un tenant diverso. Verifica Client ID e Secret ID';
            }
            
            console.error('❌ [POSTE AUTH] Errore autenticazione:', {
                error_code: errorCode,
                error_description: errorDescription.substring(0, 200), // Primi 200 caratteri
                status: error.response?.status,
                statusText: error.response?.statusText,
                user_friendly_message: userFriendlyMessage
            });
            
            throw new Error(`Authentication failed: ${userFriendlyMessage}. Dettagli: ${errorCode || error.message}`);
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
     * Secondo manuale v1.9:
     * - APT000901: PosteDelivery Business Express
     * - APT000902: PosteDelivery Business Standard
     * - APT000903: PosteDelivery Business Internazionale Express
     * - APT000904: PosteDelivery Business Internazionale Standard
     * - APT001013: PosteDelivery Business International Plus
     */
    private getProductCode(service: string): string {
        const productCodeMap: Record<string, string> = {
            'express': 'APT000901',      // Express
            'standard': 'APT000902',      // Standard
            'international_express': 'APT000903', // Internazionale Express
            'international_standard': 'APT000904', // Internazionale Standard
            'international_plus': 'APT001013', // International Plus
            'economy': 'APT000902',      // Economy mappato a Standard
            'international': 'APT000904'  // Internazionale mappato a Standard
        };
        
        return productCodeMap[service] || 'APT000902'; // Default: Standard
    }

    /**
     * Converte codice paese da ISO2/ISO3 a ISO4 (richiesto da Poste)
     * IT -> ITA1, DE -> DEU1, FR -> FRA1, US -> USA1, ecc.
     */
    private convertCountryToISO4(country: string): string {
        const countryMap: Record<string, string> = {
            'IT': 'ITA1', 'ITA': 'ITA1',
            'DE': 'DEU1', 'DEU': 'DEU1', 'GER': 'DEU1',
            'FR': 'FRA1', 'FRA': 'FRA1',
            'ES': 'ESP1', 'ESP': 'ESP1',
            'GB': 'GBR1', 'GBR': 'GBR1', 'UK': 'GBR1',
            'US': 'USA1', 'USA': 'USA1',
            'CH': 'CHE1', 'CHE': 'CHE1',
            'AT': 'AUT1', 'AUT': 'AUT1',
            'BE': 'BEL1', 'BEL': 'BEL1',
            'NL': 'NLD1', 'NLD': 'NLD1',
            'PT': 'PRT1', 'PRT': 'PRT1'
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

        // Normalizza i dati dal formato form al formato API
        const normalizedData = this.normalizeShipmentData(data);

        // Determina codice prodotto in base al servizio
        const codiceProdotto = this.getProductCode(normalizedData.service);

        // Estrai CDC (Cost Center Code) - formato: CDC-00038791-0 o CDC-00038791
        const cdc = this.credentials.cost_center_code || 'CDC-DEFAULT';
        // Rimuovi eventuale suffisso -0 se presente (il manuale mostra CDC-000xxxxx)
        const cleanCdc = cdc.replace(/-0$/, '');

        // Estrai servizi accessori secondo formato manuale
        // Contrassegno: APT000918 con { amount, paymentMode: "CON" }
        const services: any = {};
        if (data.cash_on_delivery || data.contrassegno) {
            const amount = Math.round((data.cash_on_delivery_amount || data.contrassegno || 0) * 100); // Converti in centesimi
            services['APT000918'] = {
                amount: String(amount),
                paymentMode: 'CON'
            };
        }

        // Peso in grammi (intero) - il manuale richiede grammi, non kg
        const weightGrams = Math.round((normalizedData.weight || 0) * 1000);

        // Dimensioni in cm (interi)
        const dimensions = normalizedData.dimensions || {};
        const length = Math.ceil(dimensions.length || 0);
        const width = Math.ceil(dimensions.width || 0);
        const height = Math.ceil(dimensions.height || 0);

        // Estrai numero civico da indirizzo (se presente)
        const extractStreetNumber = (address: string): { street: string; number: string } => {
            // Cerca pattern tipo "Via Roma 123" o "Via Roma, 123"
            const match = address.match(/(.+?)\s*,?\s*(\d+)\s*$/);
            if (match) {
                return { street: match[1].trim(), number: match[2] };
            }
            // Se non trova, prova a estrarre dall'inizio
            const match2 = address.match(/^(\d+)\s+(.+)$/);
            if (match2) {
                return { street: match2[2].trim(), number: match2[1] };
            }
            return { street: address, number: '1' }; // Default
        };

        const senderAddress = extractStreetNumber(normalizedData.sender.address);
        const receiverAddress = extractStreetNumber(normalizedData.recipient_address);

        // Costruisci payload secondo manuale v1.9
        // Struttura: costCenterCode, paperless, shipmentDate, waybills[]
        const payload = {
            costCenterCode: cleanCdc,
            paperless: 'false', // true o false (stringa)
            shipmentDate: this.formatShipmentDate(),
            waybills: [
                {
                    clientReferenceId: data.order_id || data.order_reference || data.rif_mittente || `REF_${Date.now()}`,
                    printFormat: 'A4', // Valori: "A4", "1011", "ZPL"
                    product: codiceProdotto,
                    data: {
                        sender: {
                            nameSurname: normalizedData.sender.name,
                            streetNumber: senderAddress.number,
                            address: senderAddress.street,
                            city: normalizedData.sender.city,
                            province: normalizedData.sender.province,
                            zipCode: normalizedData.sender.zip,
                            country: this.convertCountryToISO4(normalizedData.sender.country || 'IT'),
                            email: data.mittenteEmail || data.sender?.email || '',
                            phone: data.mittenteTelefono || data.sender?.phone || '',
                            ...(data.mittenteNote && { note1: data.mittenteNote })
                        },
                        receiver: {
                            nameSurname: normalizedData.recipient_name,
                            ...(data.destinatarioContactName && { contactName: data.destinatarioContactName }),
                            streetNumber: receiverAddress.number,
                            address: receiverAddress.street,
                            city: normalizedData.recipient_city,
                            province: normalizedData.recipient_province,
                            zipCode: normalizedData.recipient_postal_code,
                            country: this.convertCountryToISO4(normalizedData.recipient_country || 'IT'),
                            email: data.destinatarioEmail || data.recipient_email || '',
                            phone: data.destinatarioTelefono || data.recipient_phone || '', // Obbligatorio per Internazionale
                            ...(data.destinatarioNote && { note1: data.destinatarioNote })
                        },
                        declared: [
                            {
                                weight: String(weightGrams), // Grammi (stringa)
                                width: String(width), // cm (stringa)
                                height: String(height), // cm (stringa)
                                length: String(length) // cm (stringa)
                            }
                        ],
                        content: data.contenuto || data.content || 'Spedizione e-commerce',
                        ...(Object.keys(services).length > 0 && { services })
                    }
                }
            ]
        };

        try {
            // Endpoint secondo manuale v1.9: /postalandlogistics/parcel/waybill
            const endpoint = `${this.credentials.base_url}/postalandlogistics/parcel/waybill`;
            
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

            // Gestione errori secondo manuale: controlla errorCode nella risposta
            // Le API Poste ritornano spesso 200 OK anche in caso di errore logico
            const responseData = response.data;
            
            // Verifica errorCode a livello root
            if (responseData.result?.errorCode !== 0 && responseData.result?.errorCode !== undefined) {
                const errorCode = responseData.result.errorCode;
                const errorDesc = responseData.result.errorDescription || 'Errore sconosciuto';
                
                // Mappa codici errore comuni dal manuale
                const errorMessages: Record<number, string> = {
                    100: 'Dati obbligatori mancanti',
                    101: 'Dati non conformi',
                    114: 'Contratto non trovato',
                    115: 'Centro di Costo non trovato',
                    141: 'Servizi accessori non compatibili',
                    142: 'Barcode duplicato'
                };
                
                const userMessage = errorMessages[errorCode] || errorDesc;
                throw new Error(`Errore API Poste (${errorCode}): ${userMessage}`);
            }

            // Estrai dati risposta secondo formato manuale
            // Response: { waybills: [{ code, downloadURL, errorCode, errorDescription }] }
            if (!responseData.waybills || !Array.isArray(responseData.waybills) || responseData.waybills.length === 0) {
                throw new Error('Nessuna waybill nella risposta API');
            }

            const waybill = responseData.waybills[0];
            
            // Verifica errorCode della singola waybill
            if (waybill.errorCode !== 0 && waybill.errorCode !== undefined) {
                throw new Error(`Errore waybill (${waybill.errorCode}): ${waybill.errorDescription || 'Errore sconosciuto'}`);
            }

            const waybillNumber = waybill.code; // Tracking Number (LDV)
            const labelUrl = waybill.downloadURL; // Link PDF Etichetta

            if (!waybillNumber) {
                throw new Error('Numero waybill (code) non ricevuto dalla risposta API');
            }

            console.log('✅ [POSTE] Waybill creata con successo:', {
                waybillNumber,
                hasLabelUrl: !!labelUrl,
                productCode: codiceProdotto,
                cdc: cleanCdc
            });

            return {
                tracking_number: waybillNumber,
                label_url: labelUrl || undefined,
                // Metadati aggiuntivi per salvare nel DB
                metadata: {
                    poste_account_id: this.credentials.client_id,
                    poste_product_code: codiceProdotto,
                    waybill_number: waybillNumber,
                    label_pdf_url: labelUrl,
                    contract_code: responseData.contractCode,
                    channel: responseData.channel
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
            // Endpoint tracking secondo manuale v1.9: /postalandlogistics/parcel/tracking
            // Parametri query: waybillNumber, lastTracingState (S/N), customerType (DQ), statusDescription (E)
            const endpoint = `${this.credentials.base_url}/postalandlogistics/parcel/tracking`;
            
            const response = await axios.get(
                endpoint,
                {
                    params: {
                        waybillNumber: trackingNumber,
                        lastTracingState: 'N', // N = storico completo, S = solo ultimo stato
                        customerType: 'DQ',
                        statusDescription: 'E'
                    },
                    headers: {
                        'POSTE_clientID': this.credentials.client_id,
                        'Authorization': `Bearer ${token}`
                    },
                }
            );

            // Mappa risposta API secondo formato manuale
            // Response: { return: { outcome, result, shipment: [{ waybillNumber, product, tracking: [...] }] } }
            const responseData = response.data;
            
            if (!responseData.return || responseData.return.outcome !== 'OK') {
                throw new Error(responseData.return?.result || 'Errore recupero tracking');
            }

            const shipments = responseData.return.shipment || [];
            if (shipments.length === 0) {
                return [{
                    status: 'NOT_FOUND',
                    description: 'Spedizione non trovata',
                    date: new Date()
                }];
            }

            const shipment = shipments[0];
            const trackingEvents = shipment.tracking || [];

            return trackingEvents.map((e: any) => ({
                status: e.status || 'UNKNOWN',
                description: e.statusDescription || e.description || '',
                location: e.officeDescription || e.location || undefined,
                date: e.data ? new Date(e.data.replace(' ', 'T')) : new Date(),
                phase: e.phase || undefined
            }));
        } catch (error: any) {
            console.error('❌ [POSTE TRACKING] Errore:', error.response?.data || error.message);
            // In caso di errore, restituisci almeno un evento base
            return [{
                status: 'ERROR',
                description: error.response?.data?.error || error.message || 'Errore recupero tracking',
                date: new Date()
            }];
        }
    }
}
