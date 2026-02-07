/**
 * CRM Worker — Sprint S1 (Read-Only)
 *
 * Worker per intelligence CRM. Anne legge la pipeline,
 * capisce il contesto, e suggerisce azioni intelligenti
 * arricchite dalla sales knowledge base.
 *
 * NON prende azioni sulla pipeline (Sprint S2).
 * NON passa dal pricing graph — gestito direttamente dal supervisor-router.
 *
 * @module lib/agent/workers/crm-worker
 */

import {
  getPipelineSummary,
  getHotEntities,
  getStaleEntities,
  getHealthAlerts,
  searchEntities,
  getEntityDetail,
  getTodayActions,
  getConversionMetrics,
  getPendingQuotes,
} from '@/lib/crm/crm-data-service';
import { findRelevantKnowledge } from '@/lib/crm/sales-knowledge';
import type {
  CrmWorkerInput,
  CrmWorkerResult,
  CrmSubIntent,
  SuggestedAction,
} from '@/types/crm-intelligence';
import { defaultLogger, type ILogger } from '../logger';

// ============================================
// SUB-INTENT DETECTION
// ============================================

const SUB_INTENT_PATTERNS: { intent: CrmSubIntent; patterns: RegExp[] }[] = [
  {
    intent: 'today_actions',
    patterns: [
      /cosa (?:devo|dovrei) fare/i,
      /azioni (?:di )?oggi/i,
      /priorit[aà]/i,
      /da fare oggi/i,
      /chi (?:devo|dovrei) contattare/i,
    ],
  },
  {
    intent: 'entity_detail',
    patterns: [
      /a che punto [èe']/i,
      /dettagli? (?:del |di |sul )/i,
      /come (?:va|sta) (?:il |la |con )/i,
      /info su /i,
      /mostra(?:mi)? (?:il |la )/i,
    ],
  },
  {
    intent: 'health_check',
    patterns: [
      /salute/i,
      /health/i,
      /alert/i,
      /problemi? (?:crm|pipeline|commerciali)/i,
      /stale/i,
      /ferm[io]/i,
      /abbandonat[io]/i,
    ],
  },
  {
    intent: 'search',
    patterns: [
      /cerca/i,
      /trova/i,
      /filtra/i,
      /elenca/i,
      /lista/i,
      /mostra(?:mi)? (?:tutti |tutte |i |le )/i,
    ],
  },
  {
    intent: 'conversion_analysis',
    patterns: [
      /tasso (?:di )?conversione/i,
      /conversion/i,
      /quanti (?:ne )?abbiamo (?:vint|pers|chiusi)/i,
      /performance/i,
      /metriche/i,
    ],
  },
  {
    intent: 'pipeline_overview',
    patterns: [
      /pipeline/i,
      /come va/i,
      /situazione/i,
      /panoramica/i,
      /quanti lead/i,
      /quanti prospect/i,
      /overview/i,
      /riepilogo/i,
    ],
  },
];

function detectSubIntent(message: string): CrmSubIntent {
  for (const { intent, patterns } of SUB_INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(message))) {
      return intent;
    }
  }
  // Default: panoramica pipeline
  return 'pipeline_overview';
}

/**
 * Estrae il nome di un'entita dal messaggio (dopo "lead/prospect [nome]")
 */
function extractEntityName(message: string): string | undefined {
  // Pattern: "lead X", "prospect X", "il lead X", "info su X"
  const patterns = [
    /(?:lead|prospect|cliente)\s+["\u201c]?([^"\u201d,?.!]+)/i,
    /(?:info|dettagli|dettaglio)\s+(?:su|di|del|della)\s+["\u201c]?([^"\u201d,?.!]+)/i,
    /(?:a che punto|come va|come sta)\s+(?:il |la |con )?\s*["\u201c]?([^"\u201d,?.!]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Ignora parole troppo corte o generiche
      if (name.length > 2 && !['la', 'il', 'lo', 'un', 'una'].includes(name.toLowerCase())) {
        return name;
      }
    }
  }
  return undefined;
}

/**
 * Estrae filtri di ricerca dal messaggio
 */
