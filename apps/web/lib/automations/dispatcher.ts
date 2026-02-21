/**
 * Automation Dispatcher
 *
 * Cuore del motore di automazione. Chiamato dal cron endpoint ogni 5 minuti.
 * Ciclo: legge automazioni attive → verifica schedule → lock → esegui → log.
 */

import { supabaseAdmin } from '@/lib/db/client';
import { shouldRunNow } from './cron-utils';
import { acquireAutomationLock, releaseAutomationLock } from './distributed-lock';
import { AUTOMATION_HANDLERS } from './registry';
import type { Automation, AutomationRun, AutomationTrigger } from '@/types/automations';

interface DispatcherResult {
  checked: number;
  executed: number;
  skipped: number;
  results: Array<{
    slug: string;
    status: string;
    itemsProcessed?: number;
    itemsFailed?: number;
    error?: string;
  }>;
}

/**
 * Esegue il ciclo di dispatch per tutte le automazioni attive.
 *
 * @param toleranceMinutes - Finestra tolleranza cron (default: 5)
 * @returns Risultato complessivo
 */
export async function runDispatcher(toleranceMinutes: number = 5): Promise<DispatcherResult> {
  const result: DispatcherResult = { checked: 0, executed: 0, skipped: 0, results: [] };

  // Leggi automazioni attive
  const { data: automations, error } = await supabaseAdmin
    .from('automations')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('[DISPATCHER] Errore lettura automazioni:', error);
    return result;
  }

  if (!automations || automations.length === 0) {
    return result;
  }

  result.checked = automations.length;

  for (const automation of automations as Automation[]) {
    // Verifica se è il momento di eseguire
    if (!shouldRunNow(automation.schedule, toleranceMinutes)) {
      result.skipped++;
      continue;
    }

    // Verifica che esista un handler
    const handler = AUTOMATION_HANDLERS[automation.slug];
    if (!handler) {
      console.warn(`[DISPATCHER] Nessun handler per slug: ${automation.slug}`);
      result.skipped++;
      continue;
    }

    // Esegui automazione
    const execResult = await executeAutomation(automation, 'cron');
    result.executed++;
    result.results.push({
      slug: automation.slug,
      status: execResult.status,
      itemsProcessed: execResult.items_processed,
      itemsFailed: execResult.items_failed,
      error: execResult.error_message || undefined,
    });
  }

  return result;
}

/**
 * Esegue una singola automazione con lock, logging e error handling.
 *
 * @param automation - Automazione da eseguire
 * @param trigger - Origine dell'esecuzione
 * @param userId - ID utente (per trigger manuali)
 * @returns Record run dal DB
 */
export async function executeAutomation(
  automation: Automation,
  trigger: AutomationTrigger,
  userId?: string
): Promise<AutomationRun> {
  const startTime = Date.now();

  // Crea record run (status: running)
  const { data: run, error: insertError } = await supabaseAdmin
    .from('automation_runs')
    .insert({
      automation_id: automation.id,
      triggered_by: trigger,
      triggered_by_user_id: userId || null,
      status: 'running',
    })
    .select()
    .single();

  if (insertError || !run) {
    console.error(`[DISPATCHER] Errore creazione run per ${automation.slug}:`, insertError);
    // Ritorna un run fittizio per non bloccare il flusso
    return {
      id: 'error',
      automation_id: automation.id,
      triggered_by: trigger,
      triggered_by_user_id: userId || null,
      status: 'failure',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
      result: null,
      error_message: insertError?.message || 'Errore creazione run',
      items_processed: 0,
      items_failed: 0,
    };
  }

  // Acquisisci lock — tracciamo stato per rilascio sicuro nel finally
  let lockAcquired = false;
  try {
    lockAcquired = await acquireAutomationLock(automation.slug);
  } catch (lockError) {
    console.warn(
      `[DISPATCHER] Errore acquisizione lock per ${automation.slug}, proseguo fail-open:`,
      lockError
    );
    lockAcquired = false;
  }

  if (!lockAcquired) {
    // Aggiorna run come skippato
    await updateRun(run.id, {
      status: 'failure',
      error_message: 'Lock non acquisito — esecuzione già in corso',
      duration_ms: Date.now() - startTime,
    });
    return { ...run, status: 'failure', error_message: 'Lock non acquisito' };
  }

  try {
    // Esegui handler
    const handler = AUTOMATION_HANDLERS[automation.slug];
    if (!handler) {
      throw new Error(`Handler non trovato per slug: ${automation.slug}`);
    }

    console.log(`[DISPATCHER] Esecuzione: ${automation.slug} (trigger: ${trigger})`);
    const handlerResult = await handler(automation.config, automation);
    const durationMs = Date.now() - startTime;

    // Determina status
    const status = handlerResult.success
      ? handlerResult.itemsFailed > 0
        ? 'partial'
        : 'success'
      : 'failure';

    // Aggiorna run
    await updateRun(run.id, {
      status,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      result: handlerResult.details || {},
      error_message: handlerResult.error || null,
      items_processed: handlerResult.itemsProcessed,
      items_failed: handlerResult.itemsFailed,
    });

    // Aggiorna cache last_run su automazione
    await supabaseAdmin
      .from('automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: status,
      })
      .eq('id', automation.id);

    console.log(
      `[DISPATCHER] Completato: ${automation.slug} — ${status} ` +
        `(${handlerResult.itemsProcessed} processed, ${handlerResult.itemsFailed} failed, ${durationMs}ms)`
    );

    return {
      ...run,
      status,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      result: handlerResult.details || null,
      error_message: handlerResult.error || null,
      items_processed: handlerResult.itemsProcessed,
      items_failed: handlerResult.itemsFailed,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`[DISPATCHER] Errore esecuzione ${automation.slug}:`, error);

    await updateRun(run.id, {
      status: 'failure',
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      error_message: error.message || 'Errore sconosciuto',
    });

    // Aggiorna cache last_run
    await supabaseAdmin
      .from('automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_status: 'failure',
      })
      .eq('id', automation.id);

    return {
      ...run,
      status: 'failure',
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      error_message: error.message,
      items_processed: 0,
      items_failed: 0,
    };
  } finally {
    // Rilascia lock SOLO se effettivamente acquisito
    if (lockAcquired) {
      await releaseAutomationLock(automation.slug);
    }
  }
}

/**
 * Helper per aggiornare un run nel DB.
 */
async function updateRun(runId: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin.from('automation_runs').update(updates).eq('id', runId);

  if (error) {
    console.error(`[DISPATCHER] Errore aggiornamento run ${runId}:`, error);
  }
}
