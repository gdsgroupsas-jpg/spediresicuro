/**
 * Type definitions for Fiscal Data Module
 * Ensures type safety across fiscal control features
 */

export type UserRole = 'user' | 'admin' | 'reseller' | 'superadmin';

export interface Shipment {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  courier_cost: number;
  margin: number;
  cash_on_delivery: boolean | number;
  cod_status: 'pending' | 'collected' | 'paid' | null;
  user_id: string;
}

export interface CODShipment {
  id: string;
  created_at: string;
  cash_on_delivery: number;
  cod_status: 'pending' | 'collected' | 'paid';
  user_id: string;
}

export interface FiscalDeadline {
  date: string; // ISO date string YYYY-MM-DD
  description: string;
  type: 'F24' | 'LIPE' | 'Dichiarazione' | 'Imposte';
}

export interface ShipmentsSummary {
  count: number;
  total_margin: number;
  total_revenue: number;
}

export interface WalletInfo {
  balance: number;
}

export interface DatePeriod {
  start: string; // ISO date string
  end: string; // ISO date string
}

export interface FiscalContext {
  userId: string;
  role: UserRole;
  period: DatePeriod;
  wallet: WalletInfo;
  shipmentsSummary: ShipmentsSummary;
  pending_cod_count: number;
  pending_cod_value: number;
  deadlines: FiscalDeadline[];
}

export interface FiscalDataError extends Error {
  code: 'DATABASE_ERROR' | 'AUTH_ERROR' | 'VALIDATION_ERROR';
  context?: Record<string, any>;
}
