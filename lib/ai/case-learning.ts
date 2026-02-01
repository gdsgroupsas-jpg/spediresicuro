/**
 * Case Learning Service
 *
 * Anne impara dai casi risolti e migliora nel tempo.
 *
 * Flusso:
 * 1. Prima di rispondere, Anne cerca pattern simili gia risolti
 * 2. Se trova un pattern con alta confidence, lo usa come guida
 * 3. Dopo la risoluzione, registra l'esito (success/failure)
 * 4. Il trigger DB aggiorna automaticamente confidence_score
 *
 * Pattern vengono creati:
 * - Automaticamente dopo escalation risolte da operatore
 * - Manualmente dall'admin che valida un pattern
 * - Automaticamente quando Anne risolve con successo un caso nuovo
 */

import { supabaseAdmin } from '@/lib/db/client';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CasePattern {
  id: string;
  category: string;
  carrier: string | null;
  trigger_conditions: Record<string, any>;
  resolution_action: string;
  resolution_params: Record<string, any>;
  successful_message: string | null;
  confidence_score: number;
  success_count: number;
  failure_count: number;
  human_validated: boolean;
}

export interface PatternMatch {
  pattern: CasePattern;
  matchScore: number; // 0-1, quanto il caso corrente matcha il pattern
}

export interface CaseContext {
  category: string;
  carrier?: string;
  holdReason?: string;
  shipmentStatus?: string;
  daysSinceLastEvent?: number;
  userMessage: string;
  keywords: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH: Trova pattern simili
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cerca pattern appresi che matchano il caso corrente.
 * Ritorna i top-3 pattern ordinati per matchScore * confidence.
 */
export async function findSimilarPatterns(ctx: CaseContext): Promise<PatternMatch[]> {
  // Query tutti i pattern attivi nella stessa categoria
  let query = supabaseAdmin
    .from('support_case_patterns')
    .select('*')
    .eq('is_active', true)
    .eq('category', ctx.category)
    .gte('confidence_score', 0.5) // Solo pattern con almeno 50% di successo
    .order('confidence_score', { ascending: false })
    .limit(20);

  if (ctx.carrier) {
    // Cerca sia carrier specifico che generici (carrier IS NULL)
    query = query.or(`carrier.eq.${ctx.carrier},carrier.is.null`);
  }

  const { data: patterns, error } = await query;
  if (error || !patterns?.length) return [];

  // Calcola match score per ogni pattern
  const matches: PatternMatch[] = [];

  for (const pattern of patterns) {
    const score = calculateMatchScore(pattern, ctx);
    if (score > 0.3) {
      // Soglia minima di match
      matches.push({ pattern, matchScore: score });
    }
  }

  // Ordina per score combinato (match * confidence)
  matches.sort((a, b) => {
    const scoreA = a.matchScore * a.pattern.confidence_score;
    const scoreB = b.matchScore * b.pattern.confidence_score;
    // Bonus per pattern validati da umano
    const bonusA = a.pattern.human_validated ? 0.1 : 0;
    const bonusB = b.pattern.human_validated ? 0.1 : 0;
    return scoreB + bonusB - (scoreA + bonusA);
  });

  return matches.slice(0, 3);
}

/**
 * Calcola quanto un pattern matcha il contesto corrente.
 */
function calculateMatchScore(pattern: CasePattern, ctx: CaseContext): number {
  const conditions = pattern.trigger_conditions;
  let matchedConditions = 0;
  let totalConditions = 0;

  // Match hold_reason
  if (conditions.hold_reason) {
    totalConditions++;
    if (conditions.hold_reason === ctx.holdReason) matchedConditions++;
  }

  // Match shipment_status
  if (conditions.shipment_status) {
    totalConditions++;
    if (conditions.shipment_status === ctx.shipmentStatus) matchedConditions++;
  }

  // Match carrier
  if (conditions.carrier) {
    totalConditions++;
    if (conditions.carrier === ctx.carrier) matchedConditions++;
  }

  // Match days_stale range
  if (conditions.days_stale_min !== undefined && ctx.daysSinceLastEvent !== undefined) {
    totalConditions++;
    if (ctx.daysSinceLastEvent >= conditions.days_stale_min) matchedConditions++;
  }

  // Match keywords
  if (conditions.keywords && Array.isArray(conditions.keywords) && ctx.keywords.length > 0) {
    totalConditions++;
    const matchedKeywords = conditions.keywords.filter((kw: string) =>
      ctx.keywords.some((uk) => uk.includes(kw) || kw.includes(uk))
    );
    if (matchedKeywords.length > 0) {
      matchedConditions += matchedKeywords.length / conditions.keywords.length;
    }
  }

  if (totalConditions === 0) return 0;
  return matchedConditions / totalConditions;
}

// ═══════════════════════════════════════════════════════════════════════════
// LEARN: Registra esiti e crea nuovi pattern
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registra l'esito di un pattern usato.
 * Il trigger DB aggiorna automaticamente confidence_score.
 */
export async function recordPatternUsage(
  patternId: string,
  userId: string,
  outcome: 'success' | 'failure' | 'partial' | 'escalated',
  opts?: {
    shipmentId?: string;
    resolutionTimeSeconds?: number;
    userMessage?: string;
    userFeedback?: number;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from('support_pattern_usage').insert({
    pattern_id: patternId,
    user_id: userId,
    shipment_id: opts?.shipmentId || null,
    outcome,
    resolution_time_seconds: opts?.resolutionTimeSeconds || null,
    user_message: opts?.userMessage || null,
    user_feedback: opts?.userFeedback || null,
  });

  if (error) {
    console.error('[Case Learning] Errore registrazione usage:', error.message);
  }
}

/**
 * Crea un nuovo pattern da un caso risolto con successo.
 * Chiamato quando Anne risolve un caso che non matchava nessun pattern esistente.
 */
export async function learnFromResolvedCase(
  ctx: CaseContext,
  resolution: {
    action: string;
    params?: Record<string, any>;
    message?: string;
  },
  opts?: {
    sourceEscalationId?: string;
  }
): Promise<string | null> {
  // Verifica che non esista gia un pattern quasi identico
  const existing = await findSimilarPatterns(ctx);
  if (existing.length > 0 && existing[0].matchScore > 0.8) {
    // Pattern simile esiste, aggiorna quello
    return existing[0].pattern.id;
  }

  // Costruisci trigger conditions dal contesto
  const triggerConditions: Record<string, any> = {};
  if (ctx.holdReason) triggerConditions.hold_reason = ctx.holdReason;
  if (ctx.shipmentStatus) triggerConditions.shipment_status = ctx.shipmentStatus;
  if (ctx.carrier) triggerConditions.carrier = ctx.carrier;
  if (ctx.daysSinceLastEvent !== undefined && ctx.daysSinceLastEvent > 2) {
    triggerConditions.days_stale_min = ctx.daysSinceLastEvent;
  }
  if (ctx.keywords.length > 0) {
    triggerConditions.keywords = ctx.keywords.slice(0, 5); // Max 5 keywords
  }

  const { data, error } = await supabaseAdmin
    .from('support_case_patterns')
    .insert({
      category: ctx.category,
      carrier: ctx.carrier || null,
      trigger_conditions: triggerConditions,
      resolution_action: resolution.action,
      resolution_params: resolution.params || {},
      successful_message: resolution.message || null,
      source_escalation_id: opts?.sourceEscalationId || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Case Learning] Errore creazione pattern:', error.message);
    return null;
  }

  console.log(
    `[Case Learning] Nuovo pattern appreso: ${data.id} (${ctx.category}/${ctx.carrier || '*'})`
  );
  return data.id;
}

/**
 * Apprende automaticamente da una escalation risolta.
 * Chiamato quando un operatore risolve un'escalation.
 */
export async function learnFromEscalation(escalationId: string): Promise<void> {
  const { data: escalation } = await supabaseAdmin
    .from('support_escalations')
    .select('*')
    .eq('id', escalationId)
    .eq('status', 'resolved')
    .single();

  if (!escalation || !escalation.resolution) return;

  // Estrai contesto dall'escalation
  const metadata = escalation.metadata || {};
  const ctx: CaseContext = {
    category: metadata.category || 'generico',
    carrier: metadata.carrier,
    holdReason: metadata.hold_reason,
    shipmentStatus: metadata.shipment_status,
    userMessage: escalation.reason,
    keywords: extractKeywords(escalation.reason + ' ' + escalation.anne_summary),
  };

  await learnFromResolvedCase(
    ctx,
    {
      action: metadata.resolution_action || 'manual',
      message: escalation.resolution,
    },
    { sourceEscalationId: escalationId }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estrai keywords rilevanti da un testo.
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'il',
    'lo',
    'la',
    'i',
    'gli',
    'le',
    'un',
    'una',
    'di',
    'da',
    'in',
    'con',
    'su',
    'per',
    'tra',
    'fra',
    'a',
    'e',
    'o',
    'ma',
    'non',
    'che',
    'come',
    'sono',
    'ho',
    'ha',
    'mia',
    'mio',
    'mi',
    'si',
    'ci',
    'ne',
    'del',
    'della',
    'dei',
    'delle',
    'al',
    'alla',
    'ai',
    'alle',
    'questo',
    'questa',
    'quello',
    'quella',
    'piu',
    'molto',
    'anche',
    'poi',
    'ancora',
    'vorrei',
    'posso',
    'puoi',
    'cosa',
    'quando',
    'dove',
    'perche',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-zA-ZàèéìòùÀÈÉÌÒÙ\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 10);
}
