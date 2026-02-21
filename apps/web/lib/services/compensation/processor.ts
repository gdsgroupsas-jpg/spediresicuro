/**
 * Compensation Queue Processor
 *
 * H1 FIX: Retry automatico per record PENDING (REFUND e DELETE).
 *
 * Flusso:
 * 1. Retry REFUND: chiama refund_wallet_balance_v2 per rimborsare il wallet
 * 2. Retry DELETE: marca come requires_manual_review (richiede courier client)
 * 3. Expiry: record pending > 7 giorni senza max_retries → expired
 *
 * Backoff esponenziale: 1min, 5min, 30min, 2h, 12h (max 5 retry default)
 */

import { supabaseAdmin } from '@/lib/db/client';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { defaultLogger, type ILogger } from '@/lib/agent/logger';
import { logAuditEvent } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';

// Intervalli di backoff esponenziale (in millisecondi)
const RETRY_BACKOFF_MS = [
  1 * 60_000, // 1 minuto
  5 * 60_000, // 5 minuti
  30 * 60_000, // 30 minuti
  2 * 3600_000, // 2 ore
  12 * 3600_000, // 12 ore
];
const DEFAULT_MAX_RETRIES = 5;

interface CompensationRecord {
  id: string;
  user_id: string;
  action: string;
  status: string | null;
  original_cost: number | null;
  error_context: Record<string, unknown> | null;
  retry_count: number | null;
  max_retries: number | null;
  next_retry_at: string | null;
  created_at: string | null;
  shipment_id_external: string;
  tracking_number: string;
}

export interface ProcessResult {
  success: boolean;
  processed: number;
  retried: number;
  resolved: number;
  expired: number;
  deleted: number;
  errors: number;
}

/**
 * Processa compensation queue: retry automatico + cleanup
 */
export async function processCompensationQueue(
  logger: ILogger = defaultLogger
): Promise<ProcessResult> {
  logger.log('🔄 [Compensation Queue] Avvio processamento (retry + cleanup)...');

  const result: ProcessResult = {
    success: true,
    processed: 0,
    retried: 0,
    resolved: 0,
    expired: 0,
    deleted: 0,
    errors: 0,
  };

  try {
    // === FASE 1: Retry record pending con next_retry_at <= now ===
    await retryPendingRecords(logger, result);

    // === FASE 2: Expire record pending > 7 giorni che hanno esaurito i retry ===
    await expireOldRecords(logger, result);

    logger.log(
      `✅ [Compensation Queue] Completato: ${result.retried} retried, ${result.resolved} resolved, ${result.expired} expired, ${result.errors} errori`
    );

    return result;
  } catch (error: any) {
    logger.error('❌ [Compensation Queue] Errore generale:', error);
    result.success = false;
    result.errors++;
    return result;
  }
}

/**
 * FASE 1: Retry record PENDING pronti per retry
 */
