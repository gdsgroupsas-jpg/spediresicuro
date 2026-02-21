/**
 * Server Actions: Price Lists Management
 *
 * Gestione completa listini prezzi con sistema PriceRule avanzato
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { createPriceList, getPriceListById, updatePriceList } from '@/lib/db/price-lists';
import type {
  AssignPriceListInput,
  ClonePriceListInput,
  CreatePriceListInput,
  PriceCalculationResult,
  PriceListAssignment,
  UpdatePriceListInput,
} from '@/types/listini';
import type { CourierServiceType } from '@/types/shipments';
import { isAdminOrAbove, isResellerCheck, isSuperAdminCheck } from '@/lib/auth-helpers';
import { validateCreateListType, validateUpdateListType } from '@ss/domain-pricing';
import { __clearMasterListCache } from '@/lib/db/price-lists-advanced';
import {
  enrichPriceListsWithCourierData,
  logUpdatePriceListAuditEvents,
} from './price-lists.helpers';
import {
  assignPriceListToUserViaTableActionImpl,
  clonePriceListActionImpl,
  getAvailableCouriersForUserActionImpl,
  getPriceListAuditEventsActionImpl,
  revokePriceListAssignmentActionImpl,
} from './price-lists-management.impl';
import {
  getAssignablePriceListsActionImpl,
  getSupplierPriceListForCourierActionImpl,
  listAssignedPriceListsActionImpl,
  listAssignmentsForPriceListActionImpl,
  listMasterPriceListsActionImpl,
  listSupplierPriceListsActionImpl,
  listUsersForAssignmentActionImpl,
} from './price-lists-listing.impl';
import {
  assignPriceListToUserActionImpl,
  bulkUpdateUserListiniActionImpl,
  calculateQuoteActionImpl,
  createSupplierPriceListActionImpl,
  deletePriceListActionImpl,
  getApplicablePriceListActionImpl,
  revokePriceListFromUserActionImpl,
} from './price-lists-operations.impl';

/**
 * Crea nuovo listino prezzi
 */
