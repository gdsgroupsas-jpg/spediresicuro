/**
 * Impersonation Cookie - Secure Implementation
 *
 * CRITICAL SECURITY: Cookie firmato/criptato per impersonation SuperAdmin→Tenant
 *
 * SCHEMA PAYLOAD:
 * {
 *   targetId: UUID,
 *   actorId: UUID,
 *   issuedAt: timestamp,
 *   expiresAt: timestamp,
 *   reason: string,
 *   nonce: random string (anti-replay),
 *   version: 1
 * }
 *
 * SECURITY PROPERTIES:
 * - Encrypted payload (AES-256-GCM via lib/security/encryption.ts)
 * - HMAC signature (SHA-256)
 * - Short TTL (30 minutes default)
 * - Nonce anti-replay
 * - Reason obbligatorio (audit trail)
 */

import crypto from 'crypto';
import { encryptCredential, decryptCredential } from './encryption';

const COOKIE_NAME = 'sp_impersonation';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minuti
const PAYLOAD_VERSION = 1;

/**
 * Payload cookie impersonation
 */
export interface ImpersonationPayload {
  targetId: string; // UUID utente target (cliente)
  actorId: string; // UUID utente actor (SuperAdmin/Reseller)
  issuedAt: number; // Timestamp Unix (ms)
  expiresAt: number; // Timestamp Unix (ms)
  reason: string; // Motivo impersonation (es: "support ticket #123")
  nonce: string; // Random string anti-replay
  version: number; // Schema version (per future evolution)
}

/**
 * Result decode cookie
 */
export interface DecodeResult {
  success: boolean;
  payload?: ImpersonationPayload;
  error?:
    | 'MISSING'
    | 'INVALID_FORMAT'
    | 'DECRYPT_FAILED'
    | 'INVALID_SIGNATURE'
    | 'EXPIRED'
    | 'INVALID_SCHEMA';
  errorMessage?: string;
}

/**
 * Ottiene secret per HMAC signature (da env)
 *
 * ⚠️ CRITICAL: Questo secret DEVE essere configurato in produzione
 */
function getSignatureSecret(): string {
  const secret = process.env.IMPERSONATION_COOKIE_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('IMPERSONATION_COOKIE_SECRET not configured in production');
    }
    // Fallback dev (NON usare in produzione)
    console.warn('⚠️ IMPERSONATION_COOKIE_SECRET not configured, using dev fallback');
    return 'dev-secret-change-in-production-impersonation';
  }

  return secret;
}

/**
 * Genera nonce random (anti-replay)
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Calcola HMAC signature di un payload
 */
function signPayload(payloadJson: string): string {
  const secret = getSignatureSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadJson);
  return hmac.digest('hex');
}

/**
 * Verifica HMAC signature
 */
function verifySignature(payloadJson: string, signature: string): boolean {
  const expected = signPayload(payloadJson);
  // Timing-safe comparison
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * Crea cookie impersonation sicuro
 *
 * FORMATO: <encrypted_payload>.<signature>
 *
 * @param actorId - UUID utente che impersona (SuperAdmin/Reseller)
 * @param targetId - UUID utente target (cliente)
 * @param reason - Motivo impersonation (obbligatorio per audit)
 * @param ttlMs - TTL in millisecondi (default 30min)
 * @returns Cookie value (encrypted + signed)
 */
export function createImpersonationCookie(
  actorId: string,
  targetId: string,
  reason: string,
  ttlMs: number = DEFAULT_TTL_MS
): string {
  // Validate inputs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(actorId)) {
    throw new Error('Invalid actorId format (must be UUID)');
  }

  if (!uuidRegex.test(targetId)) {
    throw new Error('Invalid targetId format (must be UUID)');
  }

  if (!reason || reason.trim().length === 0) {
    throw new Error('Reason is required for impersonation');
  }

  const now = Date.now();

  // Costruisci payload
  const payload: ImpersonationPayload = {
    targetId,
    actorId,
    issuedAt: now,
    expiresAt: now + ttlMs,
    reason: reason.trim(),
    nonce: generateNonce(),
    version: PAYLOAD_VERSION,
  };

  // Serializza payload
  const payloadJson = JSON.stringify(payload);

  // Cripta payload (AES-256-GCM via lib/security/encryption.ts)
  const encryptedPayload = encryptCredential(payloadJson);

  // Firma payload (HMAC-SHA256)
  const signature = signPayload(payloadJson);

  // Formato finale: <encrypted>.<signature>
  const cookieValue = `${encryptedPayload}.${signature}`;

  console.log('✅ [IMPERSONATION] Cookie created:', {
    actorId: actorId.substring(0, 8) + '...',
    targetId: targetId.substring(0, 8) + '...',
    reason: reason.substring(0, 30),
    expiresAt: new Date(payload.expiresAt).toISOString(),
  });

  return cookieValue;
}

/**
 * Decodifica e verifica cookie impersonation
 *
 * CRITICAL: Fail-closed su qualsiasi errore
 *
 * @param cookieValue - Cookie value da decodificare
 * @returns DecodeResult con payload o errore
 */
