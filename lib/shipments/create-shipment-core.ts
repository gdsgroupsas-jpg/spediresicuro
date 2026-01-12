import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ActingContext } from '@/lib/safe-auth'
import type { CreateShipmentInput } from '@/lib/validations/shipment'
import { withConcurrencyRetry } from '@/lib/wallet/retry'
import { getPlatformFeeSafe, DEFAULT_PLATFORM_FEE } from '@/lib/services/pricing/platform-fee'
// Sprint 1: Financial Tracking
import { recordPlatformCost, updateShipmentApiSource } from '@/lib/shipments/platform-cost-recorder'
import { determineApiSource, calculateProviderCost } from '@/lib/pricing/platform-cost-calculator'

export interface CourierCreateShippingInput {
  sender: CreateShipmentInput['sender']
  recipient: Required<CreateShipmentInput['recipient']> & { email: string }
  packages: CreateShipmentInput['packages']
  insurance?: number
  cod?: number
  notes?: string
}

export interface CourierCreateShippingResult {
  cost: number
  trackingNumber: string
  shipmentId: string
  labelData?: string | null
  labelZPL?: string | null
}

export interface CourierClient {
  createShipping(payload: CourierCreateShippingInput, opts?: { timeout?: number }): Promise<CourierCreateShippingResult>
  deleteShipping(payload: { shipmentId: string }): Promise<void>
}

export type CreateShipmentCoreResult =
  | { status: number; json: any }

export interface CreateShipmentCoreDeps {
  supabaseAdmin: SupabaseClient
  /**
   * Ritorna il client corriere (reale o mock).
   * - In produzione: usa `courier_configs` + `CourierFactory.getClient(...)`
   * - Nei test: ritorna un mock che simula success/fail
   */
  getCourierClient: (validated: CreateShipmentInput) => Promise<CourierClient>

  /**
   * Override opzionali per forzare failure controllate nei test.
   * Se non forniti, usa implementazione reale (Supabase RPC / insert).
   */
  overrides?: {
    refundWallet?: (args: { userId: string; amount: number }) => Promise<{ error: { message: string; code?: string } | null }>
    insertShipment?: (args: {
      targetId: string
      validated: CreateShipmentInput
      idempotencyKey: string
      courierResponse: CourierCreateShippingResult
      finalCost: number
    }) => Promise<{ data: any | null; error: { message: string } | null }>
  }

  now?: () => Date
  /**
   * Forza idempotencyKey deterministica (utile per test retry).
   * Se non fornita, viene calcolata come in route.
   */
  idempotencyKeyOverride?: string
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
    .digest('hex')
}

/**
 * Core business logic per creazione spedizione.
 * Pensata per essere ri-usata da:
 * - API Route (`app/api/shipments/create/route.ts`)
 * - Smoke test scripts (con courier mock + failure injection)
 */
