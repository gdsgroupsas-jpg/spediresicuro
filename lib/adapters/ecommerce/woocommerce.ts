/**
 * WooCommerce E-commerce Adapter
 *
 * Integrazione con WooCommerce via REST API
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

export class WooCommerceAdapter extends EcommerceAdapter {
  private baseUrl: string;

  constructor(credentials: EcommerceCredentials) {
    super(credentials, 'woocommerce');
    this.baseUrl = `${credentials.store_url}/wp-json/wc/v3`;
  }

  async connect(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/system_status');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // No-op
  }

  async fetchOrders(filters?: OrderFilters): Promise<Order[]> {
    try {
      const params = new URLSearchParams();

      if (filters?.status) {
        params.append('status', filters.status.join(','));
      }

      if (filters?.created_after) {
        params.append('after', filters.created_after.toISOString());
      }

      if (filters?.created_before) {
        params.append('before', filters.created_before.toISOString());
      }

      params.append('per_page', String(filters?.limit || 50));
      params.append('page', String((filters?.offset || 0) / (filters?.limit || 50) + 1));

      const response = await this.makeRequest(`/orders?${params}`);
      const orders = await response.json();

      return orders.map((o: any) => this.normalizeOrder(o));
    } catch (error) {
      this.handleError(error, 'fetchOrders');
    }
  }

  async getOrder(orderId: string): Promise<Order> {
    try {
      const response = await this.makeRequest(`/orders/${orderId}`);
      const order = await response.json();
      return this.normalizeOrder(order);
    } catch (error) {
      this.handleError(error, 'getOrder');
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    try {
      await this.makeRequest(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      this.handleError(error, 'updateOrderStatus');
    }
  }

  async pushTrackingInfo(orderId: string, tracking: TrackingInfo): Promise<void> {
    try {
      // WooCommerce: aggiungi tracking come meta data o nota
      await this.makeRequest(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          meta_data: [
            { key: '_tracking_number', value: tracking.tracking_number },
            { key: '_tracking_provider', value: tracking.courier_name },
            { key: '_tracking_url', value: tracking.tracking_url || '' },
          ],
        }),
      });

      // Aggiungi nota ordine
      await this.makeRequest(`/orders/${orderId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          note: `Spedizione tracciata: ${tracking.tracking_number} tramite ${tracking.courier_name}`,
          customer_note: true,
        }),
      });
    } catch (error) {
      this.handleError(error, 'pushTrackingInfo');
    }
  }

  async syncProducts(): Promise<Product[]> {
    try {
      const response = await this.makeRequest('/products?per_page=100');
      const products = await response.json();

      return products.map((p: any) => ({
        id: p.id.toString(),
        sku: p.sku || '',
        name: p.name,
        description: p.description,
        price: parseFloat(p.price),
        image_url: p.images?.[0]?.src,
        inventory_quantity: p.stock_quantity,
      }));
    } catch (error) {
      this.handleError(error, 'syncProducts');
    }
  }

  async updateProductStock(productId: string, quantity: number): Promise<void> {
    try {
      await this.makeRequest(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({
          stock_quantity: quantity,
          manage_stock: true,
        }),
      });
    } catch (error) {
      this.handleError(error, 'updateProductStock');
    }
  }

  async syncInventory(): Promise<void> {
    console.log('[WooCommerce] syncInventory - to be implemented');
  }

  async setupWebhooks(callbackUrl: string): Promise<void> {
    const topics = ['order.created', 'order.updated', 'order.deleted'];

    for (const topic of topics) {
      try {
        await this.makeRequest('/webhooks', {
          method: 'POST',
          body: JSON.stringify({
            name: `SpedireSicuro - ${topic}`,
            topic,
            delivery_url: `${callbackUrl}/woocommerce`,
          }),
        });
      } catch (error) {
        console.error(`[WooCommerce] Error setting up webhook ${topic}:`, error);
      }
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // WooCommerce usa HMAC-SHA256
    const crypto = require('crypto');
    const hmac = crypto
      .createHmac('sha256', this.credentials.api_secret || '')
      .update(payload, 'utf8')
      .digest('base64');

    return hmac === signature;
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    console.log('[WooCommerce] Webhook received:', event.type);
  }

  // Helper privati
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    const authString = Buffer.from(
      `${this.credentials.api_key}:${this.credentials.api_secret}`
    ).toString('base64');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authString}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    await this.rateLimit(300);

    return response;
  }

  private normalizeOrder(order: any): Order {
    return {
      id: order.id.toString(),
      order_number: order.number || order.id.toString(),
      customer: {
        name: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
        email: order.billing?.email || '',
        phone: order.billing?.phone,
      },
      shipping_address: this.normalizeAddress(order.shipping || {}),
      items: (order.line_items || []).map((item: any) => ({
        id: item.id.toString(),
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price),
      })),
      subtotal:
        parseFloat(order.total || '0') -
        parseFloat(order.total_tax || '0') -
        parseFloat(order.shipping_total || '0'),
      shipping_cost: parseFloat(order.shipping_total || '0'),
      tax: parseFloat(order.total_tax || '0'),
      total: parseFloat(order.total || '0'),
      currency: order.currency || 'EUR',
      status: order.status,
      created_at: new Date(order.date_created),
      updated_at: new Date(order.date_modified),
    };
  }
}
