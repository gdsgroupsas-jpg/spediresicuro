/**
 * Rate Limiting Distribuito - Upstash Redis
 * 
 * Implementa rate limiting distribuito per ambienti multi-instance (Vercel).
 * 
 * ARCHITETTURA:
 * 1. Prova Redis distribuito (Upstash) - condiviso tra tutte le istanze
 * 2. Se Redis non disponibile o fallisce → fallback in-memory (per-instance)
 * 3. Se anche fallback fallisce → ALLOW (fail-open per non bloccare utenti)
 * 
 * FALLBACK STRATEGY (SAFE):
 * - Redis down → usa in-memory (degraded ma funzionante)
 * - Errore critico → ALLOW request (mai bloccare per errori interni)
 * - Questo garantisce che un problema Redis non blocchi l'intera app
 * 
 * ENV VARS (supporta sia Upstash diretto che Vercel Marketplace):
 * - UPSTASH_REDIS_REST_URL o KV_REST_API_URL
 * - UPSTASH_REDIS_REST_TOKEN o KV_REST_API_TOKEN
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
let redisInitFailed = false; // Evita retry continui se init fallisce

/**
 * Ottiene URL e Token Redis dalle ENV.
 * Supporta sia naming Upstash diretto che Vercel Marketplace (KV_*).
 */
function getRedisCredentials(): { url: string; token: string } | null {
  // Prima prova Upstash diretto
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (upstashUrl && upstashToken) {
    return { url: upstashUrl, token: upstashToken };
  }
  
  // Fallback a Vercel Marketplace naming (KV_*)
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  
  if (kvUrl && kvToken) {
    return { url: kvUrl, token: kvToken };
  }
  
  return null;
}

function getRedisClient(): Redis | null {
  // Se init è già fallita, non riprovare (evita log spam)
  if (redisInitFailed) return null;
  if (redisClient) return redisClient;
  
  const credentials = getRedisCredentials();
  
  if (!credentials) {
    // Log solo una volta
    console.warn('⚠️ [RATE-LIMIT] Redis non configurato - usando fallback in-memory');
    redisInitFailed = true;
    return null;
  }
  
  try {
    redisClient = new Redis({ 
      url: credentials.url, 
      token: credentials.token,
      // Timeout breve per non bloccare requests
      retry: { retries: 1, backoff: () => 100 },
    });
    console.log('✅ [RATE-LIMIT] Redis client inizializzato');
    return redisClient;
  } catch (error) {
    console.error('❌ [RATE-LIMIT] Errore inizializzazione Redis - fallback in-memory');
    redisInitFailed = true;
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
      analytics: false, // Disabilita analytics per performance
      prefix: 'spediresicuro:rl',
      // Timeout per singola operazione
      timeout: 1000, // 1s max
    });
    return rateLimiter;
  } catch (error) {
    console.error('❌ [RATE-LIMIT] Errore creazione rate limiter');
    return null;
  }
}

// ====== FALLBACK IN-MEMORY (per dev/test o Redis down) ======
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
 * Formato: {sha256(userId)[0:16]}:{route}
 * 
 * ⚠️ SEC-1: NO userId in chiaro - usiamo hash per privacy
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
  source: 'redis' | 'memory' | 'error';
}

/**
 * Verifica rate limit per un utente su una route specifica.
 * 
 * STRATEGIA FALLBACK (fail-open):
 * 1. Redis disponibile → usa Redis (distribuito, multi-instance)
 * 2. Redis non disponibile → usa in-memory (per-instance, degraded)
 * 3. Errore critico → ALLOW (mai bloccare per errori interni)
 * 
 * @param userId - ID utente (verrà hashato per privacy)
 * @param route - Nome route (es. 'agent-chat')
 * @returns Risultato rate limit con source indicator
 */
export async function checkRateLimit(userId: string, route: string): Promise<RateLimitResult> {
  const key = generateRateLimitKey(userId, route);
  
  // 1. Prova Redis distribuito
  const limiter = getRateLimiter();
  if (limiter) {
    try {
      const result = await limiter.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        limit: result.limit,
        resetInSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
        source: 'redis',
      };
    } catch (error) {
      // Redis fallito durante operazione - fallback a in-memory
      console.warn('⚠️ [RATE-LIMIT] Redis error, fallback in-memory');
    }
  }
  
  // 2. Fallback in-memory
  try {
    const inMemoryResult = checkRateLimitInMemory(key);
    return {
      allowed: inMemoryResult.allowed,
      remaining: inMemoryResult.remaining,
      limit: RATE_LIMIT_MAX,
      source: 'memory',
    };
  } catch (error) {
    // 3. Errore critico - ALLOW (fail-open, mai bloccare per errori interni)
    console.error('❌ [RATE-LIMIT] Errore critico, allowing request (fail-open)');
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX,
      limit: RATE_LIMIT_MAX,
      source: 'error',
    };
  }
}

/**
 * Reset rate limit per testing.
 * ⚠️ SOLO PER TEST - non usare in produzione
 */
export function resetRateLimitForTesting(): void {
  inMemoryRateLimitMap.clear();
}

/**
 * Verifica se Redis è configurato (non necessariamente connesso).
 */
export function isRedisConfigured(): boolean {
  return getRedisCredentials() !== null;
}

/**
 * Reset dello stato del client (per test)
 * ⚠️ SOLO PER TEST
 */
export function resetClientForTesting(): void {
  redisClient = null;
  rateLimiter = null;
  redisInitFailed = false;
  inMemoryRateLimitMap.clear();
}

// ====== EXPORT ======
export const rateLimit = {
  check: checkRateLimit,
  generateKey: generateRateLimitKey,
  reset: resetRateLimitForTesting,
  resetClient: resetClientForTesting,
  isRedisConfigured,
  config: {
    max: RATE_LIMIT_MAX,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  },
};

export default rateLimit;
