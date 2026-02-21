/**
 * CRM Health Rules — Funzioni pure per regole di alerting/automazione
 *
 * Ogni regola analizza un lead/prospect e decide se scatenare un'azione.
 * PURO: nessuna dipendenza esterna, completamente testabile.
 *
 * @module lib/crm/health-rules
 */

// ============================================
// TYPES
// ============================================

export type CrmAlertType =
  | 'stale_new_prospect' // Prospect new da >3gg senza contatto
  | 'cold_contacted_prospect' // Prospect contacted >7gg senza follow-up
  | 'hot_lead_uncontacted' // Lead con score >80 ancora new
  | 'stale_qualified_lead' // Lead qualified >5gg senza avanzamento
  | 'expired_quote_prospect' // Preventivo scaduto con prospect attivo
  | 'winback_candidate' // Prospect/lead lost da >30gg
  | 'score_decay'; // Score calato >15 punti

export type CrmAlertLevel = 'info' | 'warning' | 'critical';

export interface CrmAlert {
  type: CrmAlertType;
  level: CrmAlertLevel;
  entityType: 'lead' | 'prospect';
  entityId: string;
  entityName: string;
  message: string;
  daysSinceEvent: number;
}

export interface HealthCheckEntity {
  id: string;
  company_name: string;
  status: string;
  lead_score?: number | null;
  created_at: string;
  last_contact_at?: string | null;
  updated_at: string;
}

// ============================================
// CONFIGURAZIONE SOGLIE
// ============================================

export const HEALTH_THRESHOLDS = {
  /** Giorni senza contatto per prospect 'new' */
  STALE_NEW_DAYS: 3,
  /** Giorni senza follow-up per prospect 'contacted' */
  COLD_CONTACTED_DAYS: 7,
  /** Score minimo per alert "lead caldo non contattato" */
  HOT_SCORE_THRESHOLD: 80,
  /** Giorni senza avanzamento per lead 'qualified' */
  STALE_QUALIFIED_DAYS: 5,
  /** Giorni dopo perdita per candidato win-back */
  WINBACK_DAYS: 30,
  /** Delta score minimo per alert decay */
  SCORE_DECAY_THRESHOLD: 15,
} as const;

// ============================================
// HELPER
// ============================================

/**
 * Calcola giorni tra due date
 */
