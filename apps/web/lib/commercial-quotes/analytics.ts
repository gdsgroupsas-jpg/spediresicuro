/**
 * Analytics puro per preventivi commerciali.
 *
 * Funzione pura, zero dipendenze esterne — testabile con mock data.
 * Calcola KPI, funnel, margini, performance corriere/settore, timeline.
 */

import { PROSPECT_SECTORS } from '@/types/commercial-quotes';
import type {
  CommercialQuote,
  QuoteAnalyticsData,
  QuoteAnalyticsKPI,
  QuoteConversionFunnel,
  QuoteMarginAnalysis,
  QuoteMarginDataPoint,
  QuoteCarrierPerformance,
  QuoteSectorPerformance,
  QuoteTimelinePoint,
} from '@/types/commercial-quotes';

// ============================================
// HELPERS
// ============================================

/** Filtra all'ultima revisione per ogni root quote */
function filterLatestRevisions(quotes: CommercialQuote[]): CommercialQuote[] {
  // Raggruppa per root: se parent_quote_id e' null, il root e' il quote stesso
  const rootMap = new Map<string, CommercialQuote>();

  for (const q of quotes) {
    const rootId = q.parent_quote_id || q.id;
    const existing = rootMap.get(rootId);
    if (!existing || q.revision > existing.revision) {
      rootMap.set(rootId, q);
    }
  }

  return Array.from(rootMap.values());
}

