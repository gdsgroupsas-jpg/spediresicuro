/**
 * Delivery Tracker — Sprint S3d Gap Fix
 *
 * Aggiorna lo stato delle outreach_executions in base agli eventi
 * di delivery ricevuti dai webhook dei provider (Resend, WhatsApp).
 *
 * Progressione stati: sent → delivered → opened → replied
 * Ogni stato include tutti i precedenti (non si torna indietro).
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { ExecutionStatus } from '@/types/outreach';

// Ordine di progressione: status piu' avanzato non puo' regredire
const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  replied: 4,
  failed: 5,
  bounced: 6,
  skipped: 7,
};

/**
 * Aggiorna lo stato di un'execution basandosi sul provider_message_id.
 * Rispetta la progressione: non regredisce mai a uno stato precedente.
 *
 * @returns true se l'aggiornamento e' avvenuto, false altrimenti
 */
export async function updateExecutionDeliveryStatus(
  providerMessageId: string,
  newStatus: ExecutionStatus,
  extra?: {
    deliveredAt?: string;
    openedAt?: string;
    repliedAt?: string;
    errorMessage?: string;
  }
): Promise<boolean> {
  if (!providerMessageId) return false;

  // 1. Trova l'execution per provider_message_id
  const { data: execution, error: fetchError } = await supabaseAdmin
    .from('outreach_executions')
    .select('id, status')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle();

  if (fetchError || !execution) {
    // Non trovato — potrebbe non essere un messaggio outreach
    return false;
  }

  // 2. Verifica progressione (non regredire)
  const currentOrder = STATUS_ORDER[execution.status] ?? 0;
  const newOrder = STATUS_ORDER[newStatus] ?? 0;

  if (newOrder <= currentOrder) {
    // Status uguale o precedente — ignora
    return false;
  }

  // 3. Aggiorna
  const updateData: Record<string, unknown> = { status: newStatus };
  if (extra?.deliveredAt) updateData.delivered_at = extra.deliveredAt;
  if (extra?.openedAt) updateData.opened_at = extra.openedAt;
  if (extra?.repliedAt) updateData.replied_at = extra.repliedAt;
  if (extra?.errorMessage) updateData.error_message = extra.errorMessage;

  const { error: updateError } = await supabaseAdmin
    .from('outreach_executions')
    .update(updateData)
    .eq('id', execution.id);

  if (updateError) {
    console.error(
      `[delivery-tracker] Errore aggiornamento execution ${execution.id}:`,
      updateError
    );
    return false;
  }

  return true;
}
