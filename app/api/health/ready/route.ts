/**
 * Readiness probe
 *
 * Endpoint: GET /api/health/ready
 * Verifica dipendenze critiche (DB).
 */
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!supabaseConfigured) {
    // In production, missing database is CRITICAL (fail readiness)
    // In development, JSON fallback is acceptable
    const statusCode = isProduction ? 503 : 200;
    const status = isProduction ? 'not_ready' : 'degraded';

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: {
          type: 'json',
          configured: false,
          working: true,
          message: isProduction
            ? 'CRITICAL: Supabase not configured in production'
            : 'Supabase non configurato, uso database JSON locale (dev mode OK)',
        },
      },
      { status: statusCode }
    );
  }

  try {
    const { error } = await supabaseAdmin.from('shipments').select('id').limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: 'degraded',
          timestamp: new Date().toISOString(),
          database: {
            type: 'supabase',
            configured: true,
            working: false,
            message: `Supabase configurato ma errore connessione: ${error.message}`,
          },
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: {
          type: 'supabase',
          configured: true,
          working: true,
          message: 'Supabase configurato e funzionante',
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: {
          type: 'supabase',
          configured: true,
          working: false,
          message: `Errore test Supabase: ${error.message}`,
        },
      },
      { status: 503 }
    );
  }
}
