/**
 * API Route: Gestione Platform Features (Superadmin)
 * 
 * GET: Lista tutte le platform features
 * POST: Aggiorna una platform feature (solo superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Verifica che sia admin
    const user = await findUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Verifica role = 'admin'
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono gestire le features della piattaforma.' },
        { status: 403 }
      );
    }    // 3. Carica tutte le platform features
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase non configurato' },
        { status: 500 }
      );
    }

    const { data: features, error } = await supabaseAdmin
      .from('platform_features')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Errore caricamento platform features:', error);
      return NextResponse.json(
        { error: 'Errore durante il caricamento delle features' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      features: features || [],
      count: features?.length || 0,
    });
  } catch (error: any) {
    console.error('Errore API admin/platform-features GET:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle features' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Verifica che sia superadmin
    const user = await findUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Verifica role = 'admin'
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono modificare le features della piattaforma.' },
        { status: 403 }
      );
    }

    // 3. Leggi body della richiesta
    const body = await request.json();
    const { feature_code, is_enabled, is_visible, config } = body;

    if (!feature_code) {
      return NextResponse.json(
        { error: 'Parametro feature_code obbligatorio' },
        { status: 400 }
      );
    }

    // 4. Aggiorna feature
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase non configurato' },
        { status: 500 }
      );
    }

    // Prepara oggetto aggiornamento
    const updates: any = {};
    if (typeof is_enabled === 'boolean') {
      updates.is_enabled = is_enabled;
    }
    if (typeof is_visible === 'boolean') {
      updates.is_visible = is_visible;
    }
    if (config !== undefined) {
      updates.config = config;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo da aggiornare' },
        { status: 400 }
      );
    }

    // Aggiorna feature
    const { data, error } = await supabaseAdmin
      .from('platform_features')
      .update(updates)
      .eq('code', feature_code)
      .select()
      .single();

    if (error) {
      console.error('Errore aggiornamento platform feature:', error);
      return NextResponse.json(
        { error: error.message || 'Errore durante l\'aggiornamento' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Feature non trovata' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Feature aggiornata con successo',
      feature: data,
    });
  } catch (error: any) {
    console.error('Errore API admin/platform-features POST:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento della feature' },
      { status: 500 }
    );
  }
}




