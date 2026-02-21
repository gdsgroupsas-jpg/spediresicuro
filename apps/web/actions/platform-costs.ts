/**
 * Server Actions: Platform Costs Management
 *
 * Azioni per gestione costi piattaforma - Solo SuperAdmin
 *
 * @module actions/platform-costs
 * @since Sprint 1 - Financial Tracking
 */

'use server';

import {
  exportFinancialCSVActionImpl,
  getMarginByCourierActionImpl,
  getMarginByProviderActionImpl,
  getTopResellersActionImpl,
} from './platform-costs-analytics.impl';
import {
  getDailyPnLActionImpl,
  getMarginAlertsActionImpl,
  getMonthlyPnLActionImpl,
  getPlatformStatsActionImpl,
  getReconciliationPendingActionImpl,
  getResellerUsageActionImpl,
  updateReconciliationStatusActionImpl,
} from './platform-costs-dashboard.impl';
import type {
  CourierMarginData,
  MarginAlert,
  PlatformDailyPnL,
  PlatformMonthlyPnL,
  PlatformStatsData,
  ProviderMarginData,
  ReconciliationPending,
  ResellerPlatformUsage,
  TopResellerData,
} from './platform-costs.types';

export type {
  CourierMarginData,
  MarginAlert,
  PlatformDailyPnL,
  PlatformMonthlyPnL,
  PlatformStatsData,
  ProviderMarginData,
  ReconciliationPending,
  ResellerPlatformUsage,
  TopResellerData,
};

export async function getDailyPnLAction(days: number = 30): Promise<{
  success: boolean;
  data?: PlatformDailyPnL[];
  error?: string;
}> {
  return getDailyPnLActionImpl(days);
}

export async function getMonthlyPnLAction(months: number = 12): Promise<{
  success: boolean;
  data?: PlatformMonthlyPnL[];
  error?: string;
}> {
  return getMonthlyPnLActionImpl(months);
}

export async function getResellerUsageAction(month?: string): Promise<{
  success: boolean;
  data?: ResellerPlatformUsage[];
  error?: string;
}> {
  return getResellerUsageActionImpl(month);
}

export async function getMarginAlertsAction(): Promise<{
  success: boolean;
  data?: MarginAlert[];
  error?: string;
}> {
  return getMarginAlertsActionImpl();
}

export async function getReconciliationPendingAction(): Promise<{
  success: boolean;
  data?: ReconciliationPending[];
  error?: string;
}> {
  return getReconciliationPendingActionImpl();
}

export async function updateReconciliationStatusAction(
  costId: string,
  status: 'matched' | 'discrepancy' | 'resolved',
  notes?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  return updateReconciliationStatusActionImpl(costId, status, notes);
}

export async function getPlatformStatsAction(): Promise<{
  success: boolean;
  data?: PlatformStatsData;
  error?: string;
}> {
  return getPlatformStatsActionImpl();
}

export async function getMarginByCourierAction(startDate?: string): Promise<{
  success: boolean;
  data?: CourierMarginData[];
  error?: string;
}> {
  return getMarginByCourierActionImpl(startDate);
}

export async function getTopResellersAction(
  limit: number = 20,
  startDate?: string
): Promise<{
  success: boolean;
  data?: TopResellerData[];
  error?: string;
}> {
  return getTopResellersActionImpl(limit, startDate);
}

export async function getMarginByProviderAction(startDate?: string): Promise<{
  success: boolean;
  data?: ProviderMarginData[];
  error?: string;
}> {
  return getMarginByProviderActionImpl(startDate);
}

export async function exportFinancialCSVAction(startDate?: string): Promise<{
  success: boolean;
  csv?: string;
  error?: string;
}> {
  return exportFinancialCSVActionImpl(startDate);
}
