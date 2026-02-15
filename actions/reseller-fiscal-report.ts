'use server';

/**
 * Server Actions: Reseller Fiscal Report
 *
 * Genera report fiscali per reseller con dati pronti per fatturazione ai sub-user.
 *
 * @module actions/reseller-fiscal-report
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { computeMargin } from '@/lib/financial';
import type {
  FiscalReportFilters,
  FiscalReportResult,
  MonthlyFiscalSummary,
  ClientFiscalSummary,
  FiscalShipmentLine,
  FiscalEntity,
  MarginUnavailableReason,
  ResellerProviderMarginData,
} from '@/types/reseller-fiscal';

// Nomi mesi in italiano
const MONTH_NAMES = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/**
 * Formatta il label del mese (es. "Gennaio 2026")
 */
function formatMonthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Mappa un utente DB a FiscalEntity
 */
function mapToFiscalEntity(user: any): FiscalEntity {
  return {
    id: user.id,
    name: user.name || user.email?.split('@')[0] || 'N/D',
    email: user.email,
    company_name: user.company_name,
    vat_number: user.vat_number,
    fiscal_code: user.fiscal_code,
    address: user.address,
    city: user.city,
    province: user.province,
    zip: user.zip,
    country: user.country || 'IT',
  };
}

/**
 * Calcola i valori fiscali da una spedizione
 *
 * PRINCIPIO: Il margine esiste SOLO se esistono dati reali.
 * - MAI calcolo inverso (base_price = final_price / (1 + margin_percent/100))
 * - MAI usare percentuali hardcoded
 * - Se costo mancante -> margin = null con reason
 *
 * @see lib/financial/margin-calculator.ts
 */
function calculateFiscalValues(
  shipment: any,
  providerCost?: number
): {
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  margin_amount: number | null;
  margin_percent: number | null;
  margin_reason: MarginUnavailableReason | null;
  base_price: number | null;
  final_price: number;
} {
  const vat_rate = shipment.vat_rate || 22;

  // Prezzo vendita: usa final_price se disponibile, altrimenti total_cost
  const final_price = parseFloat(shipment.final_price) || parseFloat(shipment.total_cost) || 0;

  // Costo fornitore: SOLO da dati reali (provider_cost o base_price salvato)
  // ⚠️ RIMOSSO: calcolo inverso da margin_percent
  const basePrice = parseFloat(shipment.base_price) || null;

  // Usa computeMargin per calcolo strict
  const marginResult = computeMargin({
    finalPrice: final_price,
    providerCost: providerCost ?? null,
    basePrice: basePrice,
    apiSource: shipment.api_source || 'platform',
  });

  // Calcola netto e IVA (assumendo prezzi IVA inclusa)
  const gross_amount = final_price;
  const net_amount = final_price / (1 + vat_rate / 100);
  const vat_amount = final_price - net_amount;

  // Converti reason a tipo compatibile
  let margin_reason: MarginUnavailableReason | null = null;
  if (!marginResult.isCalculable && marginResult.reason) {
    if (
      marginResult.reason === 'MISSING_COST_DATA' ||
      marginResult.reason === 'NOT_APPLICABLE_FOR_MODEL' ||
      marginResult.reason === 'MISSING_FINAL_PRICE'
    ) {
      margin_reason = marginResult.reason;
    }
  }

  return {
    net_amount: Math.round(net_amount * 100) / 100,
    vat_amount: Math.round(vat_amount * 100) / 100,
    gross_amount: Math.round(gross_amount * 100) / 100,
    margin_amount: marginResult.margin,
    margin_percent: marginResult.marginPercent,
    margin_reason,
    base_price:
      marginResult.costSource === 'provider_cost'
        ? (providerCost ?? null)
        : marginResult.costSource === 'base_price'
          ? basePrice
          : null,
    final_price: Math.round(final_price * 100) / 100,
  };
}

/**
 * Mappa una spedizione DB a FiscalShipmentLine
 * @param shipment - Dati spedizione da DB
 * @param providerCostMap - Mappa shipment_id -> provider_cost da platform_provider_costs
 */
