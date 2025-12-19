/**
 * Structured Logging System
 * 
 * Fornisce logging strutturato con requestId e userId per tracciabilità completa
 * 
 * @example
 * const logger = createLogger(requestId, userId);
 * logger.info('Operazione completata', { shipmentId: '123' });
 * logger.error('Errore creazione spedizione', error, { shipmentId: '123' });
 */

import { createHash } from 'crypto';

export interface LogContext {
  requestId?: string;
  userId?: string;
  [key: string]: any;
}

export interface Logger {
  info: (message: string, metadata?: Record<string, any>) => void;
  warn: (message: string, metadata?: Record<string, any>) => void;
  error: (message: string, error?: Error | any, metadata?: Record<string, any>) => void;
  debug: (message: string, metadata?: Record<string, any>) => void;
}

/**
 * Crea un logger strutturato con requestId e userId
 * 
 * @param requestId - ID univoco della richiesta (generato nel middleware)
 * @param userId - ID utente (opzionale, da sessione)
 * @returns Logger con metodi info, warn, error, debug
 */
export function createLogger(requestId?: string, userId?: string): Logger {
  const baseContext: LogContext = {
    requestId: requestId || 'unknown',
    userId: hashUserId(userId), // Pseudo-anonimizzato per GDPR
    timestamp: new Date().toISOString(),
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
