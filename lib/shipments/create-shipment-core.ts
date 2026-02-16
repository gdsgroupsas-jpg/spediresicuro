import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActingContext } from '@/lib/safe-auth';
import type { CreateShipmentInput } from '@/lib/validations/shipment';
import { withConcurrencyRetry } from '@/lib/wallet/retry';
import { getPlatformFeeSafe } from '@/lib/services/pricing/platform-fee';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
// Sprint 1: Financial Tracking
import {
  recordPlatformCost,
  updateShipmentApiSource,
} from '@/lib/shipments/platform-cost-recorder';
import { determineApiSource, calculateProviderCost } from '@/lib/pricing/platform-cost-calculator';
import type {
  CourierCreateShipmentRequest,
  CourierCreateShipmentResponse,
  CourierClientOptions,
} from '@/lib/services/couriers/base-courier.interface';

/**
 * Single source of truth: tipi re-esportati da base-courier.interface.ts
 * Mantenuti come alias per retrocompatibilità import negli smoke test.
 */
export type CourierCreateShippingInput = CourierCreateShipmentRequest;
export type CourierCreateShippingResult = CourierCreateShipmentResponse;

export interface CourierClient {
  createShipping(
    payload: CourierCreateShipmentRequest,
    opts?: CourierClientOptions
  ): Promise<CourierCreateShipmentResponse>;
  deleteShipping(payload: { shipmentId: string }): Promise<void>;
}

export type CreateShipmentCoreResult = { status: number; json: any };

export interface CreateShipmentCoreDeps {
  supabaseAdmin: SupabaseClient;
  /**
   * Ritorna il client corriere (reale o mock).
   * - In produzione: usa `courier_configs` + `CourierFactory.getClient(...)`
   * - Nei test: ritorna un mock che simula success/fail
   */
  getCourierClient: (validated: CreateShipmentInput) => Promise<CourierClient>;

  /**
   * Override opzionali per forzare failure controllate nei test.
   * Se non forniti, usa implementazione reale (Supabase RPC / insert).
   */
  overrides?: {
    refundWallet?: (args: {
      userId: string;
      amount: number;
    }) => Promise<{ error: { message: string; code?: string } | null }>;
    insertShipment?: (args: {
      targetId: string;
      validated: CreateShipmentInput;
      idempotencyKey: string;
      courierResponse: CourierCreateShippingResult;
      finalCost: number;
    }) => Promise<{ data: any | null; error: { message: string } | null }>;
  };

  /** ID della courier_config usata (per tracking per-fornitore) */
  courierConfigId?: string;

  now?: () => Date;
  /**
   * Forza idempotencyKey deterministica (utile per test retry).
   * Se non fornita, viene calcolata come in route.
   */
  idempotencyKeyOverride?: string;
}

function buildIdempotencyKey(validated: CreateShipmentInput, targetId: string) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        userId: targetId,
        recipient: validated.recipient,
        packages: validated.packages,
        timestamp: Math.floor(Date.now() / 5000),
      })
    )
    .digest('hex');
}

/**
 * Core business logic per creazione spedizione.
 *
 * ## Single Source of Truth
 * Questa funzione è l'unica implementazione della logica di creazione spedizione.
 * Tutti i consumer (API routes, test, integrazioni) devono usare questa funzione.
 *
 * ## Chiamata da:
 * - `app/api/shipments/create/route.ts` (API Route - thin wrapper)
 * - Smoke test scripts (con courier mock + failure injection)
 *
 * ## Flusso:
 * 1. Genera idempotency key (hash di recipient + packages)
 * 2. Acquisisce lock idempotency (crash-safe)
 * 3. Verifica credito wallet (pre-check)
 * 4. Debita wallet (con idempotency)
 * 5. Chiama API corriere
 * 6. Inserisce shipment in DB
 * 7. Registra costo piattaforma (financial tracking)
 * 8. Aggiusta wallet (diff stima vs reale)
 * 9. Completa lock idempotency
 *
 * ## Invariante "No Credit, No Label"
 * Se il wallet non ha credito sufficiente, la spedizione NON viene creata.
 *
 * @param params.context - Contesto autenticazione (actor + target per impersonation)
 * @param params.validated - Dati spedizione validati (Zod schema)
 * @param params.deps - Dipendenze iniettabili (supabaseAdmin, getCourierClient)
 * @returns {status: number, json: any} - Risposta HTTP-like
 *
 * @example
 * const result = await createShipmentCore({
 *   context: await requireSafeAuth(),
 *   validated: createShipmentSchema.parse(body),
 *   deps: { supabaseAdmin, getCourierClient: async (v) => CourierFactory.getClient(...) }
 * });
 * return Response.json(result.json, { status: result.status });
 */
