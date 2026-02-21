/**
 * Outreach Worker — Sprint S3c
 *
 * Worker per outreach multi-canale. Anne gestisce:
 * - Enrollment a sequenze
 * - Invio messaggi singoli
 * - Gestione canali (abilita/disabilita)
 * - Status enrollment e metriche
 * - Lista template e sequenze
 *
 * NON passa dal pricing graph — gestito direttamente dal supervisor-router.
 *
 * @module lib/agent/workers/outreach-worker
 */

import {
  enrollEntity,
  cancelEnrollment,
  pauseEnrollment,
  resumeEnrollment,
  getEnrollmentsByEntity,
  isAlreadyEnrolled,
} from '@/lib/outreach/enrollment-service';
import {
  getSequences,
  getSequenceWithSteps,
  getTemplates,
  getChannelConfig,
  upsertChannelConfig,
  findSequencesByTrigger,
} from '@/lib/outreach/outreach-data-service';
import { getProvider, getConfiguredChannels } from '@/lib/outreach/channel-providers';
import { getOutreachMetrics } from '@/lib/outreach/outreach-analytics';
import { renderTemplate, buildTemplateVars } from '@/lib/outreach/template-engine';
import { checkConsent } from '@/lib/outreach/consent-service';
import { isOutreachKillSwitchActive } from '@/lib/outreach/outreach-feature-flags';
import { searchEntities, getEntityDetail } from '@/lib/crm/crm-data-service';
import type { OutreachChannel } from '@/types/outreach';
import { defaultLogger, type ILogger } from '../logger';

// ============================================
// TIPI
// ============================================

export interface OutreachWorkerInput {
  message: string;
  userId: string;
  userRole: 'admin' | 'user' | 'reseller' | 'reseller';
  workspaceId?: string;
}

export interface OutreachWorkerResult {
  response: string;
  toolsUsed: string[];
}

// ============================================
// SUB-INTENT DETECTION
// ============================================

type OutreachSubIntent =
  | 'enroll_entity'
  | 'cancel_enrollment'
  | 'pause_enrollment'
  | 'resume_enrollment'
  | 'send_message'
  | 'check_status'
  | 'manage_channels'
  | 'list_templates'
  | 'list_sequences'
  | 'outreach_metrics';

const SUB_INTENT_PATTERNS: { intent: OutreachSubIntent; patterns: RegExp[] }[] = [
  {
    intent: 'enroll_entity',
    patterns: [
      /(?:iscrivi|enroll|aggiungi)\s+(?:a|alla|nella)\s+(?:sequenza|campagna)/i,
      /(?:attiva|avvia)\s+(?:sequenza|campagna|outreach)\s+(?:per|su|a)/i,
      /(?:iscrivi|inserisci)\s+.+\s+(?:al|nella|alla)\s+(?:followup|intro|winback)/i,
    ],
  },
  {
    intent: 'cancel_enrollment',
    patterns: [
      /(?:cancella|rimuovi|annulla)\s+(?:enrollment|iscrizione|sequenza)/i,
      /(?:ferma|stop)\s+(?:sequenza|outreach|campagna)/i,
    ],
  },
  {
    intent: 'pause_enrollment',
    patterns: [
      /(?:metti in pausa|pausa)\s+(?:sequenza|outreach|enrollment)/i,
      /(?:sospendi)\s+(?:sequenza|outreach)/i,
    ],
  },
  {
    intent: 'resume_enrollment',
    patterns: [/(?:riprendi|riattiva|riavvia)\s+(?:sequenza|outreach|enrollment)/i],
  },
  {
    intent: 'send_message',
    patterns: [
      /(?:manda|invia|scrivi)\s+(?:una? )?(?:email|whatsapp|telegram|messaggio)/i,
      /(?:manda|invia)\s+(?:followup|follow-up|reminder)/i,
    ],
  },
  {
    intent: 'manage_channels',
    patterns: [
      /(?:abilita|disabilita|attiva|disattiva)\s+(?:canale |)(?:email|whatsapp|telegram)/i,
      /(?:canali)\s+(?:attivi|configurati|disponibili)/i,
      /(?:quali|che)\s+canali/i,
    ],
  },
  {
    intent: 'list_templates',
    patterns: [
      /(?:mostra|lista|elenca|quali)\s+(?:i )?template/i,
      /template\s+(?:disponibili|attivi)/i,
    ],
  },
  {
    intent: 'list_sequences',
    patterns: [
      /(?:mostra|lista|elenca|quali)\s+(?:le )?(?:sequenze|campagne)/i,
      /sequenze?\s+(?:disponibili|attive)/i,
    ],
  },
  {
    intent: 'outreach_metrics',
    patterns: [
      /(?:metriche|statistiche|performance|risultati)\s+(?:outreach|campagne|sequenze)/i,
      /(?:quanti|quante)\s+(?:email|messaggi|invii)/i,
      /tasso\s+(?:di )?(apertura|risposta|delivery)/i,
    ],
  },
  {
    intent: 'check_status',
    patterns: [
      /(?:stato|status)\s+(?:outreach|sequenza|enrollment|campagna)/i,
      /(?:a che punto|come va)\s+(?:l'outreach|la sequenza|la campagna)/i,
    ],
  },
];

function detectSubIntent(message: string): OutreachSubIntent {
  for (const { intent, patterns } of SUB_INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(message))) {
      return intent;
    }
  }
  return 'check_status';
}

