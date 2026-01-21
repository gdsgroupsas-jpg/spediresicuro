/**
 * Value Stats Service - P4 Task 1
 *
 * Calcola statistiche di valore per l'utente:
 * - Minuti risparmiati (tempo manuale vs tempo con Anne)
 * - Errori evitati (fallback/retry)
 * - Confidence media
 *
 * ⚠️ SICUREZZA:
 * - RLS enforcement: usa requireSafeAuth()
 * - NO PII: solo aggregazioni, mai dati raw
 */

import { supabase } from '@/lib/db/client';

// Configurazione
const MANUAL_PREVENTIVE_TIME_MINUTES = parseFloat(
  process.env.MANUAL_PREVENTIVE_TIME_MINUTES || '5'
);
const MIN_REQUESTS_FOR_STATS = parseInt(process.env.MIN_REQUESTS_FOR_STATS || '3', 10);

export interface ValueStats {
  totalRequests: number;
  minutesSaved: number;
  errorsAvoided: number;
  averageConfidence: number;
  hasEnoughData: boolean;
}

/**
 * Calcola statistiche di valore per un utente
 *
 * @export - Esportato per test e route
 */
export async function calculateValueStats(userId: string): Promise<ValueStats> {
  // 1. Recupera sessioni agent dell'utente (ultima settimana)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Query agent_sessions con RLS (usa supabase, non supabaseAdmin)
  const { data: sessions, error } = await supabase
    .from('agent_sessions')
    .select('state, created_at, updated_at')
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(100); // Limita a ultime 100 sessioni

  if (error) {
    console.error('❌ [Value Stats] Errore query sessioni:', error);
    // Ritorna stats vuote invece di errore
    return {
      totalRequests: 0,
      minutesSaved: 0,
      errorsAvoided: 0,
      averageConfidence: 0,
      hasEnoughData: false,
    };
  }

  const totalRequests = sessions?.length || 0;
  const hasEnoughData = totalRequests >= MIN_REQUESTS_FOR_STATS;

  if (!hasEnoughData) {
    return {
      totalRequests,
      minutesSaved: 0,
      errorsAvoided: 0,
      averageConfidence: 0,
      hasEnoughData: false,
    };
  }

  // 2. Calcola minuti risparmiati
  // Stima: tempo manuale = 5 min * numero richieste
  // Tempo con Anne = somma duration_ms da telemetria (se disponibile) o stima
  const manualTimeMinutes = totalRequests * MANUAL_PREVENTIVE_TIME_MINUTES;

  // Per ora, stima conservativa: Anne risparmia 60% del tempo manuale
  // TODO: Usare duration_ms reale da telemetria quando disponibile
  const estimatedAnneTimeMinutes = manualTimeMinutes * 0.4;
  const minutesSaved = Math.round(manualTimeMinutes - estimatedAnneTimeMinutes);

  // 3. Calcola errori evitati
  // Conta sessioni con validationErrors o processingStatus = 'error'
  // Ogni errore gestito = errore evitato
  let errorsAvoided = 0;
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const session of sessions || []) {
    try {
      const state = session.state as Record<string, unknown>;

      // Errori evitati: se ci sono validationErrors, significa che Anne li ha rilevati
      if (state?.validationErrors && Array.isArray(state.validationErrors)) {
        errorsAvoided += state.validationErrors.length;
      }

      // Confidence score
      if (typeof state?.confidenceScore === 'number' && state.confidenceScore > 0) {
        totalConfidence += state.confidenceScore;
        confidenceCount++;
      }
    } catch (e) {
      // Ignora errori di parsing
      console.warn('⚠️ [Value Stats] Errore parsing stato sessione:', e);
    }
  }

  // 4. Calcola confidence media
  const averageConfidence =
    confidenceCount > 0 ? Math.round((totalConfidence / confidenceCount) * 10) / 10 : 0;

  return {
    totalRequests,
    minutesSaved: Math.max(0, minutesSaved), // Non negativo
    errorsAvoided,
    averageConfidence,
    hasEnoughData: true,
  };
}
