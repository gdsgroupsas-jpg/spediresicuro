/**
 * API Endpoint: Doctor Service - Eventi Diagnostici
 * 
 * GET /api/admin/doctor/events
 * 
 * Recupera eventi diagnostici con filtri (tipo, severità, data, utente).
 * Solo admin/superadmin possono accedere.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const context = await requireSafeAuth();
    
    // Verifica permessi admin
    const isAdmin = context.actor.role === 'admin' || context.actor.role === 'superadmin';
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const severity = searchParams.get('severity') || 'all';
    const dateRange = searchParams.get('dateRange') || '24h';
    const userId = searchParams.get('userId') || null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Calcola data di inizio in base al range
    const dateFrom = getDateFromRange(dateRange);

    // Query base
    let query = supabaseAdmin
      .from('diagnostics_events')
      .select('*', { count: 'exact' })
      .gte('created_at', dateFrom.toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtri
    if (type !== 'all') {
      query = query.eq('type', type);
    }

    if (severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: events, error, count } = await query;

    if (error) {
      console.error('Errore recupero eventi diagnostici:', error);
      return NextResponse.json(
        { error: 'Errore recupero eventi' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: events || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Errore API Doctor Events:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

/**
 * Calcola data di inizio in base al range
 */
function getDateFromRange(range: string): Date {
  const now = new Date();
  
  switch (range) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'all':
      return new Date(0); // Inizio epoch
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

export const dynamic = 'force-dynamic';


