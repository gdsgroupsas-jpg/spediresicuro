/**
 * Distributed Lock per Automation Engine
 *
 * Usa Redis (Upstash) per lock pessimistico sulle automazioni.
 * Previene esecuzioni duplicate in caso di multiple istanze.
 *
 * Fail mode configurabile via LOCK_FAIL_MODE:
 * - 'open' (default): se Redis non disponibile, procedi (sicuro per Vercel single-instance)
 * - 'closed': se Redis non disponibile, blocca esecuzione
 *
 * Observability: trackError() + Sentry metrics su ogni fail-open/fail-closed
 */

import { getRedis } from '@/lib/db/redis';
import { trackError } from '@/lib/error-tracker';
import * as Sentry from '@sentry/nextjs';

const LOCK_PREFIX = 'automation:lock:';

// Fail mode configurabile: 'open' (default, procedi) o 'closed' (blocca)
let lockFailMode: 'open' | 'closed' = (process.env.LOCK_FAIL_MODE as 'open' | 'closed') || 'open';

/** Solo per testing — imposta fail mode runtime */
export function __setFailModeForTesting(mode: 'open' | 'closed'): void {
  lockFailMode = mode;
}

/** Solo per testing — reset al default */
export function __resetFailModeForTesting(): void {
  lockFailMode = (process.env.LOCK_FAIL_MODE as 'open' | 'closed') || 'open';
}

/**
 * Acquisisce un lock distribuito per un'automazione.
 *
 * @param slug - Identificativo automazione
 * @param ttlSeconds - Durata lock in secondi (default: 300 = 5 min)
 * @returns true se lock acquisito (o Redis non disponibile in fail-open mode)
 */
export async function acquireAutomationLock(
  slug: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const redis = getRedis();

  // Redis non disponibile: comportamento dipende da failMode
  if (!redis) {
    trackError(new Error(`Redis non disponibile per lock: ${slug}`), {
      context: 'DistributedLock',
      metadata: { slug, failMode: lockFailMode, reason: 'redis_unavailable' },
    });
    try {
      Sentry.metrics.count('distributed_lock.fail_open', 1, {
        attributes: { slug, reason: 'redis_unavailable' },
      });
    } catch {
      // Sentry non disponibile
    }
    return lockFailMode === 'open';
  }

  try {
    const key = `${LOCK_PREFIX}${slug}`;
    // SET NX (solo se non esiste) + EX (TTL)
    const result = await redis.set(key, Date.now().toString(), { nx: true, ex: ttlSeconds });

    if (result === 'OK') {
      return true;
    }

    // Lock gia in uso — non e' un errore, e' comportamento atteso
    console.warn(`[LOCK] Automazione gia in esecuzione: ${slug}`);
    return false;
  } catch (error) {
    trackError(error instanceof Error ? error : new Error(String(error)), {
      context: 'DistributedLock',
      metadata: { slug, failMode: lockFailMode, reason: 'redis_error' },
    });
    try {
      Sentry.metrics.count('distributed_lock.fail_open', 1, {
        attributes: { slug, reason: 'redis_error' },
      });
    } catch {
      // Sentry non disponibile
    }
    return lockFailMode === 'open';
  }
}

/**
 * Rilascia il lock distribuito per un'automazione.
 *
 * @param slug - Identificativo automazione
 */
export async function releaseAutomationLock(slug: string): Promise<void> {
  const redis = getRedis();

  if (!redis) return;

  try {
    const key = `${LOCK_PREFIX}${slug}`;
    await redis.del(key);
  } catch (error) {
    trackError(error instanceof Error ? error : new Error(String(error)), {
      context: 'DistributedLock.release',
      metadata: { slug },
    });
    // Non critico: il TTL liberera comunque il lock
  }
}
