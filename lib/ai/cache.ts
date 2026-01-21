/**
 * Cache System per Anne
 *
 * Cache in-memory per ottimizzare performance e ridurre costi API.
 * Cachea contesti e risultati di calcoli costosi.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number = 100; // Massimo 100 entry

  /**
   * Ottieni valore dalla cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Verifica se è scaduto
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Salva valore in cache
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    // Se cache è piena, rimuovi entry più vecchia
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  /**
   * Rimuovi entry dalla cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Pulisci cache scaduta
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Pulisci tutta la cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Ottieni statistiche cache
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Istanza globale cache
const cache = new MemoryCache();

// Cleanup automatico ogni 5 minuti
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      cache.cleanup();
    },
    5 * 60 * 1000
  );
}

/**
 * Genera chiave cache per contesto utente
 */
export function getContextCacheKey(userId: string, userRole: string): string {
  return `context:${userId}:${userRole}`;
}

/**
 * Genera chiave cache per calcolo prezzo
 */
export function getPricingCacheKey(request: {
  weight: number;
  zip: string;
  province: string;
  serviceType?: string;
}): string {
  return `pricing:${request.weight}:${request.zip}:${request.province}:${request.serviceType || 'standard'}`;
}

/**
 * Ottieni contesto dalla cache
 */
export function getCachedContext<T>(key: string): T | null {
  return cache.get<T>(key);
}

/**
 * Salva contesto in cache
 */
export function setCachedContext<T>(key: string, data: T, ttlSeconds: number = 300): void {
  cache.set(key, data, ttlSeconds);
}

/**
 * Pulisci cache contesto per utente
 */
export function clearUserContextCache(userId: string): void {
  cache.delete(getContextCacheKey(userId, 'admin'));
  cache.delete(getContextCacheKey(userId, 'user'));
}

/**
 * Ottieni statistiche cache (per debug)
 */
export function getCacheStats() {
  return cache.getStats();
}
