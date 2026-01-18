/**
 * Utility per identificare dati di test nel sistema
 * 
 * Identifica utenti e spedizioni create durante i test automatici
 * per permettere filtri e visualizzazioni separate nella dashboard admin
 */

/**
 * Pattern email comuni per utenti di test
 */
const TEST_EMAIL_PATTERNS = [
  /^test@/i,                           // test@example.com
  /test-.*@spediresicuro\.it$/i,       // test-{timestamp}@spediresicuro.it
  /@test\./i,                          // qualsiasi email con @test.
  /test.*@.*test/i,                    // email con "test" nel nome e dominio
  /^e2e-/i,                            // e2e-test@...
  /^smoke-test-/i,                     // smoke-test-...
  /^integration-test-/i,               // integration-test-...
]

/**
 * Pattern nomi comuni per utenti di test
 */
const TEST_NAME_PATTERNS = [
  /^test\s+/i,                         // Test User
  /test\s+user/i,                      // Test User
  /e2e\s+test/i,                       // E2E Test
  /smoke\s+test/i,                     // Smoke Test
  /integration\s+test/i,                // Integration Test
  /^test\s*$/i,                        // Solo "test"
]

/**
 * Verifica se un'email appartiene a un utente di test
 */
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false
  
  return TEST_EMAIL_PATTERNS.some(pattern => pattern.test(email))
}

/**
 * Verifica se un nome appartiene a un utente di test
 */
export function isTestName(name: string | null | undefined): boolean {
  if (!name) return false
  
  return TEST_NAME_PATTERNS.some(pattern => pattern.test(name))
}

/**
 * Verifica se un utente è un utente di test
 */
export function isTestUser(user: {
  email?: string | null
  name?: string | null
  [key: string]: any
}): boolean {
  return isTestEmail(user.email) || isTestName(user.name)
}

/**
 * Verifica se una spedizione è una spedizione di test
 * (creata da un utente di test o con status cancelled)
 */
export function isTestShipment(
  shipment: {
    user_id?: string | null
    created_by?: string | null
    status?: string | null
    tracking_number?: string | null
    [key: string]: any
  },
  userMap?: Map<string, { email?: string | null; name?: string | null }>
): boolean {
  if (shipment.tracking_number && /test/i.test(shipment.tracking_number)) {
    return true
  }

  // Se la spedizione è cancellata, probabilmente è di test
  if (shipment.status === 'cancelled') {
    return true
  }

  // Se abbiamo la mappa utenti, verifica se l'utente è di test
  if (userMap) {
    const userId = shipment.user_id || shipment.created_by
    if (userId) {
      const user = userMap.get(userId)
      if (user && isTestUser(user)) {
        return true
      }
    }
  }

  return false
}

/**
 * Filtra array di utenti escludendo quelli di test
 */
export function filterProductionUsers<T extends { email?: string | null; name?: string | null }>(
  users: T[]
): T[] {
  return users.filter(user => !isTestUser(user))
}

/**
 * Filtra array di spedizioni escludendo quelle di test
 */
export function filterProductionShipments<T extends {
  user_id?: string | null
  created_by?: string | null
  status?: string | null
  tracking_number?: string | null
  deleted?: boolean | null
  deleted_at?: string | null
}>(
  shipments: T[],
  userMap?: Map<string, { email?: string | null; name?: string | null }>
): T[] {
  return shipments.filter(shipment => {
    if (shipment.deleted === true) return false
    if (shipment.deleted_at) return false
    if (shipment.status === 'cancelled' || shipment.status === 'deleted') {
      return false
    }
    return !isTestShipment(shipment, userMap)
  })
}

/**
 * Crea una mappa utenti per lookup veloce
 */
export function createUserMap<T extends { id: string; email?: string | null; name?: string | null }>(
  users: T[]
): Map<string, { email?: string | null; name?: string | null }> {
  const map = new Map()
  users.forEach(user => {
    map.set(user.id, { email: user.email, name: user.name })
  })
  return map
}

/**
 * Conta utenti di test vs produzione
 */
export function countTestVsProduction<T extends { email?: string | null; name?: string | null }>(
  items: T[]
): { test: number; production: number; total: number } {
  let test = 0
  let production = 0

  items.forEach(item => {
    if (isTestUser(item)) {
      test++
    } else {
      production++
    }
  })

  return { test, production, total: items.length }
}
