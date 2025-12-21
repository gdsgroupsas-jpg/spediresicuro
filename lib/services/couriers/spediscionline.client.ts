import { BaseCourierClient, CourierCreateShipmentRequest, CourierCreateShipmentResponse, CourierDeleteShipmentRequest, CourierClientOptions } from './base-courier.interface'

// ⚠️ CRITICAL: Schema response REALE da OpenAPI
interface SpedisciOnlineRawResponse {
  shipmentId: number
  trackingNumber: string
  shipmentCost: string        // ⚠️ STRING "7.00", NON number
  packages: Array<{
    pack_number: number
    reference: string | null
  }>
  labelData: string           // ⚠️ "labelData", NON "labelPdf"
  labelZPL?: string
}

export class SpedisciOnlineClient extends BaseCourierClient {
  private carrier: string  // GLS, POSTE, BRT, UPS, etc
  
  constructor(config: {
    apiKey: string
    baseUrl: string
    contractId?: string
    carrier: string  // NUOVO: corriere specifico
  }) {
    super(config)
    this.carrier = config.carrier
  }
  
  async createShipping(
    request: CourierCreateShipmentRequest,
    options: CourierClientOptions = {}
  ): Promise<CourierCreateShipmentResponse> {
    
    const { timeout = 30000 } = options

    // Prepara payload SpedisciOnline
    const payload = {
      packages: request.packages.map(pkg => ({
        length: pkg.length,
        width: pkg.width,
        height: pkg.height,
        weight: pkg.weight
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
        email: request.sender.email
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
        email: request.recipient.email
      },
      carrier: this.carrier,  // Corriere dinamico (GLS, POSTE, BRT, UPS, etc)
      contract: this.contractId || this.getDefaultContract(this.carrier),  // Contratto specifico
      insuranceValue: request.insurance || 0,
      codValue: request.cod || 0,
      accessoriServices: [],
      notes: request.notes || ''
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${this.baseUrl}/shipping/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const data: SpedisciOnlineRawResponse = await response.json()

      if (!response.ok) {
        const error = new Error((data as any).message || 'SpedisciOnline API error')
        ;(error as any).statusCode = response.status
        ;(error as any).data = data
        throw error
      }

      // ⚠️ CRITICAL: Validazione campi corretti
      if (!data.labelData || !data.trackingNumber) {
        throw new Error('Invalid response: missing labelData or trackingNumber')
      }

      // ⚠️ CRITICAL: Parsing shipmentCost (string → number)
      const parsedCost = parseFloat(data.shipmentCost)
      if (isNaN(parsedCost) || parsedCost <= 0) {
        throw new Error(`Invalid shipmentCost: ${data.shipmentCost}`)
      }

      // Normalizza a formato standard
      return {
        success: true,
        shipmentId: data.shipmentId.toString(),
        trackingNumber: data.trackingNumber,
        cost: parsedCost,                    // ✅ Number parsato
        labelData: data.labelData,           // ✅ Campo corretto
        labelZPL: data.labelZPL,
        carrier: 'spediscionline',
        rawResponse: data
      }

    } catch (error: any) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        const timeoutError = new Error('SpedisciOnline API timeout')
        ;(timeoutError as any).statusCode = 'TIMEOUT'
        throw timeoutError
      }

      throw error
    }
  }

  async deleteShipping(request: CourierDeleteShipmentRequest): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/shipping/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          increment_id: parseInt(request.shipmentId)
        })
      })

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`)
      }

    } catch (error) {
      console.error('Failed to delete shipment:', error)
      throw error
    }
  }

  async validateCredentials(): Promise<boolean> {
    // TODO: Implementa chiamata test
    return true
  }
  
  private getDefaultContract(carrier: string): string {
    // Fallback se contract_id non specificato
    const defaults: Record<string, string> = {
      'GLS': 'GLSXS',
      'POSTE': 'PDB_STANDARD',
      'BRT': 'BRT_STANDARD',
      'UPS': 'UPS_STANDARD',
      'DHL': 'DHL_EXPRESS',
      'SDA': 'SDA_STANDARD',
      'TNT': 'TNT_STANDARD',
      'FEDEX': 'FEDEX_EXPRESS'
    }
    return defaults[carrier.toUpperCase()] || 'STANDARD'
  }
}

