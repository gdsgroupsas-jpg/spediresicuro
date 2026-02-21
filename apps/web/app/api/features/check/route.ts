/**
 * API Route: Verifica se un utente ha accesso a una feature
 *
 * GET /api/features/check?feature=ocr_scan
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, checkSupabaseConfig } from '@/lib/api-middleware';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { getUserByEmail } from '@/lib/db/user-helpers';
import { ApiErrors, handleApiError } from '@/lib/api-responses';

// Forza rendering dinamico (usa headers, session, ecc.)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    // 2. Ottieni feature code dalla query
    const { searchParams } = new URL(request.url);
    const featureCode = searchParams.get('feature');

    if (!featureCode) {
      return ApiErrors.BAD_REQUEST('Parametro "feature" mancante');
    }

    // 3. Verifica accesso usando la funzione Supabase
    const configCheck = checkSupabaseConfig();
    if (configCheck) {
      return NextResponse.json(
        { hasAccess: false, reason: 'Supabase non configurato' },
        { status: 200 }
      );
    }

    try {
      // 1. Ottieni ruolo utente
      const user = await getUserByEmail(context!.actor.email!, 'role, account_type');

      if (!user) {
        return NextResponse.json({
          hasAccess: false,
          feature: featureCode,
        });
      }

      // 2. Se admin o superadmin, ha sempre accesso
      if (isAdminOrAbove(user)) {
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
        .eq('user_email', context!.actor.email)
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
      return NextResponse.json({ hasAccess: false, reason: error.message }, { status: 200 });
    }
  } catch (error: any) {
    return handleApiError(error, 'GET /api/features/check');
  }
}
