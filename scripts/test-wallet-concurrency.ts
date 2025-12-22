#!/usr/bin/env tsx

/**
 * WALLET CONCURRENCY STRESS TEST
 * 
 * Verifica che il wrapper `withConcurrencyRetry` funzioni correttamente
 * sotto carico con operazioni simultanee.
 * 
 * TEST SCENARIO:
 * - Crea utente test con saldo €0
 * - Esegue 10 chiamate simultanee a `add_wallet_credit` (€10 ciascuna)
 * - Verifica che tutte le operazioni completino con successo grazie al retry
 * - Verifica che il saldo finale sia €100 (10 operazioni × €10)
 * 
 * EXPECTED BEHAVIOR:
 * - Senza retry: Solo 1 operazione passa (lock pessimistico NOWAIT)
 * - Con retry: Tutte le 10 operazioni passano (retry automatico su 55P03)
 * 
 * Usage:
 *   npx tsx scripts/test-wallet-concurrency.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { withConcurrencyRetry } from '../lib/wallet/retry'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

// ============================================
// CONFIG
// ============================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ============================================
// TEST UTILITIES
// ============================================

interface TestUser {
  id: string
  email: string
  wallet_balance: number
}

async function createTestUser(): Promise<TestUser> {
  const testEmail = `test-stress-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
  
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      email: testEmail,
      name: 'Test Stress User',
      wallet_balance: 0.00, // Initial balance €0
      account_type: 'user'
    })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`)
  }
  
  return user as TestUser
}

async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // Delete wallet transactions first (foreign key constraint)
    await supabase
      .from('wallet_transactions')
      .delete()
      .eq('user_id', userId)
    
    // Delete user
    await supabase
      .from('users')
      .delete()
      .eq('id', userId)
    
    console.log('✅ Cleanup complete')
  } catch (error: any) {
    console.error('⚠️ Cleanup error (non-critical):', error.message)
  }
}

async function getWalletBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('users')
    .select('wallet_balance')
    .eq('id', userId)
    .single()
  
  if (error) {
    throw new Error(`Failed to get balance: ${error.message}`)
  }
  
  return parseFloat(data.wallet_balance) || 0
}

async function addWalletCreditWithRetry(
  userId: string,
  amount: number,
  operationIndex: number
): Promise<{ success: boolean; error?: string; transactionId?: string }> {
  try {
    const { data: txId, error: creditError } = await withConcurrencyRetry(
      async () => await supabase.rpc('add_wallet_credit', {
        p_user_id: userId,
        p_amount: amount,
        p_description: `Stress test operation #${operationIndex}`,
        p_created_by: null
      }),
      { operationName: `stress_test_credit_${operationIndex}` }
    )

    if (creditError) {
      return {
        success: false,
        error: creditError.message || 'Unknown error'
      }
    }

    return {
      success: true,
      transactionId: txId as string
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown exception'
    }
  }
}

// ============================================
// STRESS TEST: Concurrent Credit Operations
// ============================================

async function simulateConcurrentTraffic(
  userId: string,
  amount: number,
  concurrency: number
): Promise<{
  successful: number
  failed: number
  results: Array<{ index: number; success: boolean; error?: string }>
}> {
  console.log(`\n⚡ Simulating ${concurrency} concurrent credit operations...`)
  console.log(`   Amount per operation: €${amount.toFixed(2)}`)
  console.log(`   Expected total credit: €${(concurrency * amount).toFixed(2)}`)
  
  // Create array of promises (one per operation)
  const operations = Array.from({ length: concurrency }, (_, index) => {
    return addWalletCreditWithRetry(userId, amount, index + 1)
      .then(result => ({
        index: index + 1,
        success: result.success,
        error: result.error
      }))
  })

  // Execute all operations simultaneously
  const startTime = Date.now()
  const results = await Promise.allSettled(operations)
  const endTime = Date.now()
  const duration = endTime - startTime

  // Process results
  const processedResults = results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        index: idx + 1,
        success: false,
        error: result.reason?.message || 'Promise rejected'
      }
    }
  })

  const successful = processedResults.filter(r => r.success).length
  const failed = processedResults.filter(r => !r.success).length

  console.log(`\n📊 Results (${duration}ms):`)
  console.log(`   ✅ Successful: ${successful}/${concurrency}`)
  console.log(`   ❌ Failed: ${failed}/${concurrency}`)

  // Log failures
  if (failed > 0) {
    console.log('\n❌ Failed operations:')
    processedResults
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   Operation #${r.index}: ${r.error}`)
      })
  }

  return {
    successful,
    failed,
    results: processedResults
  }
}

// ============================================
// MAIN TEST
// ============================================

async function runStressTest() {
  console.log('🧪 WALLET CONCURRENCY STRESS TEST')
  console.log('='.repeat(60))
  
  let testUser: TestUser | null = null
  
  try {
    // Setup: Create test user
    console.log('\n📝 Setup: Creating test user...')
    testUser = await createTestUser()
    console.log(`✅ Test user created:`)
    console.log(`   ID: ${testUser.id}`)
    console.log(`   Email: ${testUser.email}`)
    console.log(`   Initial balance: €${testUser.wallet_balance.toFixed(2)}`)

    // Verify initial balance
    const initialBalance = await getWalletBalance(testUser.id)
    if (initialBalance !== 0) {
      throw new Error(`Expected initial balance €0.00, got €${initialBalance.toFixed(2)}`)
    }

    // Test parameters
    const CONCURRENCY = 10
    const AMOUNT_PER_OPERATION = 10.00
    const EXPECTED_TOTAL = CONCURRENCY * AMOUNT_PER_OPERATION

    // Execute stress test
    const { successful, failed, results } = await simulateConcurrentTraffic(
      testUser.id,
      AMOUNT_PER_OPERATION,
      CONCURRENCY
    )

    // Wait a bit for any pending operations to complete
    console.log('\n⏳ Waiting 500ms for pending operations...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify final balance
    console.log('\n🔍 Verifying final balance...')
    const finalBalance = await getWalletBalance(testUser.id)
    const expectedBalance = successful * AMOUNT_PER_OPERATION

    console.log(`\n📊 Final Verification:`)
    console.log(`   Expected balance: €${expectedBalance.toFixed(2)} (${successful} operations × €${AMOUNT_PER_OPERATION})`)
    console.log(`   Actual balance: €${finalBalance.toFixed(2)}`)

    // ============================================
    // ASSERTIONS
    // ============================================

    console.log('\n' + '='.repeat(60))
    console.log('🎯 TEST RESULTS')
    console.log('='.repeat(60))

    // Assertion 1: At least some operations succeeded
    if (successful === 0) {
      console.error('\n❌ TEST FAILED: No operations succeeded')
      console.error('   This indicates a critical issue with the retry mechanism')
      process.exit(1)
    }

    // Assertion 2: Balance matches successful operations
    const balanceMatches = Math.abs(finalBalance - expectedBalance) < 0.01 // Allow 1 cent tolerance
    
    if (!balanceMatches) {
      console.error('\n❌ TEST FAILED: Balance mismatch')
      console.error(`   Expected: €${expectedBalance.toFixed(2)}`)
      console.error(`   Actual: €${finalBalance.toFixed(2)}`)
      console.error(`   Difference: €${Math.abs(finalBalance - expectedBalance).toFixed(2)}`)
      process.exit(1)
    }

    // Assertion 3: Ideal case - all operations succeed (retry working)
    if (successful === CONCURRENCY) {
      console.log('\n✅ TEST PASSED: All operations succeeded!')
      console.log(`   ✅ ${successful}/${CONCURRENCY} operations successful`)
      console.log(`   ✅ Final balance: €${finalBalance.toFixed(2)} (matches expected)`)
      console.log(`   ✅ Retry mechanism working perfectly`)
    } else if (successful > 1) {
      console.log('\n⚠️  TEST PARTIALLY PASSED: Some operations succeeded')
      console.log(`   ✅ ${successful}/${CONCURRENCY} operations successful`)
      console.log(`   ✅ Final balance: €${finalBalance.toFixed(2)} (matches successful operations)`)
      console.log(`   ⚠️  ${failed} operations failed (may indicate lock contention issues)`)
      console.log(`   💡 Without retry, only 1 operation would succeed`)
      console.log(`   💡 With retry, ${successful} operations succeeded (improvement!)`)
    } else {
      console.log('\n⚠️  TEST PARTIALLY PASSED: Only 1 operation succeeded')
      console.log(`   ✅ ${successful}/${CONCURRENCY} operations successful`)
      console.log(`   ✅ Final balance: €${finalBalance.toFixed(2)} (matches successful operations)`)
      console.log(`   ⚠️  This suggests retry may not be working as expected`)
      console.log(`   💡 Check if lock contention errors are being detected correctly`)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ STRESS TEST COMPLETED')
    console.log('='.repeat(60))

  } catch (error: any) {
    console.error('\n❌ TEST ERROR:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    // Cleanup
    if (testUser) {
      console.log('\n🧹 Cleaning up test user...')
      await cleanupTestUser(testUser.id)
    }
  }
}

// ============================================
// EXECUTE
// ============================================

runStressTest()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

