/**
 * API Route: Gestione Killer Features (Admin)
 * 
 * GET: Lista tutte le killer features disponibili
 * POST: Attiva/disattiva feature per un utente
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminRole, checkSupabaseConfig } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione e permessi admin
    const adminAuth = await requireAdminRole();
    if (!adminAuth.authorized) return adminAuth.response;

    // 2. Carica tutte le killer features
    const configCheck = checkSupabaseConfig();
    if (configCheck) return configCheck;

    const { data: features, error } = await supabaseAdmin
      .from('killer_features')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      return handleApiError(error, 'GET /api/admin/features - load features');
    }

    return NextResponse.json({
      features: features || [],
      count: features?.length || 0,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/admin/features');
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione e permessi admin
    const adminAuth = await requireAdminRole();
    if (!adminAuth.authorized) return adminAuth.response;

    // 2. Leggi body della richiesta
    const body = await request.json();
    const { targetUserEmail, featureCode, activate, expiresAt, activationType } = body;

    if (!targetUserEmail || !featureCode || typeof activate !== 'boolean') {
      return ApiErrors.BAD_REQUEST('Parametri mancanti: targetUserEmail, featureCode, activate sono obbligatori');
    }

    // 3. Chiama funzione Supabase per toggle feature
    const configCheck = checkSupabaseConfig();
    if (configCheck) return configCheck;

    try {
      // 1. Verifica che la feature esista
      const { data: feature, error: featureError } = await supabaseAdmin
        .from('killer_features')
        .select('id')
        .eq('code', featureCode)
        .single();

      if (featureError || !feature) {
        return ApiErrors.NOT_FOUND('Feature');
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
          return ApiErrors.BAD_REQUEST(updateError.message);
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
          return ApiErrors.BAD_REQUEST(insertError.message);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Feature ${activate ? 'attivata' : 'disattivata'} con successo`,
      });
    } catch (error: any) {
      return handleApiError(error, 'POST /api/admin/features - toggle feature');
    }
  } catch (error: any) {
    return handleApiError(error, 'POST /api/admin/features');
  }
}

