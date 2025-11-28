/**
 * E-commerce Adapter Base Interface
 *
 * Interfaccia comune per tutte le integrazioni e-commerce
 */

export interface EcommerceCredentials {
  store_url: string;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  [key: string]: any;
}

export interface OrderFilters {
  status?: string[];
  created_after?: Date;
  created_before?: Date;
  limit?: number;
  offset?: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  shipping_address: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    sku?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  financial_status?: string;
  fulfillment_status?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TrackingInfo {
  tracking_number: string;
  courier_name: string;
  tracking_url?: string;
  shipped_at?: Date;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  inventory_quantity?: number;
}

export interface WebhookEvent {
  type: string;
  data: any;
  timestamp: Date;
}

/**
 * Base Adapter Interface
 *
 * Ogni piattaforma e-commerce deve implementare questa interfaccia
 */
export abstract class EcommerceAdapter {
  protected credentials: EcommerceCredentials;
  protected platform: string;

  constructor(credentials: EcommerceCredentials, platform: string) {
    this.credentials = credentials;
    this.platform = platform;
  }

  /**
   * Test connessione alla piattaforma
   */
  abstract connect(): Promise<boolean>;

  /**
   * Disconnetti
   */
  abstract disconnect(): Promise<void>;

  /**
   * Ottieni ordini con filtri
   */
  abstract fetchOrders(filters?: OrderFilters): Promise<Order[]>;

  /**
   * Ottieni singolo ordine
   */
  abstract getOrder(orderId: string): Promise<Order>;

  /**
   * Aggiorna status ordine
   */
  abstract updateOrderStatus(orderId: string, status: string): Promise<void>;

  /**
   * Invia tracking info all'ordine
   */
  abstract pushTrackingInfo(orderId: string, tracking: TrackingInfo): Promise<void>;

  /**
   * Sincronizza prodotti
   */
  abstract syncProducts(): Promise<Product[]>;

  /**
   * Aggiorna stock prodotto
   */
  abstract updateProductStock(productId: string, quantity: number): Promise<void>;

  /**
   * Sincronizza inventory
   */
  abstract syncInventory(): Promise<void>;

  /**
   * Setup webhooks
   */
  abstract setupWebhooks(callbackUrl: string): Promise<void>;

  /**
   * Verifica webhook signature
   */
  abstract verifyWebhook(payload: any, signature: string): boolean;

  /**
   * Gestisci webhook event
   */
  abstract handleWebhook(event: WebhookEvent): Promise<void>;

  /**
   * Helper: Normalizza indirizzo
   */
  protected normalizeAddress(address: any): Order['shipping_address'] {
    return {
      name: address.name || address.recipient_name || '',
      address1: address.address1 || address.street || address.address || '',
      address2: address.address2 || address.address_line_2 || undefined,
      city: address.city || '',
      zip: address.zip || address.postal_code || address.postcode || '',
      province: address.province || address.state || address.region || '',
      country: address.country || address.country_code || 'IT',
      phone: address.phone || address.telephone || undefined,
    };
  }

  /**
   * Helper: Gestione errori API
   */
  protected handleError(error: any, context: string): never {
    console.error(`[${this.platform}] Error in ${context}:`, error);
    throw new Error(
      `Errore ${this.platform} - ${context}: ${error.message || 'Unknown error'}`
    );
  }

  /**
   * Helper: Rate limiting
   */
  protected async rateLimit(delayMs: number = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Helper: Retry con backoff esponenziale
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`[${this.platform}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}

/**
 * Factory per creare adapter dalla configurazione
 */
export function createEcommerceAdapter(
  platform: string,
  credentials: EcommerceCredentials
): EcommerceAdapter {
  switch (platform.toLowerCase()) {
    case 'shopify':
      const { ShopifyAdapter } = require('./shopify');
      return new ShopifyAdapter(credentials);

    case 'woocommerce':
      const { WooCommerceAdapter } = require('./woocommerce');
      return new WooCommerceAdapter(credentials);

    case 'prestashop':
      const { PrestaShopAdapter } = require('./prestashop');
      return new PrestaShopAdapter(credentials);

    case 'magento':
      const { MagentoAdapter } = require('./magento');
      return new MagentoAdapter(credentials);

    default:
      throw new Error(`Piattaforma e-commerce non supportata: ${platform}`);
  }
}
