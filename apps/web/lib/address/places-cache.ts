/**
 * Places Cache Layer
 *
 * Cache Redis per risultati Google Places autocomplete e details.
 * Riduce chiamate API e costi. Graceful degradation se Redis non disponibile.
 *
 * TTL:
 * - Autocomplete: 24h (indirizzi cambiano raramente)
 * - Place Details: 7 giorni (dati strutturati stabili)
 */

import { getRedis } from '@/lib/db/redis';
import type { PlacesAutocompleteResult, PlaceDetails } from '@/lib/adapters/google-places/base';

// ==================== CONFIG ====================

const AUTOCOMPLETE_TTL = 60 * 60 * 24; // 24 ore
const DETAILS_TTL = 60 * 60 * 24 * 7; // 7 giorni

const PREFIX = {
  autocomplete: 'places:ac:',
  details: 'places:det:',
};

// ==================== HASH ====================

/**
 * Hash semplice per chiave cache (non crypto, solo dedup)
 */
function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ==================== AUTOCOMPLETE CACHE ====================

/**
 * Recupera risultati autocomplete dalla cache
 */
export async function getCachedAutocomplete(
  input: string
): Promise<PlacesAutocompleteResult[] | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const key = `${PREFIX.autocomplete}${hashKey(input.toLowerCase().trim())}`;
    const cached = await redis.get<PlacesAutocompleteResult[]>(key);
    return cached || null;
  } catch (error) {
    console.warn('[PlacesCache] Errore lettura autocomplete cache:', error);
    return null;
  }
}

/**
 * Salva risultati autocomplete in cache
 */
export async function setCachedAutocomplete(
  input: string,
  results: PlacesAutocompleteResult[]
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = `${PREFIX.autocomplete}${hashKey(input.toLowerCase().trim())}`;
    await redis.setex(key, AUTOCOMPLETE_TTL, JSON.stringify(results));
  } catch (error) {
    console.warn('[PlacesCache] Errore scrittura autocomplete cache:', error);
  }
}

// ==================== DETAILS CACHE ====================

/**
 * Recupera dettagli place dalla cache
 */
export async function getCachedPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const key = `${PREFIX.details}${placeId}`;
    const cached = await redis.get<PlaceDetails>(key);
    return cached || null;
  } catch (error) {
    console.warn('[PlacesCache] Errore lettura details cache:', error);
    return null;
  }
}

/**
 * Salva dettagli place in cache
 */
export async function setCachedPlaceDetails(placeId: string, details: PlaceDetails): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const key = `${PREFIX.details}${placeId}`;
    await redis.setex(key, DETAILS_TTL, JSON.stringify(details));
  } catch (error) {
    console.warn('[PlacesCache] Errore scrittura details cache:', error);
  }
}
