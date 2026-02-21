/**
 * Enrollment Service — Sprint S3b
 *
 * Gestisce il ciclo di vita degli enrollment:
 * create, pause, resume, cancel, status.
 *
 * Pattern: workspace isolation, optimistic locking, idempotency.
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { Enrollment, EnrollmentStatus } from '@/types/outreach';

// ============================================
// ENROLLMENT CRUD
// ============================================

/**
 * Iscrive un'entita' a una sequenza.
 * Idempotency key: `{sequenceId}:{entityType}:{entityId}`
 * UNIQUE constraint in DB previene doppio enrollment.
 */
export async function enrollEntity(params: {
  sequenceId: string;
  entityType: 'lead' | 'prospect';
  entityId: string;
  workspaceId: string;
}): Promise<{ success: boolean; enrollmentId?: string; error?: string }> {
  const { sequenceId, entityType, entityId, workspaceId } = params;

  // Verifica che la sequenza esista ed e' attiva
  const { data: sequence, error: seqError } = await supabaseAdmin
    .from('outreach_sequences')
    .select('id, workspace_id, is_active')
    .eq('id', sequenceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (seqError || !sequence) {
    return { success: false, error: 'Sequenza non trovata o non accessibile' };
  }

  if (!sequence.is_active) {
    return { success: false, error: 'Sequenza non attiva' };
  }

  // Fetch primo step per calcolare next_execution_at
  const { data: firstStep } = await supabaseAdmin
    .from('outreach_sequence_steps')
    .select('delay_days')
    .eq('sequence_id', sequenceId)
    .order('step_order')
    .limit(1)
    .maybeSingle();

  const delayDays = firstStep?.delay_days ?? 0;
  const nextExecution = new Date();
  nextExecution.setDate(nextExecution.getDate() + delayDays);

  const idempotencyKey = `${sequenceId}:${entityType}:${entityId}`;

  const { data, error } = await supabaseAdmin
    .from('outreach_enrollments')
    .insert({
      sequence_id: sequenceId,
      entity_type: entityType,
      entity_id: entityId,
      workspace_id: workspaceId,
      current_step: 0,
      status: 'active',
      next_execution_at: nextExecution.toISOString(),
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (error) {
    // UNIQUE violation = gia' enrolled
    if (error.code === '23505') {
      return { success: false, error: "Entita' gia' iscritta a questa sequenza" };
    }
    console.error('[enrollment-service] enrollEntity error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, enrollmentId: data.id };
}

/**
 * Cancella un enrollment con motivazione.
 */
export async function cancelEnrollment(
  enrollmentId: string,
  workspaceId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('outreach_enrollments')
    .update({
      status: 'cancelled' as EnrollmentStatus,
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason,
      next_execution_at: null,
    })
    .eq('id', enrollmentId)
    .eq('workspace_id', workspaceId)
    .in('status', ['active', 'paused']);

  if (error) {
    console.error('[enrollment-service] cancelEnrollment error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Mette in pausa un enrollment attivo.
 */
export async function pauseEnrollment(
  enrollmentId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('outreach_enrollments')
    .update({
      status: 'paused' as EnrollmentStatus,
      next_execution_at: null,
    })
    .eq('id', enrollmentId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (error) {
    console.error('[enrollment-service] pauseEnrollment error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Riprende un enrollment in pausa.
 * Ricalcola next_execution_at basandosi sullo step corrente.
 */
export async function resumeEnrollment(
  enrollmentId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  // Fetch enrollment per sapere a che step e'
  const { data: enrollment, error: fetchError } = await supabaseAdmin
    .from('outreach_enrollments')
    .select('id, sequence_id, current_step, status')
    .eq('id', enrollmentId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'paused')
    .maybeSingle();

  if (fetchError || !enrollment) {
    return { success: false, error: 'Enrollment non trovato o non in pausa' };
  }

  // Prossimo step
  const nextStepOrder = enrollment.current_step + 1;
  const { data: nextStep } = await supabaseAdmin
    .from('outreach_sequence_steps')
    .select('delay_days')
    .eq('sequence_id', enrollment.sequence_id)
    .eq('step_order', nextStepOrder)
    .maybeSingle();

  // Se non c'e' prossimo step, l'enrollment e' gia' completato
  if (!nextStep) {
    const { error: completeError } = await supabaseAdmin
      .from('outreach_enrollments')
      .update({
        status: 'completed' as EnrollmentStatus,
        completed_at: new Date().toISOString(),
        next_execution_at: null,
      })
      .eq('id', enrollmentId);

    if (completeError) {
      return { success: false, error: completeError.message };
    }
    return { success: true };
  }

  const nextExecution = new Date();
  nextExecution.setDate(nextExecution.getDate() + (nextStep.delay_days ?? 0));

  const { error: updateError } = await supabaseAdmin
    .from('outreach_enrollments')
    .update({
      status: 'active' as EnrollmentStatus,
      next_execution_at: nextExecution.toISOString(),
    })
    .eq('id', enrollmentId)
    .eq('workspace_id', workspaceId);

  if (updateError) {
    console.error('[enrollment-service] resumeEnrollment error:', updateError);
    return { success: false, error: updateError.message };
  }
  return { success: true };
}

/**
 * Stato corrente degli enrollment per un'entita'.
 */
export async function getEnrollmentsByEntity(
  entityType: 'lead' | 'prospect',
  entityId: string,
  workspaceId: string
): Promise<Enrollment[]> {
  const { data, error } = await supabaseAdmin
    .from('outreach_enrollments')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('workspace_id', workspaceId)
    .order('enrolled_at', { ascending: false });

  if (error) {
    console.error('[enrollment-service] getEnrollmentsByEntity error:', error);
    return [];
  }
  return data || [];
}

/**
 * Verifica se un'entita' e' gia' enrolled in una specifica sequenza.
 */
export async function isAlreadyEnrolled(
  sequenceId: string,
  entityType: 'lead' | 'prospect',
  entityId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('outreach_enrollments')
    .select('id')
    .eq('sequence_id', sequenceId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .in('status', ['active', 'paused'])
    .maybeSingle();

  return data !== null;
}