export async function createPriceListAction(data: CreatePriceListInput): Promise<{
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

    const createPolicy = validateCreateListType({
      actor: user,
      listType: data.list_type as 'global' | 'supplier' | 'custom' | undefined,
      isGlobal: data.is_global,
    });
    if (!createPolicy.valid) {
      return { success: false, error: createPolicy.error };
    }
    if (createPolicy.listType && !data.list_type) {
      data.list_type = createPolicy.listType;
    }

    const priceList = await createPriceList(data, user.id, workspaceId);

    // H8 FIX: Invalida cache master list dopo creazione
    __clearMasterListCache();

    return { success: true, priceList };
  } catch (error: any) {
    console.error('Errore creazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Aggiorna listino esistente
 */
export async function updatePriceListAction(
  id: string,
  data: UpdatePriceListInput
): Promise<{
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

    // Recupera listino esistente
    const existingPriceList = await getPriceListById(id, workspaceId);
    if (!existingPriceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    // Verifica permessi: admin, creatore, O proprietario (assigned_to_user_id)
    const isAdmin = isAdminOrAbove(user);
    const isOwner = existingPriceList.created_by === user.id;
    const isAssignedOwner = existingPriceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questo listino',
      };
    }

    const updatePolicy = validateUpdateListType({
      actor: user,
      requestedListType: data.list_type as 'global' | 'supplier' | 'custom' | undefined,
    });
    if (!updatePolicy.valid) {
      return { success: false, error: updatePolicy.error };
    }

    const updated = await updatePriceList(id, data, user.id, workspaceId);

    await logUpdatePriceListAuditEvents({
      priceListId: id,
      actorId: user.id,
      existingPriceList,
      updatedPriceList: updated,
      updateInput: {
        name: data.name,
        status: data.status,
        default_margin_percent: data.default_margin_percent,
        rules: data.rules as any[] | undefined,
      },
    });

    // H8 FIX: Invalida cache master list dopo aggiornamento
    __clearMasterListCache();

    return { success: true, priceList: updated };
  } catch (error: any) {
    console.error('Errore aggiornamento listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Ottiene listino applicabile per utente corrente
 *
 * âœ¨ M3: Usa getWorkspaceAuth per isolamento multi-tenant
 */
export async function getApplicablePriceListAction(courierId?: string): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  return getApplicablePriceListActionImpl(courierId);
}

/**
 * Calcola preventivo usando sistema PriceRule
 *
 * âœ¨ AGGIORNATO: Per reseller, confronta automaticamente API Reseller vs API Master
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
  // âœ¨ NUOVO: Informazioni aggiuntive per reseller
  resellerComparison?: {
    apiSource: 'reseller' | 'master' | 'default';
    resellerPrice?: PriceCalculationResult;
    masterPrice?: PriceCalculationResult;
    priceDifference?: number;
  };
}> {
  return calculateQuoteActionImpl(params, priceListId);
}

/**
 * Assegna listino a utente
 *
 * âœ¨ SICUREZZA TOP-TIER:
 * - Usa RPC assign_listino_to_user_secure
 * - Verifica ownership: reseller puÃ² assegnare SOLO i suoi listini
 * - Verifica parentela: reseller puÃ² assegnare SOLO ai suoi clienti
 * - Superadmin puÃ² assegnare qualsiasi listino a qualsiasi utente
 */
export async function assignPriceListToUserAction(
  userId: string,
  priceListId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  return assignPriceListToUserActionImpl(userId, priceListId);
}

/**
 * Revoca listino da utente (soft delete in price_list_assignments)
 */
export async function revokePriceListFromUserAction(
  userId: string,
  priceListId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  return revokePriceListFromUserActionImpl(userId, priceListId);
}

/**
 * Aggiorna listini assegnati a un utente in modo atomico (singola transazione DB).
 * Calcola differenziale: aggiunge i nuovi, revoca i rimossi.
 */
export async function bulkUpdateUserListiniAction(
  userId: string,
  selectedListinoIds: string[]
): Promise<{
  success: boolean;
  added: number;
  removed: number;
  error?: string;
}> {
  return bulkUpdateUserListiniActionImpl(userId, selectedListinoIds);
}

/**
 * Ottiene listino per ID
 */
export async function getPriceListByIdAction(id: string): Promise<{
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

    // âœ… FIX P0-2: Verifica authorization PRIMA di recuperare listino
    // Previene information disclosure
    const { data: canAccess, error: accessError } = await supabaseAdmin.rpc(
      'can_access_price_list',
      {
        p_user_id: user.id,
        p_price_list_id: id,
      }
    );

    if (accessError) {
      console.error('Errore verifica accesso:', accessError);
      return { success: false, error: 'Errore verifica permessi' };
    }

    if (!canAccess) {
      // Log unauthorized attempt per security monitoring
      console.warn(
        `[SECURITY] Unauthorized access attempt: user ${user.id} tried to access price list ${id}`
      );

      // Tenta di loggare in audit table (best effort, non bloccare se fallisce)
      try {
        await supabaseAdmin.rpc('log_unauthorized_access', {
          p_user_id: user.id,
          p_resource_type: 'price_list',
          p_resource_id: id,
          p_message: 'Attempted to access price list without authorization',
          p_metadata: { action: 'getPriceListByIdAction' },
        });
      } catch {
        // Silent fail - audit logging non deve bloccare l'operazione
      }

      return {
        success: false,
        error: 'Non autorizzato a visualizzare questo listino',
      };
    }

    // Se autorizzato, recupera il listino
    const priceList = await getPriceListById(id, workspaceId);

    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    return { success: true, priceList };
  } catch (error: any) {
    console.error('Errore recupero listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Elimina listino esistente
 */
export async function deletePriceListAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return deletePriceListActionImpl(id);
}

/**
 * Lista tutti i listini (con filtri)
 */
export async function listPriceListsAction(filters?: {
  courierId?: string;
  status?: string;
  isGlobal?: boolean;
  assignedToUserId?: string;
}): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  try {
    // âœ… FIX ISOLAMENTO: usa getWorkspaceAuth per scoping multi-tenant
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const isSuperAdmin = isSuperAdminCheck(user);
    const isAdmin = isAdminOrAbove(user);

    // Superadmin/admin: query filtrata per workspace corrente
    // Include anche listini con workspace_id NULL creati dall'utente (legacy pre-migrazione)
    if (isAdmin) {
      // Recupera anche l'assigned_price_list_id del workspace
      const { data: wsRow } = await supabaseAdmin
        .from('workspaces')
        .select('assigned_price_list_id, selling_price_list_id')
        .eq('id', workspaceId)
        .single();

      const extraIds: string[] = [];
      if (wsRow?.assigned_price_list_id) extraIds.push(wsRow.assigned_price_list_id);
      if (wsRow?.selling_price_list_id) extraIds.push(wsRow.selling_price_list_id);

      // Query: SOLO listini del workspace corrente (isolamento multi-tenant)
      // Ogni listino ha workspace_id valorizzato dopo backfill del 2026-02-18
      let query = supabaseAdmin
        .from('price_lists')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.courierId) query = query.eq('courier_id', filters.courierId);
      if (filters?.isGlobal !== undefined) query = query.eq('is_global', filters.isGlobal);

      const { data, error } = await query;
      if (error) return { success: false, error: error.message };

      const results = data || [];
      const resultIds = new Set(results.map((pl: any) => pl.id));

      // Aggiungi listini assegnati al workspace ma non ancora nella lista
      const missingExtraIds = extraIds.filter((id) => !resultIds.has(id));
      if (missingExtraIds.length > 0) {
        const wq = workspaceQuery(workspaceId);
        let extraQuery = wq.from('price_lists').select('*').in('id', missingExtraIds);
        if (filters?.status) extraQuery = extraQuery.eq('status', filters.status);
        if (filters?.courierId) extraQuery = extraQuery.eq('courier_id', filters.courierId);

        const { data: extraLists } = await extraQuery;
        if (extraLists?.length) results.push(...extraLists);
      }

      // Popola dati corriere
      await enrichPriceListsWithCourierData(results);

      return { success: true, priceLists: results };
    }

    // Reseller/altri: usa RPC (gia' filtrato da RLS) + integrazione workspace
    const { data, error } = await supabaseAdmin.rpc('get_user_price_lists', {
      p_user_id: user.id,
      p_courier_id: filters?.courierId || null,
      p_status: filters?.status || null,
      p_is_global: filters?.isGlobal ?? null,
    });

    const isReseller = isResellerCheck(user);
    if (error && !isReseller) {
      return { success: false, error: error.message };
    }

    // Per reseller: integra listini assegnati + workspace
    if (isReseller) {
      const ownedIds = new Set((data || []).map((pl: any) => pl.id));

      // Listini assegnati via price_list_assignments (legacy)
      const { data: assignedIds } = await supabaseAdmin
        .from('price_list_assignments')
        .select('price_list_id')
        .eq('user_id', user.id)
        .is('revoked_at', null);

      // Listino assegnato direttamente via users.assigned_price_list_id (legacy)
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('assigned_price_list_id')
        .eq('id', user.id)
        .single();

      // Listini assegnati via workspace (sistema multi-tenant attuale)
      const { data: workspaceListIds } = await supabaseAdmin
        .from('workspace_members')
        .select('workspace:workspaces(assigned_price_list_id, selling_price_list_id)')
        .eq('user_id', user.id)
        .eq('status', 'active');

      const workspacePriceListIds: string[] = [];
      if (workspaceListIds) {
        for (const wm of workspaceListIds) {
          const ws = wm.workspace as any;
          if (ws?.assigned_price_list_id) workspacePriceListIds.push(ws.assigned_price_list_id);
          if (ws?.selling_price_list_id) workspacePriceListIds.push(ws.selling_price_list_id);
        }
      }

      const missingIds = [
        ...(assignedIds?.map((a: any) => a.price_list_id) || []),
        ...(userRow?.assigned_price_list_id ? [userRow.assigned_price_list_id] : []),
        ...workspacePriceListIds,
      ].filter((id) => id && !ownedIds.has(id));

      if (missingIds.length > 0) {
        const uniqueMissingIds = [...new Set(missingIds)];
        let assignedQuery = supabaseAdmin
          .from('price_lists')
          .select('*')
          .in('id', uniqueMissingIds);

        if (filters?.courierId) assignedQuery = assignedQuery.eq('courier_id', filters.courierId);
        if (filters?.status) assignedQuery = assignedQuery.eq('status', filters.status);

        const { data: assignedLists } = await assignedQuery;
        if (assignedLists?.length) {
          data!.push(...assignedLists);
        }
      }
    }

    // Popola dati corriere
    if (data) {
      await enrichPriceListsWithCourierData(data);
    }

    return { success: true, priceLists: data || [] };
  } catch (error: any) {
    console.error('Errore lista listini:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Crea listino fornitore per Reseller/BYOC
 *
 * @param data - Dati listino (courier_id obbligatorio per listini fornitore)
 * @returns Listino creato
 */
export async function createSupplierPriceListAction(
  data: Omit<CreatePriceListInput, 'list_type' | 'is_global'> & {
    courier_id: string;
    metadata?: {
      courier_config_id?: string;
      carrier_code?: string;
      contract_code?: string;
      synced_at?: string;
    };
  }
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  return createSupplierPriceListActionImpl(data);
}

/**
 * Lista listini fornitore dell'utente corrente
 *
 * @returns Array di listini fornitore
 */
export async function listSupplierPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  return listSupplierPriceListsActionImpl();
}

/**
 * Recupera listino fornitore per un corriere specifico
 *
 * @param courierId - ID corriere
 * @returns Listino fornitore o null
 */
export async function getSupplierPriceListForCourierAction(courierId: string): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  return getSupplierPriceListForCourierActionImpl(courierId);
}

// ============================================
// ENTERPRISE PRICE LIST MANAGEMENT
// Clonazione, Assegnazioni, Revoche
// ============================================

/**
 * Clona un listino master creando una versione derivata
 * Solo superadmin puÃ² clonare listini
 *
 * @param input - Dati per clonazione
 * @returns Listino clonato con tracciabilitÃ  master_list_id
 */
export async function clonePriceListAction(input: ClonePriceListInput): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  return clonePriceListActionImpl(input);
}

/**
 * Assegna un listino a un utente tramite tabella price_list_assignments
 * Solo superadmin puÃ² assegnare listini
 *
 * @param input - Dati assegnazione
 * @returns Assegnazione creata
 */
export async function assignPriceListToUserViaTableAction(input: AssignPriceListInput): Promise<{
  success: boolean;
  assignment?: PriceListAssignment;
  error?: string;
}> {
  return assignPriceListToUserViaTableActionImpl(input);
}

/**
 * Revoca un'assegnazione listino (soft delete per audit trail)
 * Solo superadmin puÃ² revocare
 *
 * @param assignmentId - ID assegnazione da revocare
 * @returns Successo/errore
 */
export async function revokePriceListAssignmentAction(assignmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  return revokePriceListAssignmentActionImpl(assignmentId);
}

/**
 * Lista tutte le assegnazioni per un listino specifico
 * Solo superadmin puÃ² vedere tutte le assegnazioni
 *
 * @param priceListId - ID listino
 * @returns Array di assegnazioni
 */
export async function listAssignmentsForPriceListAction(priceListId: string): Promise<{
  success: boolean;
  assignments?: PriceListAssignment[];
  error?: string;
}> {
  return listAssignmentsForPriceListActionImpl(priceListId);
}

/**
 * Lista listini assegnati all'utente corrente
 * Include sia assegnazioni dirette (assigned_to_user_id) che via tabella
 *
 * @returns Array di listini assegnati
 */
export async function listAssignedPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  return listAssignedPriceListsActionImpl();
}

