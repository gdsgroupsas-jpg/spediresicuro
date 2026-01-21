/**
 * Shopify E-commerce Adapter
 *
 * Integrazione con Shopify via REST API e GraphQL
 */

import {
  EcommerceAdapter,
  type EcommerceCredentials,
  type Order,
  type OrderFilters,
  type TrackingInfo,
  type Product,
  type WebhookEvent,
} from './base';

export class ShopifyAdapter extends EcommerceAdapter {
  private apiVersion = '2024-01';
  private baseUrl: string;

  constructor(credentials: EcommerceCredentials) {
    super(credentials, 'shopify');
    this.baseUrl = `https://${credentials.store_url}/admin/api/${this.apiVersion}`;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/shop.json');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // No-op per Shopify (stateless)
  }

  async fetchOrders(filters?: OrderFilters): Promise<Order[]> {
    try {
      const params = new URLSearchParams();

      if (filters?.status) {
        params.append('status', filters.status.join(','));
      }

      if (filters?.created_after) {
        params.append('created_at_min', filters.created_after.toISOString());
      }

      if (filters?.created_before) {
        params.append('created_at_max', filters.created_before.toISOString());
      }

      params.append('limit', String(filters?.limit || 50));

      const response = await this.makeRequest(`/orders.json?${params}`);
      const data = await response.json();

      return data.orders.map((o: any) => this.normalizeOrder(o));
    } catch (error) {
      this.handleError(error, 'fetchOrders');
    }
  }

  async getOrder(orderId: string): Promise<Order> {
    try {
      const response = await this.makeRequest(`/orders/${orderId}.json`);
      const data = await response.json();
      return this.normalizeOrder(data.order);
    } catch (error) {
      this.handleError(error, 'getOrder');
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.makeRequest(`/orders/${orderId}.json`, {
        method: 'PUT',
        body: JSON.stringify({
          order: {
            id: orderId,
            tags: status, // Shopify usa tags per status personalizzati
          },
        }),
      });
    } catch (error) {
      this.handleError(error, 'updateOrderStatus');
    }
  }

  async pushTrackingInfo(orderId: string, tracking: TrackingInfo): Promise<void> {
    try {
      // Ottieni fulfillment order
      const fulfillmentResponse = await this.makeRequest(
        `/orders/${orderId}/fulfillment_orders.json`
      );
      const fulfillmentData = await fulfillmentResponse.json();

      if (fulfillmentData.fulfillment_orders.length === 0) {
        throw new Error('No fulfillment orders found');
      }

      const fulfillmentOrderId = fulfillmentData.fulfillment_orders[0].id;

      // Crea fulfillment
      await this.makeRequest(`/fulfillments.json`, {
        method: 'POST',
        body: JSON.stringify({
          fulfillment: {
            line_items_by_fulfillment_order: [
              {
                fulfillment_order_id: fulfillmentOrderId,
              },
            ],
            tracking_info: {
              number: tracking.tracking_number,
              company: tracking.courier_name,
              url: tracking.tracking_url,
            },
            notify_customer: true,
          },
        }),
      });
    } catch (error) {
      this.handleError(error, 'pushTrackingInfo');
    }
  }

  async syncProducts(): Promise<Product[]> {
    try {
      const response = await this.makeRequest('/products.json?limit=250');
      const data = await response.json();

      const products: Product[] = [];

      data.products.forEach((product: any) => {
        product.variants.forEach((variant: any) => {
          products.push({
            id: variant.id.toString(),
            sku: variant.sku || '',
            name: `${product.title}${variant.title !== 'Default Title' ? ` - ${variant.title}` : ''}`,
            description: product.body_html,
            price: parseFloat(variant.price),
            image_url: product.image?.src,
            inventory_quantity: variant.inventory_quantity,
          });
        });
      });

      return products;
    } catch (error) {
      this.handleError(error, 'syncProducts');
    }
  }

  async updateProductStock(productId: string, quantity: number): Promise<void> {
    try {
      // Ottieni inventory item
      const variantResponse = await this.makeRequest(`/variants/${productId}.json`);
      const variantData = await variantResponse.json();
      const inventoryItemId = variantData.variant.inventory_item_id;

      // Ottieni location
      const locationsResponse = await this.makeRequest('/locations.json');
      const locationsData = await locationsResponse.json();
      const locationId = locationsData.locations[0].id;

      // Aggiorna stock
      await this.makeRequest(`/inventory_levels/set.json`, {
        method: 'POST',
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available: quantity,
        }),
      });
    } catch (error) {
      this.handleError(error, 'updateProductStock');
    }
  }

  async syncInventory(): Promise<void> {
    // Implementazione completa richiede mappatura prodotti
    console.log('[Shopify] syncInventory - to be implemented');
  }

  async setupWebhooks(callbackUrl: string): Promise<void> {
    const topics = [
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'fulfillments/create',
      'fulfillments/update',
    ];

    for (const topic of topics) {
      try {
        await this.makeRequest('/webhooks.json', {
          method: 'POST',
          body: JSON.stringify({
            webhook: {
              topic,
              address: `${callbackUrl}/shopify`,
              format: 'json',
            },
          }),
        });
      } catch (error) {
        console.error(`[Shopify] Error setting up webhook ${topic}:`, error);
      }
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Implementa verifica HMAC Shopify
    const crypto = require('crypto');
    const hmac = crypto
      .createHmac('sha256', this.credentials.api_secret)
      .update(payload, 'utf8')
      .digest('base64');

    return hmac === signature;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    console.log('[Shopify] Webhook received:', event.type);
    // Implementare gestione eventi specifici
  }

  // Helper privati
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.credentials.access_token || '',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errors || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Rate limiting
    await this.rateLimit(500);

    return response;
  }

  private normalizeOrder(order: any): Order {
    return {
      id: order.id.toString(),
      order_number: order.name || order.order_number,
      customer: {
        name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
        email: order.customer?.email || '',
        phone: order.customer?.phone,
      },
      shipping_address: this.normalizeAddress(order.shipping_address || {}),
      items: (order.line_items || []).map((item: any) => ({
        id: item.id.toString(),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
      })),
      subtotal: parseFloat(order.subtotal_price || '0'),
      shipping_cost: parseFloat(order.total_shipping_price_set?.shop_money?.amount || '0'),
      tax: parseFloat(order.total_tax || '0'),
      total: parseFloat(order.total_price || '0'),
      currency: order.currency || 'EUR',
      status: order.fulfillment_status || 'unfulfilled',
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      created_at: new Date(order.created_at),
      updated_at: new Date(order.updated_at),
    };
  }
}
