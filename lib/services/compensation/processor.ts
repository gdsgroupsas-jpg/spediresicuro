/**
 * Compensation Queue Processor
 * 
 * Servizio per cleanup orphan records in compensation_queue.
 * Verifica records con status='pending' e created_at > 7 giorni.
 * Marca come 'expired' o cancella (decisione business).
 */

import { supabaseAdmin } from '@/lib/db/client';
import { defaultLogger, type ILogger } from '@/lib/agent/logger';
import { logAuditEvent } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';

/**
 * Processa compensation queue: cleanup orphan records
 * 
 * @param logger - Logger per tracciamento
 * @returns Risultato operazione con statistiche
 */
export async function processCompensationQueue(
  logger: ILogger = defaultLogger
): Promise<{
  success: boolean;
  processed: number;
  expired: number;
  deleted: number;
  errors: number;
}> {
  logger.log('🧹 [Compensation Queue] Avvio cleanup orphan records...');
  
  const result = {
    success: true,
    processed: 0,
    expired: 0,
    deleted: 0,
    errors: 0,
  };
  
  try {
    // Calcola data limite (7 giorni fa)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Trova records con status='pending' e created_at > 7 giorni
    const { data: orphanRecords, error: fetchError } = await supabaseAdmin
      .from('compensation_queue')
      .select('id, user_id, created_at, status, action')
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString());
    
    if (fetchError) {
      logger.error('❌ [Compensation Queue] Errore fetch records:', fetchError);
      result.success = false;
      result.errors++;
      return result;
    }
    
    if (!orphanRecords || orphanRecords.length === 0) {
      logger.log('✅ [Compensation Queue] Nessun record orphan trovato');
      return result;
    }
    
    logger.log(`📋 [Compensation Queue] Trovati ${orphanRecords.length} record orphan`);
    result.processed = orphanRecords.length;
    
    // Processa ogni record
    for (const record of orphanRecords) {
      try {
        // Decisione business: marca come 'expired' invece di cancellare
        // (mantiene audit trail per analisi future)
        const { error: updateError } = await supabaseAdmin
          .from('compensation_queue')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString(),
            resolution_notes: 'Auto-expired: record pending da più di 7 giorni (cleanup automatico)',
          })
          .eq('id', record.id)
          .eq('status', 'pending'); // Double-check per sicurezza
        
        if (updateError) {
          logger.error(`❌ [Compensation Queue] Errore update record ${record.id}:`, updateError);
          result.errors++;
          continue;
        }
        
        result.expired++;
        
        // Logga operazione in audit trail (system operation, no user context)
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
              reason: 'auto-expired: pending > 7 days',
            }
          );
        } catch (auditError) {
          // Non bloccare cleanup per errori audit
          logger.warn(`⚠️ [Compensation Queue] Errore audit log per record ${record.id}:`, auditError);
        }
        
        logger.log(`✅ [Compensation Queue] Record ${record.id} marcato come expired`);
      } catch (recordError: any) {
        logger.error(`❌ [Compensation Queue] Errore processamento record ${record.id}:`, recordError);
        result.errors++;
      }
    }
    
    logger.log(`✅ [Compensation Queue] Cleanup completato: ${result.expired} expired, ${result.errors} errori`);
    
    return result;
  } catch (error: any) {
    logger.error('❌ [Compensation Queue] Errore generale:', error);
    result.success = false;
    result.errors++;
    return result;
  }
}

