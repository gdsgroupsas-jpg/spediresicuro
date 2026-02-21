/**
 * Reseller Pricing Policies - Governance Helpers
 *
 * Sistema opt-in per validazione prezzi reseller.
 * Default: libertà assoluta (nessun limite)
 * SuperAdmin può attivare protezioni per-reseller
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { ResellerPricingPolicy } from '@/types/listini';
import { createLogger, hashValue } from '@/lib/logger';

const logger = createLogger();

/**
 * Recupera la policy di pricing attiva per un reseller
 *
 * @param resellerId - UUID del reseller
 * @returns Policy attiva o null se nessuna policy esiste
 *
 * @example
 * const policy = await getResellerPricingPolicy('uuid');
 * if (policy && policy.enforce_limits) {
 *   // Applica validazione min_markup_percent
 * }
 */
export async function getResellerPricingPolicy(
  resellerId: string
): Promise<ResellerPricingPolicy | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reseller_pricing_policies')
      .select('*')
      .eq('reseller_id', resellerId)
      .is('revoked_at', null)
      .single();

    if (error) {
      // PGRST116 = No rows returned (nessuna policy = libertà assoluta)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as ResellerPricingPolicy;
  } catch (error) {
    logger.error('Error fetching reseller pricing policy', error, {
      resellerId: hashValue(resellerId),
    });
    // Fail-safe: se errore DB, nessuna restrizione (libertà assoluta)
    return null;
  }
}

/**
 * Valida il pricing di un reseller contro la sua policy attiva
 *
 * SuperAdmin ha SEMPRE bypass completo.
 * Se nessuna policy o enforce_limits=false → nessuna validazione.
 *
 * @param params - Parametri validazione
 * @returns Error message se invalido, null se valido
 *
 * @example
 * const error = await validateResellerPricing({
 *   resellerId: 'uuid',
 *   basePrice: 100,
 *   finalPrice: 105, // 5% markup
 *   isSuperAdmin: false,
 * });
 * if (error) {
 *   return { success: false, error: `Governance: ${error}` };
 * }
 */
export async function validateResellerPricing(params: {
  resellerId: string;
  basePrice: number;
  finalPrice: number;
  isSuperAdmin: boolean;
}): Promise<string | null> {
  const { resellerId, basePrice, finalPrice, isSuperAdmin } = params;

  // SuperAdmin bypass: libertà assoluta
  if (isSuperAdmin) {
    return null;
  }

  // Verifica se esiste policy attiva
  const policy = await getResellerPricingPolicy(resellerId);

  // Nessuna policy o policy non enforced → libertà assoluta
  if (!policy || !policy.enforce_limits) {
    return null;
  }

  // Calcola markup effettivo
  if (basePrice === 0) {
    // Evita divisione per zero
    return null;
  }

  const actualMarkup = ((finalPrice - basePrice) / basePrice) * 100;

  // Valida contro minimum
  if (actualMarkup < policy.min_markup_percent) {
    return `Markup ${actualMarkup.toFixed(2)}% is below minimum allowed ${policy.min_markup_percent}% (Policy enforced by SuperAdmin)`;
  }

  // Validazione OK
  return null;
}

/**
 * Crea o aggiorna una policy di pricing per un reseller
 *
 * SOLO SuperAdmin può chiamare questa funzione.
 * Revoca automaticamente policy precedente (soft delete).
 *
 * @param params - Parametri policy
 * @returns Policy creata
 *
 * @example
 * // Attiva protezione con 15% minimo
 * await upsertResellerPricingPolicy({
 *   resellerId: 'uuid',
 *   enforceLimit: true,
 *   minMarkupPercent: 15,
 *   createdBy: 'superadmin-uuid',
 *   notes: 'Reseller ha storico perdite'
 * });
 */
export async function upsertResellerPricingPolicy(params: {
  resellerId: string;
  enforceLimit: boolean;
  minMarkupPercent: number;
  createdBy: string;
  notes?: string;
}): Promise<ResellerPricingPolicy> {
  const { resellerId, enforceLimit, minMarkupPercent, createdBy, notes } = params;

  // Validazione parametri
  if (minMarkupPercent < 0 || minMarkupPercent > 100) {
    throw new Error('min_markup_percent must be between 0 and 100');
  }

  try {
    // Revoca policy precedente se esiste (soft delete per audit trail)
    await supabaseAdmin
      .from('reseller_pricing_policies')
      .update({ revoked_at: new Date().toISOString() })
      .eq('reseller_id', resellerId)
      .is('revoked_at', null);

    // Inserisci nuova policy
    const { data, error } = await supabaseAdmin
      .from('reseller_pricing_policies')
      .insert({
        reseller_id: resellerId,
        enforce_limits: enforceLimit,
        min_markup_percent: minMarkupPercent,
        created_by: createdBy,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`Policy ${enforceLimit ? 'ACTIVATED' : 'DISABLED'} for reseller`, {
      resellerId: hashValue(resellerId),
      enforceLimit,
      minMarkupPercent,
    });

    return data as ResellerPricingPolicy;
  } catch (error) {
    logger.error('Error upserting reseller pricing policy', error, {
      resellerId: hashValue(resellerId),
    });
    throw error;
  }
}

/**
 * Revoca (soft delete) la policy attiva di un reseller
 *
 * Dopo revoca, reseller torna ad avere libertà assoluta.
 *
 * @param resellerId - UUID del reseller
 * @param revokedBy - UUID SuperAdmin che revoca
 * @returns True se revocata, false se nessuna policy attiva
 *
 * @example
 * await revokeResellerPricingPolicy('reseller-uuid', 'admin-uuid');
 * // Reseller torna ad avere libertà assoluta
 */
export async function revokeResellerPricingPolicy(
  resellerId: string,
  revokedBy: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('reseller_pricing_policies')
      .update({
        revoked_at: new Date().toISOString(),
        // Note: created_by non cambia, revokedBy potrebbe essere salvato in notes
      })
      .eq('reseller_id', resellerId)
      .is('revoked_at', null)
      .select();

    if (error) throw error;

    const revoked = data && data.length > 0;

    if (revoked) {
      logger.info('Policy REVOKED for reseller', {
        resellerId: hashValue(resellerId),
        revokedBy: hashValue(revokedBy),
      });
    }

    return revoked;
  } catch (error) {
    logger.error('Error revoking reseller pricing policy', error, {
      resellerId: hashValue(resellerId),
    });
    throw error;
  }
}