function mapToShipmentLine(
  shipment: any,
  providerCostMap: Map<string, number>
): FiscalShipmentLine {
  const providerCost = providerCostMap.get(shipment.id);
  const fiscal = calculateFiscalValues(shipment, providerCost);

  return {
    shipment_id: shipment.id,
    tracking_number: shipment.tracking_number || 'N/D',
    date: shipment.created_at,
    base_price: fiscal.base_price,
    final_price: fiscal.final_price,
    margin_amount: fiscal.margin_amount,
    margin_percent: fiscal.margin_percent,
    margin_reason: fiscal.margin_reason,
    vat_rate: shipment.vat_rate || 22,
    net_amount: fiscal.net_amount,
    vat_amount: fiscal.vat_amount,
    gross_amount: fiscal.gross_amount,
    recipient_name: shipment.recipient_name || 'N/D',
    recipient_city: shipment.recipient_city || 'N/D',
    courier_name: shipment.courier?.name || shipment.carrier || 'N/D',
    service_type: shipment.service_type || 'standard',
  };
}

/**
 * Aggrega le spedizioni per cliente
 * @param clients - Lista clienti
 * @param shipments - Lista spedizioni
 * @param providerCostMap - Mappa shipment_id -> provider_cost
 */
function aggregateByClient(
  clients: any[],
  shipments: any[],
  providerCostMap: Map<string, number>
): ClientFiscalSummary[] {
  // Mappa spedizioni per user_id
  const shipmentsByUser = new Map<string, any[]>();
  for (const shipment of shipments) {
    const userId = shipment.user_id;
    if (!shipmentsByUser.has(userId)) {
      shipmentsByUser.set(userId, []);
    }
    shipmentsByUser.get(userId)!.push(shipment);
  }

  // Costruisci summary per ogni cliente
  return clients
    .map((client) => {
      const clientShipments = shipmentsByUser.get(client.id) || [];
      const shipmentLines = clientShipments.map((s) => mapToShipmentLine(s, providerCostMap));

      // Calcola totali (sempre calcolabili)
      const total_gross = shipmentLines.reduce((sum, s) => sum + s.gross_amount, 0);
      const total_net = shipmentLines.reduce((sum, s) => sum + s.net_amount, 0);
      const total_vat = shipmentLines.reduce((sum, s) => sum + s.vat_amount, 0);

      // Calcola margini SOLO per spedizioni con margine calcolabile
      // ⚠️ NUOVO: NON sommare 0 per spedizioni senza costo
      const shipmentsWithMargin = shipmentLines.filter((s) => s.margin_amount !== null);
      const shipmentsExcluded = shipmentLines.filter((s) => s.margin_amount === null);

      const margin_calculable_count = shipmentsWithMargin.length;
      const margin_excluded_count = shipmentsExcluded.length;

      // Margine totale (null se nessuna spedizione calcolabile)
      let total_margin: number | null = null;
      let avg_margin_percent: number | null = null;

      if (margin_calculable_count > 0) {
        total_margin = shipmentsWithMargin.reduce((sum, s) => sum + (s.margin_amount ?? 0), 0);

        // Calcola margine medio usando solo spedizioni con base_price
        const totalBasePrices = shipmentsWithMargin.reduce(
          (sum, s) => sum + (s.base_price ?? 0),
          0
        );
        avg_margin_percent = totalBasePrices > 0 ? (total_margin / totalBasePrices) * 100 : null;
      }

      return {
        client: mapToFiscalEntity(client),
        shipments_count: shipmentLines.length,
        total_gross: Math.round(total_gross * 100) / 100,
        total_net: Math.round(total_net * 100) / 100,
        total_vat: Math.round(total_vat * 100) / 100,
        total_margin: total_margin !== null ? Math.round(total_margin * 100) / 100 : null,
        avg_margin_percent:
          avg_margin_percent !== null ? Math.round(avg_margin_percent * 100) / 100 : null,
        margin_calculable_count,
        margin_excluded_count,
        shipments: shipmentLines,
      };
    })
    .filter((c) => c.shipments_count > 0); // Escludi clienti senza spedizioni nel periodo
}

/**
 * Costruisce un summary vuoto
 */
function buildEmptySummary(reseller: any, filters: FiscalReportFilters): MonthlyFiscalSummary {
  const startDate = new Date(filters.year, filters.month - 1, 1);
  const endDate = new Date(filters.year, filters.month, 0);

  return {
    period: {
      month: filters.month,
      year: filters.year,
      label: formatMonthLabel(filters.month, filters.year),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    },
    reseller: mapToFiscalEntity(reseller),
    total_shipments: 0,
    total_gross: 0,
    total_net: 0,
    total_vat: 0,
    total_margin: null,
    avg_margin_percent: null,
    margin_calculable_count: 0,
    margin_excluded_count: 0,
    clients: [],
  };
}

/**
 * Ottiene il report fiscale mensile per un reseller
 */
