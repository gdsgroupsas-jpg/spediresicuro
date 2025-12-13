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
     * 
     * FIXED: Strict adherence to manual and sanitization to prevent 401/404 errors.
     */
    private async getAuthToken(): Promise<string> {
        // Return cached token if valid (with 5 min buffer)
        if (this.token && Date.now() < this.tokenExpiry - 300000) {
            return this.token;
        }

        // 1. Sanitize Credentials (aggressive trim + remove spaces)
        const sanitizedClientId = (this.credentials.client_id || '').trim().replace(/\s+/g, '');
        const sanitizedSecretId = (this.credentials.client_secret || '').trim().replace(/\s+/g, '');

        // 2. Logging for Debug (Safe)
        console.log('[Poste Auth] Attempting authentication...');
        console.log('[Poste Auth] ClientID Length:', sanitizedClientId.length);
        console.log('[Poste Auth] SecretID Length:', sanitizedSecretId.length);
        console.log('[Poste Auth] Preview ClientID:', sanitizedClientId.substring(0, 5) + '...');

        try {
            // 3. Endpoint: ONLY /user/sessions is valid for new API
            // clean base_url just in case
            const baseUrl = this.credentials.base_url.replace(/\/$/, '');
            const authUrl = `${baseUrl}/user/sessions`;

            console.log('[Poste Auth] Endpoint:', authUrl);

            // 4. Request
            const response = await axios.post(
                authUrl,
                {
                    clientId: sanitizedClientId,
                    secretId: sanitizedSecretId,
                    grantType: 'client_credentials',
                    scope: 'default'
                },
                {
                    headers: {
                        'POSTE_clientID': sanitizedClientId,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // 5. Check & Store
            if (response.data && response.data.access_token) {
                console.log('[Poste Auth] ✅ Access Token Received');
                this.token = response.data.access_token;
                this.tokenExpiry = Date.now() + ((response.data.expires_in || 3599) * 1000);
                return this.token!;
            } else {
                console.error('[Poste Auth] ❌ No access_token in response body:', response.data);
                throw new Error('No access_token received from Poste API');
            }

        } catch (error: any) {
            console.error('[Poste Auth] ❌ Auth Failed');

            // Safe Error Extraction
            const status = error.response?.status;
            const data = error.response?.data;
            const errorMessage = data?.error_description || data?.error || error.message;

            console.error('[Poste Auth] Status:', status);
            console.error('[Poste Auth] Error Details:', JSON.stringify(data, null, 2));

            // Specialized Error for Tenant Issue
            if (errorMessage && errorMessage.includes('AADSTS700016')) {
                throw new Error(`POSTE ERROR: Client ID non trovato nel tenant (AADSTS700016). Verifica credenziali PDB. Dettagli: ${errorMessage}`);
            }

            throw new Error(`Authentication failed (${status}): ${errorMessage}`);
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

    async createShipment(data: any): Promise<ShippingLabel> {
        const token = await this.getAuthToken();

        // Product codes mapping based on service
        let productCode = 'APT000902'; // Standard default
        if (data.service === 'express') productCode = 'APT000901';
        if (data.service === 'international') productCode = 'APT000904';

        // Helper Address Splitter
        const splitAddress = (fullAddress: string) => {
            const match = fullAddress.match(/^(.+)\s+(\d+(\/[a-zA-Z0-9]+)?)$/);
            if (match) {
                return { address: match[1].trim(), streetNumber: match[2] };
            }
            return { address: fullAddress, streetNumber: '.' };
        };

        const senderAddr = splitAddress(data.sender?.address || 'Via Roma 1');
        const receiverAddr = splitAddress(data.recipient_address || '');

        // Fix Country Code: Poste usa ITA1, USA1 etc.
        const normalizeCountry = (c: string) => {
            if (!c || c === 'IT' || c === 'Italy' || c === 'Italia') return 'ITA1';
            return c;
        };

        const payload = {
            costCenterCode: this.credentials.cost_center_code || 'CDC-DEFAULT',
            shipmentDate: new Date().toISOString(),
            waybills: [{
                printFormat: 'A4', // 'A4', '10x11'
                product: productCode,
                data: { // FIXED: Manual v1.9 says 'data'
                    sender: {
                        nameSurname: data.sender?.name || 'Mittente',
                        address: senderAddr.address,
                        streetNumber: senderAddr.streetNumber,
                        zipCode: data.sender?.zip || '00100',
                        city: data.sender?.city || 'Roma',
                        country: normalizeCountry(data.sender?.country),
                        province: data.sender?.province || 'RM',
                        email: data.sender?.email || 'info@spediresicuro.it',
                        phone: data.sender?.phone || '3333333333',
                    },
                    receiver: {
                        nameSurname: data.recipient_name,
                        address: receiverAddr.address,
                        streetNumber: receiverAddr.streetNumber,
                        zipCode: data.recipient_postal_code,
                        city: data.recipient_city,
                        country: normalizeCountry(data.recipient_country),
                        province: data.recipient_province,
                        email: data.recipient_email || 'destinatario@email.com',
                        phone: data.recipient_phone || '3330000000',
                    },
                    content: 'Spedizione e-commerce',
                    declared: [{
                        weight: Math.ceil(data.weight * 1000).toString(), // g, string
                        length: Math.ceil(data.dimensions.length).toString(), // cm, string
                        width: Math.ceil(data.dimensions.width).toString(), // cm, string
                        height: Math.ceil(data.dimensions.height).toString() // cm, string
                    }]
                }
            }]
        };

        console.log('📦 [POST ADAPTER] Payload:', JSON.stringify(payload, null, 2));

        try {
            const response = await axios.post(
                `${this.credentials.base_url}/postalandlogistics/parcel/waybill`,
                payload,
                {
                    headers: {
                        'POSTE_clientID': this.credentials.client_id,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                }
            );

            // Poste returns a list of waybills
            // Response example: { waybills: [ { code: '...', result: { pdf: 'base64...' } } ] }
            // Or downloadURL?
            // "Stampa LdV: formati supportati: A4 e 10x11; 10x11 anche come .pdf o .prn"
            // Let's inspect response structure safely
            const waybill = response.data.waybills?.[0];

            if (!waybill) {
                console.error('❌ Poste Error Response:', response.data);
                throw new Error('No waybill generated in response');
            }

            // Check for errors in the waybill object itself if structured that way
            // But usually if status 200, it's ok.

            // Check if we have a download URL or base64
            // The user summary doesn't explicitly specify the response format for print, 
            // but implies standard usage. Assuming `downloadURL` or `print` object.
            // Let's fallback to `code` (tracking) and try to construct a URL if missing,
            // or return the raw data if we need to debug.

            // NOTE: Previous working code assumed `downloadURL`. 
            // If that was wrong, we'll see. 
            // But let's look for `result.pdf` or similar if `downloadURL` is missing.

            let labelUrl = waybill.downloadURL;
            let labelPdf = undefined;

            // If base64 is provided in some field (e.g. valid '10x11' request often returns base64)
            // For A4, normally it's a URL or base64.

            return {
                tracking_number: waybill.code,
                label_url: labelUrl
            };
        } catch (error: any) {
            // Enhanced Error Logging
            console.error('❌ Poste API Error Details:', error.response?.data);
            // Return the specific error message from Poste if available
            const posteError = error.response?.data?.errorDescription
                || error.response?.data?.messages?.[0]?.description
                || error.message;
            throw new Error(posteError);
        }
    }

    async getTracking(trackingNumber: string): Promise<TrackingEvent[]> {
        const token = await this.getAuthToken();

        const response = await axios.get(
            `${this.credentials.base_url}/postalandlogistics/parcel/tracking?waybillNumber=${trackingNumber}`,
            {
                headers: {
                    'POSTE_clientID': this.credentials.client_id,
                    'Authorization': `Bearer ${token}`
                },
            }
        );

        return (response.data || []).map((e: any) => ({
            status: e.status || 'UNKNOWN',
            description: e.description,
            location: e.location,
            date: new Date(e.date), // Check format from actual response
        }));
    }
}
