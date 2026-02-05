/**
 * Pricing Cache - Milestone 5
 *
 * Cache layer centralizzato per il modulo pricing con:
 * - TTL configurabile (default 30s per master lists, 5min per quotes)
 * - Workspace-scoped cache keys per isolamento multi-tenant
 * - Invalidation strategy esplicita
 * - Statistiche per monitoring
 *
 * @example
 * const cache = createPricingCache({ defaultTTL: 60_000 });
 * cache.set('key', data, { workspaceId: 'ws-123' });
 * const data = cache.get('key', { workspaceId: 'ws-123' });
 *
 * @module lib/cache/pricing-cache
 */

// ==================== TIPI ====================

export type CacheType = 'master-list' | 'quote' | 'price-list' | 'calculation';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  type: CacheType;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface CacheOptions {
  workspaceId?: string;
  ttl?: number;
  type?: CacheType;
  metadata?: Record<string, unknown>;
}

export interface PricingCacheConfig {
  /** TTL di default in ms (default: 30_000 = 30s) */
  defaultTTL?: number;
  /** TTL per master lists in ms (default: 30_000 = 30s) */
  masterListTTL?: number;
  /** TTL per quote/calculations in ms (default: 300_000 = 5min) */
  quoteTTL?: number;
  /** TTL per price lists in ms (default: 60_000 = 1min) */
  priceListTTL?: number;
  /** Massimo numero di entries (default: 1000) */
  maxEntries?: number;
  /** Abilita logging debug (default: false) */
  debug?: boolean;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  byType: Record<CacheType, number>;
  byWorkspace: Record<string, number>;
}

export interface InvalidationOptions {
  /** Invalida tutte le entries di un workspace */
  workspaceId?: string;
  /** Invalida tutte le entries di un tipo */
  type?: CacheType;
  /** Invalida entries che matchano un pattern (inizio key) */
  keyPattern?: string;
  /** Invalida entries più vecchie di N ms */
  olderThan?: number;
}

// ==================== IMPLEMENTAZIONE ====================

/**
 * Cache centralizzata per pricing con workspace scoping
 */
export class PricingCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: Required<PricingCacheConfig>;
  private stats = { hits: 0, misses: 0 };
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = 60_000; // 1 minuto

  constructor(config: PricingCacheConfig = {}) {
    this.config = {
      defaultTTL: config.defaultTTL ?? 30_000,
      masterListTTL: config.masterListTTL ?? 30_000,
      quoteTTL: config.quoteTTL ?? 300_000,
      priceListTTL: config.priceListTTL ?? 60_000,
      maxEntries: config.maxEntries ?? 1000,
      debug: config.debug ?? false,
    };
  }

  /**
   * Costruisce chiave cache con workspace scoping
   */
  private buildKey(key: string, workspaceId?: string): string {
    return workspaceId ? `${workspaceId}:${key}` : key;
  }

  /**
   * Determina TTL basato sul tipo di cache
   */
  private getTTL(type?: CacheType, customTTL?: number): number {
    if (customTTL !== undefined) return customTTL;

    switch (type) {
      case 'master-list':
        return this.config.masterListTTL;
      case 'quote':
      case 'calculation':
        return this.config.quoteTTL;
      case 'price-list':
        return this.config.priceListTTL;
      default:
        return this.config.defaultTTL;
    }
  }

  /**
   * Verifica se entry è scaduta
   */
  private isExpired(entry: CacheEntry<unknown>, ttl: number): boolean {
    return Date.now() - entry.timestamp > ttl;
  }

  /**
   * Pulisce entries scadute (lazy cleanup)
   */
  private cleanupExpired(): void {
    for (const [key, entry] of this.cache.entries()) {
      const ttl = this.getTTL(entry.type);
      if (this.isExpired(entry, ttl)) {
        this.cache.delete(key);
        this.log('debug', `Cleanup expired: ${key}`);
      }
    }
  }

  /**
   * Evict entries se cache è piena (LRU-like)
   */
  private evictIfNeeded(): void {
    if (this.cache.size >= this.config.maxEntries) {
      // Rimuovi 10% delle entries più vecchie
      const toRemove = Math.ceil(this.config.maxEntries * 0.1);
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      );

      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
        this.log('debug', `Evicted: ${entries[i][0]}`);
      }
    }
  }

  /**
   * Log condizionale
   */
  private log(level: 'debug' | 'info' | 'warn', message: string, data?: unknown): void {
    if (this.config.debug || level !== 'debug') {
      const prefix = `[PRICING_CACHE]`;
      if (level === 'warn') {
        console.warn(`⚠️ ${prefix} ${message}`, data || '');
      } else {
        console.log(`${prefix} ${message}`, data || '');
      }
    }
  }

  // ==================== PUBLIC API ====================

  /**
   * Cleanup periodico per evitare memory leak (chiamato anche in get)
   */
  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanupExpired();
      this.lastCleanup = now;
    }
  }

  /**
   * Recupera valore dalla cache
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    // Cleanup periodico per evitare memory leak su read-heavy workload
    this.maybeCleanup();

    const fullKey = this.buildKey(key, options.workspaceId);
    const entry = this.cache.get(fullKey) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      this.log('debug', `Miss: ${fullKey}`);
      return null;
    }

    const ttl = this.getTTL(options.type || entry.type, options.ttl);
    if (this.isExpired(entry, ttl)) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      this.log('debug', `Expired: ${fullKey}`);
      return null;
    }

    this.stats.hits++;
    this.log('debug', `Hit: ${fullKey}`);
    return entry.data;
  }

  /**
   * Salva valore in cache
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    this.cleanupExpired();
    this.evictIfNeeded();

    const fullKey = this.buildKey(key, options.workspaceId);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      type: options.type || 'calculation',
      workspaceId: options.workspaceId,
      metadata: options.metadata,
    };

    this.cache.set(fullKey, entry);
    this.log('debug', `Set: ${fullKey} (TTL: ${this.getTTL(entry.type, options.ttl)}ms)`);
  }

  /**
   * Verifica se chiave esiste e non è scaduta
   */
  has(key: string, options: CacheOptions = {}): boolean {
    const fullKey = this.buildKey(key, options.workspaceId);
    const entry = this.cache.get(fullKey);

    if (!entry) return false;

    const ttl = this.getTTL(options.type || entry.type, options.ttl);
    return !this.isExpired(entry, ttl);
  }

  /**
   * Elimina entry specifica
   */
  delete(key: string, options: Pick<CacheOptions, 'workspaceId'> = {}): boolean {
    const fullKey = this.buildKey(key, options.workspaceId);
    return this.cache.delete(fullKey);
  }

  /**
   * Invalida entries secondo criteri
   */
  invalidate(options: InvalidationOptions): number {
    let invalidated = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      let shouldInvalidate = false;

      if (options.workspaceId && entry.workspaceId === options.workspaceId) {
        shouldInvalidate = true;
      }

      if (options.type && entry.type === options.type) {
        shouldInvalidate = true;
      }

      if (options.keyPattern && key.startsWith(options.keyPattern)) {
        shouldInvalidate = true;
      }

      if (options.olderThan && now - entry.timestamp > options.olderThan) {
        shouldInvalidate = true;
      }

      if (shouldInvalidate) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.log('info', `Invalidated ${invalidated} entries`, options);
    return invalidated;
  }

  /**
   * Invalida tutte le entries di un workspace
   */
  invalidateWorkspace(workspaceId: string): number {
    return this.invalidate({ workspaceId });
  }

  /**
   * Invalida entries di un tipo specifico
   */
  invalidateType(type: CacheType): number {
    return this.invalidate({ type });
  }

  /**
   * Pulisce tutta la cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    this.log('info', 'Cache cleared');
  }

  /**
   * Restituisce statistiche cache
   */
  getStats(): CacheStats {
    const byType: Record<CacheType, number> = {
      'master-list': 0,
      quote: 0,
      'price-list': 0,
      calculation: 0,
    };
    const byWorkspace: Record<string, number> = {};

    for (const entry of this.cache.values()) {
      byType[entry.type]++;
      const ws = entry.workspaceId || '_global';
      byWorkspace[ws] = (byWorkspace[ws] || 0) + 1;
    }

    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? Math.round((this.stats.hits / total) * 100) / 100 : 0,
      byType,
      byWorkspace,
    };
  }

  /**
   * Restituisce dimensione cache
   */
  get size(): number {
    return this.cache.size;
  }
}

