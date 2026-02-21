/**
 * Distributed Lock per Automation Engine
 *
 * Usa Redis (Upstash) per lock pessimistico sulle automazioni.
 * Previene esecuzioni duplicate in caso di multiple istanze.
 *
 * Fallback: se Redis non è disponibile, fail-open (procedi).
 * Sicuro per Vercel single-instance (il lock è extra-safety).
 */

import { getRedis } from '@/lib/db/redis';

const LOCK_PREFIX = 'automation:lock:';

/**
 * Acquisisce un lock distribuito per un'automazione.
 *
 * @param slug - Identificativo automazione
 * @param ttlSeconds - Durata lock in secondi (default: 300 = 5 min)
 * @returns true se lock acquisito (o Redis non disponibile)
 */
export async function acquireAutomationLock(
  slug: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const redis = getRedis();

  // Fallback fail-open: se Redis non disponibile, procedi
  if (!redis) {
    console.warn(`[LOCK] Redis non disponibile, fail-open per: ${slug}`);
    return true;
  }

  try {
    const key = `${LOCK_PREFIX}${slug}`;
    // SET NX (solo se non esiste) + EX (TTL)
    const result = await redis.set(key, Date.now().toString(), { nx: true, ex: ttlSeconds });

    if (result === 'OK') {
      return true;
    }

    console.warn(`[LOCK] Automazione già in esecuzione: ${slug}`);
    return false;
  } catch (error) {
    console.error(`[LOCK] Errore acquisizione lock ${slug}:`, error);
    // Fail-open: in caso di errore Redis, procedi comunque
    return true;
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
    console.error(`[LOCK] Errore rilascio lock ${slug}:`, error);
    // Non critico: il TTL libererà comunque il lock
  }
}
