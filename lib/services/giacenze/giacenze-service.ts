/**
 * Giacenze Service
 *
 * Gestione spedizioni in giacenza: lista, dettaglio, azioni disponibili,
 * esecuzione azione con addebito wallet.
 */

import { supabaseAdmin } from '@/lib/db/client';
import { withConcurrencyRetry } from '@/lib/wallet/retry';
import { checkCreditBeforeBooking } from '@/lib/wallet/credit-check';
import type { ShipmentHold, HoldActionType, HoldActionOption, HoldStatus } from '@/types/giacenze';
import type { StorageConfig, StorageServiceConfig } from '@/types/supplier-price-list-config';
import { HOLD_ACTION_LABELS } from '@/types/giacenze';

// Map action_type to storage service name (matches seed scripts)
const ACTION_TO_SERVICE: Record<HoldActionType, string> = {
  riconsegna: 'Riconsegna',
  riconsegna_nuovo_destinatario: 'Riconsegna al nuovo destinatario',
  reso_mittente: 'Reso al mittente',
  distruggere: 'Distruggere',
  ritiro_in_sede: 'Il destinatario ritira la merce in sede',
  consegna_parziale_rendi: 'Consegna parziale e rendi',
  consegna_parziale_distruggi: 'Consegna parziale e distruggi',
};

// Also match the key-based format used in some seed scripts
const ACTION_TO_KEY: Record<HoldActionType, string> = {
  riconsegna: 'riconsegna',
  riconsegna_nuovo_destinatario: 'riconsegna_nuovo_destinatario',
  reso_mittente: 'reso_mittente',
  distruggere: 'distruggere',
  ritiro_in_sede: 'ritiro_in_sede',
  consegna_parziale_rendi: 'consegna_parziale_rendi',
  consegna_parziale_distruggi: 'consegna_parziale_distruggi',
};

export interface HoldFilters {
  status?: HoldStatus | 'all';
  search?: string;
}

/**
 * Lista giacenze per utente con filtri
 */
export async function getHoldsForUser(
  userId: string,
  filters: HoldFilters = {}
): Promise<ShipmentHold[]> {
  let query = supabaseAdmin
    .from('shipment_holds')
    .select(
      `
      *,
      shipment:shipments!inner(
        tracking_number,
        recipient_name,
        recipient_city,
        recipient_address,
        courier_id,
        final_price,
        price_list_id
      )
    `
    )
    .eq('user_id', userId)
    .order('detected_at', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    // Search by tracking number or recipient name
    query = query.or(
      `shipment.tracking_number.ilike.%${filters.search}%,shipment.recipient_name.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('[GIACENZE] Error fetching holds:', error);
    throw new Error(`Errore caricamento giacenze: ${error.message}`);
  }

  return (data || []) as unknown as ShipmentHold[];
}

/**
 * Dettaglio singola giacenza
 */
export async function getHoldById(holdId: string, userId: string): Promise<ShipmentHold | null> {
  const { data, error } = await supabaseAdmin
    .from('shipment_holds')
    .select(
      `
      *,
      shipment:shipments!inner(
        tracking_number,
        recipient_name,
        recipient_city,
        recipient_address,
        recipient_zip,
        recipient_province,
        recipient_phone,
        courier_id,
        final_price,
        price_list_id,
        base_price,
        sender_name,
        sender_city
      )
    `
    )
    .eq('id', holdId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Errore caricamento giacenza: ${error.message}`);
  }

  return data as unknown as ShipmentHold;
}

/**
 * Calcola azioni disponibili con costi dal listino del corriere
 */
export async function getAvailableActions(
  holdId: string,
  userId: string
): Promise<HoldActionOption[]> {
  // Get hold with shipment data
  const hold = await getHoldById(holdId, userId);
  if (!hold || !hold.shipment) {
    throw new Error('Giacenza non trovata');
  }

  // Hold must be open
  if (hold.status !== 'open') {
    return [];
  }

  const shipment = hold.shipment;
  const shipmentCost = shipment.final_price || 0;

  // Get storage config from supplier price list
  const storageConfig = await getStorageConfigForShipment(shipment.price_list_id);

  const actions: HoldActionOption[] = [];

  if (!storageConfig) {
    // No storage config: return default actions with zero cost
    for (const [actionType, labels] of Object.entries(HOLD_ACTION_LABELS)) {
      actions.push({
        action: actionType as HoldActionType,
        label: labels.label,
        description: labels.description,
        fixed_cost: 0,
        percent_cost: 0,
        dossier_cost: 0,
        total_cost: 0,
        requires_new_address: actionType === 'riconsegna_nuovo_destinatario',
      });
    }
    return actions;
  }

  const dossierCost = storageConfig.dossier_opening_cost || 0;

  // Storage config can be either:
  // 1. { services: [...], dossier_opening_cost: N } (StorageConfig format)
  // 2. { riconsegna: { fixed, percent }, ... } (seed script key-based format)
  const isKeyBased = !storageConfig.services;

  for (const [actionType, labels] of Object.entries(HOLD_ACTION_LABELS)) {
    const action = actionType as HoldActionType;
    let fixedCost = 0;
    let percentValue = 0;

    if (isKeyBased) {
      // Key-based format from seed scripts
      const key = ACTION_TO_KEY[action];
      const config = (storageConfig as any)[key];
      if (config) {
        fixedCost = config.fixed || 0;
        percentValue = config.percent || 0;
      } else {
        continue; // Action not available for this courier
      }
    } else {
      // Array-based format
      const serviceName = ACTION_TO_SERVICE[action];
      const service = storageConfig.services?.find(
        (s: StorageServiceConfig) => s.service.toLowerCase() === serviceName.toLowerCase()
      );
      if (service) {
        fixedCost = service.price || 0;
        percentValue = service.percent || 0;
      } else {
        continue; // Action not available for this courier
      }
    }

    const percentCost = (percentValue / 100) * shipmentCost;
    const totalCost = fixedCost + percentCost + dossierCost;

    actions.push({
      action,
      label: labels.label,
      description: labels.description,
      fixed_cost: fixedCost,
      percent_cost: percentCost,
      dossier_cost: dossierCost,
      total_cost: Math.round(totalCost * 100) / 100,
      requires_new_address: action === 'riconsegna_nuovo_destinatario',
    });
  }

  return actions;
}

