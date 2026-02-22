/**
 * Server Actions: Price List Entries Management
 *
 * Gestione CRUD per le entry dei listini (righe della matrice)
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db/client';
import { getPriceListById } from '@/lib/db/price-lists';
import type { PriceListEntry } from '@/types/listini';

/**
 * Aggiorna una singola entry del listino
 */
export async function updatePriceListEntryAction(
  entryId: string,
  data: {
    base_price?: number;
    fuel_surcharge_percent?: number;
    cash_on_delivery_surcharge?: number;
    insurance_rate_percent?: number;
    island_surcharge?: number;
    ztl_surcharge?: number;
    estimated_delivery_days_min?: number;
    estimated_delivery_days_max?: number;
  }
): Promise<{
  success: boolean;
  entry?: PriceListEntry;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    // Recupera entry per verificare permessi sul listino
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('price_list_entries')
      .select('price_list_id')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) {
      return { success: false, error: 'Entry non trovata' };
    }

    // Verifica permessi sul listino
    const priceList = await getPriceListById(entry.price_list_id, workspaceId);
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    const isAdmin = isAdminOrAbove(user);
    const isOwner = priceList.created_by === user.id;
    const isAssignedOwner = priceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questo listino',
      };
    }

    // ✨ NUOVO: Governance validation per custom lists (opt-in)
    if (priceList.list_type === 'custom' && priceList.created_by && data.base_price) {
      const { validateResellerPricing } = await import('@/lib/db/reseller-policies');

      const validationError = await validateResellerPricing({
        resellerId: priceList.created_by,
        basePrice: data.base_price,
        finalPrice: data.base_price, // Simplified (real calc would include surcharges)
        isSuperAdmin: isAdmin,
      });

      if (validationError) {
        return {
          success: false,
          error: `Governance: ${validationError}`,
        };
      }
    }

    // Aggiorna entry
    const { data: updatedEntry, error: updateError } = await supabaseAdmin
      .from('price_list_entries')
      .update(data)
      .eq('id', entryId)
      .select()
      .single();

    if (updateError) {
      console.error('Errore aggiornamento entry:', updateError);
      return {
        success: false,
        error: updateError.message || 'Errore aggiornamento entry',
      };
    }

    return { success: true, entry: updatedEntry as PriceListEntry };
  } catch (error: any) {
    console.error('Errore updatePriceListEntryAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Crea una nuova entry nel listino
 */
export async function createPriceListEntryAction(
  priceListId: string,
  data: {
    weight_from: number;
    weight_to: number;
    zone_code?: string;
    base_price: number;
    service_type?: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day';
    fuel_surcharge_percent?: number;
    cash_on_delivery_surcharge?: number;
    insurance_rate_percent?: number;
    island_surcharge?: number;
    ztl_surcharge?: number;
    estimated_delivery_days_min?: number;
    estimated_delivery_days_max?: number;
  }
): Promise<{
  success: boolean;
  entry?: PriceListEntry;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    // Verifica permessi sul listino
    const priceList = await getPriceListById(priceListId, workspaceId);
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    const isAdmin = isAdminOrAbove(user);
    const isOwner = priceList.created_by === user.id;
    const isAssignedOwner = priceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questo listino',
      };
    }

    // Crea entry
    const { data: newEntry, error: insertError } = await supabaseAdmin
      .from('price_list_entries')
      .insert({
        price_list_id: priceListId,
        weight_from: data.weight_from,
        weight_to: data.weight_to,
        zone_code: data.zone_code || null,
        base_price: data.base_price,
        service_type: data.service_type || 'standard',
        fuel_surcharge_percent: data.fuel_surcharge_percent || 0,
        cash_on_delivery_surcharge: data.cash_on_delivery_surcharge || 0,
        insurance_rate_percent: data.insurance_rate_percent || 0,
        island_surcharge: data.island_surcharge || 0,
        ztl_surcharge: data.ztl_surcharge || 0,
        estimated_delivery_days_min: data.estimated_delivery_days_min,
        estimated_delivery_days_max: data.estimated_delivery_days_max,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Errore creazione entry:', insertError);
      return {
        success: false,
        error: insertError.message || 'Errore creazione entry',
      };
    }

    return { success: true, entry: newEntry as PriceListEntry };
  } catch (error: any) {
    console.error('Errore createPriceListEntryAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Elimina una entry del listino
 */
export async function deletePriceListEntryAction(entryId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    // Recupera entry per verificare permessi sul listino
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('price_list_entries')
      .select('price_list_id')
      .eq('id', entryId)
      .single();

    if (entryError || !entry) {
      return { success: false, error: 'Entry non trovata' };
    }

    // Verifica permessi sul listino
    const priceList = await getPriceListById(entry.price_list_id, workspaceId);
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    const isAdmin = isAdminOrAbove(user);
    const isOwner = priceList.created_by === user.id;
    const isAssignedOwner = priceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questo listino',
      };
    }

    // Elimina entry
    const { error: deleteError } = await supabaseAdmin
      .from('price_list_entries')
      .delete()
      .eq('id', entryId);

    if (deleteError) {
      console.error('Errore eliminazione entry:', deleteError);
      return {
        success: false,
        error: deleteError.message || 'Errore eliminazione entry',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore deletePriceListEntryAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Upsert multipli entry (per salvataggio batch)
 */
export async function upsertPriceListEntriesAction(
  priceListId: string,
  entries: Array<{
    id?: string; // Se presente, aggiorna; altrimenti crea
    weight_from: number;
    weight_to: number;
    zone_code?: string;
    base_price: number;
    service_type?: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day';
    fuel_surcharge_percent?: number;
    cash_on_delivery_surcharge?: number;
    insurance_rate_percent?: number;
  }>
): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    // Verifica permessi sul listino
    const priceList = await getPriceListById(priceListId, workspaceId);
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    const isAdmin = isAdminOrAbove(user);
    const isOwner = priceList.created_by === user.id;
    const isAssignedOwner = priceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questo listino',
      };
    }

    // Importa funzione upsert
    const { upsertPriceListEntries } = await import('@/lib/db/price-lists');
    const result = await upsertPriceListEntries(
      priceListId,
      entries.map((e) => ({
        weight_from: e.weight_from,
        weight_to: e.weight_to,
        zone_code: e.zone_code,
        base_price: e.base_price,
        service_type: e.service_type || 'standard',
        fuel_surcharge_percent: e.fuel_surcharge_percent || 0,
        cash_on_delivery_surcharge: e.cash_on_delivery_surcharge || 0,
        insurance_rate_percent: e.insurance_rate_percent || 0,
      })),
      workspaceId
    );

    // Logga evento audit
    try {
      const { supabaseAdmin } = await import('@/lib/db/client');
      const eventType =
        result.inserted && result.inserted > 0
          ? 'price_list_entry_imported'
          : 'price_list_entry_modified';

      await supabaseAdmin.rpc('log_price_list_event', {
        p_event_type: eventType,
        p_price_list_id: priceListId,
        p_actor_id: user.id,
        p_message: `${result.inserted || 0} inserite, ${result.updated || 0} aggiornate`,
        p_metadata: {
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          total_entries: entries.length,
        },
        p_severity: 'info',
      });
    } catch (logError) {
      // Non bloccare l'operazione se il logging fallisce
      console.error('Errore logging upsert entries:', logError);
    }

    return {
      success: true,
      inserted: result.inserted,
      updated: result.updated,
    };
  } catch (error: any) {
    console.error('Errore upsertPriceListEntriesAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