export async function createShipmentCore(params: {
  context: ActingContext;
  validated: CreateShipmentInput;
  deps: CreateShipmentCoreDeps;
}): Promise<CreateShipmentCoreResult> {
  const { context, validated, deps } = params;

  const supabaseAdmin = deps.supabaseAdmin;
  const now = deps.now ?? (() => new Date());

  const targetId = context.target.id;
  const actorId = context.actor.id;
  const impersonationActive = context.isImpersonating;

  // ============================================
  // IDEMPOTENCY KEY
  // ============================================
  const idempotencyKey = deps.idempotencyKeyOverride || buildIdempotencyKey(validated, targetId);

  // ============================================
  // CRASH-SAFE IDEMPOTENCY LOCK
  // ============================================
  const { data: lockResult, error: lockError } = await supabaseAdmin.rpc(
    'acquire_idempotency_lock',
    {
      p_idempotency_key: idempotencyKey,
      p_user_id: targetId,
      p_ttl_minutes: 30,
    }
  );

  if (lockError) {
    return { status: 500, json: { error: 'Errore sistema idempotency. Riprova.' } };
  }

  const lock = (lockResult as any)?.[0];
  if (!lock) {
    return { status: 500, json: { error: 'Errore acquisizione lock idempotency.' } };
  }

  if (!lock.acquired) {
    if (lock.status === 'completed' && lock.result_shipment_id) {
      const { data: existingShipment } = await supabaseAdmin
        .from('shipments')
        .select(
          'id, tracking_number, carrier, total_cost, label_data, sender_name, sender_address, sender_city, sender_province, sender_zip, sender_country, recipient_name, recipient_address, recipient_city, recipient_province, recipient_zip, recipient_country'
        )
        .eq('id', lock.result_shipment_id)
        .single();

      if (existingShipment) {
        return {
          status: 200,
          json: {
            success: true,
            idempotent_replay: true,
            shipment: {
              id: existingShipment.id,
              tracking_number: existingShipment.tracking_number,
              carrier: existingShipment.carrier,
              cost: existingShipment.total_cost,
              label_data: existingShipment.label_data,
              sender: {
                name: existingShipment.sender_name,
                address: existingShipment.sender_address,
                city: existingShipment.sender_city,
                province: existingShipment.sender_province,
                postalCode: existingShipment.sender_zip,
                country: existingShipment.sender_country,
              },
              recipient: {
                name: existingShipment.recipient_name,
                address: existingShipment.recipient_address,
                city: existingShipment.recipient_city,
                province: existingShipment.recipient_province,
                postalCode: existingShipment.recipient_zip,
                country: existingShipment.recipient_country,
              },
            },
          },
        };
      }
    }

    if (lock.status === 'in_progress') {
      return {
        status: 409,
        json: {
          error: 'DUPLICATE_REQUEST',
          message: 'Operazione già in corso. Riprova tra qualche minuto.',
          retry_after: lock.retry_after_minutes || 10,
          idempotency_key: idempotencyKey,
        },
      };
    }

    if (lock.status === 'failed') {
      return {
        status: 409,
        json: {
          error: 'PREVIOUS_ATTEMPT_FAILED',
          message: lock.error_message || 'Tentativo precedente fallito. Contattare supporto.',
          requires_manual_review: true,
          idempotency_key: idempotencyKey,
        },
      };
    }
  }

  // ============================================
  // COURIER CLIENT (real or mock)
  // ============================================
  const courierClient = await deps.getCourierClient(validated);

  // ============================================
  // PRE-CHECK CREDITO
  // ============================================
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('wallet_balance, role, billing_mode')
    .eq('id', targetId)
    .single();

  if (userError || !user) {
    return { status: 404, json: { error: 'User not found' } };
  }

  // ============================================
  // CALCOLO COSTO WALLET (Simplified Debit Logic)
  // ============================================
  // ✅ REFACTOR 2026-01-28: Scala esattamente final_price (niente stima + conguaglio)
  // - L'utente paga esattamente quanto vede nel preventivo
  // - Margini garantiti dal listino, non dall'API response
  // - BYOC paga solo platform_fee (standard di mercato: Sendcloud, Shippo, etc.)
  const platformFee = await getPlatformFeeSafe(targetId);

  const isSuperadmin = user.role === 'SUPERADMIN' || user.role === 'superadmin';
  const isByoc = user.role === 'BYOC' || user.role === 'byoc';
  const isPostpaid = (user as unknown as { billing_mode?: string }).billing_mode === 'postpagato';

  let walletChargeAmount: number;
  let chargeSource: 'quoted' | 'fallback' | 'byoc_fee';

  if (isByoc) {
    // BYOC: Paga solo il platform fee (il costo spedizione lo paga direttamente al corriere)
    walletChargeAmount = platformFee;
    chargeSource = 'byoc_fee';
  } else if (validated.final_price && validated.final_price > 0) {
    // ✅ Usa prezzo ESATTO dal preventivo (calcolato dal listino dell'utente)
    // Nessun margine: l'utente paga esattamente quanto vede nel preventivo
    walletChargeAmount = validated.final_price;
    chargeSource = 'quoted';
  } else {
    // ⚠️ Fallback: stima conservativa per spedizioni senza preventivo
    // Questo caso dovrebbe essere raro (API calls dirette senza UI quote)
    const fallbackEstimate = 15.0;
    walletChargeAmount = fallbackEstimate + platformFee;
    chargeSource = 'fallback';
  }

  console.log('💰 [CreateShipment] Wallet charge:', {
    source: chargeSource,
    quotedPrice: validated.final_price,
    platformFee,
    walletChargeAmount,
    isByoc,
    userId: targetId?.substring(0, 8) + '...', // NO PII
  });

  if (!isSuperadmin && !isPostpaid && (user.wallet_balance || 0) < walletChargeAmount) {
    return {
      status: 402,
      json: {
        error: 'INSUFFICIENT_CREDIT',
        required: walletChargeAmount,
        available: user.wallet_balance || 0,
        message: `Credito insufficiente. Disponibile: €${(user.wallet_balance || 0).toFixed(2)}`,
      },
    };
  }

  // ============================================
  // LOOKUP WORKSPACE_ID PER DUAL-WRITE
  // ============================================
  const targetWorkspaceId = await getUserWorkspaceId(targetId);

  // ============================================
  // WALLET DEBIT PRIMA DELLA CHIAMATA CORRIERE
  // ============================================
  /**
   * ⚠️ INVARIANTE (GOVERNANCE): No Credit, No Label (bidirezionale)
   *
   * - Debit wallet PRIMA della chiamata corriere (nessuna label senza credito)
   * - Se corriere/DB falliscono, eseguire refund o enqueue in compensation_queue
   *
   * P0 AUDIT FIX: Idempotency standalone a livello wallet
   * - decrement_wallet_balance() ora riceve idempotency_key
   * - UNIQUE constraint previene doppio addebito anche fuori shipment flow
   *
   * Qualsiasi modifica a questo flusso DEVE mantenere VERDI gli smoke test wallet:
   *   - `npm run smoke:wallet`
   */
  let walletDebited = false;
  let walletDebitAmount = 0;
  let _walletTransactionId: string | undefined; // Prefixed: kept for audit trail

  if (!isSuperadmin && isPostpaid) {
    // ============================================
    // POSTPAID: Traccia consumo senza debitare wallet
    // ============================================
    console.log('📋 [POSTPAID] Recording postpaid charge:', {
      userId: targetId?.substring(0, 8) + '...',
      amount: walletChargeAmount,
      idempotencyKey: idempotencyKey?.substring(0, 16) + '...',
    });

    const { error: postpaidError } = await supabaseAdmin.from('wallet_transactions').insert({
      user_id: targetId,
      amount: -walletChargeAmount, // Negativo per coerenza con SHIPMENT_CHARGE
      type: 'POSTPAID_CHARGE',
      description: `Spedizione postpagata - ${validated.carrier || 'corriere'}`,
      idempotency_key: idempotencyKey,
      reference_id: null, // Aggiornato dopo creazione spedizione
    });

    if (postpaidError) {
      // Idempotent replay: se key esiste gia', e' un retry OK
      if (postpaidError.code === '23505') {
        console.log('📋 [POSTPAID] Idempotent replay: charge already recorded');
      } else {
        console.error('❌ [POSTPAID] Failed to record charge:', postpaidError);
        return {
          status: 500,
          json: {
            error: 'POSTPAID_CHARGE_FAILED',
            message: 'Errore nella registrazione della spedizione postpagata.',
          },
        };
      }
    }

    walletDebited = false; // Non serve compensazione wallet
    walletDebitAmount = walletChargeAmount; // Per tracking finanziario
  } else if (!isSuperadmin) {
    console.log('💳 [WALLET] Starting wallet debit:', {
      userId: targetId?.substring(0, 8) + '...',
      amount: walletChargeAmount,
      idempotencyKey: idempotencyKey?.substring(0, 16) + '...',
    });

    // P0: Passa idempotency_key a wallet function (standalone idempotent)
    // ✅ REFACTOR: Debit diretto di walletChargeAmount (no stima + conguaglio)
    // Dual-write: passa workspace_id per sincronizzare workspaces.wallet_balance
    const { data: walletResult, error: walletError } = await withConcurrencyRetry(
      async () =>
        await supabaseAdmin.rpc('decrement_wallet_balance', {
          p_user_id: targetId,
          p_amount: walletChargeAmount,
          p_idempotency_key: idempotencyKey, // P0: Wallet-level idempotency
          p_workspace_id: targetWorkspaceId,
        }),
      { operationName: 'shipment_debit_final' }
    );

    console.log('💳 [WALLET] RPC result:', {
      hasData: !!walletResult,
      hasError: !!walletError,
      errorMessage: walletError?.message,
      errorCode: walletError?.code,
      dataType: typeof walletResult,
      dataPreview: JSON.stringify(walletResult)?.substring(0, 200),
    });

    if (walletError) {
      console.error('❌ [WALLET] Debit failed:', {
        error: walletError.message,
        code: walletError.code,
        details: walletError,
      });
      return {
        status: 402,
        json: {
          error: 'INSUFFICIENT_CREDIT',
          required: walletChargeAmount,
          available: user.wallet_balance || 0,
          message: `Credito insufficiente. Disponibile: €${(user.wallet_balance || 0).toFixed(2)}`,
        },
      };
    }

    // P0: Handle new JSONB return type
    const result = (walletResult as any)?.[0] || walletResult;
    console.log('💳 [WALLET] Parsed result:', {
      success: result?.success,
      idempotentReplay: result?.idempotent_replay,
      transactionId: result?.transaction_id,
    });

    if (result?.idempotent_replay) {
      console.log('💰 [WALLET] Idempotent replay: wallet already debited for this operation', {
        transaction_id: result.transaction_id,
        idempotency_key: idempotencyKey,
      });
    }

    walletDebited = true;
    walletDebitAmount = walletChargeAmount;
    _walletTransactionId = result?.transaction_id;
    console.log('✅ [WALLET] Debit successful:', {
      amount: walletDebitAmount,
      transactionId: _walletTransactionId,
    });
  }

  // ============================================
  // CHIAMATA CORRIERE
  // ============================================
  const recipientEmailFallback =
    validated.recipient.email || context.target.email || `noemail+${targetId}@spediresicuro.local`;

  const recipientNormalized = {
    ...(validated.recipient as any),
    email: recipientEmailFallback,
  };

  let courierResponse: CourierCreateShippingResult;
  try {
    courierResponse = await courierClient.createShipping(
      {
        sender: validated.sender,
        recipient: recipientNormalized,
        packages: validated.packages,
        insurance: validated.insurance?.value,
        cod: validated.cod?.value,
        notes: validated.notes,
        // Pickup (ritiro a domicilio)
        pickup: validated.pickup,
      },
      { timeout: 30000 }
    );
  } catch (courierError: any) {
    // ============================================
    // COMPENSAZIONE: etichetta non creata → refund wallet / rimuovi postpaid charge
    // ============================================
    // Postpaid: rimuovi POSTPAID_CHARGE (non c'e' wallet da rimborsare)
    if (isPostpaid && !isSuperadmin) {
      try {
        await supabaseAdmin
          .from('wallet_transactions')
          .delete()
          .eq('idempotency_key', idempotencyKey)
          .eq('type', 'POSTPAID_CHARGE');
        console.log('📋 [POSTPAID] Compensazione: POSTPAID_CHARGE rimosso per errore corriere');
      } catch (postpaidCompError) {
        console.error('❌ [POSTPAID] Compensazione fallita:', postpaidCompError);
      }
    }

    // Prepaid: refund wallet
    if (walletDebited && !isSuperadmin) {
      try {
        const refundFn =
          deps.overrides?.refundWallet ??
          (async ({ userId, amount }) => {
            // ✨ FIX CONTABILE: Usa refund_wallet_balance con tipo SHIPMENT_REFUND
            const { error } = await supabaseAdmin.rpc('refund_wallet_balance', {
              p_user_id: userId,
              p_amount: amount,
              p_idempotency_key: `${idempotencyKey}-refund`,
              p_description: 'Rimborso automatico: errore creazione etichetta corriere',
              p_workspace_id: targetWorkspaceId,
            });
            return { error: error ? { message: error.message, code: error.code } : null };
          });

        const { error: compensateError } = await refundFn({
          userId: targetId,
          amount: walletDebitAmount,
        });

        if (compensateError) {
          // NOTE: Alcune installazioni DB hanno shipment_id_external/tracking_number NOT NULL.
          // In caso di fallimento PRIMA di ottenere tracking/shipmentId, usiamo placeholder.
          const { error: queueError } = await supabaseAdmin.from('compensation_queue').insert({
            user_id: targetId,
            provider_id:
              validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider,
            carrier: validated.carrier,
            shipment_id_external: 'UNKNOWN',
            tracking_number: 'UNKNOWN',
            action: 'REFUND',
            original_cost: walletDebitAmount,
            error_context: {
              courier_error: courierError.message,
              compensation_error: compensateError.message,
              retry_strategy: 'MANUAL',
              actor_id: actorId,
              impersonation_active: impersonationActive,
            },
            status: 'PENDING',
          } as any);

          if (queueError) {
            // Best-effort logging for smoke tests / diagnostics
            console.error('❌ [COMPENSATION_QUEUE] Insert failed (courier fail refund):', {
              message: queueError.message,
              code: (queueError as any).code,
            });
          }
        }
      } catch {
        // ignore
      }
    }

    if (courierError?.statusCode === 422)
      return { status: 422, json: { error: 'Indirizzo destinatario non valido.' } };
    if (courierError?.statusCode >= 500 || `${courierError?.message || ''}`.includes('timeout')) {
      return { status: 503, json: { error: 'Corriere temporaneamente non disponibile.' } };
    }
    return { status: 500, json: { error: 'Errore creazione spedizione.' } };
  }

  // ============================================
  // TRANSAZIONE DB (best-effort)
  // ============================================
  // Sprint 2.7: Costo finale = corriere + platform fee
  const courierFinalCost = courierResponse.cost;
  const finalCost = courierFinalCost + platformFee;

  console.log('💰 [CreateShipment] Final cost breakdown:', {
    courierFinalCost,
    platformFee,
    finalCost,
    trackingNumber: courierResponse.trackingNumber,
    shipmentId: courierResponse.shipmentId,
  });

  console.log('🚀 [CreateShipment] Proceeding to DB insert...');

  let shipment: any;
  try {
    // ✅ REFACTOR 2026-01-28: Niente più wallet adjustment/conguaglio
    // L'utente ha già pagato walletChargeAmount (= final_price dal listino)
    // Il costo corriere (courierFinalCost) è un costo interno, non impatta il wallet
    // Log per audit trail
    if (!isSuperadmin && walletDebited) {
      console.log('💰 [WALLET] Simplified debit - no adjustment needed:', {
        walletDebited: walletDebitAmount,
        courierCost: courierFinalCost,
        platformFee,
        internalCost: finalCost,
        margin: walletDebitAmount - finalCost,
      });
    }

    // Insert shipment (allow override)
    const insertShipmentFn =
      deps.overrides?.insertShipment ??
      (async (args) => {
        const { data, error } = await supabaseAdmin
          .from('shipments')
          .insert({
            user_id: args.targetId,
            // NOTE: il DB applica un CHECK constraint su shipments.status.
            // In produzione il valore valido è 'pending' (vedi errore shipments_status_check).
            status: 'pending',
            idempotency_key: args.idempotencyKey,
            carrier: args.validated.carrier,
            tracking_number: args.courierResponse.trackingNumber,
            shipment_id_external: args.courierResponse.shipmentId,
            label_data: args.courierResponse.labelData,
            label_zpl: args.courierResponse.labelZPL,
            total_cost: args.finalCost,
            sender_name: args.validated.sender.name,
            sender_address: args.validated.sender.address,
            sender_city: args.validated.sender.city,
            sender_province: args.validated.sender.province,
            sender_zip: args.validated.sender.postalCode,
            sender_country: args.validated.sender.country,
            sender_phone: args.validated.sender.phone,
            sender_email: args.validated.sender.email,
            recipient_name: args.validated.recipient.name,
            recipient_address: args.validated.recipient.address,
            recipient_city: args.validated.recipient.city,
            recipient_province: args.validated.recipient.province,
            recipient_zip: args.validated.recipient.postalCode,
            recipient_country: args.validated.recipient.country,
            recipient_phone: args.validated.recipient.phone,
            recipient_email: args.validated.recipient.email,
            weight: args.validated.packages[0]?.weight || 1,
            length: args.validated.packages[0]?.length,
            width: args.validated.packages[0]?.width,
            height: args.validated.packages[0]?.height,
            declared_value: args.validated.insurance?.value || 0,
            cash_on_delivery_amount: args.validated.cod?.value || 0,
            notes: args.validated.notes || null,
            // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali per retrocompatibilità
            vat_mode: args.validated.vat_mode || null, // NULL = legacy (assume 'excluded')
            vat_rate: args.validated.vat_rate || 22.0, // Default per retrocompatibilità
            // Best-effort: utile per vincoli anti-orphan e audit
            created_by_user_email: context.target.email,
            // Per-provider tracking (dashboard aggregation)
            ...(deps.courierConfigId ? { courier_config_id: deps.courierConfigId } : {}),
          } as any)
          .select()
          .single();

        return { data, error: error ? { message: error.message } : null };
      });

    const { data: newShipment, error: shipmentError } = await insertShipmentFn({
      targetId,
      validated,
      idempotencyKey,
      courierResponse,
      finalCost,
    });

    console.log('📝 [CreateShipment] DB insert result:', {
      success: !!newShipment,
      error: shipmentError?.message,
      shipmentId: newShipment?.id,
    });

    if (shipmentError || !newShipment)
      throw new Error(`Shipment creation failed: ${shipmentError?.message || 'Unknown error'}`);

    shipment = newShipment;

    // Aggiorna descrizione wallet_transaction con dettagli spedizione
    if (_walletTransactionId && courierResponse.trackingNumber) {
      const recipientName = validated.recipient.name || '';
      const recipientCity = validated.recipient.city || '';
      const carrierName = validated.carrier || '';
      const tracking = courierResponse.trackingNumber;
      const description = `Spedizione ${carrierName} → ${recipientName}, ${recipientCity} - ${tracking}`;
      await supabaseAdmin
        .from('wallet_transactions')
        .update({ description })
        .eq('id', _walletTransactionId);
    }

    // Aggiorna POSTPAID_CHARGE con reference_id (shipment) e descrizione dettagliata
    if (isPostpaid && !isSuperadmin && shipment.id) {
      const recipientName = validated.recipient.name || '';
      const recipientCity = validated.recipient.city || '';
      const carrierName = validated.carrier || '';
      const tracking = courierResponse.trackingNumber || '';
      const description = `Spedizione postpagata ${carrierName} → ${recipientName}, ${recipientCity} - ${tracking}`;
      await supabaseAdmin
        .from('wallet_transactions')
        .update({ reference_id: shipment.id, description })
        .eq('idempotency_key', idempotencyKey)
        .eq('type', 'POSTPAID_CHARGE');
    }

    await supabaseAdmin.rpc('complete_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_shipment_id: shipment.id,
      p_status: 'completed',
    });

    // ============================================
    // SPRINT 1: FINANCIAL TRACKING (non-blocking)
    // ============================================
    // Determina api_source e registra costo piattaforma
    // IMPORTANTE: Questo NON deve bloccare la risposta al cliente
    // ENTERPRISE FIX: Registra SEMPRE il provider cost, non solo per 'platform'
    try {
      const apiSourceResult = await determineApiSource(supabaseAdmin, {
        userId: targetId,
        priceListId: (validated as any).priceListId, // Opzionale, potrebbe non esistere
        courierCode: validated.carrier,
      });

      // Aggiorna shipment con api_source
      await updateShipmentApiSource(
        supabaseAdmin,
        shipment.id,
        apiSourceResult.apiSource,
        apiSourceResult.priceListId
      );

      // ENTERPRISE: Calcola e registra il costo fornitore per TUTTE le spedizioni
      // Questo permette tracking margini accurato per tutti i tipi di utenti
      const serviceType = (validated as any).serviceType || 'standard';

      // ✨ ENTERPRISE FIX: Se base_price è fornito dal frontend (dal quote), usalo direttamente
      // Questo garantisce che il costo fornitore sia quello REALE dal listino, non ri-calcolato
      const providedBasePrice = (validated as any).base_price;
      let providerCostResult: {
        cost: number;
        source: 'api_realtime' | 'master_list' | 'historical_avg' | 'estimate';
        confidence: 'high' | 'medium' | 'low';
        details?: string;
      };

      if (providedBasePrice && providedBasePrice > 0) {
        // Usa il costo fornitore fornito dal frontend (calcolato durante il quoting)
        providerCostResult = {
          cost: providedBasePrice,
          source: 'master_list', // Il costo viene dal listino, passato via quote
          confidence: 'high',
          details: 'Costo fornitore dal listino (calcolato durante preventivo)',
        };
        console.log(
          '💰 [PLATFORM_COST] Usando base_price fornito dal frontend:',
          providedBasePrice
        );
      } else {
        // Fallback: calcola il costo fornitore (per spedizioni senza quote)
        providerCostResult = await calculateProviderCost(supabaseAdmin, {
          courierCode: validated.carrier,
          weight: validated.packages[0]?.weight || 1,
          destination: {
            zip: validated.recipient.postalCode,
            province: validated.recipient.province,
            country: validated.recipient.country || 'IT',
          },
          serviceType,
          masterPriceListId: apiSourceResult.masterPriceListId,
        });
        console.log(
          '💰 [PLATFORM_COST] Calcolato provider cost (fallback):',
          providerCostResult.cost
        );
      }

      // Registra il costo in platform_provider_costs (per tutte le spedizioni)
      await recordPlatformCost(supabaseAdmin, {
        shipmentId: shipment.id,
        trackingNumber: courierResponse.trackingNumber,
        billedUserId: targetId,
        billedAmount: finalCost, // Quanto abbiamo addebitato al cliente
        providerCost: providerCostResult.cost, // Quanto paghiamo noi
        apiSource: apiSourceResult.apiSource,
        courierCode: validated.carrier,
        serviceType,
        priceListId: apiSourceResult.priceListId,
        masterPriceListId: apiSourceResult.masterPriceListId,
        costSource: providerCostResult.source,
      });

      // ENTERPRISE: Aggiorna anche base_price sulla spedizione per accesso rapido
      // Questo evita join con platform_provider_costs per calcoli margine
      // final_price = prezzo di vendita al cliente (walletChargeAmount), NON il costo interno
      await supabaseAdmin
        .from('shipments')
        .update({
          base_price: providerCostResult.cost,
          final_price: walletChargeAmount,
        })
        .eq('id', shipment.id);

      console.log('💰 [PLATFORM_COST] Recorded:', {
        shipmentId: shipment.id,
        apiSource: apiSourceResult.apiSource,
        billed: finalCost,
        providerCost: providerCostResult.cost,
        margin: finalCost - providerCostResult.cost,
        marginPercent:
          providerCostResult.cost > 0
            ? Math.round(
                ((finalCost - providerCostResult.cost) / providerCostResult.cost) * 100 * 100
              ) / 100
            : 0,
        source: providerCostResult.source,
        confidence: providerCostResult.confidence,
      });
    } catch (trackingError) {
      // NON bloccare - graceful degradation
      console.error('[PLATFORM_COST] Failed to track (non-blocking):', trackingError);
    }
    // ============================================
    // END FINANCIAL TRACKING
    // ============================================
  } catch (dbError: any) {
    // FAIL LOCK (best-effort)
    try {
      await supabaseAdmin.rpc('fail_idempotency_lock', {
        p_idempotency_key: idempotencyKey,
        p_error_message: dbError.message || 'Database error after wallet debit',
      });
    } catch {
      // ignore
    }

    // Postpaid: rimuovi POSTPAID_CHARGE orfano (best-effort)
    if (isPostpaid && !isSuperadmin) {
      try {
        await supabaseAdmin
          .from('wallet_transactions')
          .delete()
          .eq('idempotency_key', idempotencyKey)
          .eq('type', 'POSTPAID_CHARGE');
        console.log('📋 [POSTPAID] Compensazione DB error: POSTPAID_CHARGE rimosso');
      } catch (postpaidCompError) {
        console.error('❌ [POSTPAID] Compensazione DB error fallita:', postpaidCompError);
      }
    }

    // Refund wallet (best-effort)
    if (walletDebited && !isSuperadmin) {
      try {
        const refundFn =
          deps.overrides?.refundWallet ??
          (async ({ userId, amount }) => {
            // ✨ FIX CONTABILE: Usa refund_wallet_balance con tipo SHIPMENT_REFUND
            const { error } = await supabaseAdmin.rpc('refund_wallet_balance', {
              p_user_id: userId,
              p_amount: amount,
              p_idempotency_key: `${idempotencyKey}-refund`,
              p_description: 'Rimborso automatico: errore creazione etichetta corriere',
              p_workspace_id: targetWorkspaceId,
            });
            return { error: error ? { message: error.message, code: error.code } : null };
          });

        const { error: compensateError } = await refundFn({
          userId: targetId,
          amount: walletDebitAmount,
        });
        if (compensateError) {
          const { error: queueError } = await supabaseAdmin.from('compensation_queue').insert({
            user_id: targetId,
            provider_id:
              validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider,
            carrier: validated.carrier,
            shipment_id_external: courierResponse.shipmentId,
            tracking_number: courierResponse.trackingNumber,
            action: 'REFUND',
            original_cost: walletDebitAmount,
            error_context: {
              db_error: dbError.message,
              compensation_error: compensateError.message,
              retry_strategy: 'MANUAL',
              actor_id: actorId,
              impersonation_active: impersonationActive,
            },
            status: 'PENDING',
          } as any);

          if (queueError) {
            console.error('❌ [COMPENSATION_QUEUE] Insert failed (db fail refund):', {
              message: queueError.message,
              code: (queueError as any).code,
            });
          }
        }
      } catch {
        // ignore
      }
    }

    // Delete label (best-effort)
    try {
      await courierClient.deleteShipping({ shipmentId: courierResponse.shipmentId });
    } catch (deleteError: any) {
      const providerIdForQueue =
        validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider;
      await supabaseAdmin.from('compensation_queue').insert({
        user_id: targetId,
        provider_id: providerIdForQueue,
        carrier: validated.carrier,
        shipment_id_external: courierResponse.shipmentId,
        tracking_number: courierResponse.trackingNumber,
        action: 'DELETE',
        original_cost: finalCost,
        error_context: {
          db_error: dbError.message,
          delete_error: deleteError.message,
          retry_strategy: 'MANUAL',
          actor_id: actorId,
          impersonation_active: impersonationActive,
        },
        next_retry_at: new Date(now().getTime() + 60000).toISOString(),
        status: 'PENDING',
      } as any);
    }

    return {
      status: 500,
      json: {
        error: 'Errore salvataggio. Riprova.',
        ...(process.env.SMOKE_TEST_DEBUG === '1'
          ? { debug: { message: dbError?.message || 'Unknown db error' } }
          : {}),
      },
    };
  }

  // ============================================
  // EMAIL CONFERMA SPEDIZIONE (non-blocking)
  // ============================================
  try {
    const { sendShipmentConfirmation } = await import('@/lib/email/resend');
    const userEmail = context.target.email;
    if (userEmail && !userEmail.endsWith('@spediresicuro.local')) {
      sendShipmentConfirmation({
        to: userEmail,
        recipientName: shipment.recipient_name || validated.recipient.name || '',
        trackingNumber: shipment.tracking_number || courierResponse.trackingNumber,
        carrier: shipment.carrier || validated.carrier,
        senderCity: shipment.sender_city || validated.sender.city || '',
        recipientCity: shipment.recipient_city || validated.recipient.city || '',
        cost: shipment.final_price || walletChargeAmount || finalCost,
      }).catch((emailErr: any) => {
        console.warn('⚠️ [EMAIL] Shipment confirmation failed (non-blocking):', emailErr?.message);
      });
    }
  } catch {
    // ignore — email is best-effort
  }

  return {
    status: 200,
    json: {
      success: true,
      shipment: {
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        carrier: shipment.carrier || validated.carrier,
        cost: shipment.total_cost || shipment.final_price || finalCost,
        label_data: shipment.label_data,
        sender: {
          name: shipment.sender_name,
          address: shipment.sender_address,
          city: shipment.sender_city,
          province: shipment.sender_province,
          postalCode: shipment.sender_zip,
          country: shipment.sender_country,
        },
        recipient: {
          name: shipment.recipient_name,
          address: shipment.recipient_address,
          city: shipment.recipient_city,
          province: shipment.recipient_province,
          postalCode: shipment.recipient_zip,
          country: shipment.recipient_country,
        },
      },
    },
  };
}
