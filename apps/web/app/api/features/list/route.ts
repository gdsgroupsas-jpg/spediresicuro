/**
 * API Route: Lista tutte le features attive per l'utente corrente
 *
 * GET /api/features/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// Forza rendering dinamico (usa headers())
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Ottieni features attive usando la funzione Supabase
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        features: [],
        message: 'Supabase non configurato',
      });
    }

    try {
      // 1. Ottieni ruolo utente
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('email', context.actor.email)
        .single();

      const userRole = user?.role || 'user';

      // 2. Se admin, ottieni tutte le features disponibili
      if (userRole === 'admin') {
        const { data: allFeatures } = await supabaseAdmin
          .from('killer_features')
          .select('code, name, category, is_free')
          .eq('is_available', true)
          .order('display_order', { ascending: true });

        return NextResponse.json({
          features: (allFeatures || []).map((f) => ({
            feature_code: f.code,
            feature_name: f.name,
            category: f.category,
            is_free: f.is_free,
            activation_type: 'admin',
            expires_at: null,
          })),
          count: allFeatures?.length || 0,
        });
      }

      // 3. Ottieni features per ruolo
      const { data: roleFeatures } = await supabaseAdmin
        .from('role_permissions')
        .select('feature_code')
        .eq('role', userRole)
        .eq('has_access', true);

      const roleFeatureCodes = (roleFeatures || []).map((f) => f.feature_code);

      // 4. Ottieni features gratuite
      const { data: freeFeatures } = await supabaseAdmin
        .from('killer_features')
        .select('code, name, category, is_free')
        .eq('is_available', true)
        .eq('is_free', true);

      const freeFeatureCodes = (freeFeatures || []).map((f) => f.code);

      // 5. Ottieni features attivate esplicitamente per l'utente
      const { data: userFeatures } = await supabaseAdmin
        .from('user_features')
        .select('feature_id, is_active, expires_at, activation_type')
        .eq('user_email', context.actor.email)
        .eq('is_active', true);

      // Ottieni i codici delle features attivate
      const activeUserFeatureIds = (userFeatures || [])
        .filter((uf) => !uf.expires_at || new Date(uf.expires_at) > new Date())
        .map((uf) => uf.feature_id);

      const userFeatureCodes: string[] = [];
      if (activeUserFeatureIds.length > 0) {
        const { data: userFeatureDetails } = await supabaseAdmin
          .from('killer_features')
          .select('code')
          .in('id', activeUserFeatureIds);

        userFeatureCodes.push(...(userFeatureDetails || []).map((f) => f.code));
      }

      // 6. Combina tutte le feature codes
      const allFeatureCodes = [
        ...new Set([...roleFeatureCodes, ...freeFeatureCodes, ...userFeatureCodes]),
      ];

      // 7. Ottieni dettagli delle features
      const { data: features } = await supabaseAdmin
        .from('killer_features')
        .select('code, name, category, is_free')
        .in('code', allFeatureCodes)
        .eq('is_available', true)
        .order('display_order', { ascending: true });

      // 8. Ottieni mapping feature_id -> code per user features
      const featureIdToCode: Record<string, string> = {};
      if (activeUserFeatureIds.length > 0) {
        const { data: featureMapping } = await supabaseAdmin
          .from('killer_features')
          .select('id, code')
          .in('id', activeUserFeatureIds);

        (featureMapping || []).forEach((f) => {
          featureIdToCode[f.id] = f.code;
        });
      }

      // 9. Aggiungi info di attivazione
      const featuresWithActivation = (features || []).map((feature) => {
        // Trova user feature corrispondente
        const userFeature = userFeatures?.find((uf) => {
          const code = featureIdToCode[uf.feature_id];
          return code === feature.code;
        });

        return {
          feature_code: feature.code,
          feature_name: feature.name,
          category: feature.category,
          is_free: feature.is_free,
          activation_type:
            userFeature?.activation_type ||
            (roleFeatureCodes.includes(feature.code) ? 'role' : 'free'),
          expires_at: userFeature?.expires_at || null,
        };
      });

      return NextResponse.json({
        features: featuresWithActivation,
        count: featuresWithActivation.length,
      });
    } catch (error: any) {
      console.error('Errore recupero features:', error);
      return NextResponse.json({ features: [], error: error.message }, { status: 200 });
    }
  } catch (error: any) {
    console.error('Errore API features/list:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle features' },
      { status: 500 }
    );
  }
}
