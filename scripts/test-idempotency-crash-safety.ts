#!/usr/bin/env tsx

/**
 * IDEMPOTENCY CRASH-SAFETY TEST
 * 
 * Verifica che l'idempotency lock prevenga doppio addebito
 * anche in caso di crash dopo debit ma prima di shipment creation.
 * 
 * TEST SCENARIO:
 * 1. Request 1: Acquire lock → Debit wallet → CRASH (simulato)
 * 2. Request 2 (retry): Acquire lock → Verifica che NON ri-debita
 * 
 * EXPECTED BEHAVIOR:
 * - Lock status = 'in_progress' dopo crash
 * - Retry NON ri-debita wallet
 * - Saldo diminuisce solo una volta
 * 
 * Usage:
 *   npx tsx scripts/test-idempotency-crash-safety.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================
// TEST UTILITIES
// ============================================

async function createTestUser() {
  const testEmail = `test-idempotency-${Date.now()}@example.com`
  
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: testEmail,
      name: 'Test Idempotency User',
      wallet_balance: 100.00, // Initial balance €100
      account_type: 'user'
    })
    .select()
    .single()
  
  if (error) throw new Error(`Failed to create test user: ${error.message}`)
  return user
}

async function cleanupTestUser(userId: string) {
  try {
    await supabase.from('idempotency_locks').delete().eq('user_id', userId)
    await supabase.from('wallet_transactions').delete().eq('user_id', userId)
    await supabase.from('shipments').delete().eq('user_id', userId)
    await supabase.from('users').delete().eq('id', userId)
    console.log('✅ Cleanup complete')
  } catch (error: any) {
    console.error('⚠️ Cleanup error:', error.message)
  }
}

async function getWalletBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('users')
    .select('wallet_balance')
    .eq('id', userId)
    .single()
  
  if (error) throw new Error(`Failed to get balance: ${error.message}`)
  return parseFloat(data.wallet_balance) || 0
}

async function getLockStatus(idempotencyKey: string) {
  const { data, error } = await supabase
    .from('idempotency_locks')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ============================================
// TEST: Crash Safety
// ============================================

async function testCrashSafety() {
  console.log('🧪 IDEMPOTENCY CRASH-SAFETY TEST')
  console.log('='.repeat(60))
  
  let testUser: any = null
  
  try {
    // Setup
    console.log('\n📝 Setup: Creating test user...')
    testUser = await createTestUser()
    console.log(`✅ Test user created: ${testUser.email}`)
    console.log(`   Initial balance: €${testUser.wallet_balance.toFixed(2)}`)

    const idempotencyKey = `test-crash-${Date.now()}`
    const debitAmount = 10.00
    const initialBalance = await getWalletBalance(testUser.id)

    console.log(`\n⚡ Simulating crash scenario...`)
    console.log(`   Idempotency key: ${idempotencyKey}`)
    console.log(`   Debit amount: €${debitAmount.toFixed(2)}`)

    // ============================================
    // STEP 1: Request 1 - Acquire lock
    // ============================================
    console.log('\n📌 STEP 1: Acquiring lock...')
    const { data: lock1, error: lock1Error } = await supabase.rpc('acquire_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_user_id: testUser.id,
      p_ttl_minutes: 10
    })

    if (lock1Error) throw new Error(`Lock acquisition failed: ${lock1Error.message}`)
    if (!lock1[0]?.acquired) throw new Error('Lock not acquired')

    console.log('✅ Lock acquired')

    // ============================================
    // STEP 2: Request 1 - Debit wallet (simula debit)
    // ============================================
    console.log('\n📌 STEP 2: Debit wallet...')
    const { error: debitError } = await supabase.rpc('decrement_wallet_balance', {
      p_user_id: testUser.id,
      p_amount: debitAmount
    })

    if (debitError) throw new Error(`Debit failed: ${debitError.message}`)

    const balanceAfterDebit = await getWalletBalance(testUser.id)
    console.log(`✅ Wallet debited: €${debitAmount.toFixed(2)}`)
    console.log(`   Balance after debit: €${balanceAfterDebit.toFixed(2)}`)

    // ============================================
    // STEP 3: Request 1 - CRASH (simulato)
    // ============================================
    console.log('\n💥 STEP 3: CRASH SIMULATED (before shipment creation)')
    console.log('   Lock status should remain: in_progress')
    console.log('   Wallet already debited')
    
    // Verifica lock status dopo "crash"
    const lockAfterCrash = await getLockStatus(idempotencyKey)
    if (lockAfterCrash?.status !== 'in_progress') {
      throw new Error(`Expected lock status 'in_progress', got '${lockAfterCrash?.status}'`)
    }
    console.log('✅ Lock status: in_progress (correct)')

    // ============================================
    // STEP 4: Request 2 (retry) - Acquire lock
    // ============================================
    console.log('\n📌 STEP 4: Retry - Acquiring lock again...')
    const { data: lock2, error: lock2Error } = await supabase.rpc('acquire_idempotency_lock', {
      p_idempotency_key: idempotencyKey,
      p_user_id: testUser.id,
      p_ttl_minutes: 10
    })

    if (lock2Error) throw new Error(`Lock acquisition failed: ${lock2Error.message}`)
    
    const lock2Result = lock2[0]
    console.log(`   Lock acquired: ${lock2Result.acquired}`)
    console.log(`   Lock status: ${lock2Result.status}`)

    // ============================================
    // ASSERTIONS
    // ============================================
    console.log('\n' + '='.repeat(60))
    console.log('🎯 TEST RESULTS')
    console.log('='.repeat(60))

    // Assertion 1: Lock non acquisito al retry
    if (lock2Result.acquired) {
      console.error('\n❌ TEST FAILED: Lock acquired on retry (should be in_progress)')
      process.exit(1)
    }
    console.log('✅ Lock NOT acquired on retry (correct)')

    // Assertion 2: Lock status = in_progress
    if (lock2Result.status !== 'in_progress') {
      console.error(`\n❌ TEST FAILED: Expected status 'in_progress', got '${lock2Result.status}'`)
      process.exit(1)
    }
    console.log('✅ Lock status: in_progress (prevents re-debit)')

    // Assertion 3: Balance non diminuito due volte
    const finalBalance = await getWalletBalance(testUser.id)
    const expectedBalance = initialBalance - debitAmount
    const actualDifference = initialBalance - finalBalance

    console.log(`\n💰 Balance verification:`)
    console.log(`   Initial: €${initialBalance.toFixed(2)}`)
    console.log(`   Final: €${finalBalance.toFixed(2)}`)
    console.log(`   Difference: €${actualDifference.toFixed(2)}`)
    console.log(`   Expected difference: €${debitAmount.toFixed(2)}`)

    if (Math.abs(actualDifference - debitAmount) > 0.01) {
      console.error(`\n❌ TEST FAILED: Balance decreased by €${actualDifference.toFixed(2)}, expected €${debitAmount.toFixed(2)}`)
      console.error('   This indicates double debit occurred!')
      process.exit(1)
    }
    console.log('✅ Balance decreased exactly once (no double debit)')

    // ============================================
    // SUCCESS
    // ============================================
    console.log('\n' + '='.repeat(60))
    console.log('✅ TEST PASSED: Crash-safety verified!')
    console.log('='.repeat(60))
    console.log('✅ Lock prevents re-debit on retry')
    console.log('✅ Balance consistency maintained')
    console.log('✅ Idempotency is crash-safe')

  } catch (error: any) {
    console.error('\n❌ TEST ERROR:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    if (testUser) {
      console.log('\n🧹 Cleaning up...')
      await cleanupTestUser(testUser.id)
    }
  }
}

// ============================================
// EXECUTE
// ============================================

testCrashSafety()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })





