/**
 * CRM Data Service — Layer dati read-only per Anne CRM Intelligence
 *
 * Tutte le query CRM passano da qui. Rispetta l'isolamento:
 * - Admin → query su tabella `leads` (tutte)
 * - Reseller → query su tabella `reseller_prospects` filtrate per workspace_id
 *
 * NESSUNA AZIONE DI SCRITTURA — Sprint S1 e' read-only.
 *
 * @module lib/crm/crm-data-service
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { evaluateHealthRules, daysBetween, HEALTH_THRESHOLDS } from '@/lib/crm/health-rules';
import type { CrmAlert, HealthCheckEntity } from '@/lib/crm/health-rules';
import type {
  PipelineSummary,
  TodayAction,
  CrmSearchFilters,
  CrmSearchResult,
  CrmEntityDetail,
  CrmEntityEvent,
  ConversionMetrics,
  PendingQuoteSummary,
} from '@/types/crm-intelligence';

/**
 * Helper: ritorna il query builder corretto per CRM.
 * - Admin: supabaseAdmin cross-workspace (INTENZIONALE — admin vede tutti i leads)
 * - Reseller: workspaceQuery (fail-closed se wsId mancante)
 */
function getCrmQueryBuilder(isAdmin: boolean, workspaceId?: string) {
  if (isAdmin) {
    // DESIGN INTENZIONALE: admin vede leads cross-workspace
    return { db: supabaseAdmin, error: null as string | null };
  }
  if (!workspaceId) {
    return { db: null, error: 'workspaceId obbligatorio per reseller' };
  }
  return { db: workspaceQuery(workspaceId), error: null as string | null };
}

// ============================================
// PIPELINE SUMMARY
// ============================================

/**
 * Panoramica pipeline: conteggi per stato, score medio, valore
 */
export async function getPipelineSummary(
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId?: string
): Promise<PipelineSummary> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const selectFields = 'status, lead_score, estimated_monthly_volume';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] getPipelineSummary: ${dbError}`);
    return { total: 0, byStatus: {}, avgScore: 0, pipelineValue: 0 };
  }

  const { data: rows, error } = await db.from(table).select(selectFields);
  if (error || !rows) {
    console.error(`[crm-data-service] getPipelineSummary error:`, error);
    return { total: 0, byStatus: {}, avgScore: 0, pipelineValue: 0 };
  }

  const byStatus: Record<string, number> = {};
  let totalScore = 0;
  let scoreCount = 0;
  let pipelineValue = 0;

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const status = (r.status as string) || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    const score = r.lead_score as number | null;
    if (score != null) {
      totalScore += score;
      scoreCount++;
    }

    // Stima valore: volume mensile * €5/spedizione (media mercato)
    const volume = r.estimated_monthly_volume as number | null;
    if (volume && status !== 'lost' && status !== 'won') {
      pipelineValue += volume * 5;
    }
  }

  return {
    total: rows.length,
    byStatus,
    avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
    pipelineValue,
  };
}

// ============================================
// HOT ENTITIES
// ============================================

interface HotEntityRow {
  id: string;
  company_name: string;
  lead_score: number;
  status: string;
  sector?: string;
  last_contact_at?: string;
}

export interface HotEntity {
  id: string;
  name: string;
  score: number;
  status: string;
  sector?: string;
  daysSinceLastContact?: number;
}

/**
 * Entita con score >= 70, ordinate per score desc
 */
export async function getHotEntities(
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId?: string,
  limit = 5
): Promise<HotEntity[]> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] getHotEntities: ${dbError}`);
    return [];
  }

  const { data: rows, error } = await db
    .from(table)
    .select('id, company_name, lead_score, status, sector, last_contact_at')
    .gte('lead_score', 70)
    .not('status', 'in', '("won","lost")')
    .order('lead_score', { ascending: false })
    .limit(limit);

  if (error || !rows) {
    console.error(`[crm-data-service] getHotEntities error:`, error);
    return [];
  }

  const now = new Date();
  return (rows as HotEntityRow[]).map((r) => ({
    id: r.id,
    name: r.company_name,
    score: r.lead_score,
    status: r.status,
    sector: r.sector || undefined,
    daysSinceLastContact: r.last_contact_at
      ? Math.floor(daysBetween(r.last_contact_at, now))
      : undefined,
  }));
}

// ============================================
// STALE ENTITIES
// ============================================

export interface StaleEntity {
  id: string;
  name: string;
  status: string;
  daysSinceActivity: number;
  riskLevel: 'warning' | 'critical';
}

/**
 * Entita senza contatto recente (basato su soglie health-rules)
 */
