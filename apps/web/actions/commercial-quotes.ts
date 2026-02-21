'use server';

/**
 * Server Actions: Preventivatore Commerciale
 *
 * Facade compatibile per azioni commercial quotes.
 * Implementazioni granulari in file *.impl.ts.
 *
 * @module actions/commercial-quotes
 */

import type {
  CommercialQuote,
  CommercialQuoteStatus,
  ConvertQuoteInput,
  CreateCommercialQuoteInput,
  CreateRevisionInput,
  DeliveryMode,
  NegotiationTimelineEntry,
  PriceMatrixSnapshot,
  QuoteAnalyticsData,
  QuotePipelineStats,
  RenewExpiredQuoteInput,
} from '@/types/commercial-quotes';
import type { ActionResult } from './commercial-quotes.helpers';
import {
  createCommercialQuoteActionImpl,
  previewPriceMatrixActionImpl,
} from './commercial-quotes-create.impl';
import {
  deleteCommercialQuoteDraftActionImpl,
  generateQuotePdfActionImpl,
  sendCommercialQuoteActionImpl,
  updateQuoteStatusActionImpl,
} from './commercial-quotes-lifecycle.impl';
import {
  convertQuoteToClientActionImpl,
  createRevisionActionImpl,
  renewExpiredQuoteActionImpl,
} from './commercial-quotes-conversion.impl';
import {
  getAccessoryServicesActionImpl,
  getAvailableCarriersForQuotesActionImpl,
  getCommercialQuoteByIdActionImpl,
  getCommercialQuotesActionImpl,
  getQuoteAnalyticsActionImpl,
  getQuoteNegotiationTimelineActionImpl,
  getQuotePipelineStatsActionImpl,
} from './commercial-quotes-query.impl';

export async function createCommercialQuoteAction(
  input: CreateCommercialQuoteInput
): Promise<ActionResult<CommercialQuote>> {
  return createCommercialQuoteActionImpl(input);
}

export async function previewPriceMatrixAction(params: {
  priceListId: string;
  marginPercent: number;
  marginFixedEur?: number;
  carrierCode: string;
  vatMode?: 'included' | 'excluded';
  deliveryMode?: DeliveryMode;
  pickupFee?: number | null;
  goodsNeedsProcessing?: boolean;
  processingFee?: number | null;
}): Promise<ActionResult<PriceMatrixSnapshot>> {
  return previewPriceMatrixActionImpl(params);
}

export async function getCommercialQuotesAction(filters?: {
  status?: CommercialQuoteStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ quotes: CommercialQuote[]; total: number }>> {
  return getCommercialQuotesActionImpl(filters);
}

export async function getCommercialQuoteByIdAction(
  quoteId: string
): Promise<ActionResult<{ quote: CommercialQuote; revisions: CommercialQuote[] }>> {
  return getCommercialQuoteByIdActionImpl(quoteId);
}

export async function getQuotePipelineStatsAction(): Promise<ActionResult<QuotePipelineStats>> {
  return getQuotePipelineStatsActionImpl();
}

export async function sendCommercialQuoteAction(
  quoteId: string
): Promise<ActionResult<{ pdfUrl: string }>> {
  return sendCommercialQuoteActionImpl(quoteId);
}

export async function updateQuoteStatusAction(
  quoteId: string,
  newStatus: CommercialQuoteStatus,
  notes?: string
): Promise<ActionResult> {
  return updateQuoteStatusActionImpl(quoteId, newStatus, notes);
}

export async function createRevisionAction(
  input: CreateRevisionInput
): Promise<ActionResult<CommercialQuote>> {
  return createRevisionActionImpl(input);
}

export async function convertQuoteToClientAction(
  input: ConvertQuoteInput
): Promise<ActionResult<{ userId: string; priceListId: string }>> {
  return convertQuoteToClientActionImpl(input);
}

export async function deleteCommercialQuoteDraftAction(quoteId: string): Promise<ActionResult> {
  return deleteCommercialQuoteDraftActionImpl(quoteId);
}

export async function generateQuotePdfAction(
  quoteId: string
): Promise<ActionResult<{ pdfBase64: string }>> {
  return generateQuotePdfActionImpl(quoteId);
}

export async function getQuoteAnalyticsAction(): Promise<ActionResult<QuoteAnalyticsData>> {
  return getQuoteAnalyticsActionImpl();
}

export async function getQuoteNegotiationTimelineAction(
  quoteId: string
): Promise<ActionResult<NegotiationTimelineEntry[]>> {
  return getQuoteNegotiationTimelineActionImpl(quoteId);
}

export async function renewExpiredQuoteAction(
  input: RenewExpiredQuoteInput
): Promise<ActionResult<CommercialQuote>> {
  return renewExpiredQuoteActionImpl(input);
}

export async function getAvailableCarriersForQuotesAction(): Promise<
  ActionResult<
    Array<{
      contractCode: string;
      carrierCode: string;
      courierName: string;
      priceListId: string;
      doesClientPickup: boolean;
    }>
  >
> {
  return getAvailableCarriersForQuotesActionImpl();
}

export async function getAccessoryServicesAction(
  priceListId: string
): Promise<ActionResult<Array<{ service: string; price: number; percent: number }>>> {
  return getAccessoryServicesActionImpl(priceListId);
}