/**
 * Estrae nome entita' dal messaggio
 */
function extractEntityName(message: string): string | undefined {
  const patterns = [
    /(?:iscrivi|enroll|aggiungi|manda|invia)\s+(?:a |alla |nella )?(?:sequenza |campagna )?(?:il |la )?(?:lead |prospect )?["'\u201c]?([^"'\u201d,?.!]+?)["'\u201d]?\s+(?:a|al|alla|nella|per)/i,
    /(?:per|su|a)\s+(?:il |la )?(?:lead |prospect )?["'\u201c]?([^"'\u201d,?.!]+?)["'\u201d]?\s*$/i,
    /(?:manda|invia)\s+(?:email|whatsapp|telegram|messaggio)\s+(?:a|al|alla)\s+(?:il |la )?(?:lead |prospect )?["'\u201c]?([^"'\u201d,?.!]+)/i,
    /(?:stato|status)\s+(?:outreach|sequenza)\s+(?:di |per )?(?:il |la )?["'\u201c]?([^"'\u201d,?.!]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim();
      if (
        name.length > 2 &&
        !['la', 'il', 'lo', 'un', 'una', 'al', 'alla'].includes(name.toLowerCase())
      ) {
        return name;
      }
    }
  }
  return undefined;
}

/**
 * Estrae il canale dal messaggio
 */
function extractChannel(message: string): OutreachChannel | undefined {
  const lower = message.toLowerCase();
  if (lower.includes('email') || lower.includes('e-mail')) return 'email';
  if (lower.includes('whatsapp') || lower.includes('wa')) return 'whatsapp';
  if (lower.includes('telegram') || lower.includes('tg')) return 'telegram';
  return undefined;
}

// ============================================
// MAIN WORKER
// ============================================

export async function outreachWorker(
  input: OutreachWorkerInput,
  logger: ILogger = defaultLogger
): Promise<OutreachWorkerResult> {
  const { message, userRole, workspaceId } = input;
  const subIntent = detectSubIntent(message);
  const isAdmin = userRole === 'admin';
  const entityLabel = isAdmin ? 'lead' : 'prospect';
  const toolsUsed: string[] = [];

  logger.log(`📨 [Outreach Worker] Sub-intent: ${subIntent}, role: ${userRole}`);

  // Kill switch: blocca operazioni di invio, permetti letture (status, metriche, listing)
  const readOnlyIntents: OutreachSubIntent[] = [
    'check_status',
    'outreach_metrics',
    'list_templates',
    'list_sequences',
    'manage_channels',
  ];
  if (isOutreachKillSwitchActive() && !readOnlyIntents.includes(subIntent)) {
    return {
      response:
        "Il sistema outreach e' temporaneamente sospeso (kill switch attivo). Le operazioni di invio e enrollment sono bloccate. Contatta l'amministratore per riattivare.",
      toolsUsed: [],
    };
  }

  try {
    switch (subIntent) {
      case 'enroll_entity':
        return await handleEnrollEntity(message, userRole, workspaceId, entityLabel, toolsUsed);

      case 'cancel_enrollment':
        return await handleCancelEnrollment(message, userRole, workspaceId, entityLabel, toolsUsed);

      case 'pause_enrollment':
        return await handlePauseResumeEnrollment(
          message,
          userRole,
          workspaceId,
          entityLabel,
          toolsUsed,
          'pause'
        );

      case 'resume_enrollment':
        return await handlePauseResumeEnrollment(
          message,
          userRole,
          workspaceId,
          entityLabel,
          toolsUsed,
          'resume'
        );

      case 'send_message':
        return await handleSendMessage(message, userRole, workspaceId, entityLabel, toolsUsed);

      case 'manage_channels':
        return await handleManageChannels(message, workspaceId, toolsUsed);

      case 'list_templates':
        return await handleListTemplates(workspaceId, extractChannel(message), toolsUsed);

      case 'list_sequences':
        return await handleListSequences(workspaceId, toolsUsed);

      case 'outreach_metrics':
        return await handleOutreachMetrics(workspaceId, toolsUsed);

      case 'check_status':
        return await handleCheckStatus(message, userRole, workspaceId, entityLabel, toolsUsed);

      default:
        return await handleCheckStatus(message, userRole, workspaceId, entityLabel, toolsUsed);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
    logger.warn(`⚠️ [Outreach Worker] Errore: ${msg}`);
    return {
      response: `Mi dispiace, c'e' stato un errore nel sistema outreach: ${msg}`,
      toolsUsed,
    };
  }
}

// ============================================
// HANDLERS
// ============================================

async function handleEnrollEntity(
  message: string,
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('schedule_outreach');

  const entityName = extractEntityName(message);
  if (!entityName) {
    return {
      response: `Quale ${entityLabel} vuoi iscrivere alla sequenza? Indicami il nome.\nEsempio: "iscrivi Farmacia Rossi alla sequenza followup"`,
      toolsUsed,
    };
  }

  if (!workspaceId) {
    return {
      response: "Workspace non identificato. Impossibile procedere con l'enrollment.",
      toolsUsed,
    };
  }

  // Cerca entita'
  const entity = await getEntityDetail(userRole, undefined, entityName, workspaceId);
  if (!entity) {
    return {
      response: `Non ho trovato ${entityLabel} con nome simile a "${entityName}".`,
      toolsUsed,
    };
  }

  // Cerca sequenze disponibili
  const sequences = await getSequences(workspaceId);
  const activeSequences = sequences.filter((s) => s.is_active);

  if (activeSequences.length === 0) {
    return {
      response:
        "Non ci sono sequenze attive configurate. Crea una sequenza prima di iscrivere entita'.",
      toolsUsed,
    };
  }

  // Prova a matchare sequenza dal messaggio
  const lower = message.toLowerCase();
  let targetSequence = activeSequences.find((s) => lower.includes(s.name.toLowerCase()));
  if (!targetSequence) {
    // Prova match per trigger
    if (lower.includes('followup') || lower.includes('follow-up')) {
      targetSequence = activeSequences.find(
        (s) => s.trigger_on === 'stale' || s.name.toLowerCase().includes('followup')
      );
    } else if (lower.includes('intro')) {
      targetSequence = activeSequences.find(
        (s) =>
          s.trigger_on === 'new_lead' ||
          s.trigger_on === 'new_prospect' ||
          s.name.toLowerCase().includes('intro')
      );
    } else if (lower.includes('winback') || lower.includes('win-back')) {
      targetSequence = activeSequences.find(
        (s) => s.trigger_on === 'winback' || s.name.toLowerCase().includes('winback')
      );
    }
  }

  if (!targetSequence) {
    const seqList = activeSequences
      .map((s) => `- **${s.name}** (trigger: ${s.trigger_on})`)
      .join('\n');
    return {
      response: `Non ho capito quale sequenza usare. Sequenze disponibili:\n${seqList}\n\nEsempio: "iscrivi ${entityName} alla sequenza [nome]"`,
      toolsUsed,
    };
  }

  // Controlla se gia' enrolled
  const entityType = userRole === 'admin' ? 'lead' : 'prospect';
  const alreadyEnrolled = await isAlreadyEnrolled(
    targetSequence.id,
    entityType as 'lead' | 'prospect',
    entity.id
  );
  if (alreadyEnrolled) {
    return {
      response: `**${entity.companyName}** e' gia' iscritto alla sequenza "${targetSequence.name}".`,
      toolsUsed,
    };
  }

  // Enroll
  const result = await enrollEntity({
    sequenceId: targetSequence.id,
    entityType: entityType as 'lead' | 'prospect',
    entityId: entity.id,
    workspaceId,
  });

  if (!result.success) {
    return {
      response: `Non posso iscrivere **${entity.companyName}**: ${result.error}`,
      toolsUsed,
    };
  }

  return {
    response: `✅ **${entity.companyName}** iscritto alla sequenza "${targetSequence.name}"\nLa sequenza iniziera' automaticamente secondo i tempi configurati.`,
    toolsUsed,
  };
}

async function handleCancelEnrollment(
  message: string,
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('schedule_outreach');

  const entityName = extractEntityName(message);
  if (!entityName || !workspaceId) {
    return {
      response: `Quale ${entityLabel} vuoi rimuovere dalla sequenza?\nEsempio: "cancella sequenza per Farmacia Rossi"`,
      toolsUsed,
    };
  }

  const entity = await getEntityDetail(userRole, undefined, entityName, workspaceId);
  if (!entity) {
    return { response: `Non ho trovato ${entityLabel} "${entityName}".`, toolsUsed };
  }

  const entityType = (userRole === 'admin' ? 'lead' : 'prospect') as 'lead' | 'prospect';
  const enrollments = await getEnrollmentsByEntity(entityType, entity.id, workspaceId);
  const active = enrollments.filter((e) => e.status === 'active' || e.status === 'paused');

  if (active.length === 0) {
    return {
      response: `**${entity.companyName}** non ha enrollment attivi.`,
      toolsUsed,
    };
  }

  // Cancella tutti gli enrollment attivi
  let cancelled = 0;
  for (const enr of active) {
    const res = await cancelEnrollment(enr.id, workspaceId, 'Cancellato via chat');
    if (res.success) cancelled++;
  }

  return {
    response: `✅ ${cancelled} enrollment cancellati per **${entity.companyName}**.`,
    toolsUsed,
  };
}

async function handlePauseResumeEnrollment(
  message: string,
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[],
  action: 'pause' | 'resume'
): Promise<OutreachWorkerResult> {
  toolsUsed.push('schedule_outreach');

  const entityName = extractEntityName(message);
  if (!entityName || !workspaceId) {
    return {
      response: `Quale ${entityLabel} vuoi ${action === 'pause' ? 'mettere in pausa' : 'riprendere'}?\nEsempio: "${action === 'pause' ? 'pausa' : 'riprendi'} sequenza per Farmacia Rossi"`,
      toolsUsed,
    };
  }

  const entity = await getEntityDetail(userRole, undefined, entityName, workspaceId);
  if (!entity) {
    return { response: `Non ho trovato ${entityLabel} "${entityName}".`, toolsUsed };
  }

  const entityType = (userRole === 'admin' ? 'lead' : 'prospect') as 'lead' | 'prospect';
  const enrollments = await getEnrollmentsByEntity(entityType, entity.id, workspaceId);
  const target = enrollments.filter((e) =>
    action === 'pause' ? e.status === 'active' : e.status === 'paused'
  );

  if (target.length === 0) {
    const status = action === 'pause' ? 'attivi' : 'in pausa';
    return {
      response: `**${entity.companyName}** non ha enrollment ${status}.`,
      toolsUsed,
    };
  }

  let count = 0;
  for (const enr of target) {
    const res =
      action === 'pause'
        ? await pauseEnrollment(enr.id, workspaceId)
        : await resumeEnrollment(enr.id, workspaceId);
    if (res.success) count++;
  }

  const verb = action === 'pause' ? 'messi in pausa' : 'ripresi';
  return {
    response: `✅ ${count} enrollment ${verb} per **${entity.companyName}**.`,
    toolsUsed,
  };
}

async function handleSendMessage(
  message: string,
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('schedule_outreach');

  const entityName = extractEntityName(message);
  const channel = extractChannel(message);

  if (!entityName) {
    return {
      response: `A quale ${entityLabel} vuoi inviare il messaggio?\nEsempio: "manda email a Farmacia Rossi"`,
      toolsUsed,
    };
  }

  if (!channel) {
    return {
      response: `Su quale canale vuoi inviare? (email, whatsapp, telegram)\nEsempio: "manda email a ${entityName}"`,
      toolsUsed,
    };
  }

  if (!workspaceId) {
    return { response: 'Workspace non identificato.', toolsUsed };
  }

  // Verifica provider configurato
  const provider = getProvider(channel);
  if (!provider.isConfigured()) {
    return {
      response: `Il canale **${channel}** non e' configurato. Verifica le variabili d'ambiente.`,
      toolsUsed,
    };
  }

  // Cerca entita'
  const entity = await getEntityDetail(userRole, undefined, entityName, workspaceId);
  if (!entity) {
    return { response: `Non ho trovato ${entityLabel} "${entityName}".`, toolsUsed };
  }

  // Verifica consenso
  const entityType = (userRole === 'admin' ? 'lead' : 'prospect') as 'lead' | 'prospect';
  const hasConsent = await checkConsent(entityType, entity.id, channel);
  if (!hasConsent) {
    return {
      response: `⚠️ **${entity.companyName}** non ha dato consenso per il canale **${channel}**. Non posso inviare senza consenso GDPR.`,
      toolsUsed,
    };
  }

  // Cerca template appropriato
  const templates = await getTemplates(workspaceId, { channel });
  if (templates.length === 0) {
    return {
      response: `Nessun template ${channel} disponibile. Crea un template prima di inviare.`,
      toolsUsed,
    };
  }

  // Usa il primo template della categoria followup, o il primo disponibile
  const template = templates.find((t) => t.category === 'followup') || templates[0];

  // Risolvi destinatario
  const recipient =
    channel === 'email' ? entity.email : channel === 'whatsapp' ? entity.phone : undefined;

  if (!recipient) {
    return {
      response: `**${entity.companyName}** non ha ${channel === 'email' ? 'email' : 'telefono'} registrato.`,
      toolsUsed,
    };
  }

  // Render e invio
  const vars = buildTemplateVars(entity as unknown as Record<string, unknown>);
  const body = renderTemplate(template.body, vars);
  const subject = template.subject ? renderTemplate(template.subject, vars) : null;

  const sendResult = await provider.send(recipient, subject, body);

  if (!sendResult.success) {
    return {
      response: `❌ Errore invio ${channel} a **${entity.companyName}**: ${sendResult.error}`,
      toolsUsed,
    };
  }

  return {
    response: `✅ ${channel.charAt(0).toUpperCase() + channel.slice(1)} inviato a **${entity.companyName}** (${recipient})\nTemplate: ${template.name}`,
    toolsUsed,
  };
}

async function handleManageChannels(
  message: string,
  workspaceId: string | undefined,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('manage_outreach_channels');

  if (!workspaceId) {
    return { response: 'Workspace non identificato.', toolsUsed };
  }

  const lower = message.toLowerCase();
  const channel = extractChannel(message);

  // Se e' una richiesta di lista canali
  if (
    !channel ||
    lower.includes('quali canali') ||
    lower.includes('canali attivi') ||
    lower.includes('canali configurati')
  ) {
    const configs = await getChannelConfig(workspaceId);
    const configured = getConfiguredChannels();

    const lines: string[] = ['**Canali Outreach**\n'];

    for (const ch of ['email', 'whatsapp', 'telegram'] as OutreachChannel[]) {
      const config = configs.find((c) => c.channel === ch);
      const envOk = configured.includes(ch);
      const enabled = config?.enabled ?? false;
      const icon = enabled && envOk ? '✅' : envOk ? '⚪' : '❌';
      const status =
        enabled && envOk
          ? 'Attivo'
          : envOk
            ? 'Configurato ma disabilitato'
            : 'Non configurato (env vars mancanti)';
      lines.push(`${icon} **${ch}**: ${status}`);
      if (config?.daily_limit) {
        lines.push(`   Limite giornaliero: ${config.daily_limit}`);
      }
    }

    return { response: lines.join('\n'), toolsUsed };
  }

  // Toggle canale
  const enable = lower.includes('abilita') || lower.includes('attiva');
  const disable = lower.includes('disabilita') || lower.includes('disattiva');

  if (!enable && !disable) {
    return {
      response: `Vuoi abilitare o disabilitare **${channel}**?\nEsempio: "abilita email" o "disabilita whatsapp"`,
      toolsUsed,
    };
  }

  const newState = enable;
  const result = await upsertChannelConfig({
    workspaceId,
    channel,
    enabled: newState,
  });

  if (!result.success) {
    return {
      response: `Errore configurazione canale: ${result.error}`,
      toolsUsed,
    };
  }

  return {
    response: `✅ Canale **${channel}** ${newState ? 'abilitato' : 'disabilitato'}.`,
    toolsUsed,
  };
}

async function handleListTemplates(
  workspaceId: string | undefined,
  channel: OutreachChannel | undefined,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('get_outreach_status');

  if (!workspaceId) {
    return { response: 'Workspace non identificato.', toolsUsed };
  }

  const templates = await getTemplates(workspaceId, channel ? { channel } : undefined);

  if (templates.length === 0) {
    return {
      response: `Nessun template ${channel || ''} trovato per il workspace.`,
      toolsUsed,
    };
  }

  const lines: string[] = [
    `**Template Outreach${channel ? ` (${channel})` : ''}** — ${templates.length}\n`,
  ];

  for (const t of templates) {
    const systemBadge = t.is_system ? ' [sistema]' : '';
    lines.push(`- **${t.name}**${systemBadge} — ${t.channel} | ${t.category}`);
  }

  return { response: lines.join('\n'), toolsUsed };
}

async function handleListSequences(
  workspaceId: string | undefined,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('get_outreach_status');

  if (!workspaceId) {
    return { response: 'Workspace non identificato.', toolsUsed };
  }

  const sequences = await getSequences(workspaceId);

  if (sequences.length === 0) {
    return { response: 'Nessuna sequenza configurata per il workspace.', toolsUsed };
  }

  const lines: string[] = [`**Sequenze Outreach** — ${sequences.length}\n`];

  for (const s of sequences) {
    const status = s.is_active ? '✅' : '⚪';
    lines.push(
      `${status} **${s.name}** — trigger: ${s.trigger_on}${s.description ? ` | ${s.description}` : ''}`
    );
  }

  return { response: lines.join('\n'), toolsUsed };
}

async function handleOutreachMetrics(
  workspaceId: string | undefined,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('get_outreach_status');

  if (!workspaceId) {
    return { response: 'Workspace non identificato.', toolsUsed };
  }

  const metrics = await getOutreachMetrics(workspaceId);

  const lines: string[] = ['**Metriche Outreach**\n'];

  lines.push(
    `Totale inviati: **${metrics.totalSent}** | Recapitati: **${metrics.totalDelivered}**`
  );
  lines.push(`Aperti: **${metrics.totalOpened}** | Risposte: **${metrics.totalReplied}**`);
  lines.push(`Falliti: **${metrics.totalFailed}**`);
  lines.push('');
  lines.push(
    `Delivery rate: **${Math.round(metrics.deliveryRate * 100)}%** | Open rate: **${Math.round(metrics.openRate * 100)}%** | Reply rate: **${Math.round(metrics.replyRate * 100)}%**`
  );

  // Per canale
  lines.push('\n**Per canale:**');
  for (const [ch, data] of Object.entries(metrics.byChannel)) {
    if (data.sent > 0) {
      lines.push(
        `- **${ch}**: ${data.sent} inviati, ${data.delivered} recapitati, ${data.opened} aperti, ${data.replied} risposte`
      );
    }
  }

  return { response: lines.join('\n'), toolsUsed };
}

async function handleCheckStatus(
  message: string,
  userRole: 'admin' | 'user' | 'reseller',
  workspaceId: string | undefined,
  entityLabel: string,
  toolsUsed: string[]
): Promise<OutreachWorkerResult> {
  toolsUsed.push('get_outreach_status');

  const entityName = extractEntityName(message);

  if (!entityName || !workspaceId) {
    // Panoramica generale
    return await handleOutreachMetrics(workspaceId, toolsUsed);
  }

  const entity = await getEntityDetail(userRole, undefined, entityName, workspaceId);
  if (!entity) {
    return { response: `Non ho trovato ${entityLabel} "${entityName}".`, toolsUsed };
  }

  const entityType = (userRole === 'admin' ? 'lead' : 'prospect') as 'lead' | 'prospect';
  const enrollments = await getEnrollmentsByEntity(entityType, entity.id, workspaceId);

  if (enrollments.length === 0) {
    return {
      response: `**${entity.companyName}** non ha enrollment outreach.`,
      toolsUsed,
    };
  }

  const lines: string[] = [
    `**Outreach per ${entity.companyName}** — ${enrollments.length} enrollment\n`,
  ];

  for (const e of enrollments) {
    const statusIcon =
      e.status === 'active'
        ? '🟢'
        : e.status === 'paused'
          ? '⏸️'
          : e.status === 'completed'
            ? '✅'
            : e.status === 'cancelled'
              ? '❌'
              : '🔴';
    lines.push(
      `${statusIcon} **${e.status}** — step ${e.current_step}` +
        (e.next_execution_at
          ? ` | prossimo: ${new Date(e.next_execution_at).toLocaleDateString('it-IT')}`
          : '')
    );
  }

  return { response: lines.join('\n'), toolsUsed };
}
