/**
 * API Route per Diagnostics
 * Endpoint per ricevere eventi diagnostici dall'automation-service
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inizializza Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

/**
 * POST /api/diagnostics
 * Riceve eventi diagnostici dall'automation-service
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica token di autorizzazione
    const authHeader = request.headers.get('authorization');
    const diagnosticsToken = process.env.DIAGNOSTICS_TOKEN;

    if (!authHeader || !diagnosticsToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Token mancante' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== diagnosticsToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Token non valido' },
        { status: 401 }
      );
    }

    // Parse body
    const body = await request.json();
    const { type, severity, context } = body;

    // Validazione base
    const validTypes = ['error', 'warning', 'info', 'performance', 'user_action'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `type deve essere uno di: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Verifica Supabase
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          success: true,
          id: `temp-${Date.now()}`,
          message: 'Diagnostic event queued (database not configured)',
          warning: 'Supabase not configured - event not persisted',
        },
        { status: 200 }
      );
    }

    // Salva nel database
    const { data, error } = await supabaseAdmin
      .from('diagnostics_events')
      .insert({
        type,
        severity: severity || 'low',
        context: context || {},
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Errore salvando diagnostic event:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Errore salvando evento diagnostico',
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: data.id,
        message: 'Evento diagnostico salvato con successo',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Errore in POST /api/diagnostics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore interno del server',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/diagnostics
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'diagnostics-api',
      timestamp: new Date().toISOString(),
      supabase_configured: !!supabaseAdmin,
    },
    { status: 200 }
  );
}
