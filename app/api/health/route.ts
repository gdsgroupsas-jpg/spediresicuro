/**
 * Route API per verificare lo stato dell'applicazione
 * Utile per monitoring e health checks
 *
 * Endpoint: GET /api/health
 *
 * Validates:
 * - Database connectivity
 * - Feature flags configuration
 * - API key authentication setup (if enabled)
 */
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';
import { FeatureFlags, validateFeatureFlags } from '@/lib/feature-flags';

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
    features: {
      apiKeyAuth: {
        enabled: FeatureFlags.API_KEY_AUTH,
        shadowMode: FeatureFlags.API_KEY_SHADOW_MODE,
        configured: true,
        errors: [] as string[],
      },
    },
  };

  // Validate feature flags configuration
  if (FeatureFlags.API_KEY_AUTH) {
    const validation = validateFeatureFlags();
    healthStatus.features.apiKeyAuth.configured = validation.valid;
    healthStatus.features.apiKeyAuth.errors = validation.errors;

    if (!validation.valid) {
      healthStatus.status = 'degraded';
      console.error('API Key Auth misconfigured:', validation.errors);
    }
  }

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

  const statusCode = healthStatus.status === 'ok' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}