/**
 * Lista listini master (listini originali senza master_list_id)
 * Solo superadmin puÃ² vedere i listini master
 *
 * @returns Array di listini master con conteggio derivazioni
 */
export async function listMasterPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  return listMasterPriceListsActionImpl();
}

/**
 * Lista utenti disponibili per assegnazione listini
 * Solo superadmin puÃ² vedere la lista utenti
 *
 * @returns Array di utenti reseller/BYOC
 */
export async function listUsersForAssignmentAction(options?: { global?: boolean }): Promise<{
  success: boolean;
  users?: Array<{
    id: string;
    email: string;
    name?: string;
    account_type: string;
    is_reseller: boolean;
  }>;
  error?: string;
}> {
  return listUsersForAssignmentActionImpl(options);
}

/**
 * âœ¨ NUOVO: Lista listini disponibili per assegnazione
 *
 * Usa RPC get_user_owned_price_lists per garantire ownership:
 * - Superadmin: vede tutti i listini
 * - Reseller: vede SOLO i listini che ha creato (privacy totale)
 * - Admin: vede globali + propri
 *
 * @returns Array di listini assegnabili
 */
export async function getAssignablePriceListsAction(options?: {
  listType?: string;
  status?: string;
}): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  return getAssignablePriceListsActionImpl(options);
}

/**
 * Recupera corrieri disponibili per l'utente corrente
 *
 * âš ï¸ SERVER ACTION: Sostituisce chiamata diretta a getAvailableCouriersForUser
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
  return getAvailableCouriersForUserActionImpl();
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
  return getPriceListAuditEventsActionImpl(priceListId, options);
}