// ==================== SINGLETON & FACTORY ====================

let defaultInstance: PricingCache | null = null;

/**
 * Factory function per creare nuova istanza cache
 */
export function createPricingCache(config?: PricingCacheConfig): PricingCache {
  return new PricingCache(config);
}

/**
 * Restituisce istanza singleton (per uso globale)
 */
export function getPricingCache(): PricingCache {
  if (!defaultInstance) {
    // Configura da environment variables
    defaultInstance = new PricingCache({
      defaultTTL: parseInt(process.env.PRICING_CACHE_DEFAULT_TTL || '30000', 10),
      masterListTTL: parseInt(process.env.PRICING_CACHE_MASTER_TTL || '30000', 10),
      quoteTTL: parseInt(process.env.PRICING_CACHE_QUOTE_TTL || '300000', 10),
      priceListTTL: parseInt(process.env.PRICING_CACHE_PRICELIST_TTL || '60000', 10),
      maxEntries: parseInt(process.env.PRICING_CACHE_MAX_ENTRIES || '1000', 10),
      debug: process.env.PRICING_CACHE_DEBUG === 'true',
    });
  }
  return defaultInstance;
}

/**
 * Reset singleton (per testing)
 */
export function __resetPricingCache(): void {
  defaultInstance = null;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Helper per caching master lists con workspace scoping
 */
export async function withMasterListCache<T>(
  cache: PricingCache,
  masterListId: string,
  workspaceId: string | undefined,
  fetchFn: () => Promise<T>
): Promise<T | null> {
  const cached = cache.get<T>(masterListId, {
    workspaceId,
    type: 'master-list',
  });

  if (cached !== null) {
    return cached;
  }

  try {
    const data = await fetchFn();
    if (data !== null) {
      cache.set(masterListId, data, {
        workspaceId,
        type: 'master-list',
      });
    }
    return data;
  } catch (error) {
    console.error(`[PRICING_CACHE] Error fetching master list ${masterListId}:`, error);
    return null;
  }
}

/**
 * Helper per caching quote calculations
 */
export function buildQuoteCacheKey(params: {
  userId: string;
  workspaceId: string;
  weight: number;
  zip?: string;
  province?: string;
  courierId?: string;
  serviceType?: string;
  priceListId?: string;
}): string {
  return [
    params.userId,
    params.weight.toFixed(2),
    params.zip || '',
    params.province || '',
    params.courierId || '',
    params.serviceType || '',
    params.priceListId || '',
  ].join(':');
}
