export interface CourierCreateShipmentRequest {
  sender: {
    name: string;
    company?: string;
    address: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone?: string;
    email: string;
  };
  recipient: {
    name: string;
    company?: string;
    address: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone?: string;
    email: string;
  };
  packages: Array<{
    length: number;
    width: number;
    height: number;
    weight: number;
  }>;
  insurance?: number;
  cod?: number;
  notes?: string;
}

export interface CourierCreateShipmentResponse {
  success: boolean;
  shipmentId: string;
  trackingNumber: string;
  cost: number; // Normalizzato a number
  labelData: string; // Base64 PDF (campo standard)
  labelZPL?: string;
  carrier: string;
  rawResponse?: any;
}

export interface CourierDeleteShipmentRequest {
  shipmentId: string;
}

export interface CourierClientOptions {
  timeout?: number;
}

export abstract class BaseCourierClient {
  protected apiKey: string;
  protected baseUrl: string;
  protected contractId?: string;
  protected carrier?: string; // Opzionale: per provider aggregatori

  constructor(config: {
    apiKey: string;
    baseUrl: string;
    contractId?: string;
    carrier?: string; // Opzionale: per provider aggregatori
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.contractId = config.contractId;
    this.carrier = config.carrier;
  }

  abstract createShipping(
    request: CourierCreateShipmentRequest,
    options?: CourierClientOptions
  ): Promise<CourierCreateShipmentResponse>;

  abstract deleteShipping(request: CourierDeleteShipmentRequest): Promise<void>;

  abstract validateCredentials(): Promise<boolean>;
}
