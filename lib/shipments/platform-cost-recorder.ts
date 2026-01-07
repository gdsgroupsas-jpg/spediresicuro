/**
 * Platform Cost Recorder
 * 
 * Registra i costi reali che SpedireSicuro paga ai corrieri
 * quando un Reseller/BYOC usa i contratti piattaforma.
 * 
 * IMPORTANTE: Questo modulo NON deve mai bloccare la creazione della spedizione.
 * Se fallisce, logga l'errore e continua (graceful degradation).
 * 
 * @module lib/shipments/platform-cost-recorder
 * @since Sprint 1 - Financial Tracking
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type ApiSource = 'platform' | 'reseller_own' | 'byoc_own' | 'unknown';
export type CostSource = 'api_realtime' | 'master_list' | 'historical_avg' | 'estimate';

export interface RecordPlatformCostParams {
  shipmentId: string;
  trackingNumber: string;
  billedUserId: string;
  billedAmount: number;
  providerCost: number;
  apiSource: ApiSource;
  courierCode: string;
  serviceType?: string;
  priceListId?: string;
  masterPriceListId?: string;
  costSource?: CostSource;
}

export interface RecordPlatformCostResult {
  success: boolean;
  recordId?: string;
  error?: string;
}

/**
 * Registra il costo piattaforma per una spedizione.
 * 
 * Chiamare SOLO per spedizioni con api_source = 'platform'.
 * Per gli altri tipi (reseller_own, byoc_own), non serve registrare
 * perché SpedireSicuro non paga nulla.
 * 
 * @param supabaseAdmin - Client Supabase con privilegi admin
 * @param params - Parametri per la registrazione
 * @returns Risultato dell'operazione
 */
export async function recordPlatformCost(
  supabaseAdmin: SupabaseClient,
  params: RecordPlatformCostParams
): Promise<RecordPlatformCostResult> {
  const {
    shipmentId,
    trackingNumber,
    billedUserId,
    billedAmount,
    providerCost,
    apiSource,
    courierCode,
    serviceType,
    priceListId,
    masterPriceListId,
    costSource = 'estimate',
  } = params;

  // Skip se non è spedizione platform
  if (apiSource !== 'platform') {
    console.log(`[PLATFORM_COST] Skip: api_source=${apiSource} (only 'platform' recorded)`);
    return { success: true };
  }

  try {
    // Usa la funzione RPC per insert sicuro con validazione
    const { data, error } = await supabaseAdmin.rpc('record_platform_provider_cost', {
      p_shipment_id: shipmentId,
      p_tracking_number: trackingNumber,
      p_billed_user_id: billedUserId,
      p_billed_amount: billedAmount,
      p_provider_cost: providerCost,
      p_api_source: apiSource,
      p_courier_code: courierCode,
      p_service_type: serviceType || null,
      p_price_list_id: priceListId || null,
      p_master_price_list_id: masterPriceListId || null,
      p_cost_source: costSource,
    });

    if (error) {
      throw error;
    }

    console.log(`[PLATFORM_COST] ✅ Recorded: shipment=${shipmentId}, margin=${billedAmount - providerCost}`);

    return {
      success: true,
      recordId: data as string,
    };
  } catch (error: any) {
    // NON bloccare la spedizione, solo log
    console.error('[PLATFORM_COST] ❌ Failed to record:', {
      shipmentId,
      error: error.message,
    });

    // Prova insert diretto come fallback
    try {
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('platform_provider_costs')
        .insert({
          shipment_id: shipmentId,
          shipment_tracking_number: trackingNumber,
          billed_user_id: billedUserId,
          billed_amount: billedAmount,
          provider_cost: providerCost,
          api_source: apiSource,
          courier_code: courierCode,
          service_type: serviceType,
          price_list_id: priceListId,
          master_price_list_id: masterPriceListId,
          cost_source: costSource,
        })
        .select('id')
        .single();

      if (!fallbackError && fallbackData) {
        console.log(`[PLATFORM_COST] ✅ Recorded via fallback: ${fallbackData.id}`);
        return { success: true, recordId: fallbackData.id };
      }
    } catch (fallbackErr) {
      // Ignore fallback error
    }

    // Log in audit per recovery manuale
    await logPlatformCostFailure(supabaseAdmin, {
      shipmentId,
      billedUserId,
      billedAmount,
      providerCost,
      courierCode,
      errorMessage: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Logga un fallimento di registrazione per recovery manuale.
 */
async function logPlatformCostFailure(
  supabaseAdmin: SupabaseClient,
  params: {
    shipmentId: string;
    billedUserId: string;
    billedAmount: number;
    providerCost: number;
    courierCode: string;
    errorMessage: string;
  }
): Promise<void> {
  try {
    await supabaseAdmin.rpc('log_financial_event', {
      p_event_type: 'platform_cost_recorded',
      p_user_id: params.billedUserId,
      p_shipment_id: params.shipmentId,
      p_amount: params.billedAmount,
      p_message: `FAILED: ${params.errorMessage}`,
      p_severity: 'error',
      p_metadata: {
        provider_cost: params.providerCost,
        courier: params.courierCode,
        error: params.errorMessage,
        requires_manual_recovery: true,
      },
    });
  } catch (logError) {
    // Best effort, ignore
    console.error('[PLATFORM_COST] Failed to log failure:', logError);
  }
}

/**
 * Aggiorna il campo api_source su una spedizione esistente.
 * 
 * @param supabaseAdmin - Client Supabase con privilegi admin
 * @param shipmentId - ID della spedizione
 * @param apiSource - Fonte API determinata
 * @param priceListUsedId - ID del listino usato (opzionale)
 */
export async function updateShipmentApiSource(
  supabaseAdmin: SupabaseClient,
  shipmentId: string,
  apiSource: ApiSource,
  priceListUsedId?: string
): Promise<void> {
  try {
    const updateData: Record<string, any> = { api_source: apiSource };
    
    if (priceListUsedId) {
      updateData.price_list_used_id = priceListUsedId;
    }

    const { error } = await supabaseAdmin
      .from('shipments')
      .update(updateData)
      .eq('id', shipmentId);

    if (error) {
      console.error('[PLATFORM_COST] Failed to update shipment api_source:', error);
    } else {
      console.log(`[PLATFORM_COST] Updated shipment ${shipmentId} api_source=${apiSource}`);
    }
  } catch (error) {
    console.error('[PLATFORM_COST] Error updating shipment:', error);
  }
}
