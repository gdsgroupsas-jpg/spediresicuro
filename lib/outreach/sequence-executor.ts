/**
 * Sequence Executor — Sprint S3b
 *
 * Core engine: processa la coda outreach ogni 5 minuti (Vercel Cron).
 *
 * Algoritmo:
 * 1. Query enrollment attivi con next_execution_at <= NOW() (batch 20)
 * 2. Per ogni enrollment:
 *    - Verifica condizione step (no_reply, no_open, ecc.)
 *    - Verifica consenso GDPR
 *    - Verifica canale abilitato + rate limit + cool-down 24h
 *    - Invia via channel provider
 *    - Crea execution record, avanza step
 * 3. Ritorna metriche ProcessResult
 *
 * Safety: optimistic locking, idempotency, rate limit, cool-down.
 */

import { supabaseAdmin } from '@/lib/db/client';
import { getProvider } from './channel-providers';
import { renderTemplate, buildTemplateVars } from './template-engine';
import {
  isOutreachKillSwitchActive,
  isWorkspaceEnabledForOutreach,
} from './outreach-feature-flags';
import { outreachLogger } from './outreach-logger';
import { CHANNEL_CAPABILITIES } from '@/types/outreach';
import type {
  OutreachChannel,
  StepCondition,
  EnrollmentStatus,
  ExecutionStatus,
  ProcessResult,
} from '@/types/outreach';

// ============================================
// COSTANTI
// ============================================

/** Batch size per ciclo di processing */
const BATCH_SIZE = 20;

/** Cool-down minimo tra invii allo stesso destinatario sullo stesso canale */
const COOLDOWN_HOURS = 24;

// ============================================
// PROCESSO PRINCIPALE
// ============================================

/**
 * Processa la coda outreach: enrollment attivi con next_execution_at scaduto.
 * Chiamato dal cron job ogni 5 minuti.
 */
export async function processOutreachQueue(): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    completed: 0,
  };

  // 0. Kill switch globale
  if (isOutreachKillSwitchActive()) {
    outreachLogger.warn('executor', 'Kill switch attivo — nessun invio processato');
    return result;
  }

  // 1. Fetch enrollment pronti per esecuzione
  const { data: enrollments, error: fetchError } = await supabaseAdmin
    .from('outreach_enrollments')
    .select('id, sequence_id, entity_type, entity_id, workspace_id, current_step, updated_at')
    .eq('status', 'active')
    .lte('next_execution_at', new Date().toISOString())
    .order('next_execution_at')
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error('[sequence-executor] Errore fetch enrollment:', fetchError);
    return result;
  }

  if (!enrollments || enrollments.length === 0) {
    return result;
  }

  // 2. Processa ogni enrollment
  for (const enrollment of enrollments) {
    result.processed++;

    try {
      const stepResult = await processEnrollmentStep(enrollment);

      switch (stepResult) {
        case 'sent':
          result.sent++;
          break;
        case 'skipped':
          result.skipped++;
          break;
        case 'failed':
          result.failed++;
          break;
        case 'completed':
          result.completed++;
          break;
      }
    } catch (err) {
      console.error(`[sequence-executor] Errore processing enrollment ${enrollment.id}:`, err);
      result.failed++;
    }
  }

  outreachLogger.info(
    'executor',
    `Ciclo completato: ${result.processed} processati, ${result.sent} inviati, ${result.skipped} skippati, ${result.failed} falliti, ${result.completed} completati`
  );

  return result;
}

// ============================================
// PROCESSING SINGOLO ENROLLMENT
// ============================================

type StepOutcome = 'sent' | 'skipped' | 'failed' | 'completed';

/**
 * Processa un singolo step per un enrollment.
 * Ritorna l'esito: sent, skipped, failed, completed.
 */
