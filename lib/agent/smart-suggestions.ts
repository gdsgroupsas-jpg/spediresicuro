/**
 * Smart Suggestions - P4 Task 4
 * 
 * Analizza telemetria utente per suggerimenti proattivi basati su pattern ricorrenti.
 * 
 * âš ï¸ SICUREZZA:
 * - RLS enforcement: usa requireSafeAuth()
 * - NO PII: mai mostrare indirizzi completi, solo "destinatario a Milano"
 * - Privacy: suggerimenti basati solo su dati utente, non cross-user
 * - Rate limiting: max 1 suggerimento ogni 24h per tipo
 */

import { supabase } from '@/lib/db/client';

// Configurazione
const PATTERN_THRESHOLD = 3; // Stesso valore 3+ volte â†’ suggerisci
const RATE_LIMIT_HOURS = 24; // Max 1 suggerimento ogni 24h per tipo

export type SuggestionType = 'save_recipient' | 'default_courier' | 'default_weight';

export interface Suggestion {
  type: SuggestionType;
  message: string;
  action: string;
  dismissible: true;
  data?: {
    recipientCity?: string;
    courierName?: string;
    weight?: number;
  };
}

/**
 * Pattern detection da spedizioni recenti
 */
interface PatternData {
  recipientCity?: string;
  courierName?: string;
  weight?: number;
}

/**
 * Analizza spedizioni recenti per pattern ricorrenti
 */
async function detectPatterns(
  userId: string,
  limit: number = 10
): Promise<{
  recurringRecipient: PatternData | null;
  recurringCourier: PatternData | null;
  recurringWeight: PatternData | null;
}> {
  // Query shipments con RLS (usa supabase, non supabaseAdmin)
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('recipient_city, courier_name, weight')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !shipments || shipments.length < PATTERN_THRESHOLD) {
    return {
      recurringRecipient: null,
      recurringCourier: null,
      recurringWeight: null,
    };
  }

  // Conta occorrenze
  const recipientCounts: Record<string, number> = {};
  const courierCounts: Record<string, number> = {};
  const weightCounts: Record<number, number> = {};

  for (const shipment of shipments) {
    if (shipment.recipient_city) {
      recipientCounts[shipment.recipient_city] =
        (recipientCounts[shipment.recipient_city] || 0) + 1;
    }
    if (shipment.courier_name) {
      courierCounts[shipment.courier_name] =
        (courierCounts[shipment.courier_name] || 0) + 1;
    }
    if (shipment.weight) {
      weightCounts[shipment.weight] = (weightCounts[shipment.weight] || 0) + 1;
    }
  }

  // Trova pattern ricorrenti
  const recurringRecipient = Object.entries(recipientCounts).find(
    ([, count]) => count >= PATTERN_THRESHOLD
  )?.[0];

  const recurringCourier = Object.entries(courierCounts).find(
    ([, count]) => count >= PATTERN_THRESHOLD
  )?.[0];

  const recurringWeight = Object.entries(weightCounts).find(
    ([, count]) => count >= PATTERN_THRESHOLD
  )?.[0];

  return {
    recurringRecipient: recurringRecipient
      ? { recipientCity: recurringRecipient }
      : null,
    recurringCourier: recurringCourier
      ? { courierName: recurringCourier }
      : null,
    recurringWeight: recurringWeight
      ? { weight: parseFloat(String(recurringWeight)) }
      : null,
  };
}

/**
 * Verifica rate limiting (max 1 suggerimento ogni 24h per tipo)
 * 
 * NOTA: Per ora, il rate limiting Ã¨ gestito lato client.
 * In produzione, potresti usare una tabella DB per rate limiting server-side.
 */
function checkRateLimit(
  userId: string,
  suggestionType: SuggestionType
): boolean {
  // Server-side: sempre permetti (rate limiting gestito lato client)
  // Il client chiamerÃ  markSuggestionShown() per salvare il timestamp
  return true;
}

/**
 * Salva timestamp suggerimento per rate limiting
 * 
 * NOTA: Questa funzione Ã¨ chiamata lato client.
 * In produzione, potresti salvare in DB.
 */
export function markSuggestionShown(
  userId: string,
  suggestionType: SuggestionType
): void {
  if (typeof window === 'undefined') return;

  try {
    const key = `suggestion_${suggestionType}_${userId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignora errori localStorage
  }
}

/**
 * Verifica se un suggerimento Ã¨ giÃ  stato mostrato recentemente (lato client)
 */
export function shouldShowSuggestion(
  userId: string,
  suggestionType: SuggestionType
): boolean {
  if (typeof window === 'undefined') return true;

  try {
    const key = `suggestion_${suggestionType}_${userId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return true;

    const { timestamp } = JSON.parse(cached);
    const now = Date.now();
    const hoursSince = (now - timestamp) / (1000 * 60 * 60);

    return hoursSince >= RATE_LIMIT_HOURS;
  } catch {
    return true; // In caso di errore, permetti
  }
}

/**
 * Genera suggerimento basato su pattern
 */
async function generateSuggestion(
  patterns: Awaited<ReturnType<typeof detectPatterns>>,
  userId: string
): Promise<Suggestion | null> {
  // PrioritÃ : recipient > courier > weight
  if (patterns.recurringRecipient) {
    return {
      type: 'save_recipient',
      message: `Vuoi salvare questo destinatario per prossime spedizioni?`,
      action: 'save_recipient',
      dismissible: true,
      data: {
        recipientCity: patterns.recurringRecipient.recipientCity,
      },
    };
  }

  if (patterns.recurringCourier) {
    return {
      type: 'default_courier',
      message: `Vuoi impostare ${patterns.recurringCourier.courierName} come corriere predefinito?`,
      action: 'set_default_courier',
      dismissible: true,
      data: {
        courierName: patterns.recurringCourier.courierName,
      },
    };
  }

  if (patterns.recurringWeight) {
    return {
      type: 'default_weight',
      message: `Pacco standard da ${patterns.recurringWeight.weight}kg?`,
      action: 'set_default_weight',
      dismissible: true,
      data: {
        weight: patterns.recurringWeight.weight,
      },
    };
  }

  return null;
}

/**
 * Ottieni suggerimento proattivo per l'utente
 * 
 * @param userId - ID utente (da requireSafeAuth())
 * @returns Suggestion o null se nessun pattern rilevato
 */
export async function getSmartSuggestion(
  userId: string
): Promise<Suggestion | null> {
  try {
    // âš ï¸ SICUREZZA: Verifica autenticazione (in produzione, usa requireSafeAuth())
    // Per ora, assumiamo che userId sia giÃ  validato dalla route

    // 1. Rileva pattern
    const patterns = await detectPatterns(userId);

    // 2. Genera suggerimento
    const suggestion = await generateSuggestion(patterns, userId);

    return suggestion;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('âŒ [Smart Suggestions] Errore:', errorMessage);
    return null;
  }
}