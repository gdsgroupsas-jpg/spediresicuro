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
    // IDEMPOTENCY CHECK
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

    const oneMinuteAgo = new Date(Date.now() - 60000)
    const { data: recentDuplicate } = await supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('user_id', targetId) // Target ID (who pays)
      .eq('idempotency_key', idempotencyKey)
      .gte('created_at', oneMinuteAgo.toISOString())
      .limit(1)
      .maybeSingle()

    if (recentDuplicate) {
      return Response.json(
        { 
          error: 'DUPLICATE_REQUEST',
          message: 'Richiesta duplicata. Attendere.',
          shipment_id: recentDuplicate.id
        },
        { status: 409 }
      )
    }

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
        await supabaseAdmin
          .from('wallet_transactions')
          .insert({
            user_id: targetId, // Target ID (who pays)
            amount: -finalCost,
            type: 'SHIPMENT_CHARGE',
            description: `Spedizione ${courierResponse.trackingNumber}`,
            status: 'COMPLETED'
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

    } catch (dbError: any) {
      
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

