import {
  BaseCourierClient,
  CourierCreateShipmentRequest,
  CourierCreateShipmentResponse,
  CourierDeleteShipmentRequest,
  CourierClientOptions,
} from './base-courier.interface';

// ⚠️ CRITICAL: Schema response REALE da OpenAPI
interface SpedisciOnlineRawResponse {
  shipmentId: number;
  trackingNumber: string;
  shipmentCost: string; // ⚠️ STRING "7.00", NON number
  packages: Array<{
    pack_number: number;
    reference: string | null;
  }>;
  labelData: string; // ⚠️ "labelData", NON "labelPdf"
  labelZPL?: string;
}

export class SpedisciOnlineClient extends BaseCourierClient {
  protected carrier: string; // GLS, POSTE, BRT, UPS, etc (aligned with base class)

  constructor(config: {
    apiKey: string;
    baseUrl: string;
    contractId?: string;
    carrier: string; // NUOVO: corriere specifico
  }) {
    super(config);
    this.carrier = config.carrier;
  }

  async createShipping(
    request: CourierCreateShipmentRequest,
    options: CourierClientOptions = {}
  ): Promise<CourierCreateShipmentResponse> {
    const { timeout = 30000 } = options;

    // Prepara payload SpedisciOnline (schema da openapi.json)
    // CRITICAL: carrierCode deve essere il prefisso del provider (es. "postedeliverybusiness", "gls", "brt")
    // contractCode è il codice contratto completo (es. "postedeliverybusiness-SDA---Express---H24+")
    const contractCode = this.contractId || this.getDefaultContract(this.carrier);

    // Estrai carrierCode dal contractCode
    // Formato contractCode: "carriercode-ContractName" (es. "postedeliverybusiness-SDA---Express---H24+")
    // Se contractCode contiene "-", la prima parte è il carrierCode
    // Altrimenti, usa contractCode stesso come carrierCode (per casi legacy)
    let carrierCode: string;
    if (contractCode && contractCode.includes('-')) {
      carrierCode = contractCode.split('-')[0].toLowerCase();
    } else if (contractCode) {
      // Usa contractCode come carrierCode se non contiene "-"
      carrierCode = contractCode.toLowerCase();
    } else {
      // Fallback al carrier normalizzato (potrebbe non funzionare per alcuni provider)
      carrierCode = this.carrier.toLowerCase();
    }

    console.log('🔧 [SPEDISCIONLINE] Carrier/Contract resolution:', {
      contractId: this.contractId,
      contractCode,
      carrierCode,
      originalCarrier: this.carrier,
    });

    const payload = {
      packages: request.packages.map((pkg) => ({
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        weight: pkg.weight,
      })),
      shipFrom: {
        name: request.sender.name,
        company: request.sender.company || '',
        street1: request.sender.address,
        street2: request.sender.address2 || '',
        city: request.sender.city,
        state: request.sender.province,
        postalCode: request.sender.postalCode,
        country: request.sender.country,
        phone: request.sender.phone || null,
        email: request.sender.email,
      },
      shipTo: {
        name: request.recipient.name,
        company: request.recipient.company || '',
        street1: request.recipient.address,
        street2: request.recipient.address2 || '',
        city: request.recipient.city,
        state: request.recipient.province,
        postalCode: request.recipient.postalCode,
        country: request.recipient.country,
        phone: request.recipient.phone || null,
        email: request.recipient.email,
      },
      carrierCode: carrierCode, // ✅ OpenAPI: carrierCode (lowercase)
      contractCode: contractCode, // ✅ OpenAPI: contractCode
      insuranceValue: request.insurance || 0,
      codValue: request.cod || 0,
      accessoriServices: [],
      notes: request.notes || '',
    };

    console.log('📦 [SPEDISCIONLINE] Creating shipment:', {
      carrierCode,
      contractCode,
      baseUrl: this.baseUrl,
      sender: payload.shipFrom.city,
      recipient: payload.shipTo.city,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}/shipping/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Debug: log raw response info before parsing
      const contentType = response.headers.get('content-type') || '';
      console.log('📦 [SPEDISCIONLINE] Raw response:', {
        status: response.status,
        statusText: response.statusText,
        contentType,
      });

      // SpedisciOnline API bug: sometimes returns JSON with text/html Content-Type
      // Try to parse as JSON regardless of Content-Type, fall back to error if it's actually HTML
      const textBody = await response.text();
      let data: SpedisciOnlineRawResponse;

      try {
        data = JSON.parse(textBody);
      } catch {
        // Actual HTML or invalid JSON
        console.error('❌ [SPEDISCIONLINE] Non-JSON response body:', {
          first500Chars: textBody.substring(0, 500),
          fullUrl: `${this.baseUrl}/shipping/create`,
        });
        throw new Error(
          `SpedisciOnline returned invalid response. Check API key and endpoint URL.`
        );
      }

      console.log('📦 [SPEDISCIONLINE] API response:', {
        status: response.status,
        ok: response.ok,
        hasTrackingNumber: !!data?.trackingNumber,
        hasLabelData: !!data?.labelData,
        shipmentCost: data?.shipmentCost,
        error: (data as any)?.message || (data as any)?.error,
      });

      if (!response.ok) {
        console.error('❌ [SPEDISCIONLINE] API error:', {
          status: response.status,
          data: JSON.stringify(data).substring(0, 500),
        });
        const error = new Error((data as any).message || 'SpedisciOnline API error');
        (error as any).statusCode = response.status;
        (error as any).data = data;
        throw error;
      }

      // ⚠️ CRITICAL: Validazione campi corretti
      if (!data.labelData || !data.trackingNumber) {
        throw new Error('Invalid response: missing labelData or trackingNumber');
      }

      // ⚠️ CRITICAL: Parsing shipmentCost (string → number)
      const parsedCost = parseFloat(data.shipmentCost);
      if (isNaN(parsedCost) || parsedCost <= 0) {
        throw new Error(`Invalid shipmentCost: ${data.shipmentCost}`);
      }

      // Normalizza a formato standard
      return {
        success: true,
        shipmentId: data.shipmentId.toString(),
        trackingNumber: data.trackingNumber,
        cost: parsedCost, // ✅ Number parsato
        labelData: data.labelData, // ✅ Campo corretto
        labelZPL: data.labelZPL,
        carrier: 'spediscionline',
        rawResponse: data,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new Error('SpedisciOnline API timeout');
        (timeoutError as any).statusCode = 'TIMEOUT';
        throw timeoutError;
      }

      // Log non-timeout errors for debugging
      console.error('❌ [SPEDISCIONLINE] Unexpected error:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 300),
      });

      throw error;
    }
  }

  async deleteShipping(request: CourierDeleteShipmentRequest): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/shipping/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          increment_id: parseInt(request.shipmentId),
        }),
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete shipment:', error);
      throw error;
    }
  }

  async validateCredentials(): Promise<boolean> {
    // TODO: Implementa chiamata test
    return true;
  }

  private getDefaultContract(carrier: string): string {
    // Fallback se contract_id non specificato
    const defaults: Record<string, string> = {
      GLS: 'GLSXS',
      POSTE: 'PDB_STANDARD',
      BRT: 'BRT_STANDARD',
      UPS: 'UPS_STANDARD',
      DHL: 'DHL_EXPRESS',
      SDA: 'SDA_STANDARD',
      TNT: 'TNT_STANDARD',
      FEDEX: 'FEDEX_EXPRESS',
    };
    return defaults[carrier.toUpperCase()] || 'STANDARD';
  }
}