async function processEnrollmentStep(enrollment: {
  id: string;
  sequence_id: string;
  entity_type: string;
  entity_id: string;
  workspace_id: string;
  current_step: number;
  updated_at: string;
}): Promise<StepOutcome> {
  const nextStepOrder = enrollment.current_step + 1;

  // Check 0: Workspace abilitato per outreach (feature flag)
  if (!isWorkspaceEnabledForOutreach(enrollment.workspace_id)) {
    outreachLogger.logSafetySkip({
      workspaceId: enrollment.workspace_id,
      entityId: enrollment.entity_id,
      channel: 'unknown',
      enrollmentId: enrollment.id,
      reason: 'Workspace non abilitato per outreach (feature flag)',
      stepOrder: nextStepOrder,
    });
    return 'skipped';
  }

  // Fetch step corrente dalla sequenza
  const { data: step } = await supabaseAdmin
    .from('outreach_sequence_steps')
    .select('id, channel, template_id, delay_days, condition')
    .eq('sequence_id', enrollment.sequence_id)
    .eq('step_order', nextStepOrder)
    .maybeSingle();

  // Se non esiste prossimo step → sequenza completata
  if (!step) {
    await completeEnrollment(enrollment.id, enrollment.updated_at);
    return 'completed';
  }

  const channel = step.channel as OutreachChannel;
  const condition = step.condition as StepCondition;

  // ─── Check 1: Condizione step ───
  const conditionMet = await evaluateStepCondition(enrollment.id, channel, condition);
  if (!conditionMet) {
    // Condizione non soddisfatta → skip step, avanza al prossimo
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient: '',
      renderedBody: '',
      renderedSubject: null,
      status: 'skipped',
      errorMessage: `Condizione "${condition}" non soddisfatta`,
    });
    await advanceToNextStep(enrollment, nextStepOrder);
    return 'skipped';
  }

  // ─── Check 2: Consenso GDPR ───
  const hasConsent = await checkConsent(enrollment.entity_type, enrollment.entity_id, channel);
  if (!hasConsent) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient: '',
      renderedBody: '',
      renderedSubject: null,
      status: 'skipped',
      errorMessage: 'Consenso GDPR mancante',
    });
    await advanceToNextStep(enrollment, nextStepOrder);
    return 'skipped';
  }

  // ─── Check 3: Canale abilitato ───
  const channelConfig = await getChannelConfigCached(enrollment.workspace_id, channel);
  if (!channelConfig?.enabled) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient: '',
      renderedBody: '',
      renderedSubject: null,
      status: 'skipped',
      errorMessage: `Canale "${channel}" non abilitato per il workspace`,
    });
    await advanceToNextStep(enrollment, nextStepOrder);
    return 'skipped';
  }

  // ─── Check 4: Rate limit giornaliero ───
  if (channelConfig.daily_limit !== null) {
    const todayCount = await getTodaySendCount(enrollment.workspace_id, channel);
    if (todayCount >= channelConfig.daily_limit) {
      // Non avanza — riprova al prossimo ciclo
      console.warn(
        `[sequence-executor] Rate limit raggiunto per workspace ${enrollment.workspace_id} canale ${channel} (${todayCount}/${channelConfig.daily_limit})`
      );
      return 'skipped';
    }
  }

  // ─── Check 5: Cool-down 24h ───
  const inCooldown = await isInCooldown(enrollment.entity_id, channel);
  if (inCooldown) {
    // Non avanza — riprova al prossimo ciclo
    return 'skipped';
  }

  // ─── Check 6: Provider configurato ───
  const provider = getProvider(channel);
  if (!provider.isConfigured()) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient: '',
      renderedBody: '',
      renderedSubject: null,
      status: 'skipped',
      errorMessage: `Provider "${channel}" non configurato (env vars mancanti)`,
    });
    await advanceToNextStep(enrollment, nextStepOrder);
    return 'skipped';
  }

  // ─── Risolvi destinatario e template ───
  const entity = await resolveEntity(enrollment.entity_type, enrollment.entity_id);
  if (!entity) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient: '',
      renderedBody: '',
      renderedSubject: null,
      status: 'failed',
      errorMessage: "Entita' non trovata",
    });
    return 'failed';
  }

  const recipient = resolveRecipient(entity, channel);
  if (!recipient) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient: '',
      renderedBody: '',
      renderedSubject: null,
      status: 'failed',
      errorMessage: `Destinatario non disponibile per canale "${channel}"`,
    });
    return 'failed';
  }

  // Fetch template
  const { data: template } = await supabaseAdmin
    .from('outreach_templates')
    .select('subject, body')
    .eq('id', step.template_id)
    .maybeSingle();

  if (!template) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient,
      renderedBody: '',
      renderedSubject: null,
      status: 'failed',
      errorMessage: 'Template non trovato',
    });
    return 'failed';
  }

  // Render template
  const templateVars = buildTemplateVars(entity);
  const renderedBody = renderTemplate(template.body, templateVars);
  const renderedSubject = template.subject ? renderTemplate(template.subject, templateVars) : null;

  // ─── INVIO ───
  const sendResult = await provider.send(recipient, renderedSubject, renderedBody);

  if (sendResult.success) {
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient,
      renderedBody,
      renderedSubject,
      status: 'sent',
      providerMessageId: sendResult.messageId,
    });
    outreachLogger.logSend({
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      enrollmentId: enrollment.id,
      stepOrder: nextStepOrder,
      success: true,
      providerMessageId: sendResult.messageId,
    });
    await advanceToNextStep(enrollment, nextStepOrder);
    return 'sent';
  }

  // ─── FALLIMENTO ───
  // Controlla retry count per decidere se bounce
  const maxRetries = channelConfig.max_retries ?? CHANNEL_CAPABILITIES[channel].defaultMaxRetries;

  const { data: retryData } = await supabaseAdmin
    .from('outreach_executions')
    .select('id')
    .eq('enrollment_id', enrollment.id)
    .eq('step_id', step.id)
    .eq('status', 'failed');

  const currentRetries = retryData?.length ?? 0;

  if (currentRetries >= maxRetries) {
    // Bounced: troppi tentativi falliti
    await createExecution({
      enrollmentId: enrollment.id,
      stepId: step.id,
      workspaceId: enrollment.workspace_id,
      entityType: enrollment.entity_type,
      entityId: enrollment.entity_id,
      channel,
      templateId: step.template_id,
      recipient,
      renderedBody,
      renderedSubject,
      status: 'bounced',
      errorMessage: sendResult.error,
      retryCount: currentRetries + 1,
    });
    await bounceEnrollment(enrollment.id);
    return 'failed';
  }

  // Retry: lascia enrollment attivo, sara' riprocessato al prossimo ciclo
  await createExecution({
    enrollmentId: enrollment.id,
    stepId: step.id,
    workspaceId: enrollment.workspace_id,
    entityType: enrollment.entity_type,
    entityId: enrollment.entity_id,
    channel,
    templateId: step.template_id,
    recipient,
    renderedBody,
    renderedSubject,
    status: 'failed',
    errorMessage: sendResult.error,
    retryCount: currentRetries + 1,
  });

  return 'failed';
}