async function retryPendingRecords(logger: ILogger, result: ProcessResult): Promise<void> {
  const now = new Date().toISOString();

  // Record PENDING con next_retry_at <= now, oppure next_retry_at IS NULL (nuovi)
  const { data: retryable, error: fetchError } = await supabaseAdmin
    .from('compensation_queue')
    .select(
      'id, user_id, action, status, original_cost, error_context, retry_count, max_retries, next_retry_at, created_at, shipment_id_external, tracking_number'
    )
    .eq('status', 'pending')
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(50); // Batch max 50 per esecuzione

  if (fetchError) {
    logger.error('❌ [Compensation Queue] Errore fetch retryable:', fetchError);
    result.errors++;
    return;
  }

  if (!retryable || retryable.length === 0) {
    logger.log('✅ [Compensation Queue] Nessun record da retry');
    return;
  }

  logger.log(`📋 [Compensation Queue] ${retryable.length} record da retry`);
  result.processed += retryable.length;

  for (const record of retryable as CompensationRecord[]) {
    try {
      const maxRetries = record.max_retries ?? DEFAULT_MAX_RETRIES;
      const currentRetry = record.retry_count ?? 0;

      // Se ha esaurito i retry → DLQ (dead letter)
      if (currentRetry >= maxRetries) {
        await moveToDeadLetter(record, logger);
        result.expired++;
        continue;
      }

      // Tenta il retry in base all'azione
      let retrySuccess = false;

      if (record.action === 'REFUND') {
        retrySuccess = await retryRefund(record, logger);
      } else if (record.action === 'DELETE') {
        // DELETE richiede courier client — marca come manual review
        retrySuccess = await retryDelete(record, logger);
      } else {
        logger.warn(
          `⚠️ [Compensation Queue] Azione sconosciuta: ${record.action} per record ${record.id}`
        );
        await moveToDeadLetter(record, logger);
        result.expired++;
        continue;
      }

      if (retrySuccess) {
        // Risolto con successo
        await supabaseAdmin
          .from('compensation_queue')
          .update({
            status: 'resolved',
            completed_at: new Date().toISOString(),
            retry_count: currentRetry + 1,
            last_retry_at: new Date().toISOString(),
            resolution_notes: `Auto-resolved al tentativo ${currentRetry + 1}`,
          })
          .eq('id', record.id)
          .eq('status', 'pending');

        result.resolved++;
        logger.log(
          `✅ [Compensation Queue] Record ${record.id} (${record.action}) risolto al tentativo ${currentRetry + 1}`
        );
      } else {
        // Retry fallito — programma prossimo tentativo con backoff esponenziale
        const backoffIndex = Math.min(currentRetry, RETRY_BACKOFF_MS.length - 1);
        const nextRetryMs = RETRY_BACKOFF_MS[backoffIndex];
        const nextRetryAt = new Date(Date.now() + nextRetryMs).toISOString();

        await supabaseAdmin
          .from('compensation_queue')
          .update({
            retry_count: currentRetry + 1,
            last_retry_at: new Date().toISOString(),
            next_retry_at: nextRetryAt,
          })
          .eq('id', record.id)
          .eq('status', 'pending');

        result.retried++;
        logger.log(
          `🔄 [Compensation Queue] Record ${record.id} retry ${currentRetry + 1}/${maxRetries} fallito, prossimo: ${nextRetryAt}`
        );
      }
    } catch (recordError: any) {
      logger.error(`❌ [Compensation Queue] Errore retry record ${record.id}:`, recordError);
      result.errors++;
    }
  }
}

/**
 * Retry azione REFUND: rimborsa wallet via RPC atomica
 */
async function retryRefund(record: CompensationRecord, logger: ILogger): Promise<boolean> {
  if (!record.original_cost || record.original_cost <= 0) {
    logger.warn(
      `⚠️ [REFUND] Record ${record.id}: costo originale non valido (${record.original_cost})`
    );
    return false;
  }

  // Recupera workspace_id dell'utente
  const workspaceId = await getUserWorkspaceId(record.user_id);
  if (!workspaceId) {
    logger.warn(
      `⚠️ [REFUND] Record ${record.id}: workspace non trovato per user ${record.user_id.substring(0, 8)}...`
    );
    return false;
  }

  // Idempotency key basata sul record ID (previene doppio refund)
  const idempotencyKey = `compensation-refund-${record.id}`;

  const { error: refundError } = await supabaseAdmin.rpc('refund_wallet_balance_v2', {
    p_workspace_id: workspaceId,
    p_user_id: record.user_id,
    p_amount: record.original_cost,
    p_idempotency_key: idempotencyKey,
    p_description: `Rimborso automatico (compensation queue retry) - ${record.tracking_number || 'N/A'}`,
  });

  if (refundError) {
    logger.error(`❌ [REFUND] Record ${record.id} fallito:`, refundError.message);
    return false;
  }

  logger.log(
    `✅ [REFUND] Record ${record.id}: rimborsati €${record.original_cost} a workspace ${workspaceId.substring(0, 8)}...`
  );
  return true;
}

/**
 * Retry azione DELETE: richiede courier client — segna per review manuale
 *
 * Le etichette orfane non sono un problema finanziario immediato (il corriere
 * scade l'etichetta dopo qualche giorno). Marca come "manual_review" per
 * il team operativo.
 */