export async function getStaleEntities(
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId?: string
): Promise<StaleEntity[]> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] getStaleEntities: ${dbError}`);
    return [];
  }

  const { data: rows, error } = await db
    .from(table)
    .select('id, company_name, status, lead_score, last_contact_at, updated_at, created_at')
    .not('status', 'in', '("won","lost")');

  if (error || !rows) {
    console.error(`[crm-data-service] getStaleEntities error:`, error);
    return [];
  }

  const now = new Date();
  const stale: StaleEntity[] = [];

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const status = r.status as string;
    const lastContact = (r.last_contact_at as string) || (r.updated_at as string);
    const days = Math.floor(daysBetween(lastContact, now));

    let isStale = false;
    let riskLevel: 'warning' | 'critical' = 'warning';

    if (status === 'new' && days > HEALTH_THRESHOLDS.STALE_NEW_DAYS) {
      isStale = true;
      const score = r.lead_score as number | null;
      if (score && score >= HEALTH_THRESHOLDS.HOT_SCORE_THRESHOLD) {
        riskLevel = 'critical';
      }
    } else if (status === 'contacted' && days > HEALTH_THRESHOLDS.COLD_CONTACTED_DAYS) {
      isStale = true;
    } else if (status === 'qualified' && days > HEALTH_THRESHOLDS.STALE_QUALIFIED_DAYS) {
      isStale = true;
    }

    if (isStale) {
      stale.push({
        id: r.id as string,
        name: r.company_name as string,
        status,
        daysSinceActivity: days,
        riskLevel,
      });
    }
  }

  // Ordina per rischio (critical prima) poi per giorni (piu' vecchi prima)
  return stale.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return a.riskLevel === 'critical' ? -1 : 1;
    return b.daysSinceActivity - a.daysSinceActivity;
  });
}

// ============================================
// HEALTH ALERTS
// ============================================

/**
 * Alert salute CRM — delega a evaluateHealthRules()
 */
export async function getHealthAlerts(
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId?: string
): Promise<CrmAlert[]> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const entityType = isAdmin ? 'lead' : 'prospect';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] getHealthAlerts: ${dbError}`);
    return [];
  }

  const { data: rows, error } = await db
    .from(table)
    .select('id, company_name, status, lead_score, created_at, last_contact_at, updated_at')
    .not('status', 'in', '("won")');

  if (error || !rows) {
    console.error(`[crm-data-service] getHealthAlerts error:`, error);
    return [];
  }

  const entities = rows as HealthCheckEntity[];
  const now = new Date();

  return evaluateHealthRules(entities, entityType as 'lead' | 'prospect', now);
}

// ============================================
// SEARCH ENTITIES
// ============================================

/**
 * Ricerca lead/prospect per nome, email, settore, stato
 */