export async function createShipmentCore(params: {
  context: ActingContext
  validated: CreateShipmentInput
  deps: CreateShipmentCoreDeps
}): Promise<CreateShipmentCoreResult> {
  const { context, validated, deps } = params

  const supabaseAdmin = deps.supabaseAdmin
  const now = deps.now ?? (() => new Date())

  const targetId = context.target.id
  const actorId = context.actor.id
  const impersonationActive = context.isImpersonating

  // ============================================
  // IDEMPOTENCY KEY
  // ============================================
  const idempotencyKey = deps.idempotencyKeyOverride || buildIdempotencyKey(validated, targetId)

  // ============================================
  // CRASH-SAFE IDEMPOTENCY LOCK
  // ============================================
  const { data: lockResult, error: lockError } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
    p_idempotency_key: idempotencyKey,
    p_user_id: targetId,
    p_ttl_minutes: 30,
  })

  if (lockError) {
    return { status: 500, json: { error: 'Errore sistema idempotency. Riprova.' } }
  }

  const lock = (lockResult as any)?.[0]
  if (!lock) {
    return { status: 500, json: { error: 'Errore acquisizione lock idempotency.' } }
  }

  if (!lock.acquired) {
    if (lock.status === 'completed' && lock.result_shipment_id) {
      const { data: existingShipment } = await supabaseAdmin
        .from('shipments')
        .select(
          'id, tracking_number, carrier, total_cost, label_data, sender_name, sender_address, sender_city, sender_province, sender_zip, sender_country, recipient_name, recipient_address, recipient_city, recipient_province, recipient_zip, recipient_country'
        )
        .eq('id', lock.result_shipment_id)
        .single()

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
        }
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
      }
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
      }
    }
  }

  // ============================================
  // COURIER CLIENT (real or mock)
  // ============================================
  const courierClient = await deps.getCourierClient(validated)

  // ============================================
  // PRE-CHECK CREDITO
  // ============================================
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('wallet_balance, role')
    .eq('id', targetId)
    .single()

  if (userError || !user) {
    return { status: 404, json: { error: 'User not found' } }
  }

  // ============================================
  // STIMA COSTO (buffer 20%) + PLATFORM FEE (Sprint 2.7)
  // ============================================
  const baseEstimatedCost = 8.5
  const courierEstimate = baseEstimatedCost * 1.2
  
  // Platform fee dinamica per utente (fail-safe: usa default se errore)
  const platformFee = await getPlatformFeeSafe(targetId)
  const estimatedCost = courierEstimate + platformFee
  
  console.log('💰 [CreateShipment] Cost estimate:', {
    courierEstimate,
    platformFee,
    estimatedCost,
    userId: targetId?.substring(0, 8) + '...', // NO PII
  })
  
  const isSuperadmin = user.role === 'SUPERADMIN' || user.role === 'superadmin'

  if (!isSuperadmin && (user.wallet_balance || 0) < estimatedCost) {
    return {
      status: 402,
      json: {
        error: 'INSUFFICIENT_CREDIT',
        required: estimatedCost,
        available: user.wallet_balance || 0,
        message: `Credito insufficiente. Disponibile: €${(user.wallet_balance || 0).toFixed(2)}`,
      },
    }
  }

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
  let walletDebited = false
  let walletDebitAmount = 0
  let walletTransactionId: string | undefined

  if (!isSuperadmin) {
    // P0: Passa idempotency_key a wallet function (standalone idempotent)
    const { data: walletResult, error: walletError } = await withConcurrencyRetry(
      async () =>
        await supabaseAdmin.rpc('decrement_wallet_balance', {
          p_user_id: targetId,
          p_amount: estimatedCost,
          p_idempotency_key: idempotencyKey,  // P0: Wallet-level idempotency
        }),
      { operationName: 'shipment_debit_estimate' }
    )

    if (walletError) {
      return {
        status: 402,
        json: {
          error: 'INSUFFICIENT_CREDIT',
          required: estimatedCost,
          available: user.wallet_balance || 0,
          message: `Credito insufficiente. Disponibile: €${(user.wallet_balance || 0).toFixed(2)}`,
        },
      }
    }

    // P0: Handle new JSONB return type
    const result = (walletResult as any)?.[0] || walletResult
    if (result?.idempotent_replay) {
      console.log('💰 [WALLET] Idempotent replay: wallet already debited for this operation', {
        transaction_id: result.transaction_id,
        idempotency_key: idempotencyKey,
      })
    }

    walletDebited = true
    walletDebitAmount = estimatedCost
    walletTransactionId = result?.transaction_id
  }

  // ============================================
  // CHIAMATA CORRIERE
  // ============================================
  const recipientEmailFallback =
    validated.recipient.email || context.target.email || `noemail+${targetId}@spediresicuro.local`

  const recipientNormalized = {
    ...(validated.recipient as any),
    email: recipientEmailFallback,
  }

  let courierResponse: CourierCreateShippingResult
  try {
    courierResponse = await courierClient.createShipping(
      {
        sender: validated.sender,
        recipient: recipientNormalized,
        packages: validated.packages,
        insurance: validated.insurance?.value,
        cod: validated.cod?.value,
        notes: validated.notes,
      },
      { timeout: 30000 }
    )
  } catch (courierError: any) {
    // ============================================
    // COMPENSAZIONE: etichetta non creata → refund wallet
    // ============================================
    if (walletDebited && !isSuperadmin) {
      try {
        const refundFn =
          deps.overrides?.refundWallet ??
          (async ({ userId, amount }) => {
            // P0: Refund con idempotency (derivata da shipment idempotency_key)
            const { data, error } = await supabaseAdmin.rpc('increment_wallet_balance', {
              p_user_id: userId,
              p_amount: amount,
              p_idempotency_key: `${idempotencyKey}-refund`,  // P0: Idempotent refund
            })
            return { error: error ? { message: error.message, code: error.code } : null }
          })

        const { error: compensateError } = await refundFn({ userId: targetId, amount: walletDebitAmount })

        if (compensateError) {
          // NOTE: Alcune installazioni DB hanno shipment_id_external/tracking_number NOT NULL.
          // In caso di fallimento PRIMA di ottenere tracking/shipmentId, usiamo placeholder.
          const { error: queueError } = await supabaseAdmin.from('compensation_queue').insert({
            user_id: targetId,
            provider_id: validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider,
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
          } as any)

          if (queueError) {
            // Best-effort logging for smoke tests / diagnostics
            console.error('❌ [COMPENSATION_QUEUE] Insert failed (courier fail refund):', {
              message: queueError.message,
              code: (queueError as any).code,
            })
          }
        }
      } catch {
        // ignore
      }
    }

    if (courierError?.statusCode === 422) return { status: 422, json: { error: 'Indirizzo destinatario non valido.' } }
    if (courierError?.statusCode >= 500 || `${courierError?.message || ''}`.includes('timeout')) {
      return { status: 503, json: { error: 'Corriere temporaneamente non disponibile.' } }
    }
    return { status: 500, json: { error: 'Errore creazione spedizione.' } }
  }

  // ============================================
  // TRANSAZIONE DB (best-effort)
  // ============================================
  // Sprint 2.7: Costo finale = corriere + platform fee
  const courierFinalCost = courierResponse.cost
  const finalCost = courierFinalCost + platformFee
  
  console.log('💰 [CreateShipment] Final cost breakdown:', {
    courierFinalCost,
    platformFee,
    finalCost,
  })

  let shipment: any
  try {
    // 1) Wallet adjustment + ledger
    if (!isSuperadmin && walletDebited) {
      const costDifference = finalCost - walletDebitAmount

      if (Math.abs(costDifference) > 0.01) {
        if (costDifference > 0) {
          // P0: Adjustment debit con idempotency
          const { error: adjustError } = await withConcurrencyRetry(
            async () =>
              await supabaseAdmin.rpc('decrement_wallet_balance', {
                p_user_id: targetId,
                p_amount: costDifference,
                p_idempotency_key: `${idempotencyKey}-adjust-debit`,  // P0: Idempotent adjustment
              }),
            { operationName: 'shipment_debit_adjustment' }
          )
          if (adjustError) throw new Error(`Wallet adjustment failed: ${adjustError.message}`)
          walletDebitAmount = finalCost
        } else {
          // P0: Adjustment credit con idempotency
          const { error: adjustError } = await supabaseAdmin.rpc('increment_wallet_balance', {
            p_user_id: targetId,
            p_amount: Math.abs(costDifference),
            p_idempotency_key: `${idempotencyKey}-adjust-credit`,  // P0: Idempotent adjustment
          })
          if (adjustError) {
            await supabaseAdmin.from('compensation_queue').insert({
              user_id: targetId,
              provider_id: validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider,
              carrier: validated.carrier,
              action: 'REFUND',
              original_cost: Math.abs(costDifference),
              error_context: {
                adjustment_error: adjustError.message,
                estimated: walletDebitAmount,
                actual: finalCost,
                retry_strategy: 'MANUAL',
              },
              status: 'PENDING',
            } as any)
          } else {
            walletDebitAmount = finalCost
          }
        }
      } else {
        walletDebitAmount = finalCost
      }

      await supabaseAdmin.from('wallet_transactions').insert({
        user_id: targetId,
        amount: -finalCost,
        type: 'SHIPMENT_CHARGE',
        description: `Spedizione ${courierResponse.trackingNumber}`,
      } as any)
    }

    // 2) Insert shipment (allow override)
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
            // Best-effort: utile per vincoli anti-orphan e audit
            created_by_user_email: context.target.email,
          } as any)
          .select()
          .single()

        return { data, error: error ? { message: error.message } : null }
      })

    const { data: newShipment, error: shipmentError } = await insertShipmentFn({
      targetId,
      validated,
      idempotencyKey,
      courierResponse,
      finalCost,
    })

    if (shipmentError || !newShipment) throw new Error(`Shipment creation failed: ${shipmentError?.message || 'Unknown error'}`)

    shipment = newShipment

    await supabaseAdmin.rpc('complete_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_shipment_id: shipment.id,
      p_status: 'completed',
    })

    // ============================================
    // SPRINT 1: FINANCIAL TRACKING (non-blocking)
    // ============================================
    // Determina api_source e registra costo piattaforma
    // IMPORTANTE: Questo NON deve bloccare la risposta al cliente
    try {
      const apiSourceResult = await determineApiSource(supabaseAdmin, {
        userId: targetId,
        priceListId: (validated as any).priceListId, // Opzionale, potrebbe non esistere
        courierCode: validated.carrier,
      })

      // Aggiorna shipment con api_source
      await updateShipmentApiSource(
        supabaseAdmin,
        shipment.id,
        apiSourceResult.apiSource,
        apiSourceResult.priceListId
      )

      // Se usa contratti piattaforma, registra il costo
      if (apiSourceResult.apiSource === 'platform') {
        // Calcola il costo reale che paghiamo al corriere
        const serviceType = (validated as any).serviceType || 'standard'
        const providerCostResult = await calculateProviderCost(supabaseAdmin, {
          courierCode: validated.carrier,
          weight: validated.packages[0]?.weight || 1,
          destination: {
            zip: validated.recipient.postalCode,
            province: validated.recipient.province,
            country: validated.recipient.country || 'IT',
          },
          serviceType,
          masterPriceListId: apiSourceResult.masterPriceListId,
        })

        // Registra il costo piattaforma
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
        })

        console.log('💰 [PLATFORM_COST] Recorded:', {
          shipmentId: shipment.id,
          billed: finalCost,
          providerCost: providerCostResult.cost,
          margin: finalCost - providerCostResult.cost,
          source: providerCostResult.source,
        })
      }
    } catch (trackingError) {
      // NON bloccare - graceful degradation
      console.error('[PLATFORM_COST] Failed to track (non-blocking):', trackingError)
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
      })
    } catch {
      // ignore
    }

    // Refund wallet (best-effort)
    if (walletDebited && !isSuperadmin) {
      try {
        const refundFn =
          deps.overrides?.refundWallet ??
          (async ({ userId, amount }) => {
            // P0: Refund con idempotency (derivata da shipment idempotency_key)
            const { data, error } = await supabaseAdmin.rpc('increment_wallet_balance', {
              p_user_id: userId,
              p_amount: amount,
              p_idempotency_key: `${idempotencyKey}-refund`,  // P0: Idempotent refund
            })
            return { error: error ? { message: error.message, code: error.code } : null }
          })

        const { error: compensateError } = await refundFn({ userId: targetId, amount: walletDebitAmount })
        if (compensateError) {
          const { error: queueError } = await supabaseAdmin.from('compensation_queue').insert({
            user_id: targetId,
            provider_id: validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider,
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
          } as any)

          if (queueError) {
            console.error('❌ [COMPENSATION_QUEUE] Insert failed (db fail refund):', {
              message: queueError.message,
              code: (queueError as any).code,
            })
          }
        }
      } catch {
        // ignore
      }
    }

    // Delete label (best-effort)
    try {
      await courierClient.deleteShipping({ shipmentId: courierResponse.shipmentId })
    } catch (deleteError: any) {
      const providerIdForQueue = validated.provider === 'spediscionline' ? 'spediscionline' : validated.provider
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
      } as any)
    }

    return {
      status: 500,
      json: {
        error: 'Errore salvataggio. Riprova.',
        ...(process.env.SMOKE_TEST_DEBUG === '1'
          ? { debug: { message: dbError?.message || 'Unknown db error' } }
          : {}),
      },
    }
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
      },
    },
  }
}