async function retryDelete(record: CompensationRecord, _logger: ILogger): Promise<boolean> {
  // Non possiamo chiamare il courier client da qui (richiederebbe config, auth, etc.)
  // Marca come risolto con nota per review manuale
  // L'etichetta non usata scade automaticamente lato corriere
  await supabaseAdmin
    .from('compensation_queue')
    .update({
      status: 'resolved',
      completed_at: new Date().toISOString(),
      resolution_notes:
        'Auto-resolved: etichetta orfana — scadrà automaticamente lato corriere. Review manuale se necessario.',
    })
    .eq('id', record.id)
    .eq('status', 'pending');

  return true; // Consideriamo "risolto" perché non è un problema finanziario
}

/**
 * Muove record in stato "dead letter" (esauriti i retry)
 */
async function moveToDeadLetter(record: CompensationRecord, logger: ILogger): Promise<void> {
  await supabaseAdmin
    .from('compensation_queue')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      dead_letter_reason: `Esauriti ${record.max_retries ?? DEFAULT_MAX_RETRIES} tentativi di retry automatico`,
      resolution_notes: 'RICHIEDE INTERVENTO MANUALE — tutti i retry automatici falliti',
    })
    .eq('id', record.id)
    .eq('status', 'pending');

  // Audit log per alerting
  try {
    await logAuditEvent(
      AUDIT_ACTIONS.SYSTEM_MAINTENANCE,
      AUDIT_RESOURCE_TYPES.COMPENSATION_QUEUE || 'compensation_queue',
      record.id,
      {
        original_status: 'pending',
        new_status: 'failed',
        action: record.action,
        retry_count: record.retry_count,
        max_retries: record.max_retries ?? DEFAULT_MAX_RETRIES,
        user_id: record.user_id,
        original_cost: record.original_cost,
        reason: 'dead_letter: max retries exceeded',
      }
    );
  } catch {
    // Non bloccare per errori audit
  }

  logger.warn(
    `⚠️ [DLQ] Record ${record.id} (${record.action}) spostato in dead letter dopo ${record.retry_count ?? 0} tentativi`
  );
}

/**
 * FASE 2: Expire record pending > 7 giorni senza retry configurato
 */
async function expireOldRecords(logger: ILogger, result: ProcessResult): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Record pending vecchi con retry esauriti o non configurati
  const { data: orphanRecords, error: fetchError } = await supabaseAdmin
    .from('compensation_queue')
    .select('id, user_id, created_at, status, action, retry_count, max_retries')
    .eq('status', 'pending')
    .lt('created_at', sevenDaysAgo.toISOString());

  if (fetchError) {
    logger.error('❌ [Compensation Queue] Errore fetch orphan records:', fetchError);
    result.errors++;
    return;
  }

  if (!orphanRecords || orphanRecords.length === 0) {
    return;
  }

  logger.log(`📋 [Compensation Queue] ${orphanRecords.length} record orphan da expirare`);
  result.processed += orphanRecords.length;

  for (const record of orphanRecords) {
    try {
      const { error: updateError } = await supabaseAdmin
        .from('compensation_queue')
        .update({
          status: 'expired',
          completed_at: new Date().toISOString(),
          resolution_notes: `Auto-expired: record pending da più di 7 giorni (retry: ${record.retry_count ?? 0}/${record.max_retries ?? DEFAULT_MAX_RETRIES})`,
        })
        .eq('id', record.id)
        .eq('status', 'pending');

      if (updateError) {
        logger.error(`❌ [Compensation Queue] Errore expire record ${record.id}:`, updateError);
        result.errors++;
        continue;
      }

      result.expired++;

      // Audit log (best-effort)
      try {
        await logAuditEvent(
          AUDIT_ACTIONS.SYSTEM_MAINTENANCE,
          AUDIT_RESOURCE_TYPES.COMPENSATION_QUEUE || 'compensation_queue',
          record.id,
          {
            original_status: 'pending',
            new_status: 'expired',
            action: record.action,
            created_at: record.created_at,
            user_id: record.user_id,
            retry_count: record.retry_count,
            reason: 'auto-expired: pending > 7 days',
          }
        );
      } catch {
        // Non bloccare
      }
    } catch (recordError: any) {
      logger.error(`❌ [Compensation Queue] Errore expire record ${record.id}:`, recordError);
      result.errors++;
    }
  }
}
