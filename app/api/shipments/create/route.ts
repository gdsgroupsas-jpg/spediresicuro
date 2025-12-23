import { requireSafeAuth } from '@/lib/safe-auth'
import { supabaseAdmin } from '@/lib/db/client'
import { createShipmentSchema } from '@/lib/validations/shipment'
import { CourierFactory } from '@/lib/services/couriers/courier-factory'
import { getCourierConfigForUser } from '@/lib/couriers/factory'
import crypto from 'crypto'
import { writeShipmentAuditLog } from '@/lib/security/audit-log'
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions'
import { withConcurrencyRetry } from '@/lib/wallet/retry'

export async function POST(request: Request) {
  // CRITICAL: Use requireSafeAuth() to support impersonation (Acting Context)
  const context = await requireSafeAuth()
  
  // Extract target and actor IDs (target = who pays, actor = who clicked)
  const targetId = context.target.id
  const actorId = context.actor.id
  const impersonationActive = context.isImpersonating

  try {
    const body = await request.json()
    
    // ============================================
    // FALLBACK: Supporto formato legacy frontend
    // ============================================
    // Se il frontend invia solo 'corriere' senza 'provider' e 'carrier',
    // mappiamo automaticamente a provider='spediscionline' e carrier=corriere
    if (body.corriere && !body.carrier) {
      body.carrier = body.corriere.toUpperCase()
      body.provider = body.provider || 'spediscionline'
    }
    
    const validated = createShipmentSchema.parse(body)

    // ============================================
    // IDEMPOTENCY KEY GENERATION
    // ============================================
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        userId: targetId, // Use targetId for idempotency (who pays, not who clicked)
        recipient: validated.recipient,
        packages: validated.packages,
        timestamp: Math.floor(Date.now() / 5000)
      }))
      .digest('hex')

    // ============================================
    // CRASH-SAFE IDEMPOTENCY LOCK
    // ============================================
    // ⚠️ CRITICAL: Acquire lock BEFORE wallet debit
    // Prevents double debit even if crash occurs after debit but before shipment creation
    // Migration: 044_idempotency_locks.sql
    
    // ⚠️ FIX P0: TTL aumentato da 10 a 30 minuti per prevenire TOCTOU (audit 2025-12-22)
    // Se lock scade prima del retry, potrebbe causare doppio debit
    const { data: lockResult, error: lockError } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_user_id: targetId,
      p_ttl_minutes: 30
    })

    if (lockError) {
      console.error('❌ [IDEMPOTENCY] Lock acquisition failed:', lockError)
      return Response.json(
        { error: 'Errore sistema idempotency. Riprova.' },
        { status: 500 }
      )
    }

    const lock = lockResult?.[0]
    if (!lock) {
      return Response.json(
        { error: 'Errore acquisizione lock idempotency.' },
        { status: 500 }
      )
    }

    // Handle lock states
    if (!lock.acquired) {
      if (lock.status === 'completed' && lock.result_shipment_id) {
        // Idempotent replay: shipment già creato
        const { data: existingShipment } = await supabaseAdmin
          .from('shipments')
          .select('id, tracking_number, carrier, total_cost, label_data, sender_name, sender_address, sender_city, sender_province, sender_zip, sender_country, recipient_name, recipient_address, recipient_city, recipient_province, recipient_zip, recipient_country')
          .eq('id', lock.result_shipment_id)
          .single()

        if (existingShipment) {
          return Response.json({
            success: true,
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
                country: existingShipment.sender_country
              },
              recipient: {
                name: existingShipment.recipient_name,
                address: existingShipment.recipient_address,
                city: existingShipment.recipient_city,
                province: existingShipment.recipient_province,
                postalCode: existingShipment.recipient_zip,
                country: existingShipment.recipient_country
              }
            },
            idempotent_replay: true
          })
        }
      } else if (lock.status === 'in_progress') {
        // Operation already in progress: don't debit again
        // Log strutturato per observability
        console.log(JSON.stringify({
          event_type: 'idempotency_lock_in_progress',
          idempotency_key: idempotencyKey,
          user_id: targetId,
          message: 'Lock already in progress, preventing duplicate request',
          timestamp: new Date().toISOString()
        }))
        
        return Response.json(
          { 
            error: 'DUPLICATE_REQUEST',
            message: 'Richiesta già in elaborazione. Attendere.',
            retry_after: 5,
            idempotency_key: idempotencyKey
          },
          { status: 409 }
        )
      } else if (lock.status === 'failed') {
        // Previous attempt failed after debit: don't re-debit
        // Log strutturato per observability
        console.log(JSON.stringify({
          event_type: 'idempotency_lock_failed',
          idempotency_key: idempotencyKey,
          user_id: targetId,
          error_message: lock.error_message || 'Previous attempt failed',
          requires_manual_review: true,
          timestamp: new Date().toISOString()
        }))
        
        return Response.json(
          { 
            error: 'PREVIOUS_ATTEMPT_FAILED',
            message: lock.error_message || 'Tentativo precedente fallito. Contattare supporto.',
            requires_manual_review: true,
            idempotency_key: idempotencyKey
          },
          { status: 409 }
        )
      }
    }

    // Lock acquired: proceed with operation
    // ⚠️ From this point, if we crash, retry will see status='in_progress' and won't re-debit

    // ============================================
    // CONFIGURAZIONE CORRIERE
    // ============================================
    // Cerca configurazione per provider + carrier + contract_id
    const providerId = validated.provider === 'spediscionline' ? 'spedisci_online' : validated.provider
    
    const { data: courierConfigs, error: configError } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('provider_id', providerId)
      .eq('carrier', validated.carrier)
      .eq('is_active', true)
      .or(validated.contract_id 
        ? `contract_id.eq.${validated.contract_id},contract_id.is.null`
        : 'contract_id.is.null'
      )
      .limit(1)

    if (configError || !courierConfigs || courierConfigs.length === 0) {
      return Response.json(
        { error: `Configurazione non trovata per ${validated.carrier} tramite ${validated.provider}. Vai su Integrazioni.` },
        { status: 400 }
      )
    }

    const courierConfig = courierConfigs[0]
    const contractId = validated.contract_id || courierConfig.contract_id || undefined

    const courierClient = CourierFactory.getClient(
      validated.provider,
      validated.carrier,
      {
        apiKey: courierConfig.api_key,
        baseUrl: courierConfig.base_url,
        contractId: contractId
      }
    )

    // ============================================
    // PRE-CHECK CREDITO
    // ============================================
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('wallet_balance, role')
      .eq('id', targetId) // Target ID (who pays)
      .single()

    if (userError || !user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const estimatedCost = 8.50 // TODO: Calcolo reale
    const isSuperadmin = user.role === 'SUPERADMIN' || user.role === 'superadmin'

    if (!isSuperadmin && (user.wallet_balance || 0) < estimatedCost) {
      return Response.json(
        { 
          error: 'INSUFFICIENT_CREDIT',
          required: estimatedCost,
          available: user.wallet_balance || 0,
          message: `Credito insufficiente. Disponibile: €${(user.wallet_balance || 0).toFixed(2)}`
        },
        { status: 402 }
      )
    }

    // ============================================
    // CHIAMATA CORRIERE
    // ============================================
    // Normalize recipient email (TypeScript fix - fail-safe fallback)
    // Email is optional in Zod schema but some couriers require it
    const recipientEmailFallback = 
      validated.recipient.email ||
      context.target.email ||
      `noemail+${targetId}@spediresicuro.local`;
    
    const recipientNormalized = {
      ...validated.recipient,
      email: recipientEmailFallback,
    };
    
    const usedEmailFallback = !validated.recipient.email;
    
    let courierResponse
    try {
      courierResponse = await courierClient.createShipping({
        sender: validated.sender,
        recipient: recipientNormalized, // Use normalized recipient (with email guaranteed)
        packages: validated.packages,
        insurance: validated.insurance?.value,
        cod: validated.cod?.value,
        notes: validated.notes
      }, { timeout: 30000 })

    } catch (courierError: any) {
      
      await supabaseAdmin
        .from('diagnostics_events')
        .insert({
          type: 'error',
          severity: 'high',
          context: {
            user_id: targetId, // Target ID (who pays)
            actor_id: actorId, // Actor ID (who clicked)
            impersonation_active: impersonationActive,
            carrier: validated.carrier,
            error: courierError.message,
            status_code: courierError.statusCode
          }
        })

      if (courierError.statusCode === 422) {
        return Response.json(
          { error: 'Indirizzo destinatario non valido.' },
          { status: 422 }
        )
      }

      if (courierError.statusCode >= 500 || courierError.message.includes('timeout')) {
        return Response.json(
          { error: 'Corriere temporaneamente non disponibile.' },
          { status: 503 }
        )
      }

      return Response.json(
        { error: 'Errore creazione spedizione.' },
        { status: 500 }
      )
    }

    // ============================================
    // TRANSAZIONE DB
    // ============================================
    const finalCost = courierResponse.cost

    let shipment
    try {
      // Inizia transazione (Supabase non supporta transazioni esplicite, usiamo try/catch)
      
      // ============================================
      // 1. WALLET DEBIT - ATOMIC OPERATION
      // ============================================
      // ⚠️ CRITICAL: Never UPDATE users.wallet_balance directly
      // ⚠️ Always use decrement_wallet_balance() RPC for atomic safety
      // ⚠️ Migration: 040_wallet_atomic_operations.sql
      
      if (!isSuperadmin) {
        // ATOMIC DEBIT: Uses SELECT FOR UPDATE NOWAIT
        // Smart retry per lock contention (55P03)
        const { error: walletError } = await withConcurrencyRetry(
          async () => await supabaseAdmin.rpc('decrement_wallet_balance', {
            p_user_id: targetId, // Target ID (who pays)
            p_amount: finalCost
          }),
          { operationName: 'shipment_debit' }
        )

        // FAIL-FAST: No fallback, no manual UPDATE
        // If RPC fails, entire operation must fail
        if (walletError) {
          console.error('❌ [WALLET] Atomic debit failed:', {
            userId: targetId,
            amount: finalCost,
            error: walletError.message,
            code: walletError.code
          })
          
          throw new Error(`Wallet debit failed: ${walletError.message}`)
        }

        // SUCCESS: Log wallet debit
        console.log('✅ [WALLET] Atomic debit successful:', {
          userId: targetId,
          amount: finalCost,
          trackingNumber: courierResponse.trackingNumber
        })

        // Create wallet transaction record for audit trail
        // ⚠️ FIX P0: Rimosso campo 'status' inesistente (audit 2025-12-22)
        await supabaseAdmin
          .from('wallet_transactions')
          .insert({
            user_id: targetId, // Target ID (who pays)
            amount: -finalCost,
            type: 'SHIPMENT_CHARGE',
            description: `Spedizione ${courierResponse.trackingNumber}`
          })
      }

      // 2. Crea spedizione
      const { data: newShipment, error: shipmentError } = await supabaseAdmin
        .from('shipments')
        .insert({
          user_id: targetId, // Target ID (who pays, owner of shipment)
          status: 'confirmed',
          idempotency_key: idempotencyKey,
          carrier: validated.carrier,
          tracking_number: courierResponse.trackingNumber,
          shipment_id_external: courierResponse.shipmentId,
          label_data: courierResponse.labelData,  // ✅ Campo corretto
          label_zpl: courierResponse.labelZPL,
          total_cost: finalCost,
          sender_name: validated.sender.name,
          sender_address: validated.sender.address,
          sender_city: validated.sender.city,
          sender_province: validated.sender.province,
          sender_zip: validated.sender.postalCode,
          sender_country: validated.sender.country,
          sender_phone: validated.sender.phone,
          sender_email: validated.sender.email,
          recipient_name: validated.recipient.name,
          recipient_address: validated.recipient.address,
          recipient_city: validated.recipient.city,
          recipient_province: validated.recipient.province,
          recipient_zip: validated.recipient.postalCode,
          recipient_country: validated.recipient.country,
          recipient_phone: validated.recipient.phone,
          recipient_email: validated.recipient.email,
          weight: validated.packages[0]?.weight || 1,
          length: validated.packages[0]?.length,
          width: validated.packages[0]?.width,
          height: validated.packages[0]?.height,
          declared_value: validated.insurance?.value || 0,
          cash_on_delivery_amount: validated.cod?.value || 0,
          notes: validated.notes || null
        })
        .select()
        .single()

      if (shipmentError || !newShipment) {
        throw new Error(`Shipment creation failed: ${shipmentError?.message || 'Unknown error'}`)
      }

      shipment = newShipment

      // ============================================
      // COMPLETE IDEMPOTENCY LOCK
      // ============================================
      // Mark lock as completed after successful shipment creation
      await supabaseAdmin.rpc('complete_idempotency_lock', {
        p_idempotency_key: idempotencyKey,
        p_shipment_id: shipment.id,
        p_status: 'completed'
      })

    } catch (dbError: any) {
      // ============================================
      // FAIL IDEMPOTENCY LOCK
      // ============================================
      // Mark lock as failed if error occurred after debit
      // This prevents re-debit on retry
      try {
        await supabaseAdmin.rpc('fail_idempotency_lock', {
          p_idempotency_key: idempotencyKey,
          p_error_message: dbError.message || 'Database error after wallet debit'
        })
        
        // Log strutturato per observability
        console.log(JSON.stringify({
          event_type: 'idempotency_lock_marked_failed',
          idempotency_key: idempotencyKey,
          user_id: targetId,
          error_message: dbError.message || 'Database error after wallet debit',
          note: 'Lock marked as failed after wallet debit, preventing re-debit on retry',
          timestamp: new Date().toISOString()
        }))
      } catch (failError: any) {
        // Fail-open: log but don't block error response
        console.error('⚠️ [IDEMPOTENCY] Failed to mark lock as failed:', failError)
      }
      
      // COMPENSAZIONE
      try {
        await courierClient.deleteShipping({
          shipmentId: courierResponse.shipmentId
        })

      } catch (deleteError: any) {
        
        // Accoda per retry MANUALE
        // ⚠️ STRATEGIA RETRY: MANUAL (processo manuale via dashboard admin)
        // TODO: Implementare job automatico in futuro se necessario
        
        // Normalizza provider_id per compatibilità DB
        const providerIdForQueue = validated.provider === 'spediscionline' 
          ? 'spediscionline' 
          : validated.provider
        
        await supabaseAdmin
          .from('compensation_queue')
          .insert({
            user_id: targetId, // Target ID (who pays)
            provider_id: providerIdForQueue,
            carrier: validated.carrier,
            shipment_id_external: courierResponse.shipmentId,
            tracking_number: courierResponse.trackingNumber,
            action: 'DELETE',
            original_cost: finalCost,
            error_context: {
              db_error: dbError.message,
              delete_error: deleteError.message,
              retry_strategy: 'MANUAL',  // Esplicito: retry manuale
              actor_id: actorId, // Track who clicked (if impersonation)
              impersonation_active: impersonationActive
            },
            next_retry_at: new Date(Date.now() + 60000).toISOString(),
            status: 'PENDING'
          })
      }

      return Response.json(
        { error: 'Errore salvataggio. Riprova.' },
        { status: 500 }
      )
    }

    // ============================================
    // AUDIT LOG
    // ============================================
    try {
      await writeShipmentAuditLog(
        context,
        AUDIT_ACTIONS.CREATE_SHIPMENT,
        shipment.id,
        {
          carrier: validated.carrier,
          tracking_number: shipment.tracking_number,
          cost: finalCost,
          provider: validated.provider,
          recipient_email_fallback: usedEmailFallback, // Track if email fallback was used
        }
      );
    } catch (auditError) {
      // Fail-open: non bloccare se audit fallisce
      console.warn('⚠️ [AUDIT] Failed to log shipment creation:', auditError);
    }

    // SUCCESS
    return Response.json({
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
          country: shipment.sender_country
        },
        recipient: {
          name: shipment.recipient_name,
          address: shipment.recipient_address,
          city: shipment.recipient_city,
          province: shipment.recipient_province,
          postalCode: shipment.recipient_zip,
          country: shipment.recipient_country
        }
      }
    })

  } catch (error: any) {
    console.error('Error:', error)
    
    // Se è errore di validazione Zod
    if (error.name === 'ZodError') {
      return Response.json(
        { error: 'Dati non validi', details: error.errors },
        { status: 400 }
      )
    }

    return Response.json({ error: 'Errore interno' }, { status: 500 })
  }
}

