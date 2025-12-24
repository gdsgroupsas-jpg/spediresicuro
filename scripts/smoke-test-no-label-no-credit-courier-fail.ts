#!/usr/bin/env tsx

/**
 * SMOKE TEST 1:
 * - corriere fallisce DOPO debit stimato → refund wallet + NO shipment
 * - se refund fallisce → enqueue compensation_queue (REFUND)
 *
 * Usage:
 *   npx tsx scripts/smoke-test-no-label-no-credit-courier-fail.ts
 */

import type { ActingContext } from '@/lib/safe-auth'
import type { CreateShipmentInput } from '@/lib/validations/shipment'
import { createShipmentCore, type CourierClient } from '@/lib/shipments/create-shipment-core'
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

function makeFailingCourierClient(): CourierClient {
  return {
    async createShipping() {
      const err: any = new Error('timeout while calling courier')
      err.statusCode = 503
      throw err
    },
    async deleteShipping() {
      // non usato in questo scenario
    },
  }
}

async function main() {
  loadEnvFromLocal()
  const supabase = getSupabaseAdminClient()

  console.log('')
  console.log('🧪 SMOKE TEST 1 - Courier fail after debit (No Label, No Credit)')
  console.log('='.repeat(72))

  // CASE A: refund success
  const userA = await createSmokeTestUser({ supabase, initialBalance: 50, label: 'courier-fail-refund-ok' })
  const ctxA = buildContext(userA)
  const validated = buildValidShipmentInput()
  const balanceBeforeA = await getWalletBalance({ supabase, userId: userA.id })

  try {
    console.log('\nCASE A) Corriere fallisce → refund OK → no shipment, no queue')

    const resultA = await createShipmentCore({
      context: ctxA,
      validated,
      deps: {
        supabaseAdmin: supabase,
        getCourierClient: async () => makeFailingCourierClient(),
      },
    })

    if (resultA.status !== 503) throw new Error(`Expected 503, got ${resultA.status}`)

    const balanceAfterA = await getWalletBalance({ supabase, userId: userA.id })
    if (Math.abs(balanceAfterA - balanceBeforeA) > 0.01) {
      throw new Error(`Wallet not refunded. Before=${balanceBeforeA} After=${balanceAfterA}`)
    }

    const shipmentsA = await fetchRows({ supabase, table: 'shipments', filter: { user_id: userA.id }, columns: 'id' })
    if (shipmentsA.length !== 0) throw new Error(`Expected 0 shipments, got ${shipmentsA.length}`)

    const queueA = await fetchRows({
      supabase,
      table: 'compensation_queue',
      filter: { user_id: userA.id },
      columns: 'id, action, status',
    })
    if (queueA.length !== 0) throw new Error(`Expected 0 compensation_queue rows, got ${queueA.length}`)

    console.log('✅ CASE A PASS')
  } finally {
    await cleanupSmokeTestUser({ supabase, userId: userA.id })
  }

  // CASE B: refund fails → queue REFUND
  const userB = await createSmokeTestUser({ supabase, initialBalance: 50, label: 'courier-fail-refund-fail' })
  const ctxB = buildContext(userB)
  const balanceBeforeB = await getWalletBalance({ supabase, userId: userB.id })

  try {
    console.log('\nCASE B) Corriere fallisce → refund FALLISCE → enqueue compensation_queue(REFUND)')

    const resultB = await createShipmentCore({
      context: ctxB,
      validated,
      deps: {
        supabaseAdmin: supabase,
        getCourierClient: async () => makeFailingCourierClient(),
        overrides: {
          refundWallet: async () => ({ error: { message: 'FORCED_REFUND_FAILURE' } }),
        },
      },
    })

    if (resultB.status !== 503) throw new Error(`Expected 503, got ${resultB.status}`)

    const shipmentsB = await fetchRows({ supabase, table: 'shipments', filter: { user_id: userB.id }, columns: 'id' })
    if (shipmentsB.length !== 0) throw new Error(`Expected 0 shipments, got ${shipmentsB.length}`)

    const queueB = await fetchRows({
      supabase,
      table: 'compensation_queue',
      filter: { user_id: userB.id },
      columns: 'id, action, status, original_cost, error_context',
    })
    const refundRows = queueB.filter((r) => r.action === 'REFUND' && r.status === 'PENDING')
    if (refundRows.length < 1) {
      throw new Error(`Expected REFUND PENDING in compensation_queue, got: ${JSON.stringify(queueB)}`)
    }

    // Nota: in questo scenario il saldo può risultare inferiore perché il refund è fallito.
    const balanceAfterB = await getWalletBalance({ supabase, userId: userB.id })
    if (!(balanceAfterB < balanceBeforeB)) {
      throw new Error(`Expected wallet to be debited (refund failed). Before=${balanceBeforeB} After=${balanceAfterB}`)
    }

    console.log('✅ CASE B PASS')
  } finally {
    await cleanupSmokeTestUser({ supabase, userId: userB.id })
  }

  console.log('\n✅ TEST PASSATO: No Label, No Credit (courier fail paths)')
}

main().catch((err) => {
  console.error('\n❌ TEST FALLITO:', err?.message || err)
  process.exit(1)
})


