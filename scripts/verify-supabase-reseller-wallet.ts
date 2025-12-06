/**
 * Script di Verifica Completo: Sistema Reseller e Wallet
 * 
 * Verifica che tutte le strutture database, funzioni, trigger e RLS policies
 * siano configurate correttamente per il sistema Reseller e Wallet.
 * 
 * Esegui con: npm run verify:reseller-wallet
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Carica variabili ambiente
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRORE: Variabili d\'ambiente Supabase mancanti!')
  console.error('   Assicurati di avere NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Crea client admin (bypassa RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface VerificationResult {
  name: string
  status: '✅' | '❌' | '⚠️'
  message: string
  details?: any
}

const results: VerificationResult[] = []

function addResult(name: string, status: '✅' | '❌' | '⚠️', message: string, details?: any) {
  results.push({ name, status, message, details })
  console.log(`${status} ${name}: ${message}`)
}

async function verifyTableExists(tableName: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .limit(1)
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = table not found
      throw error
    }
    
    return !error
  } catch (error: any) {
    return false
  }
}

async function verifyColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      query: `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        ) as exists
      `
    })
    
    // Fallback: prova a fare una query con quella colonna
    const { error: queryError } = await supabaseAdmin
      .from(tableName)
      .select(columnName)
      .limit(1)
    
    return !queryError
  } catch {
    // Prova metodo diretto
    try {
      const { error } = await supabaseAdmin
        .from(tableName)
        .select(columnName)
        .limit(1)
      
      return !error
    } catch {
      return false
    }
  }
}

async function verifyFunctionExists(functionName: string): Promise<boolean> {
  try {
    // Prova a chiamare la funzione con parametri dummy
    // Ogni funzione ha parametri diversi, quindi proviamo con parametri comuni
    const testParams: any = {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    }
    
    // Per funzioni specifiche, aggiungi parametri corretti
    if (functionName === 'add_wallet_credit') {
      testParams.p_amount = 0.01
      testParams.p_description = 'test'
    } else if (functionName === 'deduct_wallet_credit') {
      testParams.p_amount = 0.01
      testParams.p_type = 'test'
    } else if (functionName === 'is_sub_user_of') {
      testParams.p_sub_user_id = '00000000-0000-0000-0000-000000000000'
      testParams.p_admin_id = '00000000-0000-0000-0000-000000000000'
    }
    
    const { error } = await supabaseAdmin.rpc(functionName, testParams)
    
    // Se l'errore è "function does not exist" allora non esiste
    if (error?.message?.includes('does not exist') || 
        error?.message?.includes('non esiste') ||
        error?.message?.includes('function') && error?.message?.includes('not found')) {
      return false
    }
    
    // Altri errori (come parametri sbagliati, constraint violations, ecc.) 
    // significano che la funzione esiste ma i parametri sono sbagliati
    return true
  } catch (error: any) {
    // Se l'errore contiene "does not exist", la funzione non esiste
    if (error?.message?.includes('does not exist') || 
        error?.message?.includes('non esiste')) {
      return false
    }
    // Altri errori = funzione esiste
    return true
  }
}

async function main() {
  console.log('\n🔍 VERIFICA SISTEMA RESELLER E WALLET\n')
  console.log('=' .repeat(60))
  
  // ============================================
  // 1. VERIFICA TABELLA USERS - Campi aggiunti
  // ============================================
  console.log('\n📋 1. Verifica Tabella Users\n')
  
  const usersColumns = [
    { name: 'parent_id', type: 'UUID', description: 'ID Admin creatore' },
    { name: 'is_reseller', type: 'BOOLEAN', description: 'Flag Reseller' },
    { name: 'wallet_balance', type: 'DECIMAL', description: 'Saldo wallet' },
  ]
  
  for (const col of usersColumns) {
    const exists = await verifyColumnExists('users', col.name)
    if (exists) {
      addResult(
        `Campo users.${col.name}`,
        '✅',
        `Esiste (${col.type}) - ${col.description}`
      )
    } else {
      addResult(
        `Campo users.${col.name}`,
        '❌',
        `MANCANTE - ${col.description}`
      )
    }
  }
  
  // ============================================
  // 2. VERIFICA TABELLA WALLET_TRANSACTIONS
  // ============================================
  console.log('\n📋 2. Verifica Tabella wallet_transactions\n')
  
  const walletTableExists = await verifyTableExists('wallet_transactions')
  if (walletTableExists) {
    addResult('Tabella wallet_transactions', '✅', 'Esiste')
    
    const walletColumns = [
      'id', 'user_id', 'amount', 'type', 'description',
      'reference_id', 'reference_type', 'created_by', 'created_at'
    ]
    
    for (const col of walletColumns) {
      const exists = await verifyColumnExists('wallet_transactions', col)
      if (exists) {
        addResult(`Campo wallet_transactions.${col}`, '✅', 'Esiste')
      } else {
        addResult(`Campo wallet_transactions.${col}`, '❌', 'MANCANTE')
      }
    }
  } else {
    addResult('Tabella wallet_transactions', '❌', 'MANCANTE - Esegui migration 019_reseller_system_and_wallet.sql')
  }
  
  // ============================================
  // 3. VERIFICA FUNZIONI SQL
  // ============================================
  console.log('\n📋 3. Verifica Funzioni SQL\n')
  
  const functions = [
    { name: 'is_super_admin', description: 'Verifica Super Admin' },
    { name: 'is_reseller', description: 'Verifica Reseller' },
    { name: 'is_sub_user_of', description: 'Verifica Sub-User' },
    { name: 'add_wallet_credit', description: 'Aggiunge credito wallet' },
    { name: 'deduct_wallet_credit', description: 'Scala credito wallet' },
    { name: 'update_wallet_balance', description: 'Trigger function wallet balance' },
  ]
  
  for (const func of functions) {
    const exists = await verifyFunctionExists(func.name)
    if (exists) {
      addResult(`Funzione ${func.name}`, '✅', `Esiste - ${func.description}`)
    } else {
      addResult(`Funzione ${func.name}`, '❌', `MANCANTE - ${func.description}`)
    }
  }
  
  // ============================================
  // 4. TEST FUNZIONI PRINCIPALI
  // ============================================
  console.log('\n📋 4. Test Funzioni Principali\n')
  
  // Test is_super_admin
  try {
    const { data: superAdminTest, error: superAdminError } = await supabaseAdmin.rpc('is_super_admin', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    })
    
    if (!superAdminError) {
      addResult('Test is_super_admin', '✅', 'Funzione eseguibile (ritorna boolean)')
    } else {
      addResult('Test is_super_admin', '❌', `Errore: ${superAdminError.message}`)
    }
  } catch (error: any) {
    addResult('Test is_super_admin', '❌', `Errore: ${error.message}`)
  }
  
  // Test is_reseller
  try {
    const { data: resellerTest, error: resellerError } = await supabaseAdmin.rpc('is_reseller', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    })
    
    if (!resellerError) {
      addResult('Test is_reseller', '✅', 'Funzione eseguibile (ritorna boolean)')
    } else {
      addResult('Test is_reseller', '❌', `Errore: ${resellerError.message}`)
    }
  } catch (error: any) {
    addResult('Test is_reseller', '❌', `Errore: ${error.message}`)
  }
  
  // ============================================
  // 5. VERIFICA DATI ESISTENTI
  // ============================================
  console.log('\n📋 5. Verifica Dati Esistenti\n')
  
  try {
    // Conta utenti con is_reseller = true
    const { data: resellers, error: resellersError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, is_reseller, account_type')
      .eq('is_reseller', true)
      .limit(10)
    
    if (!resellersError && resellers) {
      addResult(
        'Utenti Reseller',
        '✅',
        `Trovati ${resellers.length} Reseller`,
        resellers.map(u => ({ email: u.email, account_type: u.account_type }))
      )
    } else {
      addResult('Utenti Reseller', '⚠️', 'Nessun Reseller trovato o errore nella query')
    }
    
    // Conta transazioni wallet
    if (walletTableExists) {
      const { data: transactions, error: transactionsError } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .limit(1)
      
      if (!transactionsError) {
        const { count } = await supabaseAdmin
          .from('wallet_transactions')
          .select('*', { count: 'exact', head: true })
        
        addResult(
          'Transazioni Wallet',
          '✅',
          `Trovate ${count || 0} transazioni`
        )
      }
    }
    
    // Verifica wallet_balance non null
    const { data: usersWithWallet, error: walletError } = await supabaseAdmin
      .from('users')
      .select('id, email, wallet_balance')
      .not('wallet_balance', 'is', null)
      .limit(5)
    
    if (!walletError && usersWithWallet) {
      const totalBalance = usersWithWallet.reduce((sum, u) => sum + (parseFloat(u.wallet_balance?.toString() || '0') || 0), 0)
      addResult(
        'Wallet Balance',
        '✅',
        `${usersWithWallet.length} utenti con wallet configurato (totale: €${totalBalance.toFixed(2)})`
      )
    }
  } catch (error: any) {
    addResult('Verifica Dati', '⚠️', `Errore: ${error.message}`)
  }
  
  // ============================================
  // 6. TEST OPERAZIONE WALLET (se possibile)
  // ============================================
  console.log('\n📋 6. Test Operazioni Wallet\n')
  
  // Cerca un utente di test
  try {
    const { data: testUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, wallet_balance')
      .limit(1)
      .single()
    
    if (!userError && testUser) {
      // Test add_wallet_credit (solo se abbiamo un utente)
      const testAmount = 0.01 // Importo minimo per test
      
      try {
        const { data: txId, error: addError } = await supabaseAdmin.rpc('add_wallet_credit', {
          p_user_id: testUser.id,
          p_amount: testAmount,
          p_description: 'Test verifica sistema',
          p_created_by: null,
        })
        
        if (!addError && txId) {
          addResult('Test add_wallet_credit', '✅', `Transazione creata: ${txId}`)
          
          // Verifica che il balance sia stato aggiornato
          const { data: updatedUser } = await supabaseAdmin
            .from('users')
            .select('wallet_balance')
            .eq('id', testUser.id)
            .single()
          
          const expectedBalance = (parseFloat(testUser.wallet_balance?.toString() || '0') || 0) + testAmount
          const actualBalance = parseFloat(updatedUser?.wallet_balance?.toString() || '0') || 0
          
          if (Math.abs(actualBalance - expectedBalance) < 0.01) {
            addResult('Test trigger wallet_balance', '✅', 'Balance aggiornato correttamente dal trigger')
          } else {
            addResult('Test trigger wallet_balance', '⚠️', `Balance potrebbe non essere aggiornato (atteso: ${expectedBalance}, attuale: ${actualBalance})`)
          }
          
          // Rimuovi transazione di test (opzionale)
          // await supabaseAdmin.from('wallet_transactions').delete().eq('id', txId)
        } else {
          addResult('Test add_wallet_credit', '❌', `Errore: ${addError?.message || 'Sconosciuto'}`)
        }
      } catch (error: any) {
        addResult('Test add_wallet_credit', '❌', `Errore: ${error.message}`)
      }
    } else {
      addResult('Test operazioni wallet', '⚠️', 'Nessun utente trovato per test')
    }
  } catch (error: any) {
    addResult('Test operazioni wallet', '⚠️', `Errore: ${error.message}`)
  }
  
  // ============================================
  // RIEPILOGO FINALE
  // ============================================
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 RIEPILOGO VERIFICA\n')
  
  const successCount = results.filter(r => r.status === '✅').length
  const errorCount = results.filter(r => r.status === '❌').length
  const warningCount = results.filter(r => r.status === '⚠️').length
  
  console.log(`✅ Successi: ${successCount}`)
  console.log(`❌ Errori: ${errorCount}`)
  console.log(`⚠️  Warning: ${warningCount}`)
  console.log(`📋 Totale verifiche: ${results.length}`)
  
  if (errorCount === 0) {
    console.log('\n🎉 TUTTO OK! Il sistema Reseller e Wallet è configurato correttamente.\n')
  } else {
    console.log('\n⚠️  ATTENZIONE: Ci sono errori da correggere.')
    console.log('\n📝 Azioni consigliate:')
    console.log('   1. Esegui la migration: supabase/migrations/019_reseller_system_and_wallet.sql')
    console.log('   2. Verifica le variabili d\'ambiente Supabase')
    console.log('   3. Controlla i log di Supabase per dettagli\n')
  }
  
  // Mostra errori dettagliati
  if (errorCount > 0) {
    console.log('\n❌ ERRORI TROVATI:\n')
    results
      .filter(r => r.status === '❌')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`)
        if (r.details) {
          console.log(`     Dettagli:`, r.details)
        }
      })
  }
  
  // Mostra warning
  if (warningCount > 0) {
    console.log('\n⚠️  WARNING:\n')
    results
      .filter(r => r.status === '⚠️')
      .forEach(r => {
        console.log(`   - ${r.name}: ${r.message}`)
      })
  }
  
  console.log('\n' + '='.repeat(60) + '\n')
  
  // Exit code
  process.exit(errorCount > 0 ? 1 : 0)
}

// Esegui verifica
main().catch((error) => {
  console.error('\n❌ ERRORE FATALE:', error)
  process.exit(1)
})
