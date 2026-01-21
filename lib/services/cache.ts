/**
 * Agent Cache Service
 *
 * Cache in-memory per risultati RAG e pricing calculations.
 * Riduce query duplicate e migliora performance.
 *
 * P3 Task 6: Performance Optimization - Query & Caching
 */

// ==================== TIPI ====================

interface CachedItem<T> {
  result: T;
  expires: number;
}

// ==================== CACHE SERVICE ====================

export class AgentCache {
  private ragCache = new Map<string, CachedItem<any>>();
  private pricingCache = new Map<string, CachedItem<any[]>>();
  private readonly RAG_TTL_MS = 60 * 60 * 1000; // 1 ora
  private readonly PRICING_TTL_MS = 5 * 60 * 1000; // 5 minuti

  /**
   * Pulisce cache scaduta (chiamare periodicamente).
   */
  private cleanExpiredCache(): void {
    const now = Date.now();

    // Pulisci RAG cache
    for (const [key, cached] of this.ragCache.entries()) {
      if (cached.expires < now) {
        this.ragCache.delete(key);
      }
    }

    // Pulisci pricing cache
    for (const [key, cached] of this.pricingCache.entries()) {
      if (cached.expires < now) {
        this.pricingCache.delete(key);
      }
    }
  }

  /**
   * Genera cache key per RAG query.
   */
  private getRAGCacheKey(query: string, context?: string): string {
    return `rag:${query}:${context || ''}`;
  }

  /**
   * Genera cache key per pricing calculation.
   */
  private getPricingCacheKey(params: {
    weight: number;
    destinationZip: string;
    destinationProvince: string;
    serviceType?: string;
    cashOnDelivery?: number;
    declaredValue?: number;
  }): string {
    return `pricing:${params.weight}:${params.destinationZip}:${params.destinationProvince}:${params.serviceType || 'standard'}:${params.cashOnDelivery || 0}:${params.declaredValue || 0}`;
  }

  /**
   * Recupera risultato RAG dalla cache.
   */
  getRAG(query: string, context?: string): any | null {
    this.cleanExpiredCache();

    const key = this.getRAGCacheKey(query, context);
    const cached = this.ragCache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    return null;
  }

  /**
   * Salva risultato RAG in cache.
   */
  setRAG(query: string, result: any, context?: string, ttl?: number): void {
    const key = this.getRAGCacheKey(query, context);
    this.ragCache.set(key, {
      result,
      expires: Date.now() + (ttl || this.RAG_TTL_MS),
    });
  }

  /**
   * Recupera risultato pricing dalla cache.
   */
  getPricing(params: {
    weight: number;
    destinationZip: string;
    destinationProvince: string;
    serviceType?: string;
    cashOnDelivery?: number;
    declaredValue?: number;
  }): any[] | null {
    this.cleanExpiredCache();

    const key = this.getPricingCacheKey(params);
    const cached = this.pricingCache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }

    return null;
  }

  /**
   * Salva risultato pricing in cache.
   */
  setPricing(
    params: {
      weight: number;
      destinationZip: string;
      destinationProvince: string;
      serviceType?: string;
      cashOnDelivery?: number;
      declaredValue?: number;
    },
    result: any[],
    ttl?: number
  ): void {
    const key = this.getPricingCacheKey(params);
    this.pricingCache.set(key, {
      result,
      expires: Date.now() + (ttl || this.PRICING_TTL_MS),
    });
  }

  /**
   * Invalida cache RAG per una query specifica.
   */
  invalidateRAG(query: string, context?: string): void {
    const key = this.getRAGCacheKey(query, context);
    this.ragCache.delete(key);
  }

  /**
   * Invalida cache pricing per parametri specifici.
   */
  invalidatePricing(params: {
    weight: number;
    destinationZip: string;
    destinationProvince: string;
    serviceType?: string;
    cashOnDelivery?: number;
    declaredValue?: number;
  }): void {
    const key = this.getPricingCacheKey(params);
    this.pricingCache.delete(key);
  }

  /**
   * Pulisce tutta la cache.
   */
  clear(): void {
    this.ragCache.clear();
    this.pricingCache.clear();
  }

  /**
   * Statistiche cache (per monitoring).
   */
  getStats(): {
    ragSize: number;
    pricingSize: number;
    ragHitRate?: number; // Richiede tracking hits/misses
    pricingHitRate?: number;
  } {
    this.cleanExpiredCache();
    return {
      ragSize: this.ragCache.size,
      pricingSize: this.pricingCache.size,
    };
  }
}

// ==================== SINGLETON ====================

/**
 * Istanza singleton del cache service (riutilizzabile).
 */
export const agentCache = new AgentCache();