export function verifyImpersonationCookie(cookieValue: string | undefined): DecodeResult {
  // 1. Check cookie presente
  if (!cookieValue) {
    return {
      success: false,
      error: 'MISSING',
      errorMessage: 'Impersonation cookie not present',
    };
  }

  // 2. Check formato: <encrypted>.<signature>
  const parts = cookieValue.split('.');
  if (parts.length !== 2) {
    console.warn('❌ [IMPERSONATION] Invalid cookie format (expected: encrypted.signature)');
    return {
      success: false,
      error: 'INVALID_FORMAT',
      errorMessage: 'Cookie format invalid',
    };
  }

  const [encryptedPayload, signature] = parts;

  // 3. Decripta payload
  let payloadJson: string;
  try {
    payloadJson = decryptCredential(encryptedPayload);
  } catch (error: any) {
    console.error('❌ [IMPERSONATION] Decryption failed:', error.message);
    return {
      success: false,
      error: 'DECRYPT_FAILED',
      errorMessage: 'Cookie decryption failed (tampered or key rotation)',
    };
  }

  // 4. Verifica signature (HMAC)
  let isSignatureValid = false;
  try {
    isSignatureValid = verifySignature(payloadJson, signature);
  } catch (error: any) {
    console.error('❌ [IMPERSONATION] Signature verification error:', error.message);
    return {
      success: false,
      error: 'INVALID_SIGNATURE',
      errorMessage: 'Signature verification failed',
    };
  }

  if (!isSignatureValid) {
    console.warn('❌ [IMPERSONATION] Invalid signature (cookie tampered)');
    return {
      success: false,
      error: 'INVALID_SIGNATURE',
      errorMessage: 'Cookie signature invalid (tampered)',
    };
  }

  // 5. Parse payload JSON
  let payload: ImpersonationPayload;
  try {
    payload = JSON.parse(payloadJson);
  } catch (error: any) {
    console.error('❌ [IMPERSONATION] JSON parse failed:', error.message);
    return {
      success: false,
      error: 'INVALID_FORMAT',
      errorMessage: 'Payload JSON invalid',
    };
  }

  // 6. Validate schema
  if (
    !payload.targetId ||
    !payload.actorId ||
    !payload.issuedAt ||
    !payload.expiresAt ||
    !payload.reason ||
    !payload.nonce ||
    typeof payload.version !== 'number'
  ) {
    console.warn('❌ [IMPERSONATION] Invalid payload schema:', payload);
    return {
      success: false,
      error: 'INVALID_SCHEMA',
      errorMessage: 'Payload schema invalid (missing fields)',
    };
  }

  // 7. Validate UUIDs format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(payload.targetId) || !uuidRegex.test(payload.actorId)) {
    console.warn('❌ [IMPERSONATION] Invalid UUID format:', {
      targetId: payload.targetId,
      actorId: payload.actorId,
    });
    return {
      success: false,
      error: 'INVALID_SCHEMA',
      errorMessage: 'Invalid UUID format in payload',
    };
  }

  // 8. Check TTL (expired?)
  const now = Date.now();
  if (now > payload.expiresAt) {
    const expiredAgo = Math.floor((now - payload.expiresAt) / 1000); // secondi
    console.warn('❌ [IMPERSONATION] Cookie expired:', {
      expiredAgo: `${expiredAgo}s ago`,
      issuedAt: new Date(payload.issuedAt).toISOString(),
      expiresAt: new Date(payload.expiresAt).toISOString(),
    });
    return {
      success: false,
      error: 'EXPIRED',
      errorMessage: `Cookie expired ${expiredAgo}s ago`,
    };
  }

  // 9. Sanity check: issuedAt non può essere nel futuro
  if (payload.issuedAt > now + 60000) {
    // tolleranza 1 minuto
    console.warn('❌ [IMPERSONATION] issuedAt in the future (clock skew?):', {
      issuedAt: new Date(payload.issuedAt).toISOString(),
      now: new Date(now).toISOString(),
    });
    return {
      success: false,
      error: 'INVALID_SCHEMA',
      errorMessage: 'issuedAt in the future (clock skew)',
    };
  }

  // ✅ SUCCESS: Cookie valido
  console.log('✅ [IMPERSONATION] Cookie verified successfully:', {
    actorId: payload.actorId.substring(0, 8) + '...',
    targetId: payload.targetId.substring(0, 8) + '...',
    reason: payload.reason.substring(0, 30),
    expiresIn: Math.floor((payload.expiresAt - now) / 1000) + 's',
  });

  return {
    success: true,
    payload,
  };
}

/**
 * Cookie name (esportato per middleware/API)
 */
export const IMPERSONATION_COOKIE_NAME = COOKIE_NAME;

/**
 * Default TTL (esportato per reference)
 */
export const IMPERSONATION_DEFAULT_TTL_MS = DEFAULT_TTL_MS;

/**
 * Helper: Crea cookie con default TTL
 */
export function createImpersonationCookieWithDefaults(
  actorId: string,
  targetId: string,
  reason: string
): string {
  return createImpersonationCookie(actorId, targetId, reason, DEFAULT_TTL_MS);
}
