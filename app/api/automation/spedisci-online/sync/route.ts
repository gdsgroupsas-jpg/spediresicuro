/**
 * API Route: Sync Automation Spedisci.Online
 *
 * Endpoint: POST /api/automation/spedisci-online/sync
 *
 * Esegue sync manuale per estrarre session data da Spedisci.Online
 *
 * ⚠️ SOLO ADMIN: Solo superadmin può eseguire sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { syncCourierConfig, syncAllEnabledConfigs } from '@/lib/automation/spedisci-online-agent';
import { supabaseAdmin } from '@/lib/db/client';
import { isSuperAdminCheck } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Verifica che sia superadmin
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('email', context.actor.email)
      .single();

    if (userError || !user || !isSuperAdminCheck(user)) {
      return NextResponse.json(
        { success: false, error: 'Solo superadmin può eseguire sync' },
        { status: 403 }
      );
    }

    // 3. Leggi parametri
    const body = await request.json();
    const { config_id, sync_all } = body;

    // 4. Esegui sync
    if (sync_all) {
      // Sync tutte le configurazioni abilitate
      await syncAllEnabledConfigs();
      return NextResponse.json({
        success: true,
        message: 'Sync globale completata',
      });
    } else if (config_id) {
      // Sync configurazione specifica
      const result = await syncCourierConfig(config_id);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: result.message || 'Sync completata',
          session_data: result.session_data,
          contracts: result.contracts,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || 'Errore durante sync',
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Specifica config_id o sync_all=true' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ Errore API sync automation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
