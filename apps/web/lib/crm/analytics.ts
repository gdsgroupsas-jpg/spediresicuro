/**
 * CRM Analytics — Funzioni pure per metriche cross-livello
 *
 * Calcola KPI, funnel conversione, analisi fonte/settore/zona,
 * distribuzione score, tempo a conversione.
 *
 * PURO: zero dipendenze esterne, completamente testabile con mock data.
 *
 * @module lib/crm/analytics
 */

import { LEAD_SECTOR_LABELS, LEAD_SOURCE_LABELS, GEOGRAPHIC_ZONE_LABELS } from '@/types/leads';
import type { LeadStatus, LeadSource, LeadSector, GeographicZone } from '@/types/leads';

// ============================================
// INPUT TYPES
// ============================================

export interface CrmAnalyticsEntity {
  id: string;
  status: string;
  lead_score?: number | null;
  lead_source?: string | null;
  source?: string | null; // vecchio campo leads
  sector?: string | null;
  geographic_zone?: string | null;
  estimated_monthly_volume?: number | null;
  estimated_value?: number | null;
  created_at: string;
  updated_at: string;
  converted_at?: string | null;
  last_contact_at?: string | null;
}

// ============================================
// OUTPUT TYPES
// ============================================

export interface CrmAnalyticsData {
  kpi: CrmKPI;
  funnel: CrmConversionFunnel;
  source_analysis: CrmSourceAnalysis[];
  sector_analysis: CrmSectorAnalysis[];
  zone_analysis: CrmZoneAnalysis[];
  score_distribution: CrmScoreDistribution;
  time_to_conversion: CrmTimeToConversion;
}

export interface CrmKPI {
  total: number;
  active: number;
  won: number;
  lost: number;
  conversion_rate: number; // won / (won + lost)
  avg_score: number;
  total_pipeline_value: number; // stimato da volume * valore medio
  avg_days_to_conversion: number;
}

export interface CrmConversionFunnel {
  new: number;
  contacted: number;
  qualified: number;
  negotiation: number;
  won: number;
  lost: number;
  dropoff_new_to_contacted: number;
  dropoff_contacted_to_won: number;
}

export interface CrmSourceAnalysis {
  source: string;
  label: string;
  total: number;
  won: number;
  lost: number;
  conversion_rate: number;
  avg_score: number;
}

export interface CrmSectorAnalysis {
  sector: string;
  label: string;
  total: number;
  won: number;
  conversion_rate: number;
  avg_volume: number;
  avg_score: number;
}

export interface CrmZoneAnalysis {
  zone: string;
  label: string;
  total: number;
  won: number;
  conversion_rate: number;
}

export interface CrmScoreDistribution {
  hot: number; // >= 80
  warm: number; // >= 60
  cold: number; // >= 40
  very_cold: number; // < 40
}

export interface CrmTimeToConversion {
  avg_days: number;
  min_days: number;
  max_days: number;
  median_days: number;
  by_source: { source: string; label: string; avg_days: number }[];
}

// ============================================
// HELPERS
// ============================================

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function getSourceLabel(source: string | null): string {
  if (!source) return 'Non specificata';
  return LEAD_SOURCE_LABELS[source as LeadSource] || source;
}

function getSectorLabel(sector: string | null): string {
  if (!sector) return 'Non specificato';
  return LEAD_SECTOR_LABELS[sector as LeadSector] || sector;
}

function getZoneLabel(zone: string | null): string {
  if (!zone) return 'Non specificata';
  return GEOGRAPHIC_ZONE_LABELS[zone as GeographicZone] || zone;
}

/** Ricava la source unificata (lead_source o source) */
function getSource(entity: CrmAnalyticsEntity): string {
  return entity.lead_source || entity.source || 'unknown';
}

// ============================================
// CALCOLO ANALYTICS PRINCIPALE
// ============================================

/**
 * Calcola tutte le metriche CRM da un array di entita (lead o prospect).
 * Funzione pura — testabile senza dipendenze esterne.
 */
