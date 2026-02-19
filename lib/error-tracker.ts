/**
 * Error Tracking System
 *
 * Sistema centralizzato per tracciare errori con contesto completo
 * Integra con logger strutturato per tracciabilità
 *
 * @example
 * trackError(error, { requestId, userId, context: 'API /api/shipments' });
 */

import { createLogger, generateRequestId } from './logger';
import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  context?: string; // Es: 'API /api/shipments', 'Middleware', 'Database'
  metadata?: Record<string, any>;
}

/**
 * Traccia un errore con contesto completo
 *
 * @param error - Errore da tracciare
 * @param errorContext - Contesto dell'errore (requestId, userId, context, metadata)
 */
export function trackError(error: Error | any, errorContext: ErrorContext = {}): void {
  const {
    requestId = generateRequestId(),
    userId = 'unknown',
    context = 'Unknown',
    metadata = {},
  } = errorContext;

  const logger = createLogger(requestId, userId);

  // Log errore strutturato
  logger.error(`Error in ${context}`, error, {
    ...metadata,
    context,
    severity: determineSeverity(error),
    errorType: error?.name || 'Error',
  });

  // Sentry error tracking (fail-safe: se Sentry non inizializzato, skip)
  try {
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
      tags: { context, severity: determineSeverity(error) },
      extra: { requestId, ...metadata },
      ...(userId && userId !== 'unknown' ? { user: { id: userId } } : {}),
    });
  } catch {
    // Sentry non disponibile (es. test, dev senza DSN) — logging gia avvenuto sopra
  }
}

/**
 * Determina la severità dell'errore
 *
 * @param error - Errore da analizzare
 * @returns Severità: 'low' | 'medium' | 'high' | 'critical'
 */
function determineSeverity(error: Error | any): string {
  // Errori di autenticazione/autorizzazione
  if (error?.status === 401 || error?.status === 403) {
    return 'medium';
  }

  // Errori di validazione
  if (error?.status === 400 || error?.status === 422) {
    return 'low';
  }

  // Errori di database critici
  if (error?.code === '42P01' || error?.code === 'PGRST116') {
    return 'high';
  }

  // Errori di rete/timeout
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
    return 'medium';
  }

  // Errori generici server
  if (error?.status === 500 || error?.status === 503) {
    return 'high';
  }

  // Default
  return 'medium';
}

/**
 * Traccia un errore API con contesto standardizzato
 *
 * @param error - Errore da tracciare
 * @param requestId - ID richiesta
 * @param userId - ID utente (opzionale)
 * @param route - Route API (es: 'GET /api/shipments')
 * @param metadata - Metadata aggiuntiva
 */
export function trackApiError(
  error: Error | any,
  requestId: string,
  userId?: string,
  route?: string,
  metadata?: Record<string, any>
): void {
  trackError(error, {
    requestId,
    userId,
    context: route || 'API',
    metadata: {
      ...metadata,
      route,
      method: route?.split(' ')[0] || 'UNKNOWN',
    },
  });
}

/**
 * Traccia un errore di middleware
 *
 * @param error - Errore da tracciare
 * @param requestId - ID richiesta
 * @param pathname - Pathname della richiesta
 * @param metadata - Metadata aggiuntiva
 */
export function trackMiddlewareError(
  error: Error | any,
  requestId: string,
  pathname?: string,
  metadata?: Record<string, any>
): void {
  trackError(error, {
    requestId,
    context: 'Middleware',
    metadata: {
      ...metadata,
      pathname,
    },
  });
}