export async function getResellerFiscalReport(
  filters: FiscalReportFilters
): Promise<FiscalReportResult> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    console.log('[FISCAL_REPORT] Auth context:', {
      actorId: context.actor.id,
      actorEmail: context.actor.email,
      targetId: context.target?.id,
      targetEmail: context.target?.email,
      isImpersonating: context.isImpersonating,
    });

    // 1. Verifica utente e ruolo reseller
    // Usa l'ID invece dell'email per query più affidabile (evita problemi di encoding/case)
    // Nota: Usa * per evitare errori se alcune colonne non esistono nel DB
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', context.actor.id)
      .single();

    if (userError) {
      console.error('[FISCAL_REPORT] User query error:', userError);
      return { success: false, error: `Errore DB: ${userError.message}` };
    }

    if (!currentUser) {
      console.error('[FISCAL_REPORT] User not found for ID:', context.actor.id);
      return { success: false, error: 'Utente non trovato' };
    }

    console.log('[FISCAL_REPORT] Current user:', {
      id: currentUser.id,
      email: currentUser.email,
      is_reseller: currentUser.is_reseller,
      account_type: currentUser.account_type,
    });

    if (!currentUser.is_reseller && currentUser.account_type !== 'superadmin') {
      return { success: false, error: 'Non sei un reseller' };
    }

    // 2. Calcola date periodo
    const startDate = new Date(filters.year, filters.month - 1, 1);
    const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);

    // 3. Ottieni sub-users (clienti del reseller)
    // Nota: Usa * per evitare errori se alcune colonne non esistono nel DB
    let clientsQuery = supabaseAdmin.from('users').select('*').eq('parent_id', currentUser.id);

    if (filters.client_id) {
      clientsQuery = clientsQuery.eq('id', filters.client_id);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('Errore query clienti:', clientsError);
      return { success: false, error: 'Errore recupero clienti' };
    }

    if (!clients || clients.length === 0) {
      return {
        success: true,
        data: buildEmptySummary(currentUser, filters),
      };
    }

    const clientIds = clients.map((c) => c.id);

    // 4. Query spedizioni nel periodo per tutti i clienti
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select(
        `
        id,
        tracking_number,
        created_at,
        user_id,
        base_price,
        final_price,
        margin_percent,
        vat_rate,
        total_cost,
        carrier,
        recipient_name,
        recipient_city,
        service_type,
        courier:couriers(name)
      `
      )
      .in('user_id', clientIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (shipmentsError) {
      console.error('Errore query spedizioni:', shipmentsError);
      return { success: false, error: 'Errore recupero spedizioni' };
    }

    // 4b. Recupera costi fornitore da platform_provider_costs
    // Questo ci dà il costo reale pagato dalla piattaforma al corriere
    const shipmentIds = (shipments || []).map((s) => s.id);
    let providerCostMap = new Map<string, number>();

    if (shipmentIds.length > 0) {
      const { data: providerCosts, error: providerCostsError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('shipment_id, provider_cost')
        .in('shipment_id', shipmentIds);

      if (!providerCostsError && providerCosts) {
        for (const pc of providerCosts) {
          if (pc.shipment_id && pc.provider_cost != null) {
            providerCostMap.set(pc.shipment_id, parseFloat(pc.provider_cost));
          }
        }
      }
    }

    // 5. Aggrega dati per cliente
    const clientSummaries = aggregateByClient(clients, shipments || [], providerCostMap);

    // 6. Calcola totali
    const total_gross = clientSummaries.reduce((sum, c) => sum + c.total_gross, 0);
    const total_net = clientSummaries.reduce((sum, c) => sum + c.total_net, 0);
    const total_vat = clientSummaries.reduce((sum, c) => sum + c.total_vat, 0);
    const total_shipments = clientSummaries.reduce((sum, c) => sum + c.shipments_count, 0);

    // Calcola contatori margini
    const margin_calculable_count = clientSummaries.reduce(
      (sum, c) => sum + c.margin_calculable_count,
      0
    );
    const margin_excluded_count = clientSummaries.reduce(
      (sum, c) => sum + c.margin_excluded_count,
      0
    );

    // Calcola margine totale SOLO da spedizioni calcolabili
    // ⚠️ NUOVO: NON sommare 0 per spedizioni senza costo
    let total_margin: number | null = null;
    let avg_margin_percent: number | null = null;

    if (margin_calculable_count > 0) {
      // Somma margini solo dai clienti che hanno margini calcolabili
      total_margin = clientSummaries.reduce((sum, c) => sum + (c.total_margin ?? 0), 0);

      // Calcola margine medio pesato usando solo spedizioni con base_price
      const totalBasePrices = clientSummaries.reduce(
        (sum, c) =>
          sum +
          c.shipments
            .filter((s) => s.base_price !== null)
            .reduce((s, ship) => s + (ship.base_price ?? 0), 0),
        0
      );
      avg_margin_percent = totalBasePrices > 0 ? (total_margin / totalBasePrices) * 100 : null;
    }

    // 7. Costruisci risposta
    const summary: MonthlyFiscalSummary = {
      period: {
        month: filters.month,
        year: filters.year,
        label: formatMonthLabel(filters.month, filters.year),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      reseller: mapToFiscalEntity(currentUser),
      total_shipments,
      total_gross: Math.round(total_gross * 100) / 100,
      total_net: Math.round(total_net * 100) / 100,
      total_vat: Math.round(total_vat * 100) / 100,
      total_margin: total_margin !== null ? Math.round(total_margin * 100) / 100 : null,
      avg_margin_percent:
        avg_margin_percent !== null ? Math.round(avg_margin_percent * 100) / 100 : null,
      margin_calculable_count,
      margin_excluded_count,
      clients: clientSummaries,
    };

    return { success: true, data: summary };
  } catch (error: any) {
    console.error('Errore getResellerFiscalReport:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Margini aggregati per configurazione API (fornitore) - vista reseller
 * Mostra al reseller come si distribuiscono i margini tra le diverse courier_config
 * usate dai suoi clienti (sub-users).
 */
export async function getResellerMarginByProvider(
  filters: FiscalReportFilters
): Promise<{ success: boolean; data?: ResellerProviderMarginData[]; error?: string }> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', context.actor.id)
      .single();

    if (userError || !currentUser) {
      return { success: false, error: 'Utente non trovato' };
    }

    if (!currentUser.is_reseller && currentUser.account_type !== 'superadmin') {
      return { success: false, error: 'Non sei un reseller' };
    }

    // Sub-users del reseller + reseller stesso
    const { data: clients } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', currentUser.id);

    const clientIds = (clients || []).map((c: any) => c.id);
    // Includi anche le spedizioni dirette del reseller stesso
    clientIds.push(currentUser.id);
    // (Se non ci sono sub-users, comunque mostra le spedizioni del reseller)

    // Periodo
    const startDate = new Date(filters.year, filters.month - 1, 1);
    const endDate = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);

    // Query spedizioni dei clienti con courier_config_id
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .select(
        `
        courier_config_id,
        base_price,
        final_price,
        courier_configs(
          id,
          name,
          config_label,
          provider_id,
          carrier
        )
      `
      )
      .in('user_id', clientIds)
      .not('courier_config_id', 'is', null)
      .not('base_price', 'is', null)
      .not('final_price', 'is', null)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .neq('status', 'cancelled')
      .limit(50000);

    if (error) throw error;

    // Aggrega per courier_config_id
    const configMap = new Map<
      string,
      {
        provider_name: string;
        total_shipments: number;
        total_revenue: number;
        total_cost: number;
        gross_margin: number;
      }
    >();

    (data || []).forEach((row: any) => {
      const configId = row.courier_config_id;
      if (!configId) return;

      const configInfo = Array.isArray(row.courier_configs)
        ? row.courier_configs[0]
        : row.courier_configs;

      const displayName = configInfo?.config_label || configInfo?.name || null;
      const providerName = configInfo
        ? displayName ||
          `${(configInfo.provider_id || '').replaceAll('_', ' ')} (${configInfo.carrier || 'N/A'})`
        : configId.substring(0, 8);

      const existing = configMap.get(configId) || {
        provider_name: providerName,
        total_shipments: 0,
        total_revenue: 0,
        total_cost: 0,
        gross_margin: 0,
      };

      const revenue = row.final_price || 0;
      const cost = row.base_price || 0;

      configMap.set(configId, {
        provider_name: existing.provider_name,
        total_shipments: existing.total_shipments + 1,
        total_revenue: existing.total_revenue + revenue,
        total_cost: existing.total_cost + cost,
        gross_margin: existing.gross_margin + (revenue - cost),
      });
    });

    const result: ResellerProviderMarginData[] = Array.from(configMap.entries())
      .map(([config_id, stats]) => ({
        config_id,
        provider_name: stats.provider_name,
        total_shipments: stats.total_shipments,
        total_revenue: Math.round(stats.total_revenue * 100) / 100,
        total_cost: Math.round(stats.total_cost * 100) / 100,
        gross_margin: Math.round(stats.gross_margin * 100) / 100,
        avg_margin_percent:
          stats.total_cost > 0
            ? Math.round((stats.gross_margin / stats.total_cost) * 100 * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.gross_margin - a.gross_margin);

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[FISCAL_REPORT] getResellerMarginByProvider error:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