/**
 * Esegui azione giacenza con addebito wallet
 */
export async function executeAction(
  holdId: string,
  userId: string,
  actionType: HoldActionType,
  newAddress?: {
    name: string;
    address: string;
    city: string;
    zip: string;
    province: string;
    phone: string;
  }
): Promise<{ success: boolean; hold: ShipmentHold; walletTransactionId?: string }> {
  // Verify hold exists and is open
  const hold = await getHoldById(holdId, userId);
  if (!hold) {
    throw new Error('Giacenza non trovata');
  }
  if (hold.status !== 'open') {
    throw new Error('Questa giacenza non è più modificabile');
  }

  // Validate new address for riconsegna_nuovo_destinatario
  if (actionType === 'riconsegna_nuovo_destinatario') {
    if (!newAddress?.name || !newAddress?.address || !newAddress?.city || !newAddress?.zip) {
      throw new Error('Indirizzo nuovo destinatario obbligatorio');
    }
  }

  // Get available actions to find cost
  const actions = await getAvailableActions(holdId, userId);
  const selectedAction = actions.find((a) => a.action === actionType);
  if (!selectedAction) {
    throw new Error(`Azione "${actionType}" non disponibile per questa giacenza`);
  }

  const cost = selectedAction.total_cost;
  const idempotencyKey = `giacenza_${holdId}_${actionType}_${Date.now()}`;
  let walletTransactionId: string | undefined;

  // Charge wallet if cost > 0
  if (cost > 0) {
    // Pre-check balance
    const creditCheck = await checkCreditBeforeBooking(userId, cost);
    if (!creditCheck.sufficient) {
      throw new Error(
        `Credito insufficiente. Disponibile: €${creditCheck.currentBalance.toFixed(2)}, Richiesto: €${cost.toFixed(2)}`
      );
    }

    // Debit wallet with retry
    const actionLabel = HOLD_ACTION_LABELS[actionType]?.label || actionType;
    const description = `Giacenza: ${actionLabel} - ${hold.shipment?.tracking_number || ''}`;

    const result = await withConcurrencyRetry(
      async () =>
        await supabaseAdmin.rpc('decrement_wallet_balance', {
          p_user_id: userId,
          p_amount: cost,
          p_idempotency_key: idempotencyKey,
        }),
      { operationName: 'giacenza_action_debit' }
    );

    if (result.error) {
      throw new Error(`Errore addebito wallet: ${result.error.message}`);
    }

    // Record wallet transaction with reference
    const { data: txData } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        amount: -cost,
        type: 'GIACENZA_ACTION',
        description,
        reference_type: 'giacenza_action',
        reference_id: holdId,
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single();

    walletTransactionId = txData?.id;
  }

  // Update hold record
  const updateData: any = {
    status: 'action_confirmed',
    action_type: actionType,
    action_cost: cost,
    action_requested_at: new Date().toISOString(),
    action_confirmed_at: new Date().toISOString(),
    wallet_transaction_id: walletTransactionId || null,
    idempotency_key: idempotencyKey,
  };

  if (actionType === 'riconsegna_nuovo_destinatario' && newAddress) {
    updateData.new_recipient_name = newAddress.name;
    updateData.new_recipient_address = newAddress.address;
    updateData.new_recipient_city = newAddress.city;
    updateData.new_recipient_zip = newAddress.zip;
    updateData.new_recipient_province = newAddress.province;
    updateData.new_recipient_phone = newAddress.phone;
  }

  const { error: updateError } = await supabaseAdmin
    .from('shipment_holds')
    .update(updateData)
    .eq('id', holdId);

  if (updateError) {
    console.error('[GIACENZE] Error updating hold:', updateError);
    throw new Error(`Errore aggiornamento giacenza: ${updateError.message}`);
  }

  // Return updated hold
  const updatedHold = await getHoldById(holdId, userId);
  return {
    success: true,
    hold: updatedHold!,
    walletTransactionId,
  };
}

/**
 * Conteggio giacenze aperte per badge
 */
export async function getOpenCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('shipment_holds')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['open', 'action_requested']);

  if (error) {
    console.error('[GIACENZE] Error counting open holds:', error);
    return 0;
  }

  return count || 0;
}

// =====================================================
// Internal helpers
// =====================================================

async function getStorageConfigForShipment(priceListId: string | null): Promise<any | null> {
  if (!priceListId) return null;

  const { data, error } = await supabaseAdmin
    .from('supplier_price_list_configs')
    .select('storage_config')
    .eq('price_list_id', priceListId)
    .single();

  if (error || !data?.storage_config) return null;

  return data.storage_config;
}