export function computeCrmAnalytics(entities: CrmAnalyticsEntity[]): CrmAnalyticsData {
  return {
    kpi: computeKPI(entities),
    funnel: computeFunnel(entities),
    source_analysis: computeSourceAnalysis(entities),
    sector_analysis: computeSectorAnalysis(entities),
    zone_analysis: computeZoneAnalysis(entities),
    score_distribution: computeScoreDistribution(entities),
    time_to_conversion: computeTimeToConversion(entities),
  };
}

// ============================================
// KPI
// ============================================

function computeKPI(entities: CrmAnalyticsEntity[]): CrmKPI {
  const won = entities.filter((e) => e.status === 'won');
  const lost = entities.filter((e) => e.status === 'lost');
  const active = entities.filter((e) => !['won', 'lost'].includes(e.status));
  const decided = won.length + lost.length;

  // Pipeline value: stima da volume mensile * 12 (annuale) per entita attive
  const pipelineValue = active.reduce((sum, e) => {
    const monthlyVol = e.estimated_monthly_volume || 0;
    const estValue = e.estimated_value || 0;
    // Se ha estimated_value usa quello, altrimenti stima da volume
    return sum + (estValue > 0 ? estValue : monthlyVol * 5); // ~5 EUR/spedizione media
  }, 0);

  // Tempo medio a conversione per i vinti
  const conversionDays = won
    .filter((e) => e.converted_at)
    .map((e) => daysBetween(e.created_at, e.converted_at!));

  return {
    total: entities.length,
    active: active.length,
    won: won.length,
    lost: lost.length,
    conversion_rate: decided > 0 ? won.length / decided : 0,
    avg_score: avg(entities.map((e) => e.lead_score || 0)),
    total_pipeline_value: pipelineValue,
    avg_days_to_conversion: avg(conversionDays),
  };
}

// ============================================
// FUNNEL
// ============================================

/**
 * Funnel basato sullo stato attuale.
 * NB: ogni entita e in UN solo stato, non abbiamo la storia.
 * Usiamo il conteggio per stato come proxy del funnel.
 */
function computeFunnel(entities: CrmAnalyticsEntity[]): CrmConversionFunnel {
  const statusCounts: Record<string, number> = {};
  for (const e of entities) {
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
  }

  const newCount = statusCounts['new'] || 0;
  const contacted = statusCounts['contacted'] || 0;
  // Prospect: quote_sent ~ qualified per lead
  const qualified = (statusCounts['qualified'] || 0) + (statusCounts['quote_sent'] || 0);
  const negotiation = (statusCounts['negotiation'] || 0) + (statusCounts['negotiating'] || 0);
  const won = statusCounts['won'] || 0;
  const lost = statusCounts['lost'] || 0;

  // Entita che hanno superato lo stato "new"
  const pastNew = contacted + qualified + negotiation + won + lost;
  const total = entities.length;

  return {
    new: newCount,
    contacted,
    qualified,
    negotiation,
    won,
    lost,
    dropoff_new_to_contacted: total > 0 ? 1 - pastNew / total : 0,
    dropoff_contacted_to_won: pastNew > 0 ? 1 - won / pastNew : 0,
  };
}

// ============================================
// SOURCE ANALYSIS
// ============================================

function computeSourceAnalysis(entities: CrmAnalyticsEntity[]): CrmSourceAnalysis[] {
  const bySource = new Map<string, CrmAnalyticsEntity[]>();

  for (const e of entities) {
    const src = getSource(e);
    const list = bySource.get(src) || [];
    list.push(e);
    bySource.set(src, list);
  }

  return Array.from(bySource.entries())
    .map(([source, items]) => {
      const won = items.filter((e) => e.status === 'won').length;
      const lost = items.filter((e) => e.status === 'lost').length;
      const decided = won + lost;

      return {
        source,
        label: getSourceLabel(source),
        total: items.length,
        won,
        lost,
        conversion_rate: decided > 0 ? won / decided : 0,
        avg_score: avg(items.map((e) => e.lead_score || 0)),
      };
    })
    .sort((a, b) => b.conversion_rate - a.conversion_rate);
}

