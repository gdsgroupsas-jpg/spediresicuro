/**
 * Types: E-commerce Integrations
 */

export type EcommercePlatform = 'shopify' | 'woocommerce' | 'prestashop' | 'magento' | 'custom';

export type EcommerceOrderStatus =
  | 'pending'
  | 'processing'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export interface EcommerceIntegration {
  id: string;
  user_id: string;

  platform: EcommercePlatform;

  store_url: string;
  api_key_encrypted?: string;
  api_secret_encrypted?: string;
  access_token_encrypted?: string;

  config?: any;
  field_mapping?: any;

  active: boolean;
  last_sync_at?: string;
  last_sync_status?: string;
  last_sync_error?: string;

  webhook_secret?: string;
  webhook_enabled: boolean;

  created_at: string;
  updated_at: string;
}

export interface EcommerceOrder {
  id: string;
  integration_id: string;

  platform_order_id: string;
  platform_order_number: string;

  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;

  shipping_address?: any;
  items?: any;

  subtotal?: number;
  shipping_cost?: number;
  tax?: number;
  total?: number;
  currency?: string;

  status: EcommerceOrderStatus;
  financial_status?: string;
  fulfillment_status?: string;

  shipment_id?: string;

  synced_at?: string;

  platform_created_at?: string;
  platform_updated_at?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateEcommerceIntegrationInput {
  platform: EcommercePlatform;
  store_url: string;
  api_key_encrypted: string;
  api_secret_encrypted?: string;
  access_token_encrypted?: string;
  config?: any;
}
