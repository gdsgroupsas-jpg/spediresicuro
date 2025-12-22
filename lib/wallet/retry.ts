/**
 * Smart Retry Wrapper per Operazioni Wallet
 * 
 * Gestisce automaticamente i retry SOLO per errori di lock contention (55P03).
 * Fail-fast su TUTTI gli altri errori (insufficient balance, validation, etc.).
 * 
 * MIGRATION: 040_wallet_atomic_operations.sql
 * SECURITY: P0 - Resilienza finanziaria
 */

/**
 * Verifica se un errore è causato da lock contention
 * 
 * DETECTION LOGIC:
 * - true se code === '55P03' (PostgreSQL lock_not_available)
 * - true se code === 'P0001' AND message contiene "Wallet locked by concurrent operation" OR "Retry recommended"
 * - true se message contiene 'lock_not_available'
 */
function isLockContentionError(error: any): boolean {
  const errorCode = error?.code
  const errorMessage = error?.message || ''
  
  // 1. Codice PostgreSQL standard per lock_not_available
  if (errorCode === '55P03') {
    return true
  }
  
  // 2. Codice P0001 (RAISE EXCEPTION) con messaggio specifico di lock contention
  if (errorCode === 'P0001') {
    if (
      errorMessage.includes('Wallet locked by concurrent operation') ||
      errorMessage.includes('Retry recommended')
    ) {
      return true
    }
  }
  
  // 3. Messaggio contiene 'lock_not_available' (fallback per compatibilità)
  if (errorMessage.includes('lock_not_available')) {
    return true
  }
  
  return false
}

/**
 * Wrapper per retry automatico su lock contention
 * 
 * @param operation - Funzione async che esegue l'operazione wallet (deve ritornare { data?, error? })
 * @param options - Opzioni di configurazione
 * @returns Risultato dell'operazione (stesso formato di Supabase RPC)
 * 
 * @example
 * ```typescript
 * const result = await withConcurrencyRetry(
 *   async () => await supabaseAdmin.rpc('decrement_wallet_balance', { p_user_id, p_amount }),
 *   { operationName: 'shipment_debit' }
 * )
 * 
 * if (result.error) {
 *   throw new Error(result.error.message)
 * }
 * ```
 */
export async function withConcurrencyRetry<T = any>(
  operation: () => Promise<{ data?: T; error?: any }>,
  options: {
    maxRetries?: number
    operationName?: string
  } = {}
): Promise<{ data?: T; error?: any }> {
  const { maxRetries = 3, operationName = 'wallet_operation' } = options
  
  // Backoff incrementale: 50ms, 150ms, 300ms
  const backoffDelays = [50, 150, 300]
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation()
      
      // Se successo (no error), ritorna immediatamente
      if (!result.error) {
        if (attempt > 0) {
          console.info(`✅ [WALLET_RETRY] ${operationName} succeeded on retry ${attempt}/${maxRetries}`)
        }
        return result
      }
      
      // Verifica se è errore di lock contention
      const isLockError = isLockContentionError(result.error)
      const isLastAttempt = attempt === maxRetries
      
      // Fail-fast su errori NON-lock o ultimo tentativo
      if (!isLockError) {
        // Errore NON di lock: fail-fast immediato
        return result
      }
      
      if (isLastAttempt) {
        // Ultimo tentativo fallito: ritorna errore
        console.error(`❌ [WALLET_RETRY] ${operationName} failed after ${maxRetries} retries (lock contention)`, {
          error: result.error.message,
          code: result.error.code
        })
        return result
      }
      
      // Lock contention: retry con backoff
      const delay = backoffDelays[attempt] || 300
      console.warn(`⚠️ [WALLET_RETRY] ${operationName} lock contention, retry ${attempt + 1}/${maxRetries} in ${delay}ms`, {
        error: result.error.message,
        code: result.error.code
      })
      
      // Attendi prima del prossimo tentativo
      await new Promise(resolve => setTimeout(resolve, delay))
      
    } catch (error: any) {
      // Eccezione non gestita: verifica se è lock error
      const isLockError = isLockContentionError(error)
      const isLastAttempt = attempt === maxRetries
      
      if (!isLockError || isLastAttempt) {
        // Non è lock error o ultimo tentativo: rilancia
        throw error
      }
      
      // Lock contention: retry con backoff
      const delay = backoffDelays[attempt] || 300
      console.warn(`⚠️ [WALLET_RETRY] ${operationName} lock contention (exception), retry ${attempt + 1}/${maxRetries} in ${delay}ms`, {
        error: error.message,
        code: error.code
      })
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // Unreachable (TypeScript safety)
  throw new Error(`Unreachable: ${operationName} retry loop`)
}

