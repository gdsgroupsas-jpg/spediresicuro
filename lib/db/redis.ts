/**
 * Centralized Redis Client
 *
 * Single source of truth per la connessione Redis.
 * Supporta Upstash Redis (HTTP based) per edge compatibility.
 */

import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
let redisInitAttempted = false;

export function getRedis(): Redis | null {
  if (redis) return redis;
  if (redisInitAttempted) return null; // Evita retry continui

  redisInitAttempted = true;

  // Supporta sia UPSTASH_* che KV_* (Vercel Marketplace)
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn(
      "⚠️ [REDIS] Configurazione mancante - funzionalità distribuite disabilitate"
    );
    return null;
  }

  try {
    redis = new Redis({ url, token });
    // Quick ping/connection check optional here, but we keep it lazy
    return redis;
  } catch (error) {
    console.error("❌ [REDIS] Errore inizializzazione:", error);
    return null;
  }
}
