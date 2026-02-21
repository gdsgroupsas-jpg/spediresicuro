/**
 * CRM Analytics Mapping — Funzioni pure per mappare righe DB → CrmAnalyticsEntity
 *
 * Separato da server actions per evitare vincolo "use server" (tutte le export devono essere async).
 * Esportato per test unitari.
 *
 * @module lib/crm/analytics-mapping
 */

import type { CrmAnalyticsEntity } from '@/lib/crm/analytics';

// ============================================
// TYPES DB RAW
// ============================================

export interface LeadRow {
  id: string;
  status: string;
  lead_score: number | null;
  lead_source: string | null;
  source: string | null;
  sector: string | null;
  geographic_zone: string | null;
  estimated_monthly_volume: number | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  last_contact_at: string | null;
}

export interface ProspectRow {
  id: string;
  status: string;
  lead_score: number | null;
  sector: string | null;
  estimated_monthly_volume: number | null;
  estimated_monthly_value: number | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  last_contact_at: string | null;
}

// ============================================
// MAPPING
// ============================================

/** Mappa righe leads → CrmAnalyticsEntity */
export function mapLeadsToCrmEntities(rows: LeadRow[]): CrmAnalyticsEntity[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    lead_score: r.lead_score,
    lead_source: r.lead_source,
    source: r.source,
    sector: r.sector,
    geographic_zone: r.geographic_zone,
    estimated_monthly_volume: r.estimated_monthly_volume,
    estimated_value: null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    converted_at: r.converted_at,
    last_contact_at: r.last_contact_at,
  }));
}

/** Mappa righe prospect → CrmAnalyticsEntity */
export function mapProspectsToCrmEntities(rows: ProspectRow[]): CrmAnalyticsEntity[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    lead_score: r.lead_score,
    lead_source: null,
    source: null,
    sector: r.sector,
    geographic_zone: null,
    estimated_monthly_volume: r.estimated_monthly_volume,
    estimated_value: r.estimated_monthly_value,
    created_at: r.created_at,
    updated_at: r.updated_at,
    converted_at: r.converted_at,
    last_contact_at: r.last_contact_at,
  }));
}
