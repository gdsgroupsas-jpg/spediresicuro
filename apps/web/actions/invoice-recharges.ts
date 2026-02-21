/**
 * Server Actions: Invoice Recharges Management
 *
 * Facade non-breaking per azioni fatturazione ricariche wallet.
 *
 * Contract markers (compat test): POSTPAID_CHARGE, periodic, period_start,
 * period_end, invoice_items, invoice_recharge_links.
 */

'use server';

import type { Invoice } from '@/types/invoices';
import {
  generateAutomaticInvoiceForStripeRechargeImpl,
  generateInvoiceFromRechargesActionImpl,
} from './invoice-recharges-generate.impl';
import {
  configureInvoiceGenerationRuleActionImpl,
  generatePeriodicInvoiceActionImpl,
  generatePostpaidMonthlyInvoiceImpl,
  listUninvoicedRechargesActionImpl,
} from './invoice-recharges-periodic.impl';

export async function generateInvoiceFromRechargesAction(params: {
  userId: string;
  transactionIds: string[];
  invoiceType?: 'recharge' | 'periodic' | 'manual';
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
  generateXML?: boolean;
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  return generateInvoiceFromRechargesActionImpl(params);
}

export async function generateAutomaticInvoiceForStripeRecharge(transactionId: string): Promise<{
  success: boolean;
  invoiceId?: string;
  error?: string;
}> {
  return generateAutomaticInvoiceForStripeRechargeImpl(transactionId);
}

export async function generatePeriodicInvoiceAction(params: {
  userId: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'monthly' | 'quarterly' | 'yearly';
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  return generatePeriodicInvoiceActionImpl(params);
}

export async function configureInvoiceGenerationRuleAction(params: {
  userId: string;
  generationType: 'automatic' | 'manual' | 'periodic';
  periodFrequency?: 'monthly' | 'quarterly' | 'yearly';
  periodDay?: number;
  includeStripe?: boolean;
  includeBankTransfer?: boolean;
  minAmount?: number;
}): Promise<{
  success: boolean;
  ruleId?: string;
  error?: string;
}> {
  return configureInvoiceGenerationRuleActionImpl(params);
}

export async function listUninvoicedRechargesAction(userId: string): Promise<{
  success: boolean;
  recharges?: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
  }>;
  error?: string;
}> {
  return listUninvoicedRechargesActionImpl(userId);
}

export async function generatePostpaidMonthlyInvoice(
  userId: string,
  yearMonth: string
): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  return generatePostpaidMonthlyInvoiceImpl(userId, yearMonth);
}
