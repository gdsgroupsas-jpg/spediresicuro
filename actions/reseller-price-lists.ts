/**
 * Server Actions: Reseller Price Lists Management
 *
 * Gestione listini personalizzati per reseller con funzionalità enterprise:
 * - Clonazione listini supplier con margini personalizzati
 * - Assegnazione listini a sub-users
 * - Modifica completa di listini personalizzati
 * - Import CSV per completamento manuale
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { assertValidUserId } from '@/lib/validators';
import type { PriceList, PriceListEntry } from '@/types/listini';
import type { CourierServiceType } from '@/types/shipments';

/**
 * Clona un listino supplier applicando margini personalizzati
 *
 * @param sourcePriceListId - ID listino supplier da clonare
 * @param newName - Nome del nuovo listino personalizzato
 * @param marginType - Tipo margine: 'percent' | 'fixed' | 'none'
 * @param marginValue - Valore margine (percentuale o fisso)
 * @param description - Descrizione opzionale
 * @returns Listino creato con statistiche
 */
export async function resellerCloneSupplierPriceListAction(
  sourcePriceListId: string,
  newName: string,
  marginType: 'percent' | 'fixed' | 'none',
  marginValue: number = 0,
  description?: string
): Promise<{
  success: boolean;
  priceListId?: string;
  entryCount?: number;
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

    const isReseller = user.is_reseller === true;
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: 'Non autorizzato: solo reseller e admin possono clonare listini',
      };
    }

    // Validazione input
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!sourcePriceListId || !uuidRegex.test(sourcePriceListId)) {
      return { success: false, error: 'ID listino non valido' };
    }
    if (
      !newName ||
      typeof newName !== 'string' ||
      newName.trim().length === 0 ||
      newName.trim().length > 200
    ) {
      return { success: false, error: 'Nome listino non valido (1-200 caratteri)' };
    }

    // Valida margini
    if (marginType === 'percent' && marginValue < -100) {
      return {
        success: false,
        error: 'Il margine percentuale non può essere inferiore a -100%',
      };
    }

    if (marginType === 'fixed' && marginValue < 0) {
      return {
        success: false,
        error: 'Il margine fisso non può essere negativo',
      };
    }

    // Chiama la funzione DB per clonazione
    const { data, error } = await supabaseAdmin.rpc('reseller_clone_supplier_price_list', {
      p_source_id: sourcePriceListId,
      p_new_name: newName,
      p_margin_type: marginType,
      p_margin_value: marginValue,
      p_description: description || null,
      p_caller_id: user.id, // ✨ FIX: Passa caller_id per supportare service_role
    });

    if (error) {
      console.error('Errore clonazione listino:', error);
      return {
        success: false,
        error: 'Errore durante la clonazione del listino',
      };
    }

    const result = data as any;
    const clonedPriceListId = result.price_list_id;

    // Logga evento audit per listino clonato
    if (clonedPriceListId) {
      try {
        await supabaseAdmin.rpc('log_price_list_event', {
          p_event_type: 'price_list_cloned',
          p_price_list_id: clonedPriceListId,
          p_actor_id: user.id,
          p_message: `Listino clonato da ${sourcePriceListId}. Margine: ${marginType} ${marginValue}`,
          p_metadata: {
            source_price_list_id: sourcePriceListId,
            margin_type: marginType,
            margin_value: marginValue,
            entry_count: result.entry_count || 0,
          },
          p_severity: 'info',
        });
      } catch (logError) {
        console.error('Errore logging clone:', logError);
      }
    }

    return {
      success: true,
      priceListId: clonedPriceListId,
      entryCount: result.entry_count,
    };
  } catch (error: any) {
    console.error('Errore resellerCloneSupplierPriceListAction:', error);
    return {
      success: false,
      error: 'Errore durante la clonazione del listino',
    };
  }
}

/**
 * Assegna un listino personalizzato a un sub-user
 *
 * @param priceListId - ID listino personalizzato
 * @param userId - ID sub-user a cui assegnare
 * @param notes - Note opzionali
 * @returns Assegnazione creata
 */
export async function resellerAssignPriceListAction(
  priceListId: string,
  userId: string,
  notes?: string
): Promise<{
  success: boolean;
  assignmentId?: string;
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

    if (!user.is_reseller) {
      return {
        success: false,
        error: 'Non autorizzato: solo reseller possono assegnare listini',
      };
    }

    // Valida userId
    assertValidUserId(userId);
    assertValidUserId(priceListId);

    // Chiama la funzione DB per assegnazione
    const { data, error } = await supabaseAdmin.rpc('reseller_assign_price_list', {
      p_price_list_id: priceListId,
      p_user_id: userId,
      p_notes: notes || null,
      p_caller_id: user.id, // ✨ FIX: Passa caller_id per supportare service_role
    });

    if (error) {
      console.error('Errore assegnazione listino:', error);
      return {
        success: false,
        error: "Errore durante l'assegnazione del listino",
      };
    }

    return {
      success: true,
      assignmentId: data as string,
    };
  } catch (error: any) {
    console.error('Errore resellerAssignPriceListAction:', error);
    return {
      success: false,
      error: "Errore durante l'assegnazione del listino",
    };
  }
}