// ============================================
// HELPER: Condizioni Step
// ============================================

/**
 * Valuta la condizione di uno step basandosi sulle execution precedenti.
 * Tiene conto delle CHANNEL_CAPABILITIES per condizioni non supportate.
 */
async function evaluateStepCondition(
  enrollmentId: string,
  channel: OutreachChannel,
  condition: StepCondition
): Promise<boolean> {
  // 'always' → esegui sempre
  if (condition === 'always') return true;

  const capabilities = CHANNEL_CAPABILITIES[channel];

  // Se il canale non supporta open tracking, tratta no_open/opened come 'always'
  if (
    (condition === 'no_open' || condition === 'opened') &&
    !capabilities.supportsOpenTracking &&
    !capabilities.supportsReadTracking
  ) {
    return true; // Fail-open: esegui se non possiamo verificare
  }

  // Recupera ultima execution per l'enrollment
  const { data: lastExec } = await supabaseAdmin
    .from('outreach_executions')
    .select('status, opened_at, replied_at')
    .eq('enrollment_id', enrollmentId)
    .in('status', ['sent', 'delivered', 'opened', 'replied'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastExec) {
    // Nessuna execution precedente: no_reply/no_open → true (nessuna risposta/apertura)
    return condition === 'no_reply' || condition === 'no_open';
  }

  switch (condition) {
    case 'no_reply':
      return lastExec.replied_at === null;
    case 'no_open':
      return lastExec.opened_at === null;
    case 'replied':
      return lastExec.replied_at !== null;
    case 'opened':
      return lastExec.opened_at !== null;
    default:
      return true;
  }
}

// ============================================
// HELPER: Consent GDPR
// ============================================

async function checkConsent(
  entityType: string,
  entityId: string,
  channel: OutreachChannel
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('outreach_consent')
    .select('consented')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('channel', channel)
    .eq('consented', true)
    .maybeSingle();

  return data !== null;
}

// ============================================
// HELPER: Rate Limit e Cool-down
// ============================================

async function getChannelConfigCached(workspaceId: string, channel: OutreachChannel) {
  const { data } = await supabaseAdmin
    .from('outreach_channel_config')
    .select('enabled, daily_limit, max_retries')
    .eq('workspace_id', workspaceId)
    .eq('channel', channel)
    .maybeSingle();

  return data;
}

async function getTodaySendCount(workspaceId: string, channel: OutreachChannel): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('outreach_executions')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('channel', channel)
    .gte('sent_at', today.toISOString())
    .in('status', ['sent', 'delivered', 'opened', 'replied']);

  return count ?? 0;
}