export async function searchEntities(
  userRole: 'admin' | 'user' | 'reseller',
  queryStr: string,
  filters?: CrmSearchFilters,
  workspaceId?: string
): Promise<CrmSearchResult[]> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const entityType = isAdmin ? 'lead' : 'prospect';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] searchEntities: ${dbError}`);
    return [];
  }

  let query = db
    .from(table)
    .select('id, company_name, contact_name, email, status, lead_score, sector, last_contact_at')
    .limit(20);

  // Ricerca testuale su company_name (ilike)
  if (queryStr && queryStr.trim().length > 0) {
    query = query.ilike('company_name', `%${queryStr.trim()}%`);
  }

  // Filtri opzionali
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.sector) {
    query = query.eq('sector', filters.sector);
  }
  if (filters?.minScore != null) {
    query = query.gte('lead_score', filters.minScore);
  }
  if (filters?.maxScore != null) {
    query = query.lte('lead_score', filters.maxScore);
  }

  query = query.order('lead_score', { ascending: false });

  const { data: rows, error } = await query;
  if (error || !rows) {
    console.error(`[crm-data-service] searchEntities error:`, error);
    return [];
  }

  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    entityType: entityType as 'lead' | 'prospect',
    companyName: r.company_name as string,
    contactName: (r.contact_name as string) || undefined,
    email: (r.email as string) || undefined,
    status: r.status as string,
    score: (r.lead_score as number) || 0,
    sector: (r.sector as string) || undefined,
    lastContactAt: (r.last_contact_at as string) || undefined,
  }));
}

// ============================================
// ENTITY DETAIL
// ============================================

/**
 * Dettaglio completo di un'entita con timeline eventi recenti
 */
export async function getEntityDetail(
  userRole: 'admin' | 'user' | 'reseller',
  entityId?: string,
  searchName?: string,
  workspaceId?: string
): Promise<CrmEntityDetail | null> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const entityType = isAdmin ? 'lead' : 'prospect';
  const fkField = isAdmin ? 'lead_id' : 'prospect_id';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] getEntityDetail: ${dbError}`);
    return null;
  }

  // Trova entita
  let query = db.from(table).select('*');

  if (entityId) {
    query = query.eq('id', entityId);
  } else if (searchName) {
    query = query.ilike('company_name', `%${searchName}%`);
  } else {
    return null;
  }

  const { data: rows, error } = await query.limit(1);
  if (error || !rows || rows.length === 0) return null;

  const r = rows[0] as Record<string, unknown>;

  // Carica eventi recenti (ultimi 10) — stessa isolamento del parent
  const { data: events } = await db
    .from(eventsTable)
    .select('event_type, event_data, created_at')
    .eq(fkField, r.id as string)
    .order('created_at', { ascending: false })
    .limit(10);

  const recentEvents: CrmEntityEvent[] = (events || []).map((e: Record<string, unknown>) => ({
    eventType: e.event_type as string,
    eventData: (e.event_data as Record<string, unknown>) || undefined,
    createdAt: e.created_at as string,
  }));

  // Per reseller, carica preventivi collegati
  let pendingQuotes: PendingQuoteSummary[] | undefined;
  if (workspaceId) {
    const linkedIds = (r.linked_quote_ids as string[]) || [];
    if (linkedIds.length > 0) {
      // commercial_quotes è workspace-scoped — usa workspaceQuery (wsId già validato)
      const quotesDb = workspaceQuery(workspaceId);
      const { data: quotes } = await quotesDb
        .from('commercial_quotes')
        .select('id, prospect_company, status, expires_at, margin_percent, carrier_code')
        .in('id', linkedIds)
        .in('status', ['sent', 'negotiating', 'draft']);

      if (quotes) {
        const now = new Date();
        pendingQuotes = quotes.map((q: Record<string, unknown>) => ({
          quoteId: q.id as string,
          prospectName: q.prospect_company as string,
          status: q.status as string,
          expiresInDays: q.expires_at
            ? Math.ceil(daysBetween(now.toISOString(), new Date(q.expires_at as string)))
            : undefined,
          marginPercent: (q.margin_percent as number) || undefined,
          carrierCode: (q.carrier_code as string) || undefined,
        }));
      }
    }
  }

  return {
    id: r.id as string,
    entityType,
    companyName: r.company_name as string,
    contactName: (r.contact_name as string) || undefined,
    email: (r.email as string) || undefined,
    phone: (r.phone as string) || undefined,
    status: r.status as string,
    score: (r.lead_score as number) || 0,
    sector: (r.sector as string) || undefined,
    estimatedMonthlyVolume: (r.estimated_monthly_volume as number) || undefined,
    estimatedValue:
      (r.estimated_value as number) || (r.estimated_monthly_value as number) || undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastContactAt: (r.last_contact_at as string) || undefined,
    convertedAt: (r.converted_at as string) || undefined,
    lostReason: (r.lost_reason as string) || undefined,
    tags: (r.tags as string[]) || undefined,
    recentEvents,
    pendingQuotes,
  };
}

// ============================================
// TODAY ACTIONS (PRIORITIZZATE)
// ============================================

/**
 * Lista prioritizzata di azioni da fare oggi.
 * Combina: health alerts + hot entities non contattati + quote in scadenza.
 */
export async function getTodayActions(
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId?: string
): Promise<TodayAction[]> {
  const entityType = userRole === 'admin' ? 'lead' : 'prospect';
  const actions: TodayAction[] = [];

  // 1. Health alerts → azioni
  const alerts = await getHealthAlerts(userRole, workspaceId);
  for (const alert of alerts) {
    let action = '';
    let urgency: TodayAction['urgency'] = 'today';
    let priority = 5;

    switch (alert.type) {
      case 'hot_lead_uncontacted':
        action = 'Contattare immediatamente — lead caldo non ancora contattato';
        urgency = 'immediate';
        priority = 1;
        break;
      case 'stale_new_prospect':
        action = `Primo contatto — prospect nuovo da ${alert.daysSinceEvent} giorni`;
        urgency = 'today';
        priority = 2;
        break;
      case 'cold_contacted_prospect':
        action = `Follow-up — nessun contatto da ${alert.daysSinceEvent} giorni`;
        urgency = 'today';
        priority = 3;
        break;
      case 'stale_qualified_lead':
        action = `Avanzare pipeline — lead qualificato fermo da ${alert.daysSinceEvent} giorni`;
        urgency = 'today';
        priority = 3;
        break;
      case 'winback_candidate':
        action = 'Tentativo win-back — ricontattare con nuovo angolo';
        urgency = 'this_week';
        priority = 7;
        break;
      default:
        action = alert.message;
        priority = 6;
    }

    actions.push({
      priority,
      entityType: alert.entityType,
      entityId: alert.entityId,
      entityName: alert.entityName,
      action,
      reasoning: alert.message,
      urgency,
    });
  }

  // 2. Quote in scadenza (solo reseller)
  if (userRole !== 'admin' && workspaceId) {
    const quotes = await getPendingQuotes(workspaceId);
    for (const q of quotes) {
      if (q.expiresInDays != null && q.expiresInDays <= 5 && q.expiresInDays > 0) {
        actions.push({
          priority: 2,
          entityType: 'prospect',
          entityId: q.quoteId,
          entityName: q.prospectName,
          action: `Preventivo scade tra ${q.expiresInDays} giorni — sollecitare risposta`,
          reasoning: `Il preventivo per "${q.prospectName}" e' in stato "${q.status}" e scade tra ${q.expiresInDays} giorni`,
          urgency: q.expiresInDays <= 2 ? 'immediate' : 'today',
        });
      }
    }
  }

  // Ordina per priorita' (1 = massima)
  return actions.sort((a, b) => a.priority - b.priority);
}