/**
 * Ottieni la lista dei sub-users del reseller
 *
 * @returns Array di sub-users
 */
export async function getResellerSubUsersAction(): Promise<{
  success: boolean;
  subUsers?: Array<{
    id: string;
    email: string;
    name?: string;
  }>;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      is_reseller: wsContext.actor.is_reseller,
    };

    if (!user.is_reseller) {
      return {
        success: false,
        error: 'Non autorizzato: solo reseller possono vedere sub-users',
      };
    }

    // Recupera sub-users: supporta sia parent_reseller_id (nuovo) che parent_id (legacy)
    const { data: subUsersNew } = await supabaseAdmin
      .from('users')
      .select('id, email, name, created_at')
      .eq('parent_reseller_id', user.id)
      .order('created_at', { ascending: false });

    const { data: subUsersLegacy } = await supabaseAdmin
      .from('users')
      .select('id, email, name, created_at')
      .eq('parent_id', user.id)
      .order('created_at', { ascending: false });

    // Unisci e deduplica per id, mantieni ordine per data
    const mergedMap = new Map<
      string,
      { id: string; email: string; name: string; created_at: string }
    >();
    for (const su of [...(subUsersNew || []), ...(subUsersLegacy || [])]) {
      if (!mergedMap.has(su.id)) {
        mergedMap.set(su.id, su);
      }
    }
    const subUsers = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return {
      success: true,
      subUsers,
    };
  } catch (error: any) {
    console.error('Errore getResellerSubUsersAction:', error);
    return { success: false, error: 'Errore recupero sub-users' };
  }
}

/**
 * Ottieni lista listini supplier del reseller
 *
 * @returns Array di listini supplier clonabili
 */
export async function getResellerSupplierPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: PriceList[];
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

    const isReseller = user.is_reseller === true;
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: 'Non autorizzato',
      };
    }

    // Recupera listini supplier creati dal reseller (isolamento multi-tenant)
    const wq = workspaceQuery(workspaceId);
    const query = wq.from('price_lists').select('*').eq('list_type', 'supplier');

    if (isReseller && !isAdmin) {
      // Reseller vede solo i propri listini supplier
      query.eq('created_by', user.id);
    }

    const { data: priceLists, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      console.error('Errore recupero listini supplier:', error);
      return { success: false, error: 'Errore recupero listini supplier' };
    }

    return {
      success: true,
      priceLists: (priceLists || []) as PriceList[],
    };
  } catch (error: any) {
    console.error('Errore getResellerSupplierPriceListsAction:', error);
    return { success: false, error: 'Errore recupero listini supplier' };
  }
}

/**
 * Aggiorna margine di un listino personalizzato
 *
 * @param priceListId - ID listino
 * @param marginType - Tipo margine
 * @param marginValue - Valore margine
 * @returns Listino aggiornato
 */
export async function updateResellerPriceListMarginAction(
  priceListId: string,
  marginType: 'percent' | 'fixed' | 'none',
  marginValue: number = 0
): Promise<{
  success: boolean;
  priceList?: PriceList;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    if (!user.is_reseller) {
      return {
        success: false,
        error: 'Non autorizzato: solo reseller possono modificare margini',
      };
    }

    // Valida margini
    if (marginType === 'percent' && marginValue < -100) {
      return {
        success: false,
        error: 'Il margine percentuale non può essere inferiore a -100%',
      };
    }

    if (marginType === 'fixed' && marginValue < 0) {
      return {
        success: false,
        error: 'Il margine fisso non può essere negativo',
      };
    }

    // ✨ SECURITY FIX: Valida marginType a runtime per prevenire SQL injection
    const validMarginTypes = ['percent', 'fixed', 'none'];
    if (!validMarginTypes.includes(marginType)) {
      return {
        success: false,
        error: `Tipo margine non valido: ${marginType}. Valori accettati: ${validMarginTypes.join(
          ', '
        )}`,
      };
    }

    // ✨ SECURITY FIX: Usa parametri sicuri invece di string interpolation
    // Recupera metadata esistente e aggiorna in modo sicuro (isolamento multi-tenant)
    const wq = workspaceQuery(workspaceId);
    const { data: existingList } = await wq
      .from('price_lists')
      .select('metadata')
      .eq('id', priceListId)
      .eq('created_by', user.id)
      .eq('list_type', 'custom')
      .single();

    if (!existingList) {
      return {
        success: false,
        error: 'Listino non trovato o non autorizzato',
      };
    }

    const updatedMetadata = {
      ...(existingList.metadata || {}),
      margin_type: marginType,
    };

    const { data, error } = await wq
      .from('price_lists')
      .update({
        default_margin_percent: marginType === 'percent' ? marginValue : null,
        default_margin_fixed: marginType === 'fixed' ? marginValue : null,
        updated_at: new Date().toISOString(),
        metadata: updatedMetadata, // ✨ FIX: Usa oggetto JavaScript invece di raw SQL
      })
      .eq('id', priceListId)
      .eq('created_by', user.id) // Solo propri listini
      .eq('list_type', 'custom')
      .select()
      .single();

    if (error) {
      console.error('Errore aggiornamento margine:', error);
      return { success: false, error: 'Errore aggiornamento margine listino' };
    }

    // ✨ FIX: Restituisci data (risultato della query) invece di priceList (non definito)
    if (!data) {
      return {
        success: false,
        error: "Listino non trovato dopo l'aggiornamento",
      };
    }

    return { success: true, priceList: data as PriceList };
  } catch (error: any) {
    console.error('Errore updateResellerPriceListMarginAction:', error);
    return { success: false, error: 'Errore aggiornamento margine listino' };
  }
}

