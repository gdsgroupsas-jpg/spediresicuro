/**
 * Sistema di Audit Logging per Credenziali API
 * 
 * Registra tutti gli accessi e modifiche alle credenziali sensibili
 * per compliance e sicurezza
 */

import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'
import { findUserByEmail } from '@/lib/database'

export type AuditAction = 
  | 'credential_viewed'      // Credenziale visualizzata
  | 'credential_copied'      // Credenziale copiata
  | 'credential_created'     // Credenziale creata
  | 'credential_updated'     // Credenziale aggiornata
  | 'credential_deleted'     // Credenziale eliminata
  | 'credential_decrypted'   // Credenziale decriptata

export interface AuditLogEntry {
  action: AuditAction
  resource_type: 'courier_config' | 'api_credential'
  resource_id: string
  user_email: string
  user_id?: string
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, any>
  timestamp: string
}

/**
 * Registra un evento di audit
 */
export async function logAuditEvent(
  action: AuditAction,
  resourceType: 'courier_config' | 'api_credential',
  resourceId: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const session = await auth()
    const userEmail = session?.user?.email || 'system'
    
    // Recupera info utente
    let userId: string | undefined
    try {
      const user = await findUserByEmail(userEmail)
      userId = user?.id
    } catch {
      // Ignora errori recupero utente
    }

    // Prepara entry audit
    const auditEntry: AuditLogEntry = {
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      user_email: userEmail,
      user_id: userId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    }

    // Salva in tabella audit_logs (se esiste) o in log
    try {
      const { error } = await supabaseAdmin
        .from('audit_logs')
        .insert([{
          action,
          resource_type: resourceType,
          resource_id: resourceId,
          user_email: userEmail,
          user_id: userId,
          metadata: auditEntry.metadata,
          created_at: auditEntry.timestamp,
        }])

      if (error) {
        // Se la tabella non esiste, logga solo in console
        console.warn('⚠️ Tabella audit_logs non disponibile, loggando in console:', error.message)
        console.log('📋 [AUDIT]', JSON.stringify(auditEntry, null, 2))
      }
    } catch (error) {
      // Fallback: log in console
      console.log('📋 [AUDIT]', JSON.stringify(auditEntry, null, 2))
    }
  } catch (error) {
    // Non bloccare l'operazione se l'audit fallisce
    console.error('Errore audit logging:', error)
  }
}

/**
 * Recupera log di audit per una risorsa
 */
export async function getAuditLogs(
  resourceType: 'courier_config' | 'api_credential',
  resourceId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Errore recupero audit logs:', error)
      return []
    }

    return (data || []) as AuditLogEntry[]
  } catch (error) {
    console.error('Errore recupero audit logs:', error)
    return []
  }
}

