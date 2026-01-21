/**
 * API Endpoint: Test Carrier Credentials
 * 
 * Testa le credenziali di una configurazione corriere.
 * Aggiorna status e test_result nella tabella courier_configs.
 * 
 * POST /api/integrations/test-credentials
 * Body: { config_id: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { testCarrierCredentials } from '@/lib/integrations/carrier-configs-compat';
import { supabaseAdmin } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();

    if (!context?.actor?.email) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Leggi config_id dal body
    const body = await request.json();
    const { config_id } = body;

    if (!config_id) {
      return NextResponse.json(
        { success: false, error: 'config_id mancante' },
        { status: 400 }
      );
    }

    // 3. Verifica permessi: admin o owner della config
    const { data: config, error: configError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, owner_user_id, created_by, account_type')
      .eq('id', config_id)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { success: false, error: 'Configurazione non trovata' },
        { status: 404 }
      );
    }

    // Verifica permessi: admin o owner
    const user = await supabaseAdmin
      .from('users')
      .select('id, role, email')
      .eq('email', context.actor.email)
      .single();

    const isAdmin = user?.data?.role === 'admin';
    const isOwner = config.owner_user_id === user?.data?.id || config.created_by === context.actor.email;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { success: false, error: 'Accesso negato. Solo admin o owner possono testare credenziali.' },
        { status: 403 }
      );
    }

    // 4. Esegui test
    const result = await testCarrierCredentials(config_id);

    // 5. Ritorna risultato
    return NextResponse.json({
      success: result.success,
      error: result.error,
      response_time_ms: result.response_time_ms,
      message: result.success 
        ? 'Credenziali valide' 
        : `Errore: ${result.error}`,
    });
  } catch (error: any) {
    console.error('❌ [API] Errore test credentials:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante test credenziali',
      },
      { status: 500 }
    );
  }
}
