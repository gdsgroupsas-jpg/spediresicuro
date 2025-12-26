/**
 * Endpoint di test per verificare connessione Upstash Redis
 * 
 * GET /api/test-redis - Verifica connessione e legge un valore
 * POST /api/test-redis - Scrive un valore di test
 * 
 * ⚠️ SOLO PER DEBUG - Rimuovere in produzione
 */

import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Initialize Redis from environment variables
// Requires: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
function getRedisClient(): Redis | null {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null;
    }
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

export async function GET() {
  const redis = getRedisClient();
  
  if (!redis) {
    return NextResponse.json({
      success: false,
      error: 'Redis not configured',
      hint: 'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
    }, { status: 503 });
  }

  try {
    // Test connection with a simple ping
    const pingResult = await redis.ping();
    
    // Read test value
    const testValue = await redis.get('spediresicuro:test');
    
    return NextResponse.json({
      success: true,
      ping: pingResult,
      testValue: testValue ?? 'not set',
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST() {
  const redis = getRedisClient();
  
  if (!redis) {
    return NextResponse.json({
      success: false,
      error: 'Redis not configured',
    }, { status: 503 });
  }

  try {
    // Write test value with 60s TTL
    const testValue = `test-${Date.now()}`;
    await redis.set('spediresicuro:test', testValue, { ex: 60 });
    
    return NextResponse.json({
      success: true,
      message: 'Test value written',
      value: testValue,
      expiresIn: '60 seconds',
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

