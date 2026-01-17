/**
 * Sistema di Criptazione Credenziali API
 * 
 * Cripta/decripta credenziali sensibili usando AES-256-GCM
 * Le chiavi di criptazione sono gestite tramite variabili d'ambiente
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes per IV
const SALT_LENGTH = 64 // 64 bytes per salt
const TAG_LENGTH = 16 // 16 bytes per auth tag
const KEY_LENGTH = 32 // 32 bytes per AES-256

/**
 * Ottiene la chiave di criptazione dall'ambiente
 * Se non presente, genera una chiave (solo per sviluppo)
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY
  
  if (!envKey) {
    // ⚠️ SOLO PER SVILUPPO - In produzione DEVE essere configurata
    // Non lanciamo errore qui, gestiamo nella funzione chiamante
    console.warn('⚠️ ENCRYPTION_KEY non configurata, usando chiave di default (SOLO SVILUPPO)')
    // Chiave di default per sviluppo (NON usare in produzione!)
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH)
  }
  
  // La chiave può essere una stringa esadecimale o base64
  if (envKey.length === 64) {
    // Esadecimale (32 bytes * 2)
    return Buffer.from(envKey, 'hex')
  } else {
    // Base64 o stringa diretta - deriviamo con scrypt
    return crypto.scryptSync(envKey, 'spediresicuro-salt', KEY_LENGTH)
  }
}

/**
 * Ottiene la chiave legacy di criptazione (per key rotation)
 * Supporta ENCRYPTION_KEY_LEGACY per decrypt con chiave vecchia
 */
function getLegacyEncryptionKey(): Buffer | null {
  const envKey = process.env.ENCRYPTION_KEY_LEGACY
  
  if (!envKey) {
    return null
  }
  
  // La chiave può essere una stringa esadecimale o base64
  if (envKey.length === 64) {
    // Esadecimale (32 bytes * 2)
    return Buffer.from(envKey, 'hex')
  } else {
    // Base64 o stringa diretta - deriviamo con scrypt
    return crypto.scryptSync(envKey, 'spediresicuro-salt', KEY_LENGTH)
  }
}

/**
 * Cripta un valore sensibile
 *
 * ⚠️ SECURITY (P0 Audit Fix):
 * - In PRODUZIONE senza ENCRYPTION_KEY: BLOCCA scrittura (fail-closed)
 * - In DEVELOPMENT senza ENCRYPTION_KEY: Permette plaintext (per testing locale)
 *
 * @param plaintext - Testo da criptare
 * @returns Stringa criptata in formato: iv:salt:tag:encrypted (tutti in base64)
 * @throws Error in produzione se ENCRYPTION_KEY non configurata
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) {
    return ''
  }

  // ⚠️ P0 AUDIT FIX: Fail-closed in produzione
  // Non permettere MAI salvataggio credenziali in chiaro in produzione
  if (!process.env.ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === 'production') {
      // 🔒 FAIL-CLOSED: Blocca operazione invece di salvare in chiaro
      console.error('❌ [SECURITY P0] ENCRYPTION_KEY non configurata in produzione. Operazione bloccata.')
      throw new Error('ENCRYPTION_KEY_MISSING: Impossibile salvare credenziali in modo sicuro. Configura ENCRYPTION_KEY su Vercel.')
    } else {
      // Development: permetti plaintext per testing locale (con warning)
      console.warn('⚠️ [DEV] ENCRYPTION_KEY non configurata. Credenziali salvate in chiaro (solo sviluppo).')
      return plaintext
    }
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const salt = crypto.randomBytes(SALT_LENGTH)
    
    // Deriva chiave finale da salt
    const derivedKey = crypto.scryptSync(key, salt, KEY_LENGTH)
    
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    const tag = cipher.getAuthTag()
    
    // Formato: iv:salt:tag:encrypted (tutti in base64)
    const result = [
      iv.toString('base64'),
      salt.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64')
    ].join(':')
    
    return result
  } catch (error) {
    console.error('❌ [SECURITY P0] Errore criptazione credenziale:', error)
    // ⚠️ P0 AUDIT FIX: Fail-closed anche in caso di errore
    // Non salvare MAI in chiaro, meglio fallire che esporre credenziali
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_FAILED: Errore durante la criptazione. Credenziali non salvate per sicurezza.')
    }
    // Development: permetti fallback per debug
    console.warn('⚠️ [DEV] Fallback: credenziale salvata in chiaro (solo sviluppo)')
    return plaintext
  }
}

/**
 * Decripta un valore criptato usando una chiave specifica
 * Funzione interna per supportare dual decrypt (key rotation)
 * 
 * @param encryptedData - Stringa criptata in formato: iv:salt:tag:encrypted
 * @param key - Chiave di criptazione da usare
 * @returns Testo decriptato
 */
