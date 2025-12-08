'use server'

/**
 * Server Actions per Gestione Log Diagnostici
 * 
 * Funzioni server-side per recuperare e gestire i log diagnostici
 * del sistema dalla tabella diagnostics_events
 */

import { supabaseAdmin } from '@/lib/db/client'
import type { DiagnosticEvent } from '@/types/diagnostics'

/**
 * Recupera i log diagnostici del sistema
 * 
 * @param limit - Numero massimo di log da recuperare (default: 50)
 * @returns Array di eventi diagnostici ordinati per data decrescente
 */
export async function getSystemLogs(
  limit: number = 50
): Promise<DiagnosticEvent[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('diagnostics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Errore recupero log diagnostici:', error)
      return []
    }

    // Mappa i dati dal database al tipo DiagnosticEvent
    return (data || []).map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      context: event.context || {},
      created_at: event.created_at,
      correlation_id: event.correlation_id || undefined,
      ip_address: event.ip_address || undefined,
      user_agent: event.user_agent || undefined,
      user_id: event.user_id || undefined,
    }))
  } catch (error: any) {
    console.error('Errore in getSystemLogs:', error)
    return []
  }
}