// ============================================
// CONVERSION METRICS
// ============================================

/**
 * Metriche di conversione (tasso, tempo medio, trend)
 */
export async function getConversionMetrics(
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId?: string
): Promise<ConversionMetrics> {
  const isAdmin = userRole === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';

  const { db, error: dbError } = getCrmQueryBuilder(isAdmin, workspaceId);
  if (dbError || !db) {
    console.error(`[crm-data-service] getConversionMetrics: ${dbError}`);
    return {
      rate: 0,
      avgDaysToConversion: 0,
      wonThisMonth: 0,
      lostThisMonth: 0,
      trend: 'stable' as const,
      totalActive: 0,
      totalPipelineValue: 0,
    };
  }

  const { data: rows, error } = await db
    .from(table)
    .select('status, lead_score, estimated_monthly_volume, created_at, converted_at, updated_at');

  if (error || !rows || rows.length === 0) {
    return {
      rate: 0,
      avgDaysToConversion: 0,
      wonThisMonth: 0,
      lostThisMonth: 0,
      trend: 'stable',
      totalActive: 0,
      totalPipelineValue: 0,
    };
  }

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let won = 0;
  let lost = 0;
  let active = 0;
  let wonThisMonth = 0;
  let lostThisMonth = 0;
  let totalDays = 0;
  let convCount = 0;
  let pipelineValue = 0;

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const status = r.status as string;
    const updatedAt = r.updated_at as string;

    if (status === 'won') {
      won++;
      if (updatedAt?.startsWith(thisMonth)) wonThisMonth++;
      const createdAt = r.created_at as string;
      const convertedAt = (r.converted_at as string) || updatedAt;
      if (createdAt && convertedAt) {
        totalDays += daysBetween(createdAt, new Date(convertedAt));
        convCount++;
      }
    } else if (status === 'lost') {
      lost++;
      if (updatedAt?.startsWith(thisMonth)) lostThisMonth++;
    } else {
      active++;
      const volume = r.estimated_monthly_volume as number | null;
      if (volume) pipelineValue += volume * 5;
    }
  }

  const closedTotal = won + lost;
  const rate = closedTotal > 0 ? won / closedTotal : 0;
  const avgDays = convCount > 0 ? Math.round(totalDays / convCount) : 0;

  // Trend semplice: se wonThisMonth > lostThisMonth → improving
  let trend: ConversionMetrics['trend'] = 'stable';
  if (wonThisMonth > lostThisMonth + 1) trend = 'improving';
  else if (lostThisMonth > wonThisMonth + 1) trend = 'declining';

  return {
    rate,
    avgDaysToConversion: avgDays,
    wonThisMonth,
    lostThisMonth,
    trend,
    totalActive: active,
    totalPipelineValue: pipelineValue,
  };
}

// ============================================
// PENDING QUOTES (solo reseller)
// ============================================

/**
 * Preventivi attivi con scadenza
 */
export async function getPendingQuotes(workspaceId: string): Promise<PendingQuoteSummary[]> {
  // commercial_quotes è workspace-scoped — usa workspaceQuery
  const wq = workspaceQuery(workspaceId);
  const { data: quotes, error } = await wq
    .from('commercial_quotes')
    .select('id, prospect_company, status, expires_at, margin_percent, carrier_code')
    .in('status', ['sent', 'negotiating'])
    .order('expires_at', { ascending: true });

  if (error || !quotes) {
    console.error(`[crm-data-service] getPendingQuotes error:`, error);
    return [];
  }

  const now = new Date();
  return quotes.map((q: Record<string, unknown>) => ({
    quoteId: q.id as string,
    prospectName: q.prospect_company as string,
    status: q.status as string,
    expiresInDays: q.expires_at
      ? Math.ceil(
          (new Date(q.expires_at as string).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      : undefined,
    marginPercent: (q.margin_percent as number) || undefined,
    carrierCode: (q.carrier_code as string) || undefined,
  }));
}
