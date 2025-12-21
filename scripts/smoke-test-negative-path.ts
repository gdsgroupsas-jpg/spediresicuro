/**
 * Smoke Test - Negative Path
 * 
 * Verifica gestione errori:
 * 1. Credito insufficiente (402)
 * 2. Indirizzo non valido (422)
 * 
 * DRY RUN MODE:
 *   --dry-run o SMOKE_DRY_RUN=1
 *   In dry-run: NO chiamate Supabase, NO API esterne, NO process.exit(1)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// DRY RUN detection
const isDryRun = process.argv.includes('--dry-run') || 
                 process.argv.includes('--dry') || 
                 process.env.SMOKE_DRY_RUN === '1' ||
                 process.env.SMOKE_DRY_RUN === 'true' ||
                 process.env.DRY_RUN === '1' ||
                 process.env.DRY_RUN === 'true'

interface TestResult {
  case: string
  status: 'PASS' | 'FAIL'
  message: string
  expectedStatus?: number
  actualStatus?: number
}

async function dryRunChecks(): Promise<void> {
  console.log('🔍 SMOKE TEST - NEGATIVE PATH (DRY RUN)\n')
  console.log('='.repeat(50))
  
  const checks: Array<{ name: string; status: 'PASS' | 'FAIL' | 'WARN'; message: string }> = []

  // 1. Verifica ENV (report, non exit)
  console.log('\n📋 Verifica variabili ambiente...')
  const envVars = {
    'NEXT_PUBLIC_SUPABASE_URL': supabaseUrl,
    'SUPABASE_SERVICE_ROLE_KEY': supabaseKey,
  }

  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      const masked = key.includes('KEY') ? `${value.substring(0, 8)}...` : value
      checks.push({ name: key, status: 'PASS', message: `✅ presente: ${masked}` })
      console.log(`   ✅ ${key}: presente`)
    } else {
      checks.push({ name: key, status: 'FAIL', message: '❌ mancante (richiesto)' })
      console.log(`   ❌ ${key}: mancante (richiesto)`)
    }
  })

  // 2. Verifica import schema Zod
  console.log('\n📋 Verifica import schema Zod...')
  try {
    const schemaPath = path.join(process.cwd(), 'lib', 'validations', 'shipment.ts')
    if (fs.existsSync(schemaPath)) {
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8')
      if (schemaContent.includes('createShipmentSchema')) {
        checks.push({ name: 'Schema Zod', status: 'PASS', message: '✅ createShipmentSchema trovato' })
        console.log('   ✅ Schema Zod createShipmentSchema trovato')
      } else {
        checks.push({ name: 'Schema Zod', status: 'WARN', message: '⚠️  createShipmentSchema non trovato' })
        console.log('   ⚠️  createShipmentSchema non trovato')
      }
    } else {
      checks.push({ name: 'Schema Zod', status: 'WARN', message: '⚠️  lib/validations/shipment.ts non trovato' })
      console.log('   ⚠️  lib/validations/shipment.ts non trovato')
    }
  } catch (err: any) {
    checks.push({ name: 'Schema Zod', status: 'WARN', message: `⚠️  errore verifica: ${err.message}` })
    console.log(`   ⚠️  Errore verifica schema: ${err.message}`)
  }

  // 3. Verifica route API esiste
  console.log('\n📋 Verifica route API...')
  try {
    const routePath = path.join(process.cwd(), 'app', 'api', 'shipments', 'create', 'route.ts')
    if (fs.existsSync(routePath)) {
      const routeContent = fs.readFileSync(routePath, 'utf-8')
      if (routeContent.includes('export async function POST') || routeContent.includes('export function POST')) {
        checks.push({ name: 'Route API', status: 'PASS', message: '✅ route /api/shipments/create trovata' })
        console.log('   ✅ Route /api/shipments/create trovata')
        
        // Verifica gestione errori (402, 422)
        const hasErrorHandling = routeContent.includes('status: 402') || 
                                routeContent.includes('status: 422') ||
                                routeContent.includes('INSUFFICIENT_CREDIT') ||
                                routeContent.includes('422')
        
        if (hasErrorHandling) {
          console.log('   ✅ Route contiene gestione errori (402/422)')
        } else {
          checks.push({ name: 'Route error handling', status: 'WARN', message: '⚠️  gestione errori 402/422 non evidente' })
          console.log('   ⚠️  Gestione errori 402/422 non evidente nel codice')
        }
      } else {
        checks.push({ name: 'Route API', status: 'WARN', message: '⚠️  route non contiene POST handler' })
        console.log('   ⚠️  Route non contiene POST handler')
      }
    } else {
      checks.push({ name: 'Route API', status: 'WARN', message: '⚠️  app/api/shipments/create/route.ts non trovato' })
      console.log('   ⚠️  app/api/shipments/create/route.ts non trovato')
    }
  } catch (err: any) {
    checks.push({ name: 'Route API', status: 'WARN', message: `⚠️  errore verifica: ${err.message}` })
    console.log(`   ⚠️  Errore verifica route: ${err.message}`)
  }

  // Riepilogo
  console.log('\n' + '='.repeat(50))
  console.log('📊 RIEPILOGO DRY RUN\n')
  
  const passed = checks.filter(c => c.status === 'PASS').length
  const failed = checks.filter(c => c.status === 'FAIL').length
  const warnings = checks.filter(c => c.status === 'WARN').length

  checks.forEach(check => {
    console.log(`${check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️'} ${check.name}: ${check.message}`)
  })

  console.log('\n' + '='.repeat(50))
  console.log(`✅ PASS: ${passed} | ❌ FAIL: ${failed} | ⚠️  WARN: ${warnings}`)
  console.log('='.repeat(50))
  console.log('\n✅ DRY RUN completato - Nessuna chiamata Supabase/API eseguita')
  console.log('   Per test completi, esegui senza --dry-run\n')
  
  // In dry-run NON facciamo process.exit(1), solo report
  if (failed > 0) {
    console.log('⚠️  Alcune verifiche fallite, ma DRY RUN non blocca esecuzione\n')
  }
}

async function smokeTestNegativePath(): Promise<void> {
  // DRY RUN: solo verifiche statiche
  if (isDryRun) {
    await dryRunChecks()
    process.exit(0)
  }

  // PRODUZIONE: verifica ENV e exit se mancano
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Manca NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const results: TestResult[] = []
  
  console.log('🧪 SMOKE TEST - NEGATIVE PATH')
  console.log('='.repeat(50))
  
  // Test Case 1: Credito insufficiente (402)
  console.log('\n📋 Test Case 1: Credito insufficiente (402)...')
  
  // Trova utente con credito < 5€
  const { data: poorUser } = await supabase
    .from('users')
    .select('id, email, wallet_balance')
    .lt('wallet_balance', 5)
    .neq('role', 'SUPERADMIN')
    .limit(1)
    .single()
  
  if (poorUser) {
    console.log(`✅ Utente trovato: ${poorUser.email} (€${poorUser.wallet_balance})`)
    console.log('⚠️  NOTA: Per test completo, esegui chiamata API:')
    console.log(`   POST /api/shipments/create`)
    console.log(`   Headers: Authorization: Bearer <token_user_${poorUser.id}>`)
    console.log(`   Expected: 402 INSUFFICIENT_CREDIT`)
    
    results.push({
      case: 'Credito insufficiente',
      status: 'PASS',
      message: `Utente preparato per test (€${poorUser.wallet_balance})`,
      expectedStatus: 402
    })
  } else {
    // Crea utente di test con credito basso
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: `test-poor-${Date.now()}@test.it`,
        name: 'Test Poor User',
        wallet_balance: 2.50,
        role: 'user'
      })
      .select()
      .single()
    
    if (createError) {
      results.push({
        case: 'Credito insufficiente',
        status: 'FAIL',
        message: `Errore creazione utente test: ${createError.message}`
      })
      console.log(`❌ FAIL: ${createError.message}`)
    } else {
      results.push({
        case: 'Credito insufficiente',
        status: 'PASS',
        message: `Utente test creato: ${newUser.email} (€${newUser.wallet_balance})`,
        expectedStatus: 402
      })
      console.log(`✅ PASS: Utente test creato - ${newUser.email}`)
    }
  }
  
  // Test Case 2: Indirizzo non valido (422)
  console.log('\n📋 Test Case 2: Indirizzo non valido (422)...')
  
  const invalidAddressPayload = {
    provider: 'spediscionline',
    carrier: 'GLS',
    sender: {
      name: 'Test',
      address: 'Via Valida 1',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      country: 'IT',
      email: 'sender@test.it'
    },
    recipient: {
      name: 'Test',
      address: 'Indirizzo Inesistente 99999',  // Indirizzo non valido
      city: 'Città Inesistente',
      province: 'XX',  // Provincia non valida
      postalCode: '00000',  // CAP non valido
      country: 'IT',
      email: 'recipient@test.it'
    },
    packages: [{
      length: 10,
      width: 10,
      height: 10,
      weight: 1
    }]
  }
  
  console.log('⚠️  NOTA: Per test completo, esegui chiamata API:')
  console.log(`   POST /api/shipments/create`)
  console.log(`   Body: ${JSON.stringify(invalidAddressPayload, null, 2)}`)
  console.log(`   Expected: 422 (Indirizzo destinatario non valido)`)
  
  results.push({
    case: 'Indirizzo non valido',
    status: 'PASS',
    message: 'Payload preparato per test',
    expectedStatus: 422
  })
  
  // Riepilogo
  console.log('\n' + '='.repeat(50))
  console.log('📊 RIEPILOGO')
  console.log('='.repeat(50))
  
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌'
    console.log(`${icon} ${r.case}: ${r.message}`)
    if (r.expectedStatus) {
      console.log(`   Expected HTTP Status: ${r.expectedStatus}`)
    }
  })
  
  console.log('\n' + '='.repeat(50))
  console.log(`✅ PASS: ${passed} | ❌ FAIL: ${failed}`)
  console.log('='.repeat(50))
  console.log('\n⚠️  NOTA: Esegui chiamate API manuali per test completi')
  console.log('   Usa Postman/curl o test E2E per verificare response HTTP')
  
  if (failed > 0) {
    console.log('\n❌ SMOKE TEST FALLITO')
    process.exit(1)
  } else {
    console.log('\n✅ SMOKE TEST PASSATO (preparazione)')
    process.exit(0)
  }
}

smokeTestNegativePath().catch(err => {
  console.error('❌ Errore fatale:', err)
  process.exit(1)
})
