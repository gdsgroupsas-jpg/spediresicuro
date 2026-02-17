/**
 * Server Action: Approvazione Listino Fornitore
 *
 * ✨ FASE 5: Cambia status da draft → active
 * - Non richiede completezza: l'utente può approvare anche con zone mancanti o prezzi zero
 * - L'utente può sempre modificare il listino dopo l'approvazione
 * - Cambia status da "draft" a "active"
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { updatePriceList } from '@/lib/db/price-lists';
import { PRICING_MATRIX, getZonesForMode } from '@/lib/constants/pricing-matrix';

interface ApprovePriceListResult {
  success: boolean;
  error?: string;
  validation?: {
    totalZones: number;
    zonesWithEntries: number;
    missingZones: string[];
    entriesWithZeroPrice: number;
  };
}

export async function approvePriceListAction(
  priceListId: string,
  mode: 'fast' | 'balanced' | 'matrix' = 'balanced'
): Promise<ApprovePriceListResult> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // Recupera utente
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const workspaceId = context.workspace.id;

    // Verifica permessi
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === 'byoc';

    if (!isAdmin && !isReseller && !isBYOC) {
      return {
        success: false,
        error: 'Solo admin, reseller e BYOC possono approvare listini',
      };
    }

    // Recupera listino
    const { data: priceList, error: listError } = await supabaseAdmin
      .from('price_lists')
      .select('id, name, status, created_by')
      .eq('id', priceListId)
      .single();

    if (listError || !priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    // Verifica ownership (solo il creatore può approvare)
    if (priceList.created_by !== user.id && !isAdmin) {
      return {
        success: false,
        error: 'Puoi approvare solo i tuoi listini',
      };
    }

    // Verifica che sia in stato draft
    if (priceList.status !== 'draft') {
      return {
        success: false,
        error: `Listino già ${priceList.status === 'active' ? 'attivo' : 'archiviato'}`,
      };
    }

    // ✨ VALIDAZIONE COMPLETEZZA: RIMOSSA
    // L'utente può approvare anche con zone mancanti o prezzi zero
    // e può sempre modificare dopo l'approvazione
    // Recupera entries solo per statistiche (opzionale)
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('price_list_entries')
      .select('zone_code, base_price')
      .eq('price_list_id', priceListId);

    // Calcola statistiche per info (non bloccanti)
    let validation = {
      totalZones: 0,
      zonesWithEntries: 0,
      missingZones: [] as string[],
      entriesWithZeroPrice: 0,
    };

    if (!entriesError && entries) {
      const expectedZones = getZonesForMode(mode);
      const zonesWithEntries = new Set(entries.map((e) => e.zone_code).filter((z) => z));

      const missingZones = expectedZones
        .filter((z) => !zonesWithEntries.has(z.code))
        .map((z) => z.name);

      const entriesWithZeroPrice = entries.filter((e) => !e.base_price || e.base_price <= 0).length;

      validation = {
        totalZones: expectedZones.length,
        zonesWithEntries: zonesWithEntries.size,
        missingZones,
        entriesWithZeroPrice,
      };
    }

    // ✨ APPROVAZIONE: Cambia status da draft → active
    await updatePriceList(priceListId, { status: 'active' }, user.id, workspaceId);

    return {
      success: true,
      validation,
    };
  } catch (error: any) {
    console.error('Errore approvePriceListAction:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}