function decryptWithKey(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':')
  
  if (parts.length !== 4) {
    throw new Error('Formato dati criptati non valido')
  }
  
  const [ivBase64, saltBase64, tagBase64, encryptedBase64] = parts
  
  const iv = Buffer.from(ivBase64, 'base64')
  const salt = Buffer.from(saltBase64, 'base64')
  const tag = Buffer.from(tagBase64, 'base64')
  const encrypted = Buffer.from(encryptedBase64, 'base64')
  
  // Deriva chiave finale da salt
  const derivedKey = crypto.scryptSync(key, salt, KEY_LENGTH)
  
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
  decipher.setAuthTag(tag)
  
  let decrypted = decipher.update(encrypted)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString('utf8')
}

/**
 * Decripta un valore criptato con supporto per key rotation (dual decrypt)
 * 
 * ⚠️ STRATEGIA KEY ROTATION:
 * 1. Prova prima con ENCRYPTION_KEY corrente
 * 2. Se fallisce, prova con ENCRYPTION_KEY_LEGACY (se configurata)
 * 3. Se entrambe falliscono, lancia errore chiaro
 * 
 * @param encryptedData - Stringa criptata in formato: iv:salt:tag:encrypted
 * @returns Testo decriptato
 */
export function decryptCredential(encryptedData: string): string {
  if (!encryptedData) {
    return ''
  }

  // Se non inizia con formato criptato, assume che sia testo in chiaro (retrocompatibilità)
  if (!encryptedData.includes(':')) {
    console.warn('⚠️ [ENCRYPTION] Credenziale non criptata rilevata (retrocompatibilità)')
    return encryptedData
  }

  // ⚠️ LOGGING SICURO: Non loggare mai la credential completa
  const dataHash = crypto.createHash('sha256').update(encryptedData).digest('hex').substring(0, 8)
  
  // Prova 1: Decrypt con chiave corrente
  try {
    const key = getEncryptionKey()
    const decrypted = decryptWithKey(encryptedData, key)
    
    // ✅ Decrypt riuscito con chiave corrente
    console.log(`✅ [ENCRYPTION] Decrypt riuscito (chiave corrente) - hash: ${dataHash}`)
    return decrypted
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown decryption error'
    const isDecryptionError = 
      errorMessage.includes('Unsupported state') ||
      errorMessage.includes('unable to authenticate') ||
      errorMessage.includes('bad decrypt') ||
      errorMessage.includes('Invalid authentication tag')
    
    if (!isDecryptionError) {
      // Errore non di decrypt (es. formato non valido) - lancia subito
      console.error(`❌ [ENCRYPTION] Errore decriptazione (non key rotation) - hash: ${dataHash}`, {
        error: errorMessage
      })
      throw new Error(`Errore durante la decriptazione della credenziale: ${errorMessage}`)
    }
    
    // ⚠️ Decrypt fallito con chiave corrente - prova con legacy
    console.warn(`⚠️ [ENCRYPTION] Decrypt fallito con chiave corrente - hash: ${dataHash}, tentativo con legacy...`)
    
    // Prova 2: Decrypt con chiave legacy (se configurata)
    const legacyKey = getLegacyEncryptionKey()
    if (legacyKey) {
      try {
        const decrypted = decryptWithKey(encryptedData, legacyKey)
        
        // ✅ Decrypt riuscito con chiave legacy
        console.log(`✅ [ENCRYPTION] Decrypt riuscito (chiave legacy) - hash: ${dataHash}`)
        console.warn(`⚠️ [ENCRYPTION] ATTENZIONE: Credenziale decriptata con ENCRYPTION_KEY_LEGACY. Considera re-criptare con chiave corrente.`)
        return decrypted
      } catch (legacyError: any) {
        // Anche legacy fallisce
        console.error(`❌ [ENCRYPTION] Decrypt fallito anche con chiave legacy - hash: ${dataHash}`, {
          currentKeyError: errorMessage,
          legacyKeyError: legacyError?.message || 'Unknown error'
        })
      }
    } else {
      console.warn(`⚠️ [ENCRYPTION] ENCRYPTION_KEY_LEGACY non configurata - hash: ${dataHash}`)
    }
    
    // ❌ Entrambe le chiavi falliscono
    console.error(`❌ [ENCRYPTION] CREDENTIAL_DECRYPT_FAILED - hash: ${dataHash}`, {
      error: errorMessage,
      hint: 'La chiave di criptazione potrebbe essere stata cambiata o la credenziale è corrotta. Ricontrolla ENCRYPTION_KEY su Vercel o re-inserisci le credenziali.'
    })
    
    throw new Error('CREDENTIAL_DECRYPT_FAILED: Impossibile decriptare credenziali. La chiave di criptazione potrebbe essere stata cambiata. Verifica ENCRYPTION_KEY su Vercel (Production/Preview devono essere identiche) o re-inserisci le credenziali dell\'integrazione.')
  }
}

/**
 * Verifica se una stringa è criptata
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false
  return value.includes(':') && value.split(':').length === 4
}

/**
 * Genera una chiave di criptazione casuale (per setup iniziale)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

