import { CourierAdapter, CourierCredentials, ShippingLabel, TrackingEvent } from '@/lib/adapters/couriers/base';
import axios from 'axios';

export interface PosteCredentials extends CourierCredentials {
    api_key?: string; // Legacy/Alternative
    client_id: string;
    client_secret: string;
    base_url: string; // e.g. 'https://api.poste.it'
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

    async createShipment(data: any): Promise<ShippingLabel> {
        const token = await this.getAuthToken();

        // Product codes mapping based on service
        let productCode = 'APT000902'; // Standard default
        if (data.service === 'express') productCode = 'APT000901';
        if (data.service === 'international') productCode = 'APT000904';

        const payload = {
            costCenterCode: 'CDC-DEFAULT', // TODO: This should ideally come from config or input
            shipmentDate: new Date().toISOString(),
            waybills: [{
                printFormat: 'A4',
                product: productCode,
                data: {
                    sender: {
                        nameSurname: data.sender?.name || 'Mittente',
                        address: data.sender?.address || 'Via Roma 1',
                        zipCode: data.sender?.zip || '00100',
                        city: data.sender?.city || 'Roma',
                        country: data.sender?.country || 'IT',
                        province: data.sender?.province || 'RM'
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
                    declared: [{
                        weight: Math.ceil(data.weight * 1000), // g
                        length: Math.ceil(data.dimensions.length), // cm
                        width: Math.ceil(data.dimensions.width), // cm
                        height: Math.ceil(data.dimensions.height) // cm
                    }]
                }
            }]
        };

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
        const waybill = response.data.waybills?.[0];
        if (!waybill) throw new Error('No waybill generated');

        return {
            tracking_number: waybill.code,
            label_url: waybill.downloadURL
        };
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
