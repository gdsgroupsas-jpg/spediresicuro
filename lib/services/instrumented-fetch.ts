/**
 * M2: Instrumented Fetch Client
 *
 * Wrapper per fetch() che crea automaticamente Sentry spans per API calls esterne.
 * Permette distributed tracing di integrazioni Stripe, corrieri, AI services, etc.
 *
 * @example
 * import { instrumentedFetch } from '@/lib/services/instrumented-fetch';
 *
 * const response = await instrumentedFetch('https://api.stripe.com/v1/customers', {
 *   serviceName: 'stripe',
 *   method: 'GET',
 *   headers: { Authorization: 'Bearer sk_test_...' }
 * });
 */

import * as Sentry from '@sentry/nextjs';
import { createLogger, sanitizeMetadata } from '@/lib/logger';

/**
 * Opzioni per instrumentedFetch
 */
export interface InstrumentedFetchOptions extends RequestInit {
  serviceName?: string;     // Nome servizio (stripe, ups, dhl, anthropic, etc.)
  requestId?: string;       // Request ID per correlazione logs
  logResponse?: boolean;    // Se loggare response body (default: false per privacy)
  sensitiveHeaders?: string[]; // Headers da redact nei logs (oltre ai default)
}

/**
 * Headers sensibili da redactare automaticamente
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'api-key',
  'apikey',
  'x-auth-token',
  'cookie',
  'set-cookie',
  'x-stripe-client-secret',
];

/**
 * Fetch instrumentato con Sentry tracing
 *
 * @param url - URL da chiamare
 * @param options - Opzioni fetch + serviceName per tagging
 * @returns Response della fetch
 */
export async function instrumentedFetch(
  url: string | URL,
  options: InstrumentedFetchOptions = {}
): Promise<Response> {
  const {
    serviceName = extractServiceName(url),
    requestId,
    logResponse = false,
    sensitiveHeaders = [],
    ...fetchOptions
  } = options;

  const logger = createLogger(requestId);
  const urlString = typeof url === 'string' ? url : url.toString();
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // Crea span Sentry per questa API call
  return await Sentry.startSpan(
    {
      op: 'http.client',
      name: `${method} ${serviceName}`,
      attributes: {
        'http.method': method,
        'http.url': sanitizeUrl(urlString), // Rimuove query params sensibili
        'http.service': serviceName,
        'server.address': extractHostname(urlString),
      },
    },
    async (span) => {
      const startTime = Date.now();

      try {
        // Esegui fetch originale
        const response = await fetch(url, fetchOptions);
        const duration = Date.now() - startTime;

        // Aggiungi attributi di response allo span
        span.setAttributes({
          'http.status_code': response.status,
          'http.response.duration': duration,
        });

        // Log (solo se errore o molto lento)
        const isError = response.status >= 400;
        const isSlow = duration > 2000;

        if (isError || isSlow) {
          logger.warn(`External API ${method} ${serviceName}`, {
            service: serviceName,
            method,
            url: sanitizeUrl(urlString),
            status: response.status,
            duration,
            slow: isSlow,
            error: isError,
          });
        } else {
          logger.debug(`External API ${method} ${serviceName}`, {
            service: serviceName,
            method,
            status: response.status,
            duration,
          });
        }

        // Log response body solo se richiesto (e se errore)
        if (logResponse && isError) {
          try {
            const clonedResponse = response.clone();
            const responseText = await clonedResponse.text();
            logger.debug(`Response body (${serviceName})`, {
              status: response.status,
              body: responseText.substring(0, 500), // Primi 500 char
            });
          } catch (err) {
            // Ignore errors reading response body
          }
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Log errore
        logger.error(`External API ${method} ${serviceName} failed`, error, {
          service: serviceName,
          method,
          url: sanitizeUrl(urlString),
          duration,
        });

        // Marca span come errore
        span.setStatus({ code: 2, message: String(error) }); // 2 = ERROR

        throw error;
      }
    }
  );
}

/**
 * Estrae nome servizio dall'URL
 *
 * @param url - URL da parsare
 * @returns Nome servizio (es. "stripe", "ups", "anthropic")
 */
function extractServiceName(url: string | URL): string {
  const urlString = typeof url === 'string' ? url : url.toString();
  const hostname = extractHostname(urlString);

  // Pattern matching per servizi comuni
  if (hostname.includes('stripe.com')) return 'stripe';
  if (hostname.includes('ups.com')) return 'ups';
  if (hostname.includes('dhl.com')) return 'dhl';
  if (hostname.includes('anthropic.com')) return 'anthropic';
  if (hostname.includes('openai.com')) return 'openai';
  if (hostname.includes('deepseek.com')) return 'deepseek';
  if (hostname.includes('googleapis.com')) return 'google';
  if (hostname.includes('supabase.co')) return 'supabase';
  if (hostname.includes('vercel.com')) return 'vercel';

  // Default: hostname senza TLD
  const parts = hostname.split('.');
  return parts[parts.length - 2] || hostname;
}

/**
 * Estrae hostname da URL
 */
function extractHostname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Sanitizza URL rimuovendo parametri sensibili
 *
 * @param urlString - URL da sanitizzare
 * @returns URL sanitizzato (senza query params sensibili)
 */
function sanitizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Rimuovi query params sensibili
    const sensitiveParams = ['api_key', 'apiKey', 'token', 'secret', 'password', 'key'];
    for (const param of sensitiveParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, '[REDACTED]');
      }
    }

    return url.toString();
  } catch {
    // Se URL non valido, ritorna as-is
    return urlString;
  }
}

