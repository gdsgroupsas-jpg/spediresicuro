/**
 * API Response Utilities
 *
 * Utility condivise per response standardizzate nelle API routes
 * Consolida il pattern ripetuto 261+ volte di NextResponse.json()
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createLogger } from './logger';
import { trackApiError } from './error-tracker';

/**
 * Crea una response di successo
 *
 * @param data - Dati da ritornare
 * @param status - Status code HTTP (default: 200)
 * @returns NextResponse con success: true
 *
 * @example
 * return successResponse({ user: userData });
 * return successResponse({ message: 'Operazione completata' }, 201);
 */
export function successResponse<T = any>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * Crea una response di errore
 *
 * @param message - Messaggio di errore
 * @param status - Status code HTTP
 * @returns NextResponse con error
 *
 * @example
 * return errorResponse('Utente non trovato', 404);
 */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Errori API predefiniti
 * Consolida i messaggi di errore comuni
 */
export const ApiErrors = {
  /**
   * 401 - Non autenticato
   */
  UNAUTHORIZED: (message?: string) => errorResponse(message || 'Non autenticato', 401),

  /**
   * 403 - Accesso negato
   */
  FORBIDDEN: (message?: string) => errorResponse(message || 'Accesso negato', 403),

  /**
   * 404 - Risorsa non trovata
   */
  NOT_FOUND: (resource?: string) =>
    errorResponse(resource ? `${resource} non trovato` : 'Risorsa non trovata', 404),

  /**
   * 400 - Richiesta non valida
   */
  BAD_REQUEST: (message?: string) => errorResponse(message || 'Richiesta non valida', 400),

  /**
   * 500 - Errore interno del server
   */
  SERVER_ERROR: (message?: string) => errorResponse(message || 'Errore interno del server', 500),

  /**
   * 503 - Servizio non disponibile
   */
  SERVICE_UNAVAILABLE: (message?: string) =>
    errorResponse(message || 'Servizio temporaneamente non disponibile', 503),

  /**
   * 409 - Conflitto (es. risorsa già esistente)
   */
  CONFLICT: (message?: string) => errorResponse(message || 'Risorsa già esistente', 409),

  /**
   * 422 - Entità non processabile (validazione fallita)
   */
  VALIDATION_ERROR: (message?: string) => errorResponse(message || 'Errore di validazione', 422),
};

/**
 * Gestisce errori API in modo standardizzato
 *
 * @param error - Errore da gestire
 * @param context - Contesto dell'errore (per logging)
 * @param requestId - ID richiesta (opzionale, da header X-Request-ID)
 * @param userId - ID utente (opzionale, da sessione)
 * @returns NextResponse con errore 500
 *
 * @example
 * try {
 *   // ... operazione
 * } catch (error: any) {
 *   return handleApiError(error, 'GET /api/user/info', requestId, userId);
 * }
 */
export function handleApiError(
  error: any,
  context: string,
  requestId?: string,
  userId?: string
): NextResponse {
  // Crea logger con requestId e userId
  const logger = createLogger(requestId, userId);

  // Traccia errore con contesto completo
  trackApiError(error, requestId || 'unknown', userId, context);

  // Log strutturato dell'errore
  logger.error(`Error in ${context}`, error, {
    errorCode: error?.code,
    errorName: error?.name,
  });

  // Gestione errori Supabase specifici
  if (error?.code) {
    switch (error.code) {
      case 'PGRST116':
        return ApiErrors.NOT_FOUND();
      case '23505': // Unique violation
        return ApiErrors.CONFLICT('Risorsa già esistente');
      case '23503': // Foreign key violation
        return ApiErrors.BAD_REQUEST('Riferimento non valido');
      case '42P01': // Undefined table
        return ApiErrors.SERVER_ERROR('Configurazione database non valida');
      default:
        break;
    }
  }

  // Errore generico
  return ApiErrors.SERVER_ERROR();
}

/**
 * Estrae requestId da header o genera nuovo
 *
 * @param request - NextRequest
 * @returns RequestId
 */
export function getRequestId(request: NextRequest): string {
  return (
    request.headers.get('X-Request-ID') ||
    `api-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );
}
