/**
 * Server Actions: Price Lists Quotes & Utilities
 *
 * Calcolo preventivi, clonazione, corrieri disponibili, audit events
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { getApplicablePriceList, getPriceListById } from '@/lib/db/price-lists';
import type { ClonePriceListInput, PriceCalculationResult } from '@/types/listini';
import type { CourierServiceType } from '@/types/shipments';
import { isAdminOrAbove, isSuperAdminCheck } from '@/lib/auth-helpers';
import { __clearMasterListCache } from '@/lib/db/price-lists-advanced';

/**
 * Ottiene listino applicabile per utente corrente
 *
 * M3: Usa getWorkspaceAuth per isolamento multi-tenant
 */
export async function getApplicablePriceListAction(courierId?: string): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    // M3: Passa workspaceId
    const priceList = await getApplicablePriceList(user.id, workspaceId, courierId);

    return { success: true, priceList };
  } catch (error: any) {
    console.error('Errore recupero listino applicabile:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Calcola preventivo usando sistema PriceRule
 *
 * AGGIORNATO: Per reseller, confronta automaticamente API Reseller vs API Master
 * e seleziona il prezzo migliore
 */
export async function calculateQuoteAction(
  params: {
    weight: number;
    volume?: number;
    destination: {
      zip?: string;
      province?: string;
      region?: string;
      country?: string;
    };
    courierId?: string;
    serviceType?: CourierServiceType;
    options?: {
      declaredValue?: number;
      cashOnDelivery?: boolean;
      insurance?: boolean;
    };
  },
  priceListId?: string
): Promise<{
  success: boolean;
  result?: PriceCalculationResult;
  error?: string;
  // NUOVO: Informazioni aggiuntive per reseller
  resellerComparison?: {
    apiSource: 'reseller' | 'master' | 'default';
    resellerPrice?: PriceCalculationResult;
    masterPrice?: PriceCalculationResult;
    priceDifference?: number;
  };
}> {
  try {
    // M3: Usa getWorkspaceAuth per avere context con workspace
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    // Se e reseller e non e specificato un listino, usa confronto automatico
    if (user.is_reseller && !priceListId) {
      const { calculateBestPriceForReseller } = await import('@/lib/db/price-lists-advanced');
      const bestPriceResult = await calculateBestPriceForReseller(user.id, workspaceId, params);

      if (!bestPriceResult) {
        return {
          success: false,
          error: 'Impossibile calcolare preventivo. Verifica listino configurato.',
        };
      }

      return {
        success: true,
        result: bestPriceResult.bestPrice,
        resellerComparison: {
          apiSource: bestPriceResult.apiSource,
          resellerPrice: bestPriceResult.resellerPrice,
          masterPrice: bestPriceResult.masterPrice,
          priceDifference: bestPriceResult.priceDifference,
        },
      };
    }

    // Calcolo normale (utente standard o listino specificato)
    const { calculatePriceWithRules } = await import('@/lib/db/price-lists-advanced');
    // M3: Passa workspaceId a calculatePriceWithRules
    const result = await calculatePriceWithRules(user.id, workspaceId, params, priceListId);

    if (!result) {
      return {
        success: false,
        error: 'Impossibile calcolare preventivo. Verifica listino configurato.',
      };
    }

    return { success: true, result };
  } catch (error: any) {
    console.error('Errore calcolo preventivo:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Clona un listino master creando una versione derivata
 * Solo superadmin puo clonare listini
 *
 * @param input - Dati per clonazione
 * @returns Listino clonato con tracciabilita master_list_id
 */
export async function clonePriceListAction(input: ClonePriceListInput): Promise<{
  success: boolean;
  priceList?: any;
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

    // Solo superadmin puo clonare
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin può clonare listini',
      };
    }

    // Verifica che il listino sorgente esista
    const sourcePriceList = await getPriceListById(input.source_price_list_id, workspaceId);
    if (!sourcePriceList) {
      return { success: false, error: 'Listino sorgente non trovato' };
    }

    // H7 FIX: Dedup check — previene clone duplicato con stesso nome
    const wqClone = workspaceQuery(workspaceId);
    const { data: existingClone } = await wqClone
      .from('price_lists')
      .select('id')
      .eq('name', input.name)
      .limit(1)
      .maybeSingle();

    if (existingClone) {
      return {
        success: false,
        error: `Esiste già un listino con il nome "${input.name}". Scegli un nome diverso.`,
      };
    }

    // Usa la funzione DB clone_price_list
    const { data: clonedId, error } = await supabaseAdmin.rpc('clone_price_list', {
      p_source_id: input.source_price_list_id,
      p_new_name: input.name,
      p_target_user_id: input.target_user_id || null,
      p_overrides: input.overrides || {},
    });

    if (error) {
      console.error('Errore clonazione listino:', error);
      return { success: false, error: error.message };
    }

    // Recupera il listino clonato
    const clonedPriceList = await getPriceListById(clonedId, workspaceId);

    console.log(
      `✅ [CLONE] Listino ${String(input.source_price_list_id).replace(/[\n\r\0]/g, '')} clonato come ${String(clonedId).replace(/[\n\r\0]/g, '')} (${String(input.name).replace(/[\n\r\0]/g, '')})`
    );

    // H8 FIX: Invalida cache master list dopo clonazione
    __clearMasterListCache();

    return { success: true, priceList: clonedPriceList };
  } catch (error: any) {
    console.error('Errore clonazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Recupera corrieri disponibili per l'utente corrente
 *
 * SERVER ACTION: Sostituisce chiamata diretta a getAvailableCouriersForUser
 * che causava errori 401 quando eseguita lato client (supabaseAdmin non disponibile)
 *
 * @returns Lista corrieri disponibili con info contratto
 */
export async function getAvailableCouriersForUserAction(): Promise<{
  success: boolean;
  couriers?: Array<{
    courierId: string;
    courierName: string;
    providerId: string;
    contractCode: string;
    doesClientPickup: boolean;
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
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    // Import dinamico per evitare problemi di bundling
    const { getAvailableCouriersForUser } = await import('@/lib/db/price-lists');
    const couriers = await getAvailableCouriersForUser(user.id);

    return { success: true, couriers };
  } catch (error: any) {
    console.error('Errore getAvailableCouriersForUserAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Recupera eventi audit per un listino
 */
export async function getPriceListAuditEventsAction(
  priceListId: string,
  options?: {
    eventTypes?: string[];
    limit?: number;
    offset?: number;
    actorId?: string;
  }
): Promise<{
  success: boolean;
  events?: Array<{
    id: string;
    event_type: string;
    severity: string;
    actor_id?: string;
    actor_email?: string;
    actor_type?: string;
    message?: string;
    old_value?: any;
    new_value?: any;
    metadata?: any;
    created_at: string;
  }>;
  total_count?: number;
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
        error: "Non hai i permessi per vedere l'audit di questo listino",
      };
    }

    // Recupera eventi
    const { data, error } = await supabaseAdmin.rpc('get_price_list_audit_events', {
      p_price_list_id: priceListId,
      p_event_types: options?.eventTypes || null,
      p_limit: options?.limit || 100,
      p_offset: options?.offset || 0,
      p_actor_id: options?.actorId || null,
    });

    if (error) {
      console.error('Errore get_price_list_audit_events:', error);
      return { success: false, error: error.message };
    }

    const events = data || [];
    const total_count = events.length > 0 ? events[0].total_count : 0;

    return {
      success: true,
      events: events.map((e: any) => ({
        id: e.id,
        event_type: e.event_type,
        severity: e.severity,
        actor_id: e.actor_id,
        actor_email: e.actor_email,
        actor_type: e.actor_type,
        message: e.message,
        old_value: e.old_value,
        new_value: e.new_value,
        metadata: e.metadata,
        created_at: e.created_at,
      })),
      total_count: Number(total_count),
    };
  } catch (error: any) {
    console.error('Errore getPriceListAuditEventsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
