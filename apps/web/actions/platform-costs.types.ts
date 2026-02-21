export interface PlatformDailyPnL {
  date: string;
  courier_code: string;
  shipments_count: number;
  total_billed: number;
  total_provider_cost: number;
  total_margin: number;
  avg_margin_percent: number;
  negative_margin_count: number;
  discrepancy_count: number;
}

export interface PlatformMonthlyPnL {
  month: string;
  total_shipments: number;
  unique_users: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  margin_percent_of_revenue: number;
  negative_margin_count: number;
}

export interface ResellerPlatformUsage {
  month: string;
  billed_user_id: string;
  user_email: string;
  user_name: string | null;
  user_type: string;
  shipments_count: number;
  total_spent: number;
  margin_generated: number;
  avg_margin_percent: number;
}

export interface MarginAlert {
  id: string;
  shipment_id: string;
  shipment_tracking_number: string;
  created_at: string;
  user_email: string;
  courier_code: string;
  billed_amount: number;
  provider_cost: number;
  platform_margin: number;
  platform_margin_percent: number;
  alert_type: string;
  reconciliation_status: string;
}

export interface ReconciliationPending {
  id: string;
  shipment_id: string;
  shipment_tracking_number: string;
  created_at: string;
  courier_code: string;
  billed_amount: number;
  provider_cost: number;
  platform_margin: number;
  reconciliation_status: string;
  age_days: number;
  user_email: string;
}

export interface PlatformStatsData {
  totalShipments: number;
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  avgMarginPercent: number;
  pendingReconciliation: number;
  negativeMarginCount: number;
  last30DaysShipments: number;
}

export interface CourierMarginData {
  courier_code: string;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}

export interface TopResellerData {
  user_id: string;
  user_email: string;
  user_name: string | null;
  total_shipments: number;
  total_billed: number;
  margin_generated: number;
}

export interface ProviderMarginData {
  config_id: string;
  provider_name: string;
  owner_label: string;
  is_platform: boolean;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}