function extractSearchFilters(message: string): {
  query: string;
  status?: string;
  sector?: string;
} {
  const lower = message.toLowerCase();

  let status: string | undefined;
  if (lower.includes('nuov')) status = 'new';
  else if (lower.includes('contattat')) status = 'contacted';
  else if (lower.includes('qualificat')) status = 'qualified';
  else if (lower.includes('negoziazion')) status = 'negotiating';
  else if (lower.includes('vint') || lower.includes('convert')) status = 'won';
  else if (lower.includes('pers')) status = 'lost';
  else if (lower.includes('preventivo inviat') || lower.includes('quote_sent'))
    status = 'quote_sent';

  let sector: string | undefined;
  if (lower.includes('ecommerce') || lower.includes('e-commerce')) sector = 'ecommerce';
  else if (lower.includes('pharma') || lower.includes('farmaceut')) sector = 'pharma';
  else if (lower.includes('food') || lower.includes('alimentar')) sector = 'food';
  else if (lower.includes('artigian')) sector = 'artigianato';
  else if (lower.includes('industr')) sector = 'industria';
  else if (lower.includes('logistic')) sector = 'logistica';

  // Estrai testo di ricerca (dopo "cerca", "trova", etc.)
  const searchMatch = message.match(/(?:cerca|trova|filtra)\s+(.+)/i);
  const query = searchMatch ? searchMatch[1].trim() : '';

  return { query, status, sector };
}

// ============================================
// MAIN WORKER
// ============================================

/**
 * CRM Worker — Gestisce richieste di intelligence CRM
 */