export function daysBetween(from: string | Date, to: Date): number {
  const fromDate = typeof from === 'string' ? new Date(from) : from;
  return (to.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
}

// ============================================
// REGOLE PROSPECT (Reseller CRM)
// ============================================

/**
 * Prospect 'new' da >3 giorni senza contatto
 */
export function checkStaleNewProspect(prospect: HealthCheckEntity, now: Date): CrmAlert | null {
  if (prospect.status !== 'new') return null;

  const refDate = prospect.last_contact_at || prospect.created_at;
  const days = daysBetween(refDate, now);

  if (days > HEALTH_THRESHOLDS.STALE_NEW_DAYS) {
    return {
      type: 'stale_new_prospect',
      level: 'warning',
      entityType: 'prospect',
      entityId: prospect.id,
      entityName: prospect.company_name,
      message: `Prospect "${prospect.company_name}" e nuovo da ${Math.floor(days)} giorni senza contatto`,
      daysSinceEvent: Math.floor(days),
    };
  }
  return null;
}

/**
 * Prospect 'contacted' da >7 giorni senza follow-up
 */
export function checkColdContactedProspect(
  prospect: HealthCheckEntity,
  now: Date
): CrmAlert | null {
  if (prospect.status !== 'contacted') return null;

  const refDate = prospect.last_contact_at || prospect.updated_at;
  const days = daysBetween(refDate, now);

  if (days > HEALTH_THRESHOLDS.COLD_CONTACTED_DAYS) {
    return {
      type: 'cold_contacted_prospect',
      level: 'warning',
      entityType: 'prospect',
      entityId: prospect.id,
      entityName: prospect.company_name,
      message: `Prospect "${prospect.company_name}" contattato ${Math.floor(days)} giorni fa senza follow-up`,
      daysSinceEvent: Math.floor(days),
    };
  }
  return null;
}

// ============================================
// REGOLE LEAD (Platform CRM)
// ============================================

/**
 * Lead con score >80 ancora in stato 'new'
 */
export function checkHotLeadUncontacted(lead: HealthCheckEntity, now: Date): CrmAlert | null {
  if (lead.status !== 'new') return null;
  if (!lead.lead_score || lead.lead_score < HEALTH_THRESHOLDS.HOT_SCORE_THRESHOLD) return null;

  const days = daysBetween(lead.created_at, now);

  return {
    type: 'hot_lead_uncontacted',
    level: 'critical',
    entityType: 'lead',
    entityId: lead.id,
    entityName: lead.company_name,
    message: `Lead CALDO "${lead.company_name}" (score ${lead.lead_score}) non ancora contattato! (${Math.floor(days)} giorni)`,
    daysSinceEvent: Math.floor(days),
  };
}

/**
 * Lead 'qualified' da >5 giorni senza avanzamento
 */
export function checkStaleQualifiedLead(lead: HealthCheckEntity, now: Date): CrmAlert | null {
  if (lead.status !== 'qualified') return null;

  const refDate = lead.last_contact_at || lead.updated_at;
  const days = daysBetween(refDate, now);

  if (days > HEALTH_THRESHOLDS.STALE_QUALIFIED_DAYS) {
    return {
      type: 'stale_qualified_lead',
      level: 'warning',
      entityType: 'lead',
      entityId: lead.id,
      entityName: lead.company_name,
      message: `Lead qualificato "${lead.company_name}" fermo da ${Math.floor(days)} giorni`,
      daysSinceEvent: Math.floor(days),
    };
  }
  return null;
}

// ============================================
// REGOLE CROSS-LIVELLO
// ============================================

/**
 * Lead/prospect 'lost' da >30 giorni (candidato win-back)
 */
export function checkWinbackCandidate(
  entity: HealthCheckEntity,
  entityType: 'lead' | 'prospect',
  now: Date
): CrmAlert | null {
  if (entity.status !== 'lost') return null;

  const days = daysBetween(entity.updated_at, now);

  if (days >= HEALTH_THRESHOLDS.WINBACK_DAYS && days < HEALTH_THRESHOLDS.WINBACK_DAYS + 7) {
    // Solo nella finestra 30-37 giorni (evita alert ripetuti)
    return {
      type: 'winback_candidate',
      level: 'info',
      entityType,
      entityId: entity.id,
      entityName: entity.company_name,
      message: `${entityType === 'lead' ? 'Lead' : 'Prospect'} "${entity.company_name}" perso da ${Math.floor(days)} giorni — candidato win-back`,
      daysSinceEvent: Math.floor(days),
    };
  }
  return null;
}

/**
 * Applica tutte le regole a una lista di entita
 */
export function evaluateHealthRules(
  entities: HealthCheckEntity[],
  entityType: 'lead' | 'prospect',
  now: Date
): CrmAlert[] {
  const alerts: CrmAlert[] = [];

  for (const entity of entities) {
    if (entityType === 'prospect') {
      const staleNew = checkStaleNewProspect(entity, now);
      if (staleNew) alerts.push(staleNew);

      const coldContacted = checkColdContactedProspect(entity, now);
      if (coldContacted) alerts.push(coldContacted);
    }

    if (entityType === 'lead') {
      const hotLead = checkHotLeadUncontacted(entity, now);
      if (hotLead) alerts.push(hotLead);

      const staleLead = checkStaleQualifiedLead(entity, now);
      if (staleLead) alerts.push(staleLead);
    }

    const winback = checkWinbackCandidate(entity, entityType, now);
    if (winback) alerts.push(winback);
  }

  return alerts;
}
