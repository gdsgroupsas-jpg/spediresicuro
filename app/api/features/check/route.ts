/**
 * API Route: Verifica se un utente ha accesso a una feature
 * 
 * GET /api/features/check?feature=ocr_scan
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
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

    // 2. Ottieni feature code dalla query
    const { searchParams } = new URL(request.url);
    const featureCode = searchParams.get('feature');

    if (!featureCode) {
      return NextResponse.json(
        { error: 'Parametro "feature" mancante' },
        { status: 400 }
      );
    }

    // 3. Verifica accesso usando la funzione Supabase
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { hasAccess: false, reason: 'Supabase non configurato' },
        { status: 200 }
      );
    }

    try {
      // 1. Ottieni ruolo utente
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('email', session.user.email)
        .single();

      if (userError || !user) {
        return NextResponse.json({
          hasAccess: false,
          feature: featureCode,
        });
      }

      // 2. Se admin, ha sempre accesso
      if (user.role === 'admin') {
        return NextResponse.json({
          hasAccess: true,
          feature: featureCode,
        });
      }

      // 3. Verifica se la feature esiste ed è disponibile
      const { data: feature, error: featureError } = await supabaseAdmin
        .from('killer_features')
        .select('is_available, is_free')
        .eq('code', featureCode)
        .single();

      if (featureError || !feature || !feature.is_available) {
        return NextResponse.json({
          hasAccess: false,
          feature: featureCode,
        });
      }

      // 4. Se è gratuita, ha accesso
      if (feature.is_free) {
        return NextResponse.json({
          hasAccess: true,
          feature: featureCode,
        });
      }

      // 5. Verifica permesso ruolo
      const { data: rolePermission } = await supabaseAdmin
        .from('role_permissions')
        .select('has_access')
        .eq('role', user.role)
        .eq('feature_code', featureCode)
        .single();

      if (rolePermission?.has_access) {
        return NextResponse.json({
          hasAccess: true,
          feature: featureCode,
        });
      }

      // 6. Verifica se l'utente ha la feature attivata esplicitamente
      const { data: userFeature } = await supabaseAdmin
        .from('user_features')
        .select('is_active, expires_at')
        .eq('user_email', session.user.email)
        .eq('is_active', true)
        .single();

      if (userFeature) {
        // Verifica scadenza
        if (!userFeature.expires_at || new Date(userFeature.expires_at) > new Date()) {
          return NextResponse.json({
            hasAccess: true,
            feature: featureCode,
          });
        }
      }

      return NextResponse.json({
        hasAccess: false,
        feature: featureCode,
      });
    } catch (error: any) {
      console.error('Errore verifica feature:', error);
      return NextResponse.json(
        { hasAccess: false, reason: error.message },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('Errore API features/check:', error);
    return NextResponse.json(
      { error: 'Errore durante la verifica della feature' },
      { status: 500 }
    );
  }
}

