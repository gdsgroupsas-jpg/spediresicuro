/**
 * Types: Analytics
 */

export interface GeoAnalytics {
  id: string;
  zip_code?: string;
  city?: string;
  province?: string;
  region?: string;
  zone_type?: string;

  period_start: string;
  period_end: string;

  total_shipments: number;
  total_revenue: number;
  average_shipment_value: number;

  top_product_categories?: any;
  courier_performance?: any;

  created_at: string;
  updated_at: string;
}

export interface CourierZonePerformance {
  id: string;
  courier_id: string;

  zip_code?: string;
  province?: string;
  region?: string;
  zone_code?: string;

  total_deliveries: number;
  successful_deliveries: number;
  success_rate: number;
  average_delivery_days: number;
  on_time_deliveries: number;
  on_time_rate: number;

  quality_score: number;

  period_start: string;
  period_end: string;

  updated_at: string;
}

export interface SocialInsight {
  id: string;
  platform: string;

  metric_type: string;
  metric_value: number;

  product_category?: string;
  geographic_zone?: string;

  period_start?: string;
  period_end?: string;

  raw_data?: any;

  collected_at: string;
  created_at: string;
}

export interface FulfillmentRule {
  id: string;
  name: string;
  description?: string;

  priority: number;

  conditions?: any;

  action_type: string;
  action_params?: any;

  cost_weight: number;
  time_weight: number;
  quality_weight: number;
  margin_weight: number;

  active: boolean;

  created_at: string;
  updated_at: string;
}
