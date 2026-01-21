/**
 * Validation Utilities
 *
 * Utility condivise per validazione di input
 * Consolida i pattern di validazione duplicati nel codebase
 */

/**
 * Regex per validazione email
 * Consolidata da 4 occorrenze in auth/register, admin.ts, admin-reseller.ts
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida un indirizzo email
 *
 * @param email - Email da validare
 * @returns true se valida, false altrimenti
 *
 * @example
 * if (!validateEmail(email)) {
 *   return errorResponse('Email non valida', 400);
 * }
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Valida una password secondo requisiti minimi
 *
 * @param password - Password da validare
 * @param minLength - Lunghezza minima (default: 8)
 * @returns true se valida, false altrimenti
 */
export function validatePassword(password: string, minLength: number = 8): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return password.length >= minLength;
}

/**
 * Valida un UUID
 *
 * @param uuid - UUID da validare
 * @returns true se valido, false altrimenti
 */
export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Asserisce che userId sia valido (definito, non vuoto, UUID valido)
 *
 * ⚠️ SICUREZZA: Previene inserimenti con user_id null o invalido
 *
 * @param userId - User ID da validare
 * @throws Error con codice USER_ID_REQUIRED o INVALID_USER_ID se invalido
 *
 * @example
 * assertValidUserId(userId); // throw se invalido
 * // userId è garantito essere string valida non vuota
 */
export function assertValidUserId(userId: string): asserts userId is string {
  if (userId === undefined || userId === null) {
    throw new Error('USER_ID_REQUIRED: userId è obbligatorio e non può essere null o undefined');
  }

  if (typeof userId !== 'string') {
    throw new Error(`USER_ID_REQUIRED: userId deve essere una stringa, ricevuto: ${typeof userId}`);
  }

  if (userId.trim() === '') {
    throw new Error('USER_ID_REQUIRED: userId non può essere una stringa vuota');
  }

  if (!validateUUID(userId)) {
    throw new Error(
      `INVALID_USER_ID: userId deve essere un UUID valido, ricevuto: ${userId.substring(0, 20)}...`
    );
  }
}

/**
 * Valida un numero di telefono (formato italiano e internazionale)
 *
 * @param phone - Numero di telefono da validare
 * @returns true se valido, false altrimenti
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Accetta formati: +39 XXX XXX XXXX, 3XX XXX XXXX, etc.
  const phoneRegex = /^(\+\d{1,3}[- ]?)?\d{10,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Sanitizza una stringa rimuovendo caratteri pericolosi
 *
 * @param str - Stringa da sanitizzare
 * @returns Stringa sanitizzata
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }
  // Rimuove tag HTML e caratteri pericolosi
  return str
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '');
}