export async function crmWorker(
  input: CrmWorkerInput,
  logger: ILogger = defaultLogger
): Promise<CrmWorkerResult> {
  const { message, userRole, workspaceId } = input;
  const subIntent = detectSubIntent(message);
  const isAdmin = userRole === 'admin';
  const entityLabel = isAdmin ? 'lead' : 'prospect';
  const toolsUsed: string[] = [];

  logger.log(`📊 [CRM Worker] Sub-intent: ${subIntent}, role: ${userRole}`);

  try {
    switch (subIntent) {
      case 'pipeline_overview':
        return await handlePipelineOverview(userRole, workspaceId, entityLabel, toolsUsed);

      case 'entity_detail':
        return await handleEntityDetail(message, userRole, workspaceId, entityLabel, toolsUsed);

      case 'today_actions':
        return await handleTodayActions(userRole, workspaceId, entityLabel, toolsUsed);

      case 'health_check':
        return await handleHealthCheck(userRole, workspaceId, entityLabel, toolsUsed);

      case 'search':
        return await handleSearch(message, userRole, workspaceId, entityLabel, toolsUsed);

      case 'conversion_analysis':
        return await handleConversionAnalysis(userRole, workspaceId, entityLabel, toolsUsed);

      default:
        return await handlePipelineOverview(userRole, workspaceId, entityLabel, toolsUsed);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
    logger.warn(`⚠️ [CRM Worker] Errore: ${msg}`);
    return {
      response: `Mi dispiace, c'e' stato un errore nell'accesso ai dati CRM: ${msg}`,
      toolsUsed,
    };
  }
}

// ============================================
// HANDLERS
// ============================================

async function handlePipelineOverview(
  userRole: 'admin' | 'user',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<CrmWorkerResult> {
  toolsUsed.push('get_pipeline_summary', 'get_crm_health_alerts');

  const [summary, metrics, alerts, hot] = await Promise.all([
    getPipelineSummary(userRole, workspaceId),
    getConversionMetrics(userRole, workspaceId),
    getHealthAlerts(userRole, workspaceId),
    getHotEntities(userRole, workspaceId, 3),
  ]);

  // Formatta risposta
  const lines: string[] = [];
  lines.push(`**Pipeline ${entityLabel} — Panoramica**\n`);

  // Conteggi per stato
  const statusEntries = Object.entries(summary.byStatus);
  if (statusEntries.length > 0) {
    const statusLine = statusEntries.map(([s, c]) => `${s}: **${c}**`).join(' | ');
    lines.push(`Totale: **${summary.total}** — ${statusLine}`);
  } else {
    lines.push(`Totale: **${summary.total}** ${entityLabel}`);
  }

  // Metriche chiave
  lines.push(
    `Score medio: **${summary.avgScore}** | Tasso conversione: **${Math.round(metrics.rate * 100)}%** | Valore pipeline: **€${summary.pipelineValue.toLocaleString('it-IT')}**`
  );

  if (metrics.wonThisMonth > 0 || metrics.lostThisMonth > 0) {
    const trendEmoji =
      metrics.trend === 'improving' ? '📈' : metrics.trend === 'declining' ? '📉' : '➡️';
    lines.push(
      `Questo mese: **${metrics.wonThisMonth} vinti**, **${metrics.lostThisMonth} persi** ${trendEmoji}`
    );
  }

  // Alert
  if (alerts.length > 0) {
    lines.push('');
    const critical = alerts.filter((a) => a.level === 'critical');
    const warnings = alerts.filter((a) => a.level === 'warning');

    if (critical.length > 0) {
      lines.push(`**🔴 ${critical.length} alert critici:**`);
      for (const a of critical.slice(0, 3)) {
        lines.push(`- ${a.message}`);
      }
    }
    if (warnings.length > 0) {
      lines.push(`**⚠️ ${warnings.length} avvisi:**`);
      for (const a of warnings.slice(0, 3)) {
        lines.push(`- ${a.message}`);
      }
    }
  }

  // Hot entities
  if (hot.length > 0) {
    lines.push('');
    lines.push(`**🔥 ${entityLabel} caldi:**`);
    for (const h of hot) {
      const contactInfo =
        h.daysSinceLastContact != null
          ? ` (ultimo contatto ${h.daysSinceLastContact}gg fa)`
          : ' (mai contattato)';
      lines.push(`- **${h.name}** — score ${h.score}, stato ${h.status}${contactInfo}`);
    }
  }

  // Suggerimenti basati su knowledge
  const suggestedActions = buildSuggestionsFromAlerts(alerts);

  return { response: lines.join('\n'), toolsUsed, suggestedActions };
}

async function handleEntityDetail(
  message: string,
  userRole: 'admin' | 'user',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<CrmWorkerResult> {
  toolsUsed.push('get_entity_details');

  const entityName = extractEntityName(message);
  if (!entityName) {
    return {
      response: `Quale ${entityLabel} vuoi approfondire? Indicami il nome dell'azienda.`,
      toolsUsed,
    };
  }

  const detail = await getEntityDetail(userRole, undefined, entityName, workspaceId);
  if (!detail) {
    return {
      response: `Non ho trovato ${entityLabel} con nome simile a "${entityName}". Prova con un altro nome o usa la ricerca.`,
      toolsUsed,
    };
  }

  const lines: string[] = [];
  lines.push(`**${detail.companyName}** — ${detail.status}\n`);

  if (detail.contactName) lines.push(`Contatto: ${detail.contactName}`);
  if (detail.email) lines.push(`Email: ${detail.email}`);
  if (detail.phone) lines.push(`Telefono: ${detail.phone}`);
  lines.push(`Score: **${detail.score}** | Settore: ${detail.sector || 'N/D'}`);

  if (detail.estimatedMonthlyVolume) {
    lines.push(`Volume stimato: ${detail.estimatedMonthlyVolume} spedizioni/mese`);
  }
  if (detail.estimatedValue) {
    lines.push(`Valore stimato: €${detail.estimatedValue.toLocaleString('it-IT')}/mese`);
  }

  if (detail.lastContactAt) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(detail.lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    lines.push(`Ultimo contatto: ${daysAgo} giorni fa`);
  } else {
    lines.push(`Ultimo contatto: **mai contattato**`);
  }

  // Timeline eventi recenti
  if (detail.recentEvents.length > 0) {
    lines.push('\n**Timeline recente:**');
    for (const ev of detail.recentEvents.slice(0, 5)) {
      const date = new Date(ev.createdAt).toLocaleDateString('it-IT');
      lines.push(`- ${date}: ${ev.eventType}`);
    }
  }

  // Preventivi collegati (reseller)
  if (detail.pendingQuotes && detail.pendingQuotes.length > 0) {
    lines.push('\n**Preventivi:**');
    for (const q of detail.pendingQuotes) {
      const exp = q.expiresInDays != null ? ` (scade tra ${q.expiresInDays}gg)` : '';
      lines.push(`- ${q.status}${q.carrierCode ? ` [${q.carrierCode}]` : ''}${exp}`);
    }
  }

  // Knowledge settoriale
  if (detail.sector) {
    const knowledge = findRelevantKnowledge(detail.sector);
    const sectorKnowledge = knowledge.find((k) => k.category === 'sector_insight');
    if (sectorKnowledge) {
      lines.push(
        `\n**💡 Insight settore ${detail.sector}:** ${sectorKnowledge.insight.substring(0, 200)}...`
      );
    }
  }

  return { response: lines.join('\n'), toolsUsed };
}

async function handleTodayActions(
  userRole: 'admin' | 'user',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<CrmWorkerResult> {
  toolsUsed.push('get_today_actions');

  const actions = await getTodayActions(userRole, workspaceId);

  if (actions.length === 0) {
    return {
      response: `Nessuna azione urgente per oggi. La pipeline ${entityLabel} e' in ordine. 👍`,
      toolsUsed,
    };
  }

  const lines: string[] = [];
  lines.push(`**Azioni prioritarie — ${actions.length} attivita'**\n`);

  const immediate = actions.filter((a) => a.urgency === 'immediate');
  const today = actions.filter((a) => a.urgency === 'today');
  const thisWeek = actions.filter((a) => a.urgency === 'this_week');

  if (immediate.length > 0) {
    lines.push('**🔴 Immediate:**');
    for (const a of immediate) {
      lines.push(`- **${a.entityName}** — ${a.action}`);
      lines.push(`  _Perche': ${a.reasoning}_`);
    }
  }

  if (today.length > 0) {
    lines.push('\n**🟡 Oggi:**');
    for (const a of today) {
      lines.push(`- **${a.entityName}** — ${a.action}`);
      lines.push(`  _Perche': ${a.reasoning}_`);
    }
  }

  if (thisWeek.length > 0) {
    lines.push('\n**🔵 Questa settimana:**');
    for (const a of thisWeek.slice(0, 3)) {
      lines.push(`- **${a.entityName}** — ${a.action}`);
    }
  }

  // Aggiungi consiglio da knowledge base
  const timingKnowledge = findRelevantKnowledge(null, null, ['timing', 'follow-up']);
  if (timingKnowledge.length > 0) {
    const tip = timingKnowledge[Math.floor(Math.random() * timingKnowledge.length)];
    lines.push(`\n**💡 Tip:** ${tip.insight.substring(0, 150)}`);
  }

  const suggestedActions: SuggestedAction[] = actions.slice(0, 5).map((a) => ({
    priority: a.urgency === 'immediate' ? 'high' : a.urgency === 'today' ? 'medium' : 'low',
    entityId: a.entityId,
    entityName: a.entityName,
    action: a.action,
    reasoning: a.reasoning,
  }));

  return { response: lines.join('\n'), toolsUsed, suggestedActions };
}

async function handleHealthCheck(
  userRole: 'admin' | 'user',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<CrmWorkerResult> {
  toolsUsed.push('get_crm_health_alerts');

  const alerts = await getHealthAlerts(userRole, workspaceId);

  if (alerts.length === 0) {
    return {
      response: `La pipeline ${entityLabel} e' in buona salute. Nessun alert attivo. ✅`,
      toolsUsed,
    };
  }

  const lines: string[] = [];
  lines.push(`**Salute Pipeline — ${alerts.length} alert**\n`);

  const byLevel = {
    critical: alerts.filter((a) => a.level === 'critical'),
    warning: alerts.filter((a) => a.level === 'warning'),
    info: alerts.filter((a) => a.level === 'info'),
  };

  if (byLevel.critical.length > 0) {
    lines.push(`**🔴 Critici (${byLevel.critical.length}):**`);
    for (const a of byLevel.critical) {
      lines.push(`- ${a.message}`);
    }
  }

  if (byLevel.warning.length > 0) {
    lines.push(`\n**⚠️ Avvisi (${byLevel.warning.length}):**`);
    for (const a of byLevel.warning) {
      lines.push(`- ${a.message}`);
    }
  }

  if (byLevel.info.length > 0) {
    lines.push(`\n**ℹ️ Info (${byLevel.info.length}):**`);
    for (const a of byLevel.info) {
      lines.push(`- ${a.message}`);
    }
  }

  return {
    response: lines.join('\n'),
    toolsUsed,
    suggestedActions: buildSuggestionsFromAlerts(alerts),
  };
}

async function handleSearch(
  message: string,
  userRole: 'admin' | 'user',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<CrmWorkerResult> {
  toolsUsed.push('search_crm_entities');

  const { query, status, sector } = extractSearchFilters(message);

  const results = await searchEntities(userRole, query, { status, sector }, workspaceId);

  if (results.length === 0) {
    return {
      response: `Nessun ${entityLabel} trovato con questi criteri. Prova con filtri diversi.`,
      toolsUsed,
    };
  }

  const lines: string[] = [];
  lines.push(`**Risultati ricerca — ${results.length} ${entityLabel}**\n`);

  for (const r of results.slice(0, 10)) {
    const scoreLabel = r.score >= 80 ? '🔴' : r.score >= 60 ? '🟠' : r.score >= 40 ? '🟡' : '⚪';
    lines.push(
      `- ${scoreLabel} **${r.companyName}** — ${r.status} (score ${r.score})${r.sector ? ` [${r.sector}]` : ''}`
    );
  }

  if (results.length > 10) {
    lines.push(`\n_...e altri ${results.length - 10} risultati_`);
  }

  // Knowledge per settore se filtrato
  if (sector) {
    const knowledge = findRelevantKnowledge(sector);
    const sectorTip = knowledge.find((k) => k.category === 'sector_insight');
    if (sectorTip?.example) {
      lines.push(`\n**💡 Settore ${sector}:** ${sectorTip.example}`);
    }
  }

  return { response: lines.join('\n'), toolsUsed };
}

async function handleConversionAnalysis(
  userRole: 'admin' | 'user',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<CrmWorkerResult> {
  toolsUsed.push('get_pipeline_summary');

  const metrics = await getConversionMetrics(userRole, workspaceId);

  const lines: string[] = [];
  lines.push(`**Analisi Conversione ${entityLabel}**\n`);

  const trendEmoji =
    metrics.trend === 'improving' ? '📈' : metrics.trend === 'declining' ? '📉' : '➡️';
  lines.push(`Tasso conversione: **${Math.round(metrics.rate * 100)}%** ${trendEmoji}`);
  lines.push(`Tempo medio a conversione: **${metrics.avgDaysToConversion} giorni**`);
  lines.push(
    `${entityLabel} attivi: **${metrics.totalActive}** | Valore pipeline: **€${metrics.totalPipelineValue.toLocaleString('it-IT')}**`
  );
  lines.push(`Questo mese: **${metrics.wonThisMonth} vinti** / **${metrics.lostThisMonth} persi**`);

  // Insight basato sul trend
  if (metrics.trend === 'declining') {
    const knowledge = findRelevantKnowledge(null, 'conversione bassa', [
      'negoziazione',
      'follow-up',
    ]);
    if (knowledge.length > 0) {
      lines.push(`\n**💡 Suggerimento:** ${knowledge[0].insight.substring(0, 200)}`);
    }
  }

  return { response: lines.join('\n'), toolsUsed };
}

// ============================================
// HELPERS
// ============================================

function buildSuggestionsFromAlerts(
  alerts: { type: string; entityId: string; entityName: string; message: string; level: string }[]
): SuggestedAction[] {
  return alerts.slice(0, 5).map((a) => ({
    priority:
      a.level === 'critical'
        ? ('high' as const)
        : a.level === 'warning'
          ? ('medium' as const)
          : ('low' as const),
    entityId: a.entityId,
    entityName: a.entityName,
    action:
      a.type === 'hot_lead_uncontacted'
        ? 'Contattare immediatamente'
        : a.type === 'winback_candidate'
          ? 'Tentativo di win-back con nuovo angolo'
          : 'Follow-up necessario',
    reasoning: a.message,
  }));
}
