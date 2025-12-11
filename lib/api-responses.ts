/**
 * API Response Utilities
 *
 * Utility condivise per response standardizzate nelle API routes
 * Consolida il pattern ripetuto 261+ volte di NextResponse.json()
 */

import { NextResponse } from 'next/server';

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
export function successResponse<T = any>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    { success: true, ...data },
    { status }
  );
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
export function errorResponse(
  message: string,
  status: number
): NextResponse {
  return NextResponse.json(
    { error: message },
    { status }
  );
}

/**
 * Errori API predefiniti
 * Consolida i messaggi di errore comuni
 */
export const ApiErrors = {
  /**
   * 401 - Non autenticato
   */
  UNAUTHORIZED: (message?: string) =>
    errorResponse(message || 'Non autenticato', 401),

  /**
   * 403 - Accesso negato
   */
  FORBIDDEN: (message?: string) =>
    errorResponse(message || 'Accesso negato', 403),

  /**
   * 404 - Risorsa non trovata
   */
  NOT_FOUND: (resource?: string) =>
    errorResponse(
      resource ? `${resource} non trovato` : 'Risorsa non trovata',
      404
    ),

  /**
   * 400 - Richiesta non valida
   */
  BAD_REQUEST: (message?: string) =>
    errorResponse(message || 'Richiesta non valida', 400),

  /**
   * 500 - Errore interno del server
   */
  SERVER_ERROR: (message?: string) =>
    errorResponse(
      message || 'Errore interno del server',
      500
    ),

  /**
   * 503 - Servizio non disponibile
   */
  SERVICE_UNAVAILABLE: (message?: string) =>
    errorResponse(
      message || 'Servizio temporaneamente non disponibile',
      503
    ),

  /**
   * 409 - Conflitto (es. risorsa già esistente)
   */
  CONFLICT: (message?: string) =>
    errorResponse(message || 'Risorsa già esistente', 409),

  /**
   * 422 - Entità non processabile (validazione fallita)
   */
  VALIDATION_ERROR: (message?: string) =>
    errorResponse(
      message || 'Errore di validazione',
      422
    ),
};

/**
 * Gestisce errori API in modo standardizzato
 *
 * @param error - Errore da gestire
 * @param context - Contesto dell'errore (per logging)
 * @returns NextResponse con errore 500
 *
 * @example
 * try {
 *   // ... operazione
 * } catch (error: any) {
 *   return handleApiError(error, 'GET /api/user/info');
 * }
 */
export function handleApiError(
  error: any,
  context: string
): NextResponse {
  // Log strutturato dell'errore
  console.error(`[${context}] Error:`, {
    message: error?.message,
    code: error?.code,
    name: error?.name,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
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
