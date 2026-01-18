/**
 * Structured Logging System
 *
 * Fornisce logging strutturato con requestId e userId per tracciabilità completa
 * M2: Enhanced with Sentry trace context for distributed tracing
 *
 * @example
 * const logger = createLogger(requestId, userId);
 * logger.info('Operazione completata', { shipmentId: '123' });
 * logger.error('Errore creazione spedizione', error, { shipmentId: '123' });
 */

import { createHash } from 'crypto';
import * as Sentry from '@sentry/nextjs';

export interface LogContext {
  requestId?: string;
  userId?: string;
  traceId?: string;      // M2: Sentry trace ID for correlation
  spanId?: string;       // M2: Sentry span ID for correlation
  [key: string]: any;
}

export interface Logger {
  info: (message: string, metadata?: Record<string, any>) => void;
  warn: (message: string, metadata?: Record<string, any>) => void;
  error: (message: string, error?: Error | any, metadata?: Record<string, any>) => void;
  debug: (message: string, metadata?: Record<string, any>) => void;
}

/**
 * M2: Estrae trace context da Sentry per correlazione distribuita
 *
 * @returns Trace e Span ID se disponibili
 */
export function getTraceContext(): { traceId?: string; spanId?: string } {
  try {
    const span = Sentry.getActiveSpan();
    if (!span) return {};

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
    };
  } catch {
    // Fail-safe: se Sentry non disponibile, ritorna oggetto vuoto
    return {};
  }
}

/**
 * Crea un logger strutturato con requestId e userId
 * M2: Automaticamente include trace context da Sentry
 *
 * @param requestId - ID univoco della richiesta (generato nel middleware)
 * @param userId - ID utente (opzionale, da sessione)
 * @returns Logger con metodi info, warn, error, debug
 */
export function createLogger(requestId?: string, userId?: string): Logger {
  const traceContext = getTraceContext();

  const baseContext: LogContext = {
    requestId: requestId || 'unknown',
    userId: hashUserId(userId), // Pseudo-anonimizzato per GDPR
    timestamp: new Date().toISOString(),
    ...(traceContext.traceId && { traceId: traceContext.traceId }),
    ...(traceContext.spanId && { spanId: traceContext.spanId }),
  };

  const formatLog = (
    level: string,
    message: string,
    metadata?: Record<string, any>,
    error?: Error | any
  ) => {
    const logEntry = {
      level,
      message,
      ...baseContext,
      ...(metadata || {}),
      ...(error && {
        error: {
          name: error?.name || 'Error',
          message: error?.message || String(error),
          stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
          code: error?.code,
        },
      }),
    };

    // Output JSON strutturato per produzione, console per sviluppo
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    } else {
      return logEntry;
    }
  };

  return {
    info: (message: string, metadata?: Record<string, any>) => {
      const log = formatLog('info', message, metadata);
      if (process.env.NODE_ENV === 'production') {
        console.log(log);
      } else {
        console.log(`ℹ️ [${baseContext.requestId}]`, message, metadata || '');
      }
    },

    warn: (message: string, metadata?: Record<string, any>) => {
      const log = formatLog('warn', message, metadata);
      if (process.env.NODE_ENV === 'production') {
        console.warn(log);
      } else {
        console.warn(`⚠️ [${baseContext.requestId}]`, message, metadata || '');
      }
    },

    error: (message: string, error?: Error | any, metadata?: Record<string, any>) => {
      const log = formatLog('error', message, metadata, error);
      if (process.env.NODE_ENV === 'production') {
        console.error(log);
      } else {
        console.error(`❌ [${baseContext.requestId}]`, message, {
          ...metadata,
          error: error?.message || error,
        });
      }
    },

    debug: (message: string, metadata?: Record<string, any>) => {
      if (process.env.NODE_ENV === 'development') {
        const log = formatLog('debug', message, metadata);
        console.debug(`🔍 [${baseContext.requestId}]`, message, metadata || '');
      }
    },
  };
}

/**
 * Hash userId per pseudo-anonimizzazione GDPR
 *
 * @param userId - ID utente in chiaro
 * @returns Hash corto (primi 8 caratteri) o 'anonymous' se undefined
 */
function hashUserId(userId?: string): string {
  if (!userId) {
    return 'anonymous';
  }
  const hash = createHash('sha256').update(userId).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Hash generico per ID sensibili (ordini, spedizioni, etc.)
 *
 * @param value - Valore da hashare
 * @returns Hash corto (primi 8 caratteri)
 */
export function hashValue(value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Sanitizza metadati rimuovendo campi sensibili
 *
 * @param metadata - Metadati da sanitizzare
 * @returns Metadati sanitizzati
 */
export function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata) return undefined;

  const sensitiveKeys = ['password', 'token', 'api_key', 'apiKey', 'secret', 'authorization'];
  const sanitized = { ...metadata };

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * M2: Crea logger con trace context esplicito (per operazioni async)
 *
 * Utile quando il trace context deve essere passato manualmente
 * (es. worker, job asincroni, callback)
 *
 * @param requestId - ID univoco della richiesta
 * @param userId - ID utente (opzionale)
 * @param traceId - Trace ID esplicito (opzionale, altrimenti auto-detect)
 * @param spanId - Span ID esplicito (opzionale, altrimenti auto-detect)
 * @returns Logger con metodi info, warn, error, debug
 */
export function createLoggerWithTrace(
  requestId?: string,
  userId?: string,
  traceId?: string,
  spanId?: string
): Logger {
  const autoTrace = getTraceContext();

  const baseContext: LogContext = {
    requestId: requestId || 'unknown',
    userId: hashUserId(userId),
    timestamp: new Date().toISOString(),
    ...(traceId || autoTrace.traceId ? { traceId: traceId || autoTrace.traceId } : {}),
    ...(spanId || autoTrace.spanId ? { spanId: spanId || autoTrace.spanId } : {}),
  };

  const formatLog = (
    level: string,
    message: string,
    metadata?: Record<string, any>,
    error?: Error | any
  ) => {
    const logEntry = {
      level,
      message,
      ...baseContext,
      ...(metadata || {}),
      ...(error && {
        error: {
          name: error?.name || 'Error',
          message: error?.message || String(error),
          stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
          code: error?.code,
        },
      }),
    };

    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    } else {
      return logEntry;
    }
  };

  return {
    info: (message: string, metadata?: Record<string, any>) => {
      const log = formatLog('info', message, metadata);
      if (process.env.NODE_ENV === 'production') {
        console.log(log);
      } else {
        console.log(`ℹ️ [${baseContext.requestId}]`, message, metadata || '');
      }
    },

    warn: (message: string, metadata?: Record<string, any>) => {
      const log = formatLog('warn', message, metadata);
      if (process.env.NODE_ENV === 'production') {
        console.warn(log);
      } else {
        console.warn(`⚠️ [${baseContext.requestId}]`, message, metadata || '');
      }
    },

    error: (message: string, error?: Error | any, metadata?: Record<string, any>) => {
      const log = formatLog('error', message, metadata, error);
      if (process.env.NODE_ENV === 'production') {
        console.error(log);
      } else {
        console.error(`❌ [${baseContext.requestId}]`, message, {
          ...metadata,
          error: error?.message || error,
        });
      }
    },

    debug: (message: string, metadata?: Record<string, any>) => {
      if (process.env.NODE_ENV === 'development') {
        const log = formatLog('debug', message, metadata);
        console.debug(`🔍 [${baseContext.requestId}]`, message, metadata || '');
      }
    },
  };
}

/**
 * Genera un requestId univoco
 * Formato: timestamp-base36-random
 *
 * @returns RequestId univoco
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}
