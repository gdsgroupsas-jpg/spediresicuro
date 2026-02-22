/**
 * Server Actions: Price Lists CRUD
 *
 * Creazione, lettura, aggiornamento, eliminazione e lista listini
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import {
  createPriceList,
  deletePriceList,
  getPriceListById,
  updatePriceList,
} from '@/lib/db/price-lists';
import type { CreatePriceListInput, UpdatePriceListInput } from '@/types/listini';
import {
  isAdminOrAbove,
  isResellerCheck,
  isBYOC as isBYOCCheck,
  isSuperAdminCheck,
  isResellerOrBYOC,
} from '@/lib/auth-helpers';
import { __clearMasterListCache } from '@/lib/db/price-lists-advanced';
import { logPriceListEvent } from './_shared';

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

    // Verifica permessi
    const isAdmin = isAdminOrAbove(user);
    const isReseller = isResellerCheck(user);
    const isBYOC = isBYOCCheck(user);

    if (!isAdmin && !isReseller && !isBYOC) {
      return {
        success: false,
        error: 'Solo admin, reseller e BYOC possono creare listini',
      };
    }

    // Se list_type non specificato, imposta default basato su utente
    if (!data.list_type) {
      if (isAdmin && data.is_global) {
        data.list_type = 'global';
      } else if (isReseller || isBYOC) {
        data.list_type = 'supplier';
      }
    }

    // Validazione per BYOC: puo creare SOLO listini fornitore
    if (isBYOC && data.list_type !== 'supplier') {
      return {
        success: false,
        error: 'BYOC può creare solo listini fornitore (list_type = supplier)',
      };
    }

    // Validazione per Reseller: non puo creare listini globali
    if (isReseller && data.list_type === 'global') {
      return {
        success: false,
        error: 'Reseller non può creare listini globali',
      };
    }

    // Se non e admin, non puo creare listini globali
    if (data.is_global && !isAdmin) {
      return {
        success: false,
        error: 'Solo gli admin possono creare listini globali',
      };
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

    // Validazione per BYOC: non puo cambiare list_type
    if (isBYOCCheck(user) && data.list_type && data.list_type !== 'supplier') {
      return {
        success: false,
        error: 'BYOC può modificare solo listini fornitore',
      };
    }

    // Validazione per Reseller: non puo cambiare list_type a 'global'
    const isReseller = isResellerCheck(user);
    if (isReseller && data.list_type === 'global') {
      return {
        success: false,
        error: 'Reseller non può creare listini globali',
      };
    }

    const updated = await updatePriceList(id, data, user.id, workspaceId);

    // Logga evento audit
    const changes: Record<string, any> = {};
    if (data.name && data.name !== existingPriceList.name) {
      changes.name = { from: existingPriceList.name, to: data.name };
    }
    if (data.status && data.status !== existingPriceList.status) {
      changes.status = { from: existingPriceList.status, to: data.status };
      // Logga attivazione/disattivazione separatamente
      if (data.status === 'active' && existingPriceList.status !== 'active') {
        await logPriceListEvent(
          'price_list_activated',
          id,
          user.id,
          `Listino attivato: ${updated.name || existingPriceList.name}`
        );
      } else if (data.status === 'archived' && existingPriceList.status !== 'archived') {
        await logPriceListEvent(
          'price_list_archived',
          id,
          user.id,
          `Listino archiviato: ${updated.name || existingPriceList.name}`
        );
      }
    }
    if (
      data.default_margin_percent !== undefined &&
      data.default_margin_percent !== existingPriceList.default_margin_percent
    ) {
      changes.default_margin_percent = {
        from: existingPriceList.default_margin_percent,
        to: data.default_margin_percent,
      };
      await logPriceListEvent(
        'price_list_margin_updated',
        id,
        user.id,
        `Margine aggiornato: ${existingPriceList.default_margin_percent}% → ${data.default_margin_percent}%`,
        { default_margin_percent: existingPriceList.default_margin_percent },
        { default_margin_percent: data.default_margin_percent }
      );
    }
    if (data.rules !== undefined) {
      changes.rules = {
        from: (existingPriceList.rules as any[])?.length || 0,
        to: (data.rules as any[])?.length || 0,
      };
      // Logga modifiche regole
      const oldRulesCount = (existingPriceList.rules as any[])?.length || 0;
      const newRulesCount = (data.rules as any[])?.length || 0;
      if (newRulesCount > oldRulesCount) {
        await logPriceListEvent(
          'price_list_rule_created',
          id,
          user.id,
          `Regola creata: ${newRulesCount - oldRulesCount} nuova/e`,
          { rules_count: oldRulesCount },
          { rules_count: newRulesCount }
        );
      } else if (newRulesCount < oldRulesCount) {
        await logPriceListEvent(
          'price_list_rule_deleted',
          id,
          user.id,
          `Regola eliminata: ${oldRulesCount - newRulesCount} rimossa/e`,
          { rules_count: oldRulesCount },
          { rules_count: newRulesCount }
        );
      } else {
        await logPriceListEvent(
          'price_list_rule_updated',
          id,
          user.id,
          `Regole modificate: ${newRulesCount} regole`,
          { rules_count: oldRulesCount },
          { rules_count: newRulesCount }
        );
      }
    }

    // Logga aggiornamento generale se ci sono modifiche
    if (Object.keys(changes).length > 0) {
      await logPriceListEvent(
        'price_list_updated',
        id,
        user.id,
        `Listino aggiornato: ${Object.keys(changes).join(', ')}`,
        existingPriceList,
        updated
      );
    }

    // H8 FIX: Invalida cache master list dopo aggiornamento
    __clearMasterListCache();

    return { success: true, priceList: updated };
  } catch (error: any) {
    console.error('Errore aggiornamento listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
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

    // FIX P0-2: Verifica authorization PRIMA di recuperare listino
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
        error: 'Non hai i permessi per eliminare questo listino',
      };
    }

    // Validazione per BYOC: puo eliminare solo listini fornitore
    const isBYOC = isBYOCCheck(user);
    if (isBYOC && existingPriceList.list_type !== 'supplier') {
      return {
        success: false,
        error: 'BYOC può eliminare solo listini fornitore',
      };
    }

    await deletePriceList(id, workspaceId);

    // H8 FIX: Invalida cache master list dopo eliminazione
    __clearMasterListCache();

    return { success: true };
  } catch (error: any) {
    console.error('Errore eliminazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/** Helper: arricchisce listini con dati corriere */
async function enrichWithCourierData(priceLists: any[]): Promise<void> {
  if (!priceLists.length) return;

  const courierIds = priceLists
    .map((pl: any) => pl.courier_id)
    .filter((id: string | null) => id !== null);

  if (courierIds.length === 0) return;

  const { data: couriers } = await supabaseAdmin
    .from('couriers')
    .select('id, code, name')
    .in('id', courierIds);

  const courierMap = new Map(couriers?.map((c) => [c.id, c]) || []);

  priceLists.forEach((pl: any) => {
    if (pl.courier_id && courierMap.has(pl.courier_id)) {
      pl.courier = courierMap.get(pl.courier_id);
    }
  });
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
    // FIX ISOLAMENTO: usa getWorkspaceAuth per scoping multi-tenant
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
      await enrichWithCourierData(results);

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
      await enrichWithCourierData(data);
    }

    return { success: true, priceLists: data || [] };
  } catch (error: any) {
    console.error('Errore lista listini:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
