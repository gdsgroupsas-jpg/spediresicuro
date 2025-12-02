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
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY non configurata in produzione!')
    }
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
 * Cripta un valore sensibile
 * 
 * @param plaintext - Testo da criptare
 * @returns Stringa criptata in formato: iv:salt:tag:encrypted (tutti in base64)
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) {
    return ''
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
    console.error('Errore criptazione credenziale:', error)
    throw new Error('Errore durante la criptazione della credenziale')
  }
}

/**
 * Decripta un valore criptato
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
    console.warn('⚠️ Credenziale non criptata rilevata (retrocompatibilità)')
    return encryptedData
  }

  try {
    const key = getEncryptionKey()
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
  } catch (error) {
    console.error('Errore decriptazione credenziale:', error)
    throw new Error('Errore durante la decriptazione della credenziale')
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

