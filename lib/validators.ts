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

/**
 * Sanitizza un valore per uso sicuro nei log.
 * Previene log injection rimuovendo newline, carriage return e null bytes.
 */
export function sanitizeForLog(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
   
  return str.replace(/[\n\r\0]/g, ' ').slice(0, 500);
}

/**
 * Asserisce che workspaceId sia valido (definito, non vuoto, UUID valido)
 *
 * ⚠️ SICUREZZA: Previene SQL injection nel filtro workspace
 *
 * @param workspaceId - Workspace ID da validare
 * @throws Error con codice WORKSPACE_ID_REQUIRED o INVALID_WORKSPACE_ID se invalido
 *
 * @example
 * assertValidWorkspaceId(workspaceId); // throw se invalido
 * // workspaceId è garantito essere UUID valido
 */
export function assertValidWorkspaceId(workspaceId: string): asserts workspaceId is string {
  if (workspaceId === undefined || workspaceId === null) {
    throw new Error(
      'WORKSPACE_ID_REQUIRED: workspaceId è obbligatorio e non può essere null o undefined'
    );
  }

  if (typeof workspaceId !== 'string') {
    throw new Error(
      `WORKSPACE_ID_REQUIRED: workspaceId deve essere una stringa, ricevuto: ${typeof workspaceId}`
    );
  }

  if (workspaceId.trim() === '') {
    throw new Error('WORKSPACE_ID_REQUIRED: workspaceId non può essere una stringa vuota');
  }

  if (!validateUUID(workspaceId)) {
    throw new Error(
      `INVALID_WORKSPACE_ID: workspaceId deve essere un UUID valido, ricevuto: ${workspaceId.substring(0, 20)}...`
    );
  }
}

/**
 * Costruisce filtro workspace sicuro per query Supabase
 *
 * ⚠️ SICUREZZA: Valida workspaceId come UUID prima di costruire il filtro
 * Previene SQL injection verificando che il valore sia un UUID valido
 *
 * @param workspaceId - Workspace ID (deve essere UUID valido)
 * @returns Stringa filtro per .or() Supabase
 * @throws Error se workspaceId non è UUID valido
 *
 * @example
 * const filter = buildWorkspaceFilter(workspaceId);
 * query = query.or(filter); // safe
 */
/**
 * NOTA SICUREZZA (audit feb 2026): workspace_id.is.null e' INTENZIONALE.
 * I listini master/globali (creati dalla piattaforma) hanno workspace_id = NULL
 * e devono essere visibili a tutti i workspace per il calcolo prezzi.
 * Questo NON e' un leak multi-tenant: i dati globali sono pubblici by design.
 * Se si vuole isolamento totale (nessun dato globale), rimuovere la clausola is.null
 * e assegnare ogni listino master a un workspace specifico.
 */
export function buildWorkspaceFilter(workspaceId: string): string {
  assertValidWorkspaceId(workspaceId);
  return `workspace_id.eq.${workspaceId},workspace_id.is.null`;
}