// ============================================
// SECTOR ANALYSIS
// ============================================

function computeSectorAnalysis(entities: CrmAnalyticsEntity[]): CrmSectorAnalysis[] {
  const bySector = new Map<string, CrmAnalyticsEntity[]>();

  for (const e of entities) {
    const sec = e.sector || 'unknown';
    const list = bySector.get(sec) || [];
    list.push(e);
    bySector.set(sec, list);
  }

  return Array.from(bySector.entries())
    .map(([sector, items]) => {
      const won = items.filter((e) => e.status === 'won').length;
      const decided = won + items.filter((e) => e.status === 'lost').length;

      return {
        sector,
        label: getSectorLabel(sector),
        total: items.length,
        won,
        conversion_rate: decided > 0 ? won / decided : 0,
        avg_volume: avg(
          items.filter((e) => e.estimated_monthly_volume).map((e) => e.estimated_monthly_volume!)
        ),
        avg_score: avg(items.map((e) => e.lead_score || 0)),
      };
    })
    .sort((a, b) => b.conversion_rate - a.conversion_rate);
}

// ============================================
// ZONE ANALYSIS
// ============================================

function computeZoneAnalysis(entities: CrmAnalyticsEntity[]): CrmZoneAnalysis[] {
  const byZone = new Map<string, CrmAnalyticsEntity[]>();

  for (const e of entities) {
    const zone = e.geographic_zone || 'unknown';
    const list = byZone.get(zone) || [];
    list.push(e);
    byZone.set(zone, list);
  }

  return Array.from(byZone.entries())
    .map(([zone, items]) => {
      const won = items.filter((e) => e.status === 'won').length;
      const decided = won + items.filter((e) => e.status === 'lost').length;

      return {
        zone,
        label: getZoneLabel(zone),
        total: items.length,
        won,
        conversion_rate: decided > 0 ? won / decided : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// ============================================
// SCORE DISTRIBUTION
// ============================================

function computeScoreDistribution(entities: CrmAnalyticsEntity[]): CrmScoreDistribution {
  // Solo entita attive (non won/lost) per la distribuzione
  const active = entities.filter((e) => !['won', 'lost'].includes(e.status));

  return {
    hot: active.filter((e) => (e.lead_score || 0) >= 80).length,
    warm: active.filter((e) => (e.lead_score || 0) >= 60 && (e.lead_score || 0) < 80).length,
    cold: active.filter((e) => (e.lead_score || 0) >= 40 && (e.lead_score || 0) < 60).length,
    very_cold: active.filter((e) => (e.lead_score || 0) < 40).length,
  };
}

// ============================================
// TIME TO CONVERSION
// ============================================

function computeTimeToConversion(entities: CrmAnalyticsEntity[]): CrmTimeToConversion {
  const won = entities.filter((e) => e.status === 'won' && e.converted_at);
  const days = won.map((e) => daysBetween(e.created_at, e.converted_at!));

  // Per source
  const bySource = new Map<string, number[]>();
  for (const e of won) {
    const src = getSource(e);
    const list = bySource.get(src) || [];
    list.push(daysBetween(e.created_at, e.converted_at!));
    bySource.set(src, list);
  }

  const bySourceResult = Array.from(bySource.entries()).map(([source, sourceDays]) => ({
    source,
    label: getSourceLabel(source),
    avg_days: Math.round(avg(sourceDays)),
  }));

  return {
    avg_days: Math.round(avg(days)),
    min_days: days.length > 0 ? Math.min(...days) : 0,
    max_days: days.length > 0 ? Math.max(...days) : 0,
    median_days: Math.round(median(days)),
    by_source: bySourceResult,
  };
}
