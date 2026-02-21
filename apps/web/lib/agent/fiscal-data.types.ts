/**
 * Type definitions for Fiscal Data Module
 * Ensures type safety across fiscal control features
 */

import type { AccountType } from '@/lib/safe-auth';

/** @deprecated Usare AccountType da @/lib/safe-auth */
export type UserRole = AccountType;

/**
 * Motivo per cui il margine non e calcolabile
 * @see lib/financial/margin-calculator.ts
 */
export type MarginUnavailableReason =
  | 'MISSING_COST_DATA'
  | 'NOT_APPLICABLE_FOR_MODEL'
  | 'MISSING_FINAL_PRICE';

export interface Shipment {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  courier_cost: number | null; // null se costo non disponibile
  margin: number | null; // null se non calcolabile
  margin_reason: MarginUnavailableReason | null; // motivo se margin=null
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
  total_margin: number | null; // null se nessuna spedizione con margine calcolabile
  total_revenue: number;
  margin_calculable_count: number; // spedizioni con margine calcolato
  margin_excluded_count: number; // spedizioni escluse dal calcolo
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
