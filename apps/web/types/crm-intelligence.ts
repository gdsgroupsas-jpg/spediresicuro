/**
 * Tipi per CRM Intelligence — Sprint S1 + S2
 *
 * Definisce le interfacce per:
 * - CRM Context (iniettato nel system prompt di Anne)
 * - CRM Worker result (risposta del worker CRM)
 * - Today Actions (lista prioritizzata azioni giornaliere)
 * - Suggested Actions (suggerimenti con motivazione)
 * - CRM Write Result (Sprint S2 — azioni di scrittura)
 *
 * @module types/crm-intelligence
 */

// ============================================
// CRM CONTEXT (per system prompt)
// ============================================

/**
 * Contesto CRM iniettato nel system prompt di Anne.
 * Compatto: max 5-6 righe per non gonfiare i token.
 */
export interface CrmContext {
  entityType: 'leads' | 'prospects';
  pipelineSummary: PipelineSummary;
  hotCount: number;
  staleCount: number;
  alertCount: number;
  topActions: string[];
  pendingQuotesCount?: number;
}

export interface PipelineSummary {
  total: number;
  byStatus: Record<string, number>;
  avgScore: number;
  pipelineValue: number;
}

// ============================================
// CRM WORKER RESULT
// ============================================

export interface CrmWorkerResult {
  response: string;
  toolsUsed: string[];
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  priority: 'high' | 'medium' | 'low';
  entityId: string;
  entityName: string;
  action: string;
  /** Il PERCHE', non solo il COSA */
  reasoning: string;
}

// ============================================
// TODAY ACTIONS
// ============================================

export interface TodayAction {
  /** 1 = massima priorita, 10 = minima */
  priority: number;
  entityType: 'lead' | 'prospect';
  entityId: string;
  entityName: string;
  action: string;
  reasoning: string;
  urgency: 'immediate' | 'today' | 'this_week';
}

// ============================================
// SEARCH
// ============================================

export interface CrmSearchFilters {
  status?: string;
  sector?: string;
  minScore?: number;
  maxScore?: number;
}

export interface CrmSearchResult {
  id: string;
  entityType: 'lead' | 'prospect';
  companyName: string;
  contactName?: string;
  email?: string;
  status: string;
  score: number;
  sector?: string;
  lastContactAt?: string;
}

// ============================================
// ENTITY DETAIL
// ============================================

export interface CrmEntityDetail {
  id: string;
  entityType: 'lead' | 'prospect';
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status: string;
  score: number;
  sector?: string;
  estimatedMonthlyVolume?: number;
  estimatedValue?: number;
  createdAt: string;
  updatedAt: string;
  lastContactAt?: string;
  convertedAt?: string;
  lostReason?: string;
  tags?: string[];
  recentEvents: CrmEntityEvent[];
  pendingQuotes?: PendingQuoteSummary[];
}

export interface CrmEntityEvent {
  eventType: string;
  eventData?: Record<string, unknown>;
  createdAt: string;
}

// ============================================
// PENDING QUOTES (solo reseller)
// ============================================

export interface PendingQuoteSummary {
  quoteId: string;
  prospectName: string;
  status: string;
  expiresInDays?: number;
  marginPercent?: number;
  carrierCode?: string;
}

// ============================================
// CONVERSION METRICS
// ============================================

export interface ConversionMetrics {
  rate: number;
  avgDaysToConversion: number;
  wonThisMonth: number;
  lostThisMonth: number;
  trend: 'improving' | 'stable' | 'declining';
  totalActive: number;
  totalPipelineValue: number;
}

// ============================================
// CRM WORKER INPUT
// ============================================

export interface CrmWorkerInput {
  message: string;
  userId: string;
  userRole: 'admin' | 'user';
  workspaceId?: string;
  /** Azione specifica (es. crm_lead, crm_pipeline) quando invocato da runSpecificFlowChain */
  specificFlowId?: string;
}

export type CrmSubIntent =
  | 'pipeline_overview'
  | 'entity_detail'
  | 'today_actions'
  | 'health_check'
  | 'search'
  | 'conversion_analysis'
  // Sprint S2 — Write
  | 'update_status'
  | 'add_note'
  | 'record_contact';

// ============================================
// CRM WRITE RESULT (Sprint S2)
// ============================================

/** Risultato di un'operazione di scrittura CRM */
export interface CrmWriteResult {
  success: boolean;
  entityId: string;
  entityName: string;
  action: 'status_update' | 'note_added' | 'contact_recorded';
  details: string;
  newScore?: number;
  error?: string;
}