/**
 * Sanitizza headers rimuovendo valori sensibili
 *
 * @param headers - Headers da sanitizzare
 * @param additionalSensitive - Headers aggiuntivi da redactare
 * @returns Headers sanitizzati
 */
export function sanitizeHeaders(
  headers?: HeadersInit,
  additionalSensitive: string[] = []
): Record<string, string> {
  if (!headers) return {};

  const sensitiveSet = new Set([
    ...SENSITIVE_HEADERS,
    ...additionalSensitive.map((h) => h.toLowerCase()),
  ]);

  const result: Record<string, string> = {};

  // Converti Headers in plain object
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = sensitiveSet.has(key.toLowerCase()) ? '[REDACTED]' : value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = sensitiveSet.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      result[key] = sensitiveSet.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
  }

  return result;
}

/**
 * Factory function (following M1 pattern)
 *
 * Crea un fetch wrapper configurato per un servizio specifico
 *
 * @param serviceName - Nome del servizio (stripe, ups, etc.)
 * @param requestId - Request ID (opzionale)
 * @returns Fetch wrapper pre-configurato
 */
export function createInstrumentedFetch(serviceName: string, requestId?: string) {
  return async (url: string | URL, options: RequestInit = {}): Promise<Response> => {
    return instrumentedFetch(url, {
      ...options,
      serviceName,
      requestId,
    });
  };
}

/**
 * Helper per chiamate Stripe (pre-configurato)
 *
 * @example
 * const customer = await stripeFetch('https://api.stripe.com/v1/customers/cus_123', {
 *   method: 'GET',
 *   headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
 * });
 */
export async function stripeFetch(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  return instrumentedFetch(url, {
    ...options,
    serviceName: 'stripe',
  });
}

/**
 * Helper per chiamate corrieri (pre-configurato)
 *
 * @example
 * const tracking = await courierFetch('https://api.ups.com/track/v1/details/1Z999AA10123456784', {
 *   serviceName: 'ups',
 *   headers: { 'X-API-Key': process.env.UPS_API_KEY }
 * });
 */
export async function courierFetch(
  url: string | URL,
  options: InstrumentedFetchOptions = {}
): Promise<Response> {
  return instrumentedFetch(url, {
    ...options,
    serviceName: options.serviceName || 'courier',
  });
}