async function isInCooldown(entityId: string, channel: OutreachChannel): Promise<boolean> {
  const cooldownCutoff = new Date();
  cooldownCutoff.setHours(cooldownCutoff.getHours() - COOLDOWN_HOURS);

  const { data } = await supabaseAdmin
    .from('outreach_executions')
    .select('id')
    .eq('entity_id', entityId)
    .eq('channel', channel)
    .gte('sent_at', cooldownCutoff.toISOString())
    .in('status', ['sent', 'delivered', 'opened', 'replied'])
    .limit(1)
    .maybeSingle();

  return data !== null;
}

// ============================================
// HELPER: Risoluzione Entita' e Destinatario
// ============================================

async function resolveEntity(
  entityType: string,
  entityId: string
): Promise<Record<string, unknown> | null> {
  const table = entityType === 'lead' ? 'leads' : 'reseller_prospects';

  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .eq('id', entityId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/**
 * Estrae il contatto destinatario dall'entita' in base al canale.
 * Email: campo email, WhatsApp: phone, Telegram: telegram_chat_id.
 */
function resolveRecipient(
  entity: Record<string, unknown>,
  channel: OutreachChannel
): string | null {
  switch (channel) {
    case 'email':
      return entity.email ? String(entity.email) : null;
    case 'whatsapp':
      return entity.phone ? String(entity.phone) : null;
    case 'telegram':
      return entity.telegram_chat_id ? String(entity.telegram_chat_id) : null;
    default:
      return null;
  }
}

// ============================================
// HELPER: Avanzamento e Completamento
// ============================================

/**
 * Avanza l'enrollment al prossimo step.
 * Calcola next_execution_at basandosi sul delay del prossimo step.
 * Se non c'e' prossimo step → completa l'enrollment.
 */
async function advanceToNextStep(
  enrollment: { id: string; sequence_id: string; updated_at: string },
  currentStepOrder: number
): Promise<void> {
  // Cerca prossimo step
  const { data: nextStep } = await supabaseAdmin
    .from('outreach_sequence_steps')
    .select('delay_days')
    .eq('sequence_id', enrollment.sequence_id)
    .eq('step_order', currentStepOrder + 1)
    .maybeSingle();

  if (!nextStep) {
    // Nessun prossimo step → completamento
    await completeEnrollment(enrollment.id, enrollment.updated_at);
    return;
  }

  const nextExecution = new Date();
  nextExecution.setDate(nextExecution.getDate() + (nextStep.delay_days ?? 0));

  // Optimistic locking: updated_at nel WHERE
  const { error } = await supabaseAdmin
    .from('outreach_enrollments')
    .update({
      current_step: currentStepOrder,
      next_execution_at: nextExecution.toISOString(),
    })
    .eq('id', enrollment.id)
    .eq('updated_at', enrollment.updated_at);

  if (error) {
    console.error(`[sequence-executor] Errore avanzamento enrollment ${enrollment.id}:`, error);
  }
}

async function completeEnrollment(enrollmentId: string, updatedAt: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('outreach_enrollments')
    .update({
      status: 'completed' as EnrollmentStatus,
      completed_at: new Date().toISOString(),
      next_execution_at: null,
    })
    .eq('id', enrollmentId)
    .eq('updated_at', updatedAt);

  if (error) {
    console.error(`[sequence-executor] Errore completamento enrollment ${enrollmentId}:`, error);
  }
}

async function bounceEnrollment(enrollmentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('outreach_enrollments')
    .update({
      status: 'bounced' as EnrollmentStatus,
      next_execution_at: null,
    })
    .eq('id', enrollmentId);

  if (error) {
    console.error(`[sequence-executor] Errore bounce enrollment ${enrollmentId}:`, error);
  }
}

// ============================================
// HELPER: Creazione Execution Record
// ============================================

async function createExecution(params: {
  enrollmentId: string;
  stepId: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  channel: OutreachChannel;
  templateId: string;
  recipient: string;
  renderedBody: string;
  renderedSubject: string | null;
  status: ExecutionStatus;
  providerMessageId?: string;
  errorMessage?: string;
  retryCount?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('outreach_executions').insert({
    enrollment_id: params.enrollmentId,
    step_id: params.stepId,
    workspace_id: params.workspaceId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    channel: params.channel,
    template_id: params.templateId,
    recipient: params.recipient,
    rendered_body: params.renderedBody,
    rendered_subject: params.renderedSubject,
    status: params.status,
    provider_message_id: params.providerMessageId ?? null,
    error_message: params.errorMessage ?? null,
    retry_count: params.retryCount ?? 0,
    ...(params.status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
  });

  if (error) {
    console.error('[sequence-executor] Errore creazione execution:', error);
  }
}
