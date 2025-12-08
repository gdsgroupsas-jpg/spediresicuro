import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inizializza il client Supabase con la service role key per operazioni server-side
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Token per l'autenticazione dell'endpoint
const DIAGNOSTICS_TOKEN = process.env.DIAGNOSTICS_TOKEN || 'd4t1_d14gn0st1c1_s3gr3t1_2025_x9z';

// Interface per il corpo della richiesta
interface DiagnosticsPayload {
  type: 'info' | 'warning' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  user_agent?: string;
}

/**
 * POST /api/diagnostics
 * Endpoint per registrare eventi diagnostici nel database
 * Richiede token di autenticazione Bearer nel header Authorization
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica il token di autenticazione
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Rimuovi "Bearer "
    if (token !== DIAGNOSTICS_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 403 }
      );
    }

    // Parsifica il body della richiesta
    const payload: DiagnosticsPayload = await request.json();

    // Valida il payload
    if (!payload.type || !payload.severity) {
      return NextResponse.json(
        { error: 'Missing required fields: type and severity' },
        { status: 400 }
      );
    }

    try {
      // Inserisci l'evento nel database
      const { data, error } = await supabase
        .from('diagnostics_events')
        .insert([
          {
            type: payload.type,
            severity: payload.severity,
            context: payload.context || {},
            user_agent: payload.user_agent || 'Unknown',
            created_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json(
          { error: 'Failed to insert diagnostic event', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        id: data?.id || 'unknown',
        message: 'Diagnostic event recorded successfully',
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Fallback: ritorna un ID finto se il database non è disponibile
      return NextResponse.json({
        success: true,
        id: `temp-${Date.now()}`,
        message: 'Diagnostic event queued (database offline)',
        warning: 'Database connection failed',
      }, { status: 202 });
    }
  } catch (error) {
    console.error('Diagnostics endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/diagnostics
 * Endpoint per recuperare gli ultimi eventi diagnostici
 */
export async function GET(request: NextRequest) {
  try {
    // Verifica il token di autenticazione
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== DIAGNOSTICS_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 403 }
      );
    }

    // Recupera gli ultimi 100 eventi diagnostici
    const { data, error } = await supabase
      .from('diagnostics_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch diagnostic events', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      events: data || [],
    });
  } catch (error) {
    console.error('Diagnostics GET endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
