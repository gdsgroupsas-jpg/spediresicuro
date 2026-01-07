/**
 * Pricing Service
 * 
 * Servizio centralizzato per tutte le operazioni di pricing.
 * Astrae la complessità di listini, margini e calcoli prezzi.
 * 
 * @module lib/services/pricing/pricing-service
 * @since Sprint 3 - Refactoring
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { calculatePriceWithRules, getApplicablePriceList } from '@/lib/db/price-lists-advanced'
import type { PriceCalculationResult, PriceList } from '@/types/listini'
import type { CourierServiceType } from '@/types/shipments'

export interface QuoteParams {
  weight: number
  volume?: number
  destination: {
    zip?: string
    province?: string
    region?: string
    country?: string
  }
  courierId?: string
  serviceType?: CourierServiceType
  options?: {
    declaredValue?: number
    cashOnDelivery?: boolean
    insurance?: boolean
  }
}

export interface QuoteResult extends PriceCalculationResult {
  applicablePriceListId?: string
  applicablePriceListName?: string
  marginPercent?: number
}

export interface PricingServiceOptions {
  cacheEnabled?: boolean
  cacheTTLSeconds?: number
}

/**
 * Servizio centralizzato per pricing
 */
export class PricingService {
  private cache: Map<string, { result: QuoteResult; expiry: number }> = new Map()
  private options: PricingServiceOptions
  
  constructor(
    private supabase: SupabaseClient,
    options: PricingServiceOptions = {}
  ) {
    this.options = {
      cacheEnabled: options.cacheEnabled ?? true,
      cacheTTLSeconds: options.cacheTTLSeconds ?? 300, // 5 minuti default
    }
  }
  
  /**
   * Calcola preventivo per un utente
   */
  async calculateQuote(
    userId: string,
    params: QuoteParams,
    priceListId?: string
  ): Promise<QuoteResult | null> {
    // Check cache
    const cacheKey = this.buildCacheKey(userId, params, priceListId)
    if (this.options.cacheEnabled) {
      const cached = this.cache.get(cacheKey)
      if (cached && cached.expiry > Date.now()) {
        return cached.result
      }
    }
    
    try {
      const result = await calculatePriceWithRules(userId, params, priceListId)
      
      if (!result) return null
      
      // Arricchisci con info listino
      const enrichedResult: QuoteResult = {
        ...result,
        applicablePriceListId: priceListId,
      }
      
      // Cache result
      if (this.options.cacheEnabled) {
        this.cache.set(cacheKey, {
          result: enrichedResult,
          expiry: Date.now() + (this.options.cacheTTLSeconds! * 1000),
        })
      }
      
      return enrichedResult
    } catch (error) {
      console.error('[PRICING_SERVICE] Quote calculation error:', error)
      return null
    }
  }
  
  /**
   * Ottiene il listino applicabile per un utente
   */
  async getApplicablePriceList(
    userId: string,
    courierCode?: string
  ): Promise<PriceList | null> {
    try {
      return await getApplicablePriceList(userId, courierCode)
    } catch (error) {
      console.error('[PRICING_SERVICE] Get price list error:', error)
      return null
    }
  }
  
  /**
   * Calcola margine tra prezzo vendita e costo
   */
  calculateMargin(
    sellingPrice: number,
    costPrice: number
  ): { amount: number; percent: number } {
    const amount = sellingPrice - costPrice
    const percent = costPrice > 0 
      ? Math.round((amount / costPrice) * 100 * 100) / 100 
      : 0
    
    return { amount, percent }
  }
  
  /**
   * Applica margine percentuale a un costo base
   */
  applyMargin(baseCost: number, marginPercent: number): number {
    return Math.round((baseCost * (1 + marginPercent / 100)) * 100) / 100
  }
  
  /**
   * Calcola prezzo con sconto
   */
  applyDiscount(price: number, discountPercent: number): number {
    return Math.round((price * (1 - discountPercent / 100)) * 100) / 100
  }
  
  /**
   * Invalida cache per un utente
   */
  invalidateCacheForUser(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key)
      }
    }
  }
  
  /**
   * Pulisce tutta la cache
   */
  clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * Costruisce chiave cache
   */
  private buildCacheKey(userId: string, params: QuoteParams, priceListId?: string): string {
    return `${userId}:${params.weight}:${params.destination.zip || ''}:${params.courierId || ''}:${params.serviceType || ''}:${priceListId || ''}`
  }
}

// Singleton instance
let pricingServiceInstance: PricingService | null = null

/**
 * Factory function con singleton pattern
 */
export function getPricingService(supabase: SupabaseClient): PricingService {
  if (!pricingServiceInstance) {
    pricingServiceInstance = new PricingService(supabase)
  }
  return pricingServiceInstance
}

/**
 * Factory function per creare nuova istanza
 */
export function createPricingService(
  supabase: SupabaseClient,
  options?: PricingServiceOptions
): PricingService {
  return new PricingService(supabase, options)
}
