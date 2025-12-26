/**
 * Rate Limiting Distribuito - Upstash Redis
 * 
 * Sostituisce il rate limiting in-memory con una soluzione distribuita.
 * Supporta fallback in-memory per development/test senza Redis configurato.
 * 
 * ENV VARS:
 * - UPSTASH_REDIS_REST_URL: URL REST di Upstash Redis
 * - UPSTASH_REDIS_REST_TOKEN: Token di autenticazione
 * - RATE_LIMIT_MAX: Max richieste per finestra (default: 20)
 * - RATE_LIMIT_WINDOW_SECONDS: Finestra in secondi (default: 60)
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import crypto from 'crypto';

// ====== CONFIGURAZIONE ======
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const RATE_LIMIT_WINDOW_SECONDS = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10);

// ====== REDIS CLIENT (lazy init) ======
let redisClient: Redis | null = null;
let rateLimiter: Ratelimit | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    // ⚠️ SEC-1: NO log di token/url
    console.warn('⚠️ [RATE-LIMIT] Upstash Redis non configurato - usando fallback in-memory');
    return null;
  }
  
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    console.error('❌ [RATE-LIMIT] Errore inizializzazione Redis');
    return null;
  }
}

function getRateLimiter(): Ratelimit | null {
  if (rateLimiter) return rateLimiter;
  
  const redis = getRedisClient();
  if (!redis) return null;
  
  try {
    rateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, `${RATE_LIMIT_WINDOW_SECONDS} s`),
      analytics: true,
      prefix: 'spediresicuro:ratelimit',
    });
    return rateLimiter;
  } catch (error) {
    console.error('❌ [RATE-LIMIT] Errore creazione rate limiter');
    return null;
  }
}

// ====== FALLBACK IN-MEMORY (per dev/test) ======
const inMemoryRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitInMemory(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  const entry = inMemoryRateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    inMemoryRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ====== UTILITY ======

/**
 * Genera chiave rate limit: userHash + route
 * ⚠️ SEC-1: NO userId in chiaro - usiamo hash
 */
export function generateRateLimitKey(userId: string, route: string): string {
  const userHash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
  return `${userHash}:${route}`;
}

// ====== API PRINCIPALE ======

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetInSeconds?: number;
}

/**
 * Verifica rate limit per un utente su una route specifica.
 * Usa Redis distribuito se configurato, altrimenti fallback in-memory.
 * 
 * @param userId - ID utente (verrà hashato)
 * @param route - Nome route (es. 'agent-chat')
 * @returns Risultato rate limit
 */
export async function checkRateLimit(userId: string, route: string): Promise<RateLimitResult> {
  const key = generateRateLimitKey(userId, route);
  
  // Prova Redis distribuito
  const limiter = getRateLimiter();
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        limit: result.limit,
        resetInSeconds: Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch (error) {
      console.error('❌ [RATE-LIMIT] Errore Redis, fallback in-memory');
      // Fallback in-memory se Redis fallisce
    }
  }
  
  // Fallback in-memory
  const inMemoryResult = checkRateLimitInMemory(key);
  return {
    allowed: inMemoryResult.allowed,
    remaining: inMemoryResult.remaining,
    limit: RATE_LIMIT_MAX,
  };
}

/**
 * Reset rate limit per testing.
 * ⚠️ SOLO PER TEST - non usare in produzione
 */
export function resetRateLimitForTesting(): void {
  inMemoryRateLimitMap.clear();
}

/**
 * Verifica se Redis è configurato e connesso.
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// ====== EXPORT ======
export const rateLimit = {
  check: checkRateLimit,
  generateKey: generateRateLimitKey,
  reset: resetRateLimitForTesting,
  isRedisConfigured,
  config: {
    max: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
};

export default rateLimit;

