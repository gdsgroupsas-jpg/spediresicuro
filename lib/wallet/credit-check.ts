/**
 * Wallet Credit Check - Pre-Booking Verification
 *
 * Verifica credito disponibile PRIMA di procedere con booking.
 * Prevenzione tentativi booking inutili (risparmio API calls).
 *
 * P3 Task 2: Wallet Integration - Verifica Credito Pre-Booking
 *
 * SECURITY (P0 AUDIT FIX):
 * - SuperAdmin bypass controllato da env var ALLOW_SUPERADMIN_WALLET_BYPASS
 * - Ogni bypass loggato come security event (alerting ready)
 * - Fail-closed: se env var non configurato → bypass DISABILITATO
 */

import { supabaseAdmin } from '@/lib/db/client';
import { ActingContext } from '@/lib/safe-auth';

export interface CreditCheckResult {
  sufficient: boolean;
  currentBalance: number;
  required: number;
  deficit?: number; // Quanto manca (se insufficiente)
  bypassUsed?: boolean; // Flag se bypass SuperAdmin è stato usato
  bypassReason?: string; // Motivo bypass (se applicato)
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

  // Query wallet balance e billing_mode
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('wallet_balance, role, billing_mode')
    .eq('id', targetUserId)
    .single();

  if (error || !data) {
    throw new Error(`Errore recupero wallet balance: ${error?.message || 'User not found'}`);
  }

  const currentBalance = parseFloat(data.wallet_balance) || 0;
  const isSuperadmin = data.role === 'SUPERADMIN' || data.role === 'superadmin';

  // ============================================
  // SUPERADMIN WALLET BYPASS (P0 SECURITY)
  // ============================================
  if (isSuperadmin) {
    // Check kill-switch env var (fail-closed: default DISABILITATO)
    const bypassAllowed = process.env.ALLOW_SUPERADMIN_WALLET_BYPASS === 'true';

    if (!bypassAllowed) {
      // Bypass DISABILITATO: SuperAdmin deve pagare come tutti
      console.warn('⚠️ [WALLET] SuperAdmin bypass DISABILITATO (kill-switch active)', {
        userId: targetUserId.substring(0, 8) + '...',
        currentBalance,
        required: estimatedCost,
      });

      // Procedi con check normale (NO bypass)
      const sufficient = currentBalance >= estimatedCost;
      const deficit = sufficient ? 0 : estimatedCost - currentBalance;

      return {
        sufficient,
        currentBalance,
        required: estimatedCost,
        deficit,
        bypassUsed: false,
      };
    }

    // Bypass CONSENTITO: log security event
    console.warn('🚨 [WALLET BYPASS] SuperAdmin bypass wallet check', {
      userId: targetUserId.substring(0, 8) + '...',
      actorId: actingContext?.actor.id?.substring(0, 8) + '...',
      impersonating: actingContext?.isImpersonating || false,
      currentBalance,
      required: estimatedCost,
      deficit: currentBalance < estimatedCost ? estimatedCost - currentBalance : 0,
    });

    // Log security event (async, non-blocking)
    try {
      const { logSuperAdminWalletBypass } = await import('@/lib/security/security-events');
      await logSuperAdminWalletBypass(
        actingContext?.actor.id || targetUserId,
        targetUserId,
        estimatedCost,
        currentBalance,
        {
          impersonating: actingContext?.isImpersonating || false,
          reason: actingContext?.metadata?.reason || 'SuperAdmin operation',
          currentBalance,
          estimatedCost,
        }
      );
    } catch (error: any) {
      // Fail-open sul logging (non bloccare operazione)
      console.error('❌ [WALLET BYPASS] Failed to log security event:', error.message);
    }

    return {
      sufficient: true,
      currentBalance,
      required: estimatedCost,
      bypassUsed: true,
      bypassReason: 'SuperAdmin wallet bypass enabled',
    };
  }

  // ============================================
  // POSTPAID BYPASS
  // ============================================
  if ((data as unknown as { billing_mode?: string }).billing_mode === 'postpagato') {
    console.log('📋 [WALLET] Postpaid user: credit check bypassed', {
      userId: targetUserId.substring(0, 8) + '...',
      currentBalance,
      required: estimatedCost,
    });

    return {
      sufficient: true,
      currentBalance,
      required: estimatedCost,
      bypassUsed: true,
      bypassReason: 'Postpaid billing mode (fattura a fine mese)',
    };
  }

  // ============================================
  // STANDARD CREDIT CHECK (NON-SUPERADMIN)
  // ============================================
  const sufficient = currentBalance >= estimatedCost;
  const deficit = sufficient ? 0 : estimatedCost - currentBalance;

  return {
    sufficient,
    currentBalance,
    required: estimatedCost,
    deficit,
    bypassUsed: false,
  };
}

/**
 * Formatta messaggio errore credito insufficiente per utente.
 */
export function formatInsufficientCreditMessage(result: CreditCheckResult): string {
  return `Credito insufficiente. Disponibile: €${result.currentBalance.toFixed(2)}, Richiesto: €${result.required.toFixed(2)}. Vuoi ricaricare?`;
}