/** Calcola giorni tra due date ISO */
function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/** Calcola media di un array di numeri (0 se vuoto) */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Calcola settimana ISO: "2026-W06" */
function getISOWeek(dateStr: string): string {
  const d = new Date(dateStr);
  // Copia per non mutare
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Imposta al giovedi della settimana corrente
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Label leggibile per settimana ISO: "Sett. 6" */
function weekLabel(isoWeek: string): string {
  const weekNo = parseInt(isoWeek.split('-W')[1], 10);
  return `Sett. ${weekNo}`;
}

/** Mappa sector value -> label dalla costante PROSPECT_SECTORS */
const sectorLabelMap = new Map<string, string>(
  PROSPECT_SECTORS.map((s) => [s.value as string, s.label])
);

function getSectorLabel(sector: string | null): string {
  if (!sector) return 'Non specificato';
  return sectorLabelMap.get(sector) || sector;
}

// ============================================
// CALCOLO ANALYTICS
// ============================================

/**
 * Calcola tutte le metriche analytics da un array di preventivi.
 * Funzione pura — testabile senza dipendenze esterne.
 */
export function computeAnalytics(allQuotes: CommercialQuote[]): QuoteAnalyticsData {
  const quotes = filterLatestRevisions(allQuotes);

  return {
    kpi: computeKPI(quotes),
    funnel: computeFunnel(quotes),
    margin_analysis: computeMarginAnalysis(quotes),
    carrier_performance: computeCarrierPerformance(quotes),
    sector_performance: computeSectorPerformance(quotes),
    timeline: computeTimeline(quotes),
  };
}

/** Esportato per test indipendente */
export { filterLatestRevisions };

// ============================================
// KPI
// ============================================

function computeKPI(quotes: CommercialQuote[]): QuoteAnalyticsKPI {
  const accepted = quotes.filter((q) => q.status === 'accepted');
  const rejected = quotes.filter((q) => q.status === 'rejected');
  const decided = accepted.length + rejected.length;

  const conversion_rate = decided > 0 ? accepted.length / decided : 0;

  const average_margin_accepted = avg(accepted.map((q) => q.margin_percent ?? 0));

  // Giorni da sent_at a responded_at per chi ha un esito
  const closedWithDates = [...accepted, ...rejected].filter((q) => q.sent_at && q.responded_at);
  const average_days_to_close = avg(
    closedWithDates.map((q) => daysBetween(q.sent_at!, q.responded_at!))
  );

  // Valore totale: stima da volume_stimato * prezzo medio matrice
  const total_revenue_value = accepted.reduce((sum, q) => {
    const volume = q.prospect_estimated_volume ?? 0;
    const prices = q.price_matrix.prices.flat();
    const avgPrice = prices.length > 0 ? avg(prices) : 0;
    return sum + volume * avgPrice;
  }, 0);

  return {
    conversion_rate,
    average_margin_accepted,
    average_days_to_close,
    total_revenue_value,
    total_quotes: quotes.length,
    total_accepted: accepted.length,
    total_rejected: rejected.length,
  };
}

// ============================================
// FUNNEL
// ============================================

function computeFunnel(quotes: CommercialQuote[]): QuoteConversionFunnel {
  // Ogni quote ha raggiunto almeno "created"
  const created = quotes.length;

  // Quote che hanno raggiunto "sent" (hanno sent_at oppure status oltre sent)
  const sentStatuses = new Set(['sent', 'negotiating', 'accepted', 'rejected', 'expired']);
  const sent = quotes.filter((q) => q.sent_at || sentStatuses.has(q.status)).length;

  // Quote in negoziazione attiva o oltre
  const negotiatingStatuses = new Set(['negotiating', 'accepted', 'rejected']);
  const negotiating = quotes.filter(
    (q) => negotiatingStatuses.has(q.status) || q.responded_at
  ).length;

  // Quote accettate
  const accepted = quotes.filter((q) => q.status === 'accepted').length;

  return {
    created,
    sent,
    negotiating,
    accepted,
    dropoff_created_to_sent: created > 0 ? 1 - sent / created : 0,
    dropoff_sent_to_accepted: sent > 0 ? 1 - accepted / sent : 0,
  };
}

// ============================================
// MARGIN ANALYSIS
// ============================================

function computeMarginAnalysis(quotes: CommercialQuote[]): QuoteMarginAnalysis {
  // Solo preventivi con esito (accepted/rejected) e margini validi
  const withOutcome = quotes.filter(
    (q) => (q.status === 'accepted' || q.status === 'rejected') && q.margin_percent !== null
  );

  const data_points: QuoteMarginDataPoint[] = withOutcome.map((q) => ({
    quote_id: q.id,
    prospect_company: q.prospect_company,
    original_margin: q.original_margin_percent ?? q.margin_percent!,
    final_margin: q.margin_percent!,
    delta: q.margin_percent! - (q.original_margin_percent ?? q.margin_percent!),
    accepted: q.status === 'accepted',
  }));

  const acceptedPoints = data_points.filter((p) => p.accepted);
  const rejectedPoints = data_points.filter((p) => !p.accepted);

  return {
    data_points,
    average_original_margin: avg(data_points.map((p) => p.original_margin)),
    average_final_margin: avg(data_points.map((p) => p.final_margin)),
    average_delta: avg(data_points.map((p) => p.delta)),
    avg_margin_accepted: avg(acceptedPoints.map((p) => p.final_margin)),
    avg_margin_rejected: avg(rejectedPoints.map((p) => p.final_margin)),
  };
}

// ============================================
// CARRIER PERFORMANCE
// ============================================

function computeCarrierPerformance(quotes: CommercialQuote[]): QuoteCarrierPerformance[] {
  const carrierMap = new Map<
    string,
    { display: string; total: number; accepted: number; rejected: number; margins: number[] }
  >();

  for (const q of quotes) {
    const code = q.carrier_code;
    const existing = carrierMap.get(code) || {
      display: q.price_matrix.carrier_display_name,
      total: 0,
      accepted: 0,
      rejected: 0,
      margins: [],
    };

    existing.total++;
    if (q.status === 'accepted') existing.accepted++;
    if (q.status === 'rejected') existing.rejected++;
    if (q.margin_percent !== null) existing.margins.push(q.margin_percent);

    carrierMap.set(code, existing);
  }

  return Array.from(carrierMap.entries())
    .map(([code, data]) => {
      const decided = data.accepted + data.rejected;
      return {
        carrier_code: code,
        carrier_display_name: data.display,
        total_quotes: data.total,
        accepted: data.accepted,
        rejected: data.rejected,
        acceptance_rate: decided > 0 ? data.accepted / decided : 0,
        average_margin: avg(data.margins),
      };
    })
    .sort((a, b) => b.total_quotes - a.total_quotes);
}

// ============================================
// SECTOR PERFORMANCE
// ============================================

function computeSectorPerformance(quotes: CommercialQuote[]): QuoteSectorPerformance[] {
  const sectorMap = new Map<
    string,
    { total: number; accepted: number; rejected: number; margins: number[] }
  >();

  for (const q of quotes) {
    const sector = q.prospect_sector || 'non_specificato';
    const existing = sectorMap.get(sector) || {
      total: 0,
      accepted: 0,
      rejected: 0,
      margins: [],
    };

    existing.total++;
    if (q.status === 'accepted') existing.accepted++;
    if (q.status === 'rejected') existing.rejected++;
    if (q.margin_percent !== null) existing.margins.push(q.margin_percent);

    sectorMap.set(sector, existing);
  }

  return Array.from(sectorMap.entries())
    .map(([sector, data]) => {
      const decided = data.accepted + data.rejected;
      return {
        sector,
        sector_label: getSectorLabel(sector === 'non_specificato' ? null : sector),
        total_quotes: data.total,
        accepted: data.accepted,
        rejected: data.rejected,
        acceptance_rate: decided > 0 ? data.accepted / decided : 0,
        average_margin: avg(data.margins),
      };
    })
    .sort((a, b) => b.total_quotes - a.total_quotes);
}

// ============================================
// TIMELINE
// ============================================

function computeTimeline(quotes: CommercialQuote[]): QuoteTimelinePoint[] {
  const weekMap = new Map<string, QuoteTimelinePoint>();

  for (const q of quotes) {
    const week = getISOWeek(q.created_at);
    const existing = weekMap.get(week) || {
      period: week,
      period_label: weekLabel(week),
      created: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
    };

    existing.created++;

    // Conta nello stato raggiunto
    if (q.sent_at) existing.sent++;
    if (q.status === 'accepted') existing.accepted++;
    if (q.status === 'rejected') existing.rejected++;

    weekMap.set(week, existing);
  }

  // Ordina per periodo crescente
  return Array.from(weekMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}
