/**
 * API Route: Gestione Killer Features (Admin)
 * 
 * GET: Lista tutte le killer features disponibili
 * POST: Attiva/disattiva feature per un utente
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione e permessi admin
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const user = await findUserByEmail(session.user.email);
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono accedere.' },
        { status: 403 }
      );
    }

    // 2. Carica tutte le killer features
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase non configurato' },
        { status: 500 }
      );
    }

    const { data: features, error } = await supabaseAdmin
      .from('killer_features')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Errore caricamento features:', error);
      return NextResponse.json(
        { error: 'Errore durante il caricamento delle features' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      features: features || [],
      count: features?.length || 0,
    });
  } catch (error: any) {
    console.error('Errore API admin/features:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle features' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione e permessi admin
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const user = await findUserByEmail(session.user.email);
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono gestire le features.' },
        { status: 403 }
      );
    }

    // 2. Leggi body della richiesta
    const body = await request.json();
    const { targetUserEmail, featureCode, activate, expiresAt, activationType } = body;

    if (!targetUserEmail || !featureCode || typeof activate !== 'boolean') {
      return NextResponse.json(
        { error: 'Parametri mancanti: targetUserEmail, featureCode, activate sono obbligatori' },
        { status: 400 }
      );
    }

    // 3. Chiama funzione Supabase per toggle feature
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase non configurato' },
        { status: 500 }
      );
    }

    try {
      // 1. Verifica che la feature esista
      const { data: feature, error: featureError } = await supabaseAdmin
        .from('killer_features')
        .select('id')
        .eq('code', featureCode)
        .single();

      if (featureError || !feature) {
        return NextResponse.json(
          { error: 'Feature non trovata' },
          { status: 404 }
        );
      }

      // 2. Inserisci o aggiorna user_feature
      const { data: existingUserFeature } = await supabaseAdmin
        .from('user_features')
        .select('id')
        .eq('user_email', targetUserEmail)
        .eq('feature_id', feature.id)
        .single();

      if (existingUserFeature) {
        // Aggiorna feature esistente
        const { error: updateError } = await supabaseAdmin
          .from('user_features')
          .update({
            is_active: activate,
            expires_at: expiresAt || null,
            activation_type: activationType || 'admin_grant',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUserFeature.id);

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 400 }
          );
        }
      } else {
        // Crea nuova user_feature
        const { error: insertError } = await supabaseAdmin
          .from('user_features')
          .insert({
            user_email: targetUserEmail,
            feature_id: feature.id,
            is_active: activate,
            expires_at: expiresAt || null,
            activation_type: activationType || 'admin_grant',
          });

        if (insertError) {
          return NextResponse.json(
            { error: insertError.message },
            { status: 400 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: `Feature ${activate ? 'attivata' : 'disattivata'} con successo`,
      });
    } catch (error: any) {
      console.error('Errore toggle feature:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Errore API admin/features POST:', error);
    return NextResponse.json(
      { error: 'Errore durante la gestione della feature' },
      { status: 500 }
    );
  }
}

