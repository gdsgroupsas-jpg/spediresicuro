#!/usr/bin/env tsx

/**
 * SMOKE TEST 3:
 * - retry con stessa idempotency_key → una sola operazione wallet + stesso outcome shipment
 *
 * Usage:
 *   npx tsx scripts/smoke-test-idempotency-retry.ts
 */

import crypto from 'crypto'
import type { ActingContext } from '@/lib/safe-auth'
import type { CreateShipmentInput } from '@/lib/validations/shipment'
import { createShipmentCore, type CourierClient, type CourierCreateShippingResult } from '@/lib/shipments/create-shipment-core'
import {
  cleanupSmokeTestUser,
  createSmokeTestUser,
  fetchRows,
  getSupabaseAdminClient,
  getWalletBalance,
  loadEnvFromLocal,
} from './smoke-test-helpers'

function buildContext(user: { id: string; email: string }): ActingContext {
  return {
    actor: {
      id: user.id,
      email: user.email,
      name: 'Smoke Test',
      role: 'user',
      account_type: 'user',
      is_reseller: false,
    },
    target: {
      id: user.id,
      email: user.email,
      name: 'Smoke Test',
      role: 'user',
      account_type: 'user',
      is_reseller: false,
    },
    isImpersonating: false,
  }
}

function buildValidShipmentInput(): CreateShipmentInput {
  return {
    sender: {
      name: 'Mittente Test',
      address: 'Via Roma 1',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      country: 'IT',
      phone: '+393401234567',
      email: 'mittente@smoke-test.local',
    },
    recipient: {
      name: 'Destinatario Test',
      address: 'Via Milano 2',
      city: 'Roma',
      province: 'RM',
      postalCode: '00100',
      country: 'IT',
      phone: '+393409876543',
      email: 'dest@smoke-test.local',
    },
    packages: [{ length: 10, width: 10, height: 10, weight: 1 }],
    provider: 'spediscionline',
    carrier: 'GLS',
    notes: 'SMOKE TEST',
  }
}

function makeCourierClientOk(resp: CourierCreateShippingResult): CourierClient {
  return {
    async createShipping() {
      return resp
    },
    async deleteShipping() {
      // should never be called in success path
    },
  }
}

async function main() {
  loadEnvFromLocal()
  const supabase = getSupabaseAdminClient()

  console.log('')
  console.log('🧪 SMOKE TEST 3 - Idempotency retry (same key, one wallet op)')
  console.log('='.repeat(78))

  const user = await createSmokeTestUser({ supabase, initialBalance: 50, label: 'idempotency-retry' })
  const ctx = buildContext(user)
  const validated = buildValidShipmentInput()

  // Use a deterministic, safe key (hex)
  const idempotencyKey = crypto.createHash('sha256').update(`smoke-idem-${user.id}`).digest('hex')

  const courierResp: CourierCreateShippingResult = {
    cost: 10.2, // same as estimated cost → no adjustment
    trackingNumber: `IDEM-${Date.now()}`,
    shipmentId: `idem_ship_${Date.now()}`,
    labelData: 'MOCK_LABEL_DATA',
    labelZPL: null,
  }

  const balanceBefore = await getWalletBalance({ supabase, userId: user.id })

  try {
    console.log('\nCALL 1) Create shipment (should debit once and create shipment)')
    const r1 = await createShipmentCore({
      context: ctx,
      validated,
      deps: {
        supabaseAdmin: supabase,
        getCourierClient: async () => makeCourierClientOk(courierResp),
        idempotencyKeyOverride: idempotencyKey,
      },
    })

    if (r1.status !== 200) throw new Error(`Call 1 expected 200, got ${r1.status}: ${JSON.stringify(r1.json)}`)
    const shipmentId1 = r1.json?.shipment?.id
    if (!shipmentId1) throw new Error('Call 1: missing shipment.id')

    const balanceAfter1 = await getWalletBalance({ supabase, userId: user.id })
    if (!(balanceAfter1 < balanceBefore)) throw new Error('Call 1: expected wallet debited')

    console.log('\nCALL 2) Retry same idempotency_key (should be idempotent replay)')
    const r2 = await createShipmentCore({
      context: ctx,
      validated,
      deps: {
        supabaseAdmin: supabase,
        getCourierClient: async () => makeCourierClientOk(courierResp),
        idempotencyKeyOverride: idempotencyKey,
      },
    })

    if (r2.status !== 200) throw new Error(`Call 2 expected 200, got ${r2.status}: ${JSON.stringify(r2.json)}`)
    const shipmentId2 = r2.json?.shipment?.id
    if (shipmentId2 !== shipmentId1) throw new Error(`Call 2: expected same shipment id. ${shipmentId1} vs ${shipmentId2}`)
    if (r2.json?.idempotent_replay !== true) throw new Error('Call 2: expected idempotent_replay=true')

    const balanceAfter2 = await getWalletBalance({ supabase, userId: user.id })
    if (Math.abs(balanceAfter2 - balanceAfter1) > 0.01) {
      throw new Error(`Call 2: wallet balance changed on retry. After1=${balanceAfter1} After2=${balanceAfter2}`)
    }

    const walletTx = await fetchRows({
      supabase,
      table: 'wallet_transactions',
      filter: { user_id: user.id },
      columns: 'id, amount, type, description',
    })

    const shipmentCharges = walletTx.filter((t) => t.type === 'SHIPMENT_CHARGE')
    if (shipmentCharges.length !== 1) {
      throw new Error(`Expected exactly 1 SHIPMENT_CHARGE, got ${shipmentCharges.length}`)
    }

    console.log('\n✅ TEST PASSATO: idempotency replay non crea doppi addebiti')
  } finally {
    await cleanupSmokeTestUser({ supabase, userId: user.id })
  }
}

main().catch((err) => {
  console.error('\n❌ TEST FALLITO:', err?.message || err)
  process.exit(1)
})