/**
 * Attiva un listino personalizzato
 *
 * @param priceListId - ID listino
 * @returns Listino attivato
 */
export async function activateResellerPriceListAction(priceListId: string): Promise<{
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
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    if (!user.is_reseller) {
      return {
        success: false,
        error: 'Non autorizzato',
      };
    }

    // Verifica che il listino esista e sia del reseller (isolamento multi-tenant)
    const wq = workspaceQuery(workspaceId);
    const { data: priceList } = await wq
      .from('price_lists')
      .select('id, list_type')
      .eq('id', priceListId)
      .eq('created_by', user.id)
      .eq('list_type', 'custom')
      .single();

    if (!priceList) {
      return {
        success: false,
        error: 'Listino non trovato o non autorizzato',
      };
    }

    // Attiva listino (con ownership filter per sicurezza)
    const { error } = await wq
      .from('price_lists')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', priceListId)
      .eq('created_by', user.id);

    if (error) {
      console.error('Errore attivazione listino:', error);
      return { success: false, error: 'Errore attivazione listino' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore activateResellerPriceListAction:', error);
    return { success: false, error: 'Errore attivazione listino' };
  }
}

/**
 * Importa entries da CSV per un listino personalizzato
 *
 * @param priceListId - ID listino
 * @param entries - Array di entries da importare
 * @returns Statistiche importazione
 */
export async function importPriceListEntriesAction(
  priceListId: string,
  entries: Array<{
    weight_from: number;
    weight_to: number;
    zone_code?: string;
    zip_code_from?: string;
    zip_code_to?: string;
    province_code?: string;
    region?: string;
    service_type?: string;
    base_price: number;
    fuel_surcharge_percent?: number;
    island_surcharge?: number;
    ztl_surcharge?: number;
    cash_on_delivery_surcharge?: number;
    insurance_rate_percent?: number;
    estimated_delivery_days_min?: number;
    estimated_delivery_days_max?: number;
  }>
): Promise<{
  success: boolean;
  inserted?: number;
  updated?: number;
  skipped?: number;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    if (!user.is_reseller) {
      return {
        success: false,
        error: 'Non autorizzato: solo reseller possono importare entries',
      };
    }

    // Verifica che il listino esista e sia del reseller (isolamento multi-tenant)
    const wq = workspaceQuery(workspaceId);
    const { data: priceList } = await wq
      .from('price_lists')
      .select('id, list_type')
      .eq('id', priceListId)
      .eq('created_by', user.id)
      .eq('list_type', 'custom')
      .single();

    if (!priceList) {
      return {
        success: false,
        error: 'Listino non trovato o non autorizzato',
      };
    }

    // Importa entries usando la funzione esistente
    const { upsertPriceListEntries } = await import('@/lib/db/price-lists');

    // ✨ FIX: Normalizza entries per garantire service_type valido
    const validServiceTypes: CourierServiceType[] = [
      'standard',
      'express',
      'economy',
      'same_day',
      'next_day',
    ];
    const normalizedEntries: Omit<PriceListEntry, 'id' | 'price_list_id' | 'created_at'>[] =
      entries.map((entry) => {
        // Assicura che service_type sia sempre definito e valido
        const serviceType: CourierServiceType =
          entry.service_type && validServiceTypes.includes(entry.service_type as CourierServiceType)
            ? (entry.service_type as CourierServiceType)
            : 'standard'; // Default a 'standard' se non valido o mancante

        return {
          ...entry,
          service_type: serviceType,
        };
      });

    const result = await upsertPriceListEntries(priceListId, normalizedEntries);

    // Logga evento audit
    try {
      await supabaseAdmin.rpc('log_price_list_event', {
        p_event_type: 'price_list_entry_imported',
        p_price_list_id: priceListId,
        p_actor_id: user.id,
        p_message: `Importate ${result.inserted || 0} entries, aggiornate ${result.updated || 0}`,
        p_metadata: {
          inserted: result.inserted || 0,
          updated: result.updated || 0,
          skipped: result.skipped || 0,
          total_entries: entries.length,
        },
        p_severity: 'info',
      });
    } catch (logError) {
      // Non bloccare l'operazione se il logging fallisce
      console.error('Errore logging import entries:', logError);
    }

    return {
      success: true,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
    };
  } catch (error: any) {
    console.error('Errore importPriceListEntriesAction:', error);
    return {
      success: false,
      error: 'Errore importazione entries listino',
    };
  }
}
