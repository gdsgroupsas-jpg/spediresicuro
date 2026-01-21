/**
 * API Route: Gestione Platform Features (Superadmin)
 *
 * GET: Lista tutte le platform features
 * POST: Aggiorna una platform feature (solo superadmin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdminRole, checkSupabaseConfig } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione e permessi admin
    const adminAuth = await requireAdminRole(
      'Accesso negato. Solo gli admin possono gestire le features della piattaforma.'
    );
    if (!adminAuth.authorized) return adminAuth.response;

    // 2. Carica tutte le platform features
    const configCheck = checkSupabaseConfig();
    if (configCheck) return configCheck;

    const { data: features, error } = await supabaseAdmin
      .from('platform_features')
      .select('*')
      .order('category', { ascending: true })
      .order('display_order', { ascending: true });

    if (error) {
      return handleApiError(error, 'GET /api/admin/platform-features - load features');
    }

    return NextResponse.json({
      success: true,
      features: features || [],
      count: features?.length || 0,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/admin/platform-features');
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione e permessi admin
    const adminAuth = await requireAdminRole(
      'Accesso negato. Solo gli admin possono modificare le features della piattaforma.'
    );
    if (!adminAuth.authorized) return adminAuth.response;

    // 2. Leggi body della richiesta
    const body = await request.json();
    const { feature_code, is_enabled, is_visible, config } = body;

    if (!feature_code) {
      return ApiErrors.BAD_REQUEST('Parametro feature_code obbligatorio');
    }

    // 4. Aggiorna feature
    const configCheck = checkSupabaseConfig();
    if (configCheck) return configCheck;

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
      return ApiErrors.BAD_REQUEST('Nessun campo da aggiornare');
    }

    // Aggiorna feature
    const { data, error } = await supabaseAdmin
      .from('platform_features')
      .update(updates)
      .eq('code', feature_code)
      .select()
      .single();

    if (error) {
      return handleApiError(error, 'POST /api/admin/platform-features - update feature');
    }

    if (!data) {
      return ApiErrors.NOT_FOUND('Feature');
    }

    return NextResponse.json({
      success: true,
      message: 'Feature aggiornata con successo',
      feature: data,
    });
  } catch (error: any) {
    return handleApiError(error, 'POST /api/admin/platform-features');
  }
}
