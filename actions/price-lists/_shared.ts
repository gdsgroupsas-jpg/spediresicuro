/**
 * Shared helpers per Price Lists Server Actions
 *
 * Contiene funzioni condivise tra i vari moduli
 */

'use server';

import { supabaseAdmin } from '@/lib/db/client';

/**
 * Helper: Logga evento listino nel financial_audit_log
 */
export async function logPriceListEvent(
  eventType: string,
  priceListId: string,
  actorId: string,
  message?: string,
  oldValue?: any,
  newValue?: any,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await supabaseAdmin.rpc('log_price_list_event', {
      p_event_type: eventType,
      p_price_list_id: priceListId,
      p_actor_id: actorId,
      p_message: message,
      p_old_value: oldValue ? JSON.stringify(oldValue) : null,
      p_new_value: newValue ? JSON.stringify(newValue) : null,
      p_metadata: metadata || {},
      p_severity: 'info',
    });
  } catch (error) {
    // Non bloccare l'operazione se il logging fallisce
    console.error('Errore logging evento listino:', error);
  }
}
