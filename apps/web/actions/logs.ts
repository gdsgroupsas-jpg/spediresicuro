'use server';

/**
 * Server Actions per Gestione Log Diagnostici
 *
 * Funzioni server-side per recuperare e gestire i log diagnostici
 * del sistema dalla tabella diagnostics_events
 *
 * ⚠️ ANTI-CRASH: Limiti e timeout per evitare crash durante lettura log
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { DiagnosticEvent } from '@/types/diagnostics';

// Limiti di sicurezza per evitare crash
const MAX_LOG_LIMIT = 100; // Massimo 100 log per query
const DEFAULT_LIMIT = 50;
const QUERY_TIMEOUT_MS = 5000; // Timeout 5 secondi

/**
 * Recupera i log diagnostici del sistema
 *
 * ⚠️ ANTI-CRASH: Limita automaticamente i risultati e gestisce timeout
 *
 * @param limit - Numero massimo di log da recuperare (default: 50, max: 100)
 * @returns Array di eventi diagnostici ordinati per data decrescente
 */
export async function getSystemLogs(limit: number = DEFAULT_LIMIT): Promise<DiagnosticEvent[]> {
  try {
    // ⚠️ ANTI-CRASH: Limita il numero di log richiesti
    const safeLimit = Math.min(Math.max(1, limit), MAX_LOG_LIMIT);

    // ⚠️ ANTI-CRASH: Timeout per evitare query infinite
    const queryPromise = supabaseAdmin
      .from('diagnostics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), QUERY_TIMEOUT_MS);
    });

    const result = await Promise.race([queryPromise, timeoutPromise]);

    // Se timeout, ritorna array vuoto
    if (result === null) {
      console.warn('⚠️ [getSystemLogs] Timeout durante recupero log');
      return [];
    }

    const { data, error } = result as any;

    if (error) {
      console.error('Errore recupero log diagnostici:', error);
      return [];
    }

    // ⚠️ ANTI-CRASH: Limita i dati processati e valida struttura
    const safeData = (data || []).slice(0, safeLimit);

    // Mappa i dati dal database al tipo DiagnosticEvent con validazione
    return safeData.map((event: any) => ({
      id: event.id || '',
      type: event.type || 'info',
      severity: event.severity || 'info',
      context: event.context && typeof event.context === 'object' ? event.context : {},
      created_at: event.created_at || new Date().toISOString(),
      correlation_id: event.correlation_id || undefined,
      ip_address: event.ip_address || undefined,
      user_agent: event.user_agent || undefined,
      user_id: event.user_id || undefined,
    }));
  } catch (error: any) {
    // ⚠️ ANTI-CRASH: Gestione errori robusta - non lancia eccezioni
    console.error('Errore in getSystemLogs:', error?.message || error);
    return [];
  }
}
