/**
 * Route API per verificare lo stato dell'applicazione
 * Utile per monitoring e health checks
 *
 * Endpoint: GET /api/health
 *
 * Validates:
 * - Database connectivity
 */
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { getRedis } from '@/lib/db/redis';
import { getAllCircuitStates } from '@/lib/resilience/resilient-provider';

export async function GET() {
  const healthStatus: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: {
      type: 'unknown',
      configured: false,
      working: false,
      message: '',
    },
  };

  // Verifica configurazione Supabase
  const supabaseConfigured = isSupabaseConfigured();

  if (supabaseConfigured) {
    healthStatus.database.type = 'supabase';
    healthStatus.database.configured = true;

    // Test connessione Supabase
    try {
      const { error } = await supabaseAdmin.from('shipments').select('id').limit(1);

      if (error) {
        healthStatus.database.working = false;
        healthStatus.database.message = `Supabase configurato ma errore connessione: ${error.message}`;
        healthStatus.status = 'degraded';
      } else {
        healthStatus.database.working = true;
        healthStatus.database.message = 'Supabase configurato e funzionante';
      }
    } catch (error: any) {
      healthStatus.database.working = false;
      healthStatus.database.message = `Errore test Supabase: ${error.message}`;
      healthStatus.status = 'degraded';
    }
  } else {
    healthStatus.database.type = 'json';
    healthStatus.database.configured = false;
    healthStatus.database.working = true; // JSON locale sempre disponibile
    healthStatus.database.message = 'Supabase non configurato, uso database JSON locale';
  }

  // Check Redis
  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      healthStatus.redis = { working: true, message: 'Redis connesso' };
    } catch (error: any) {
      healthStatus.redis = { working: false, message: error.message };
      healthStatus.status = 'degraded';
    }
  } else {
    healthStatus.redis = { working: false, message: 'Redis non configurato' };
  }

  // Circuit breaker states
  try {
    healthStatus.circuitBreakers = await getAllCircuitStates();
  } catch {
    healthStatus.circuitBreakers = {};
  }

  // Uptime e versione
  healthStatus.uptime = process.uptime();
  healthStatus.version = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev';

  const statusCode = healthStatus.status === 'ok' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}
