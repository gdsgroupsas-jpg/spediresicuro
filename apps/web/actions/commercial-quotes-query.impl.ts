import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { computeAnalytics } from '@/lib/commercial-quotes/analytics';
import type {
  CommercialQuote,
  CommercialQuoteEventType,
  CommercialQuoteStatus,
  NegotiationTimelineEntry,
  QuoteAnalyticsData,
  QuotePipelineStats,
} from '@/types/commercial-quotes';
import {
  collectAccessiblePriceListIds,
  EVENT_LABELS,
  formatCarrierDisplayName,
  queryAccessiblePriceLists,
  type ActionResult,
} from './commercial-quotes.helpers';

/**
 * Lista preventivi del workspace con filtri opzionali.
 */
export async function getCommercialQuotesActionImpl(filters?: {
  status?: CommercialQuoteStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ quotes: CommercialQuote[]; total: number }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const { data: allQuotes, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('revision', { ascending: false });

    if (error) {
      return { success: false, error: `Errore caricamento preventivi: ${error.message}` };
    }

    const all = (allQuotes || []) as CommercialQuote[];

    const latestByRoot = new Map<string, CommercialQuote>();
    for (const quote of all) {
      const rootId = quote.parent_quote_id || quote.id;
      const existing = latestByRoot.get(rootId);
      if (!existing || quote.revision > existing.revision) {
        latestByRoot.set(rootId, quote);
      }
    }

    let enrichedQuotes = Array.from(latestByRoot.values());

    if (filters?.status) {
      enrichedQuotes = enrichedQuotes.filter((quote) => quote.status === filters.status);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      enrichedQuotes = enrichedQuotes.filter(
        (quote) =>
          quote.prospect_company?.toLowerCase().includes(searchLower) ||
          quote.prospect_email?.toLowerCase().includes(searchLower) ||
          quote.prospect_contact_name?.toLowerCase().includes(searchLower)
      );
    }

    enrichedQuotes.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const total = enrichedQuotes.length;
    const paginatedQuotes = enrichedQuotes.slice(offset, offset + limit);

    return {
      success: true,
      data: { quotes: paginatedQuotes, total },
    };
  } catch (error: any) {
    console.error('Errore getCommercialQuotesAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Dettaglio singolo preventivo con catena revisioni.
 */
export async function getCommercialQuoteByIdActionImpl(
  quoteId: string
): Promise<ActionResult<{ quote: CommercialQuote; revisions: CommercialQuote[] }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    const rootId = quote.parent_quote_id || quote.id;

    const { data: allRevisions } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
      .eq('workspace_id', workspaceId)
      .order('revision', { ascending: true });

    return {
      success: true,
      data: {
        quote: quote as CommercialQuote,
        revisions: (allRevisions as CommercialQuote[]) || [],
      },
    };
  } catch (error: any) {
    console.error('Errore getCommercialQuoteByIdAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Statistiche pipeline preventivi.
 */
export async function getQuotePipelineStatsActionImpl(): Promise<ActionResult<QuotePipelineStats>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quotes, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('status')
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: `Errore statistiche: ${error.message}` };
    }

    const stats: QuotePipelineStats = {
      draft: 0,
      sent: 0,
      negotiating: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      total: quotes?.length || 0,
      conversion_rate: 0,
    };

    for (const quote of quotes || []) {
      const status = quote.status as CommercialQuoteStatus;
      if (status in stats) {
        (stats as any)[status]++;
      }
    }

    const closedDeals = stats.accepted + stats.rejected;
    stats.conversion_rate = closedDeals > 0 ? stats.accepted / closedDeals : 0;

    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Errore getQuotePipelineStatsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Calcola analytics completi per i preventivi commerciali del workspace.
 * KPI, funnel, margini, performance corriere/settore, timeline.
 */
export async function getQuoteAnalyticsActionImpl(): Promise<ActionResult<QuoteAnalyticsData>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quotes, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore query analytics:', error);
      return { success: false, error: error.message };
    }

    const analytics = computeAnalytics((quotes || []) as CommercialQuote[]);
    return { success: true, data: analytics };
  } catch (error: any) {
    console.error('Errore getQuoteAnalyticsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Carica la timeline negoziazione completa per un preventivo.
 * Include eventi di tutta la catena revisioni (root + figli).
 */
export async function getQuoteNegotiationTimelineActionImpl(
  quoteId: string
): Promise<ActionResult<NegotiationTimelineEntry[]>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, parent_quote_id, workspace_id')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    const rootId = quote.parent_quote_id || quote.id;

    const { data: chainQuotes } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id')
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

    const chainIds = (chainQuotes || []).map((chainQuote) => chainQuote.id);

    const { data: events, error: eventsError } = await supabaseAdmin
      .from('commercial_quote_events')
      .select('id, quote_id, event_type, event_data, actor_id, created_at')
      .in('quote_id', chainIds)
      .order('created_at', { ascending: true });

    if (eventsError) {
      return { success: false, error: eventsError.message };
    }

    const actorIds = [...new Set((events || []).map((event) => event.actor_id).filter(Boolean))];
    const actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .in('id', actorIds);

      for (const user of users || []) {
        actorMap.set(user.id, user.full_name || user.email || 'Utente');
      }
    }

    const timeline: NegotiationTimelineEntry[] = (events || []).map((event) => ({
      id: event.id,
      event_type: event.event_type as CommercialQuoteEventType,
      event_label: EVENT_LABELS[event.event_type as CommercialQuoteEventType] || event.event_type,
      event_data: event.event_data,
      actor_name: event.actor_id ? actorMap.get(event.actor_id) || null : null,
      created_at: event.created_at,
      notes: event.event_data?.notes || event.event_data?.revision_notes || null,
    }));

    return { success: true, data: timeline };
  } catch (error: any) {
    console.error('Errore getQuoteNegotiationTimelineAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Restituisce i corrieri disponibili per il preventivatore commerciale.
 * Basato sui price_lists attivi accessibili dal reseller (3 fonti di assegnazione).
 * Ogni listino attivo = un corriere selezionabile.
 */
export async function getAvailableCarriersForQuotesActionImpl(): Promise<
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
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;
    const userId = wsAuth.target.id;

    const accessiblePlIds = await collectAccessiblePriceListIds(workspaceId, userId);

    const priceLists = await queryAccessiblePriceLists(
      workspaceId,
      accessiblePlIds,
      'id, name, metadata, source_metadata, courier_id'
    );

    if (!priceLists || priceLists.length === 0) {
      return { success: true, data: [] };
    }

    const carriers: Array<{
      contractCode: string;
      carrierCode: string;
      courierName: string;
      priceListId: string;
      doesClientPickup: boolean;
    }> = [];

    const contractCodes: string[] = [];

    for (const priceList of priceLists) {
      const metadata = (priceList.metadata || {}) as Record<string, unknown>;
      const sourceMeta = ((priceList as Record<string, unknown>).source_metadata || {}) as Record<
        string,
        unknown
      >;

      const contractCode =
        (metadata.contract_code as string) ||
        (sourceMeta.contract_code as string) ||
        (priceList.id as string);

      const carrierCode =
        (metadata.carrier_code as string) || (sourceMeta.carrier_code as string) || contractCode;

      const priceListName = (priceList as Record<string, unknown>).name as string;
      const courierName = formatCarrierDisplayName(carrierCode) || priceListName;

      carriers.push({
        contractCode,
        carrierCode,
        courierName,
        priceListId: priceList.id as string,
        doesClientPickup: false,
      });

      if (contractCode !== priceList.id) {
        contractCodes.push(contractCode);
      }
    }

    if (contractCodes.length > 0) {
      const { data: configs } = await supabaseAdmin
        .from('supplier_price_list_config')
        .select('contract_code, does_client_pickup')
        .in('contract_code', contractCodes);

      if (configs && configs.length > 0) {
        const pickupMap = new Map<string, boolean>();
        for (const config of configs) {
          if (config.contract_code) {
            pickupMap.set(config.contract_code, config.does_client_pickup ?? false);
          }
        }
        for (const carrier of carriers) {
          if (pickupMap.has(carrier.contractCode)) {
            carrier.doesClientPickup = pickupMap.get(carrier.contractCode)!;
          }
        }
      }
    }

    return { success: true, data: carriers };
  } catch (error: any) {
    console.error('Errore getAvailableCarriersForQuotesAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Carica i servizi accessori configurati per un listino specifico.
 * Query supplier_price_list_config per accessory_services_config.
 */
export async function getAccessoryServicesActionImpl(
  priceListId: string
): Promise<ActionResult<Array<{ service: string; price: number; percent: number }>>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const { data, error } = await supabaseAdmin
      .from('supplier_price_list_config')
      .select('accessory_services_config')
      .eq('price_list_id', priceListId)
      .maybeSingle();

    if (error) {
      console.error('Errore getAccessoryServicesAction:', error);
      return { success: false, error: 'Errore caricamento servizi' };
    }

    if (!data?.accessory_services_config) {
      return { success: true, data: [] };
    }

    const services = (
      data.accessory_services_config as Array<{
        service: string;
        price: number;
        percent: number;
      }>
    ).map((service) => ({
      service: service.service,
      price: service.price ?? 0,
      percent: service.percent ?? 0,
    }));

    return { success: true, data: services };
  } catch (error: any) {
    console.error('Errore getAccessoryServicesAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
