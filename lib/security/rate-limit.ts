/**
 * Rate Limiting Distribuito - Upstash Redis
 *
 * Implementa rate limiting con sliding window bucket usando Redis INCR + EXPIRE.
 *
 * STRATEGIA:
 * - Key: "rl:{route}:{userHash}:{windowBucket}"
 * - windowBucket = floor(timestamp / windowSeconds) per raggruppare richieste
 * - INCR atomico + EXPIRE per TTL automatico
 * - Fallback in-memory se Redis non disponibile (SAFE: mai bloccare per errori)
 *
 * ENV VARS (supporta Upstash diretto e Vercel Marketplace):
 * - UPSTASH_REDIS_REST_URL o KV_REST_API_URL
 * - UPSTASH_REDIS_REST_TOKEN o KV_REST_API_TOKEN
 */

import { Redis } from "@upstash/redis";
import crypto from "crypto";

// ====== CONFIGURAZIONE ======
const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_SECONDS = 60;
const REDIS_TIMEOUT_MS = 1000; // 1s timeout per non rallentare la route

// ====== REDIS CLIENT (lazy init) ======
// ====== REDIS CLIENT (lazy init) ======
import { getRedis as getSharedRedis } from "@/lib/db/redis";

// Local variable to allow mocking during tests
let redisOverride: Redis | null = null;

function getRedis(): Redis | null {
  if (redisOverride) return redisOverride;
  return getSharedRedis();
}

// Deprecated in favor of shared client, keeping for interface compatibility
let redisInitAttempted = false;

// ====== FALLBACK IN-MEMORY ======
const inMemoryStore = new Map<string, { count: number; expiresAt: number }>();

function rateLimitInMemory(
  key: string,
  limit: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = inMemoryStore.get(key);

  // Pulisci entry scadute
  if (entry && now >= entry.expiresAt) {
    inMemoryStore.delete(key);
  }

  const current = inMemoryStore.get(key);
  const resetAt = now + windowSeconds * 1000;

  if (!current) {
    inMemoryStore.set(key, { count: 1, expiresAt: resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.expiresAt };
  }

  current.count++;
  return {
    allowed: true,
    remaining: limit - current.count,
    resetAt: current.expiresAt,
  };
}

// ====== UTILITY ======

/**
 * Genera hash dell'userId per privacy (no PII in Redis keys)
 */
export function hashUserId(userId: string): string {
  return crypto
    .createHash("sha256")
    .update(userId)
    .digest("hex")
    .substring(0, 12);
}

/**
 * Genera window bucket per raggruppare richieste nella stessa finestra
 * @param windowSeconds - Dimensione finestra in secondi
 * @param nowMs - Timestamp corrente (per testing)
 */
export function getWindowBucket(
  windowSeconds: number,
  nowMs: number = Date.now()
): number {
  return Math.floor(nowMs / 1000 / windowSeconds);
}

/**
 * Genera chiave rate limit completa
 * Formato: rl:{route}:{userHash}:{windowBucket}
 */
export function generateKey(
  route: string,
  userId: string,
  windowSeconds: number,
  nowMs: number = Date.now()
): string {
  const userHash = hashUserId(userId);
  const bucket = getWindowBucket(windowSeconds, nowMs);
  return `rl:${route}:${userHash}:${bucket}`;
}

// ====== API PRINCIPALE ======

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  source: "redis" | "memory" | "error";
}

export interface RateLimitOptions {
  limit?: number;
  windowSeconds?: number;
  nowMs?: number; // Per testing deterministico
}

/**
 * Verifica rate limit per un utente su una route.
 *
 * Usa Redis INCR + EXPIRE per conteggio atomico distribuito.
 * Fallback in-memory se Redis non disponibile.
 * Fail-open se errore critico (mai bloccare per errori interni).
 *
 * @param route - Nome route (es. 'agent-chat')
 * @param userId - ID utente (verrà hashato)
 * @param options - Opzioni: limit, windowSeconds, nowMs
 */
export async function rateLimit(
  route: string,
  userId: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
  const nowMs = options.nowMs ?? Date.now();

  const key = generateKey(route, userId, windowSeconds, nowMs);
  const resetAt =
    (getWindowBucket(windowSeconds, nowMs) + 1) * windowSeconds * 1000;

  // 1. Prova Redis
  const redisClient = getRedis();
  if (redisClient) {
    try {
      // Timeout wrapper per non bloccare la route
      const result = await Promise.race([
        executeRedisRateLimit(redisClient, key, limit, windowSeconds),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Redis timeout")), REDIS_TIMEOUT_MS)
        ),
      ]);

      if (result) {
        return { ...result, resetAt, source: "redis" };
      }
    } catch (error) {
      console.warn("⚠️ [RATE-LIMIT] Redis error, fallback in-memory");
    }
  }

  // 2. Fallback in-memory
  try {
    const memResult = rateLimitInMemory(key, limit, windowSeconds);
    return { ...memResult, source: "memory" };
  } catch (error) {
    // 3. Errore critico - ALLOW (fail-open)
    console.error("❌ [RATE-LIMIT] Errore critico, allowing request");
    return {
      allowed: true,
      remaining: limit,
      resetAt,
      source: "error",
    };
  }
}

/**
 * Esegue rate limiting su Redis con INCR + EXPIRE
 */
async function executeRedisRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  // INCR atomico
  const count = await redis.incr(key);

  // Se è il primo incremento, imposta TTL
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  return { allowed, remaining };
}

// ====== TESTING UTILITIES ======

/**
 * Reset per testing (⚠️ SOLO TEST)
 */
export function resetForTesting(): void {
  inMemoryStore.clear();
  redisOverride = null;
}

/**
 * Inject mock Redis per testing (⚠️ SOLO TEST)
 */
export function setMockRedis(mockRedis: Redis | null): void {
  redisOverride = mockRedis;
}

// ====== EXPORT ======
export default {
  rateLimit,
  generateKey,
  hashUserId,
  getWindowBucket,
  resetForTesting,
  setMockRedis,
};
