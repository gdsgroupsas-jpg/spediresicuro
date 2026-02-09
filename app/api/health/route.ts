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

  const statusCode = healthStatus.status === 'ok' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}
