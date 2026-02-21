/**
 * Generic Retry Wrapper per chiamate API esterne
 *
 * REGOLE:
 * - Retry SOLO su errori transienti (5xx, timeout, network error)
 * - MAI retry su 4xx (bad request, unauthorized, not found)
 * - Backoff esponenziale con jitter per evitare thundering herd
 * - Feature flag: RETRY_ENABLED env var
 *
 * DESIGN: Pattern identico a lib/wallet/retry.ts ma per HTTP
 */

export interface RetryOptions {
  maxRetries?: number; // Default: 3
  baseDelayMs?: number; // Default: 100
  maxDelayMs?: number; // Default: 5000
  operationName?: string; // Per logging
  retryableStatuses?: number[]; // Default: [500, 502, 503, 504, 408, 429]
}

export function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  // Network errors (fetch failed, timeout)
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
    return true;
  }
  if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
    return true;
  }
  // Axios-style errors
  const status = error?.response?.status || error?.status;
  if (status && retryableStatuses.includes(status)) {
    return true;
  }
  return false;
}

/**
 * Calcola delay con exponential backoff + jitter
 * jitter evita thundering herd quando multipli client retryano insieme
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Feature flag
  if (process.env.RETRY_ENABLED === 'false') {
    return operation();
  }

  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    operationName = 'api_call',
    retryableStatuses = [500, 502, 503, 504, 408, 429],
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      if (attempt > 0) {
        const safeName = String(operationName).replace(/[\n\r\0]/g, '');
        console.info(
          `✅ [RETRY] ${safeName} succeeded on attempt ${attempt + 1}/${maxRetries + 1}`
        );
      }

      return result;
    } catch (error: any) {
      lastError = error;

      const isRetryable = isRetryableError(error, retryableStatuses);
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryable || isLastAttempt) {
        if (attempt > 0) {
          const safeName = String(operationName).replace(/[\n\r\0]/g, '');
          console.error(`❌ [RETRY] ${safeName} failed after ${attempt + 1} attempts`, {
            error: String(error?.message || '').replace(/[\n\r\0]/g, ''),
            status: error?.response?.status || error?.status,
            retryable: isRetryable,
          });
        }
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      const safeName = String(operationName).replace(/[\n\r\0]/g, '');
      console.warn(
        `⚠️ [RETRY] ${safeName} attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`,
        {
          error: String(error?.message || '').replace(/[\n\r\0]/g, ''),
          status: error?.response?.status || error?.status,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
