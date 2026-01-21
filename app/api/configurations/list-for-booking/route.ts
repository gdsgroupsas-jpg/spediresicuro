/**
 * API: List Configurations for Booking
 *
 * GET /api/configurations/list-for-booking
 *
 * Restituisce le configurazioni Spedisci.Online attive dell'utente
 * per la selezione durante il booking.
 *
 * @security Solo dati necessari alla UI (no API keys)
 */

import { supabaseAdmin } from '@/lib/db/client';
import { requireSafeAuth } from '@/lib/safe-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Autenticazione - ActingContext ha actor (chi agisce) e target (per chi)
    const context = await requireSafeAuth();
    const userId = context.target.id;

    // Recupera configurazioni attive dell'utente
    const { data: configs, error } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, is_default, status, contract_mapping, automation_settings')
      .eq('owner_user_id', userId)
      .eq('provider_id', 'spedisci_online')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Errore recupero configurazioni:', error);
      return NextResponse.json({ error: 'Errore recupero configurazioni' }, { status: 500 });
    }

    // Trasforma in formato sicuro per UI
    const safeConfigs = (configs || []).map((config) => {
      // Estrai corrieri da contract_mapping
      const contractMapping = config.contract_mapping || {};
      const allCouriers = Object.keys(contractMapping);

      // Se ci sono corrieri abilitati in automation_settings, usa quelli
      const automationSettings = (config.automation_settings as Record<string, unknown>) || {};
      const enabledCouriers = (automationSettings.enabled_carriers as string[]) || allCouriers;

      return {
        id: config.id,
        name: config.name || `Account ${config.id.substring(0, 6)}`,
        isDefault: config.is_default || false,
        status: config.status || 'active',
        couriers: enabledCouriers,
      };
    });

    return NextResponse.json({
      configs: safeConfigs,
      total: safeConfigs.length,
    });
  } catch (error: any) {
    console.error('Errore API list-for-booking:', error);
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 });
  }
}
