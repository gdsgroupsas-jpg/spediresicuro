/**
 * Wallet Credit Check - Pre-Booking Verification
 * 
 * Verifica credito disponibile PRIMA di procedere con booking.
 * Prevenzione tentativi booking inutili (risparmio API calls).
 * 
 * P3 Task 2: Wallet Integration - Verifica Credito Pre-Booking
 */

import { supabaseAdmin } from '@/lib/db/client';
import { ActingContext } from '@/lib/safe-auth';

export interface CreditCheckResult {
  sufficient: boolean;
  currentBalance: number;
  required: number;
  deficit?: number; // Quanto manca (se insufficiente)
}

/**
 * Verifica credito disponibile PRIMA di procedere con booking.
 * 
 * @param userId - ID utente
 * @param estimatedCost - Costo stimato spedizione (con buffer)
 * @param actingContext - ActingContext per impersonation support
 * @returns Risultato verifica credito
 */
export async function checkCreditBeforeBooking(
  userId: string,
  estimatedCost: number,
  actingContext?: ActingContext
): Promise<CreditCheckResult> {
  // Determina user target (supporta impersonation)
  const targetUserId = actingContext?.target.id || userId;
  
  // Query wallet balance
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('wallet_balance, role')
    .eq('id', targetUserId)
    .single();

  if (error || !data) {
    throw new Error(`Errore recupero wallet balance: ${error?.message || 'User not found'}`);
  }

  const currentBalance = parseFloat(data.wallet_balance) || 0;
  const isSuperadmin = data.role === 'SUPERADMIN' || data.role === 'superadmin';

  // Superadmin bypassa controllo credito
  if (isSuperadmin) {
    return {
      sufficient: true,
      currentBalance,
      required: estimatedCost,
    };
  }

  const sufficient = currentBalance >= estimatedCost;
  const deficit = sufficient ? 0 : estimatedCost - currentBalance;

  return {
    sufficient,
    currentBalance,
    required: estimatedCost,
    deficit,
  };
}

/**
 * Formatta messaggio errore credito insufficiente per utente.
 */
export function formatInsufficientCreditMessage(result: CreditCheckResult): string {
  return `Credito insufficiente. Disponibile: €${result.currentBalance.toFixed(2)}, Richiesto: €${result.required.toFixed(2)}. Vuoi ricaricare?`;
}

