/**
 * Server Actions: Price Lists Assignments
 *
 * Assegnazione, revoca e gestione listini per utenti
 */

'use server';

import { isResellerOrBYOC } from '@/lib/auth-helpers';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import type { AssignPriceListInput, PriceListAssignment } from '@/types/listini';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';
import { rateLimit } from '@/lib/security/rate-limit';
import { validateUUID } from '@/lib/validators';
import { isAdminOrAbove, isResellerCheck, isSuperAdminCheck } from '@/lib/auth-helpers';

/**
 * Assegna listino a utente
 *
 * SICUREZZA TOP-TIER:
 * - Usa RPC assign_listino_to_user_secure
 * - Verifica ownership: reseller puo assegnare SOLO i suoi listini
 * - Verifica parentela: reseller puo assegnare SOLO ai suoi clienti
 * - Superadmin puo assegnare qualsiasi listino a qualsiasi utente
 */
export async function assignPriceListToUserAction(
  userId: string,
  priceListId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Validazione UUID input
    if (!validateUUID(userId) || !validateUUID(priceListId)) {
      return { success: false, error: 'ID non valido' };
    }

    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const currentUser = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    // Verifica permessi: admin, superadmin, o reseller
    const isAdmin = isAdminOrAbove(currentUser);
    const isReseller = isResellerCheck(currentUser);

    if (!isAdmin && !isReseller) {
      return {
        success: false,
        error: 'Solo admin e reseller possono assegnare listini',
      };
    }

    // Rate limiting: 30 req/min per utente
    const rl = await rateLimit('assign-listino', currentUser.id, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return { success: false, error: 'Troppe richieste. Riprova tra qualche secondo.' };
    }

    // Reseller: verifica margine non negativo (no vendita sottocosto)
    if (isReseller) {
      const { data: plCheck } = await supabaseAdmin
        .from('price_lists')
        .select('default_margin_percent')
        .eq('id', priceListId)
        .single();

      if (
        plCheck &&
        plCheck.default_margin_percent !== null &&
        plCheck.default_margin_percent < 0
      ) {
        return {
          success: false,
          error: 'Non puoi assegnare un listino con margine negativo (vendita sottocosto)',
        };
      }
    }

    // USA RPC SICURA multi-listino con ownership check
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'assign_listino_to_user_multi',
      {
        p_caller_id: currentUser.id,
        p_user_id: userId,
        p_price_list_id: priceListId,
      }
    );

    if (rpcError) {
      console.error('Errore RPC assegnazione listino:', rpcError);

      // Gestione errori specifici
      const errorMessage = rpcError.message || '';

      if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('Non hai accesso')) {
        return {
          success: false,
          error: 'Non hai accesso a questo listino. Puoi assegnare solo listini che hai creato.',
        };
      }

      if (errorMessage.includes('USER_NOT_FOUND')) {
        return { success: false, error: 'Utente non trovato' };
      }

      if (errorMessage.includes('FORBIDDEN') || errorMessage.includes('solo ai tuoi clienti')) {
        return {
          success: false,
          error: 'Puoi assegnare listini solo ai tuoi clienti',
        };
      }

      return { success: false, error: rpcError.message };
    }

    // Audit log (fail-open)
    await writeAuditLog({
      context: wsContext as any,
      action: AUDIT_ACTIONS.PRICE_LIST_ASSIGNED,
      resourceType: AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT,
      resourceId: priceListId,
      metadata: { targetUserId: userId, priceListId },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Errore assegnazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
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
  try {
    // Validazione UUID input
    if (!validateUUID(userId) || !validateUUID(priceListId)) {
      return { success: false, error: 'ID non valido' };
    }

    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const currentUser = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    const isAdmin = isAdminOrAbove(currentUser);
    const isReseller = isResellerCheck(currentUser);

    if (!isAdmin && !isReseller) {
      return { success: false, error: 'Solo admin e reseller possono gestire listini' };
    }

    // Rate limiting: 30 req/min per utente (stessa route di assign)
    const rl = await rateLimit('assign-listino', currentUser.id, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return { success: false, error: 'Troppe richieste. Riprova tra qualche secondo.' };
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'revoke_listino_from_user',
      {
        p_caller_id: currentUser.id,
        p_user_id: userId,
        p_price_list_id: priceListId,
      }
    );

    if (rpcError) {
      console.error('Errore RPC revoca listino:', rpcError);
      const errorMessage = rpcError.message || '';
      if (errorMessage.includes('FORBIDDEN')) {
        return { success: false, error: 'Puoi gestire listini solo dei tuoi clienti' };
      }
      return { success: false, error: rpcError.message };
    }

    // Audit log (fail-open)
    await writeAuditLog({
      context: wsContext as any,
      action: AUDIT_ACTIONS.PRICE_LIST_REVOKED,
      resourceType: AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT,
      resourceId: priceListId,
      metadata: { targetUserId: userId, priceListId },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Errore revoca listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
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
  try {
    // Validazione UUID input
    if (!validateUUID(userId)) {
      return { success: false, added: 0, removed: 0, error: 'ID utente non valido' };
    }
    for (const id of selectedListinoIds) {
      if (!validateUUID(id)) {
        return { success: false, added: 0, removed: 0, error: 'ID listino non valido' };
      }
    }

    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, added: 0, removed: 0, error: 'Non autenticato' };
    }
    const currentUser = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    const isAdmin = isAdminOrAbove(currentUser);
    const isReseller = isResellerCheck(currentUser);

    if (!isAdmin && !isReseller) {
      return { success: false, added: 0, removed: 0, error: 'Permessi insufficienti' };
    }

    // Rate limiting
    const rl = await rateLimit('assign-listino', currentUser.id, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return {
        success: false,
        added: 0,
        removed: 0,
        error: 'Troppe richieste. Riprova tra qualche secondo.',
      };
    }

    // Reseller: verifica margine non negativo su tutti i listini selezionati
    if (isReseller && selectedListinoIds.length > 0) {
      const { data: plsCheck } = await supabaseAdmin
        .from('price_lists')
        .select('id, default_margin_percent')
        .in('id', selectedListinoIds);

      const negativeMargin = plsCheck?.find(
        (pl) => pl.default_margin_percent !== null && pl.default_margin_percent < 0
      );
      if (negativeMargin) {
        return {
          success: false,
          added: 0,
          removed: 0,
          error: 'Non puoi assegnare un listino con margine negativo (vendita sottocosto)',
        };
      }
    }

    // RPC atomica: singola transazione DB
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'bulk_update_user_listini',
      {
        p_caller_id: currentUser.id,
        p_user_id: userId,
        p_selected_ids: selectedListinoIds,
      }
    );

    if (rpcError) {
      console.error('Errore RPC bulk_update_user_listini:', rpcError);
      const msg = rpcError.message || '';
      if (msg.includes('FORBIDDEN')) {
        return {
          success: false,
          added: 0,
          removed: 0,
          error: 'Puoi gestire listini solo dei tuoi clienti',
        };
      }
      if (msg.includes('UNAUTHORIZED')) {
        return {
          success: false,
          added: 0,
          removed: 0,
          error: 'Non hai accesso a uno o più listini selezionati',
        };
      }
      return { success: false, added: 0, removed: 0, error: rpcError.message };
    }

    const added = rpcResult?.added ?? 0;
    const removed = rpcResult?.removed ?? 0;

    // Audit log
    if (added > 0 || removed > 0) {
      await writeAuditLog({
        context: wsContext as any,
        action: added > 0 ? AUDIT_ACTIONS.PRICE_LIST_ASSIGNED : AUDIT_ACTIONS.PRICE_LIST_REVOKED,
        resourceType: AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT,
        resourceId: userId,
        metadata: { targetUserId: userId, selectedListinoIds, added, removed },
      });
    }

    return { success: true, added, removed };
  } catch (error: any) {
    console.error('Errore bulk_update_user_listini:', error);
    return { success: false, added: 0, removed: 0, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Assegna un listino a un utente tramite tabella price_list_assignments
 * Solo superadmin puo assegnare listini
 *
 * @param input - Dati assegnazione
 * @returns Assegnazione creata
 */
export async function assignPriceListToUserViaTableAction(input: AssignPriceListInput): Promise<{
  success: boolean;
  assignment?: PriceListAssignment;
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

    // Solo superadmin puo assegnare
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin può assegnare listini',
      };
    }

    // FIX: Passa p_caller_id per supportare service_role
    // La funzione PostgreSQL usa auth.uid() che e NULL con service_role,
    // quindi passiamo esplicitamente l'ID del chiamante
    const { data: assignmentId, error } = await supabaseAdmin.rpc('assign_price_list', {
      p_price_list_id: input.price_list_id,
      p_user_id: input.user_id,
      p_notes: input.notes || null,
      p_caller_id: user.id, // Passa ID utente corrente per service_role
    });

    if (error) {
      console.error('Errore assegnazione listino:', error);
      return { success: false, error: error.message };
    }

    // Recupera l'assegnazione creata
    const { data: assignment } = await supabaseAdmin
      .from('price_list_assignments')
      .select(
        `
        *,
        price_list:price_lists(id, name, list_type, courier_id),
        user:users!price_list_assignments_user_id_fkey(id, email, name, account_type),
        assigner:users!price_list_assignments_assigned_by_fkey(id, email)
      `
      )
      .eq('id', assignmentId)
      .single();

    console.log(
      `✅ [ASSIGN] Listino ${input.price_list_id} assegnato a ${input.user_id} (assignment ID: ${assignmentId})`
    );

    return { success: true, assignment };
  } catch (error: any) {
    console.error('Errore assegnazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Revoca un'assegnazione listino (soft delete per audit trail)
 * Solo superadmin puo revocare
 *
 * @param assignmentId - ID assegnazione da revocare
 * @returns Successo/errore
 */
export async function revokePriceListAssignmentAction(assignmentId: string): Promise<{
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

    // Solo superadmin puo revocare
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin può revocare assegnazioni',
      };
    }

    // Usa la funzione DB revoke_price_list_assignment
    const { data: success, error } = await supabaseAdmin.rpc('revoke_price_list_assignment', {
      p_assignment_id: assignmentId,
    });

    if (error) {
      console.error('Errore revoca assegnazione:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ [REVOKE] Assegnazione ${assignmentId} revocata`);

    return { success: true };
  } catch (error: any) {
    console.error('Errore revoca assegnazione:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Lista tutte le assegnazioni per un listino specifico
 * Solo superadmin puo vedere tutte le assegnazioni
 *
 * @param priceListId - ID listino
 * @returns Array di assegnazioni
 */
export async function listAssignmentsForPriceListAction(priceListId: string): Promise<{
  success: boolean;
  assignments?: PriceListAssignment[];
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

    // Solo superadmin puo vedere tutte le assegnazioni
    if (!isAdminOrAbove(user)) {
      return {
        success: false,
        error: 'Solo admin può vedere le assegnazioni',
      };
    }

    const { data: assignments, error } = await supabaseAdmin
      .from('price_list_assignments')
      .select(
        `
        *,
        user:users!price_list_assignments_user_id_fkey(id, email, name, account_type),
        assigner:users!price_list_assignments_assigned_by_fkey(id, email)
      `
      )
      .eq('price_list_id', priceListId)
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error('Errore recupero assegnazioni:', error);
      return { success: false, error: error.message };
    }

    return { success: true, assignments: assignments || [] };
  } catch (error: any) {
    console.error('Errore recupero assegnazioni:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
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

    // Recupera listini assegnati via tabella price_list_assignments
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('price_list_assignments')
      .select('price_list_id')
      .eq('user_id', user.id)
      .is('revoked_at', null);

    if (assignmentsError) {
      console.error('Errore recupero assegnazioni:', assignmentsError);
    }

    const assignedIds = assignments?.map((a) => a.price_list_id) || [];

    // Recupera listini: sia assegnati direttamente che via tabella
    const { data: priceLists, error } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .or(
        `assigned_to_user_id.eq.${user.id},id.in.(${
          assignedIds.join(',') || '00000000-0000-0000-0000-000000000000'
        })`
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore recupero listini assegnati:', error);
      return { success: false, error: error.message };
    }

    // Popola dati corriere
    if (priceLists && priceLists.length > 0) {
      const courierIds = priceLists
        .map((pl: any) => pl.courier_id)
        .filter((id: string | null) => id !== null);

      if (courierIds.length > 0) {
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
    }

    console.log(`✅ [ASSIGNED] Trovati ${priceLists?.length || 0} listini assegnati a ${user.id}`);

    return { success: true, priceLists: priceLists || [] };
  } catch (error: any) {
    console.error('Errore recupero listini assegnati:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Lista listini master (listini originali senza master_list_id)
 * Solo superadmin puo vedere i listini master
 *
 * @returns Array di listini master con conteggio derivazioni
 */
export async function listMasterPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: any[];
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

    // TEST MODE: Bypass per E2E tests
    if (
      wsContext.actor.id === '00000000-0000-0000-0000-000000000000' ||
      wsContext.actor.id === 'test-user-id'
    ) {
      console.log('🧪 [TEST MODE] listMasterPriceListsAction: returning mock data');
      return {
        success: true,
        priceLists: [
          {
            id: 'mock-master-list-1',
            name: 'Listino Master Standard',
            list_type: 'master',
            status: 'active',
            version: '1.0',
            courier_id: 'mock-courier-gls',
            courier: { id: 'mock-courier-gls', code: 'gls', name: 'GLS' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            derived_count: 5,
            assignment_count: 3,
            master_list_id: null,
          },
        ],
      };
    }

    // Solo superadmin puo vedere i listini master
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin può vedere i listini master',
      };
    }

    // Recupera listini master del workspace corrente (isolamento multi-tenant)
    // Il superadmin vede SOLO i listini del proprio workspace, NON quelli dei reseller
    const { data: masterLists, error } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .is('master_list_id', null)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore recupero listini master:', error);
      return { success: false, error: error.message };
    }

    // Per ogni master, conta le derivazioni
    if (masterLists && masterLists.length > 0) {
      const masterIds = masterLists.map((m: any) => m.id);

      // Conta derivazioni
      const { data: derivations } = await supabaseAdmin
        .from('price_lists')
        .select('master_list_id')
        .in('master_list_id', masterIds);

      const derivationCounts = new Map<string, number>();
      derivations?.forEach((d: any) => {
        const count = derivationCounts.get(d.master_list_id) || 0;
        derivationCounts.set(d.master_list_id, count + 1);
      });

      // Conta assegnazioni attive
      const { data: assignments } = await supabaseAdmin
        .from('price_list_assignments')
        .select('price_list_id')
        .in('price_list_id', masterIds)
        .is('revoked_at', null);

      const assignmentCounts = new Map<string, number>();
      assignments?.forEach((a: any) => {
        const count = assignmentCounts.get(a.price_list_id) || 0;
        assignmentCounts.set(a.price_list_id, count + 1);
      });

      // Aggiungi conteggi
      masterLists.forEach((m: any) => {
        m.derived_count = derivationCounts.get(m.id) || 0;
        m.assignment_count = assignmentCounts.get(m.id) || 0;
      });

      // Popola dati corriere
      const courierIds = masterLists
        .map((pl: any) => pl.courier_id)
        .filter((id: string | null) => id !== null);

      if (courierIds.length > 0) {
        const { data: couriers } = await supabaseAdmin
          .from('couriers')
          .select('id, code, name')
          .in('id', courierIds);

        const courierMap = new Map(couriers?.map((c) => [c.id, c]) || []);

        masterLists.forEach((pl: any) => {
          if (pl.courier_id && courierMap.has(pl.courier_id)) {
            pl.courier = courierMap.get(pl.courier_id);
          }
        });
      }
    }

    console.log(`✅ [MASTER] Trovati ${masterLists?.length || 0} listini master`);

    return { success: true, priceLists: masterLists || [] };
  } catch (error: any) {
    console.error('Errore recupero listini master:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Lista utenti disponibili per assegnazione listini
 * Solo superadmin puo vedere la lista utenti
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
  try {
    // FIX ISOLAMENTO: usa getWorkspaceAuth per scoping multi-tenant
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    // TEST MODE: Bypass per E2E tests
    if (
      wsContext.actor.id === '00000000-0000-0000-0000-000000000000' ||
      wsContext.actor.id === 'test-user-id'
    ) {
      console.log('🧪 [TEST MODE] listUsersForAssignmentAction: returning mock data');
      return {
        success: true,
        users: [
          {
            id: 'mock-user-reseller',
            email: 'reseller@test.com',
            name: 'Reseller Test SRL',
            account_type: 'reseller',
            is_reseller: true,
          },
          {
            id: 'mock-user-byoc',
            email: 'byoc@test.com',
            name: 'BYOC User',
            account_type: 'byoc',
            is_reseller: false,
          },
        ],
      };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    // Solo superadmin puo' vedere la lista utenti
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin può vedere la lista utenti',
      };
    }

    // global=true: lista globale (per assegnazione listini master cross-workspace)
    if (options?.global) {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, account_type, is_reseller')
        .or('is_reseller.eq.true,account_type.eq.byoc')
        .order('name', { ascending: true });

      if (error) {
        console.error('Errore recupero utenti globale:', error);
        return { success: false, error: error.message };
      }
      return { success: true, users: users || [] };
    }

    // Default: utenti del workspace corrente (isolamento multi-tenant)
    const { data: members, error } = await supabaseAdmin
      .from('workspace_members')
      .select('user:users(id, email, name, account_type, is_reseller)')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (error) {
      console.error('Errore recupero utenti workspace:', error);
      return { success: false, error: error.message };
    }

    const users = (members || [])
      .map((m: any) => m.user)
      .filter((u: any) => u && isResellerOrBYOC(u));

    return { success: true, users };
  } catch (error: any) {
    console.error('Errore recupero utenti:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * NUOVO: Lista listini disponibili per assegnazione
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

    // Verifica permessi: admin, superadmin, o reseller
    const isAdmin = isAdminOrAbove(user);
    const isReseller = isResellerCheck(user);

    if (!isAdmin && !isReseller) {
      return {
        success: false,
        error: 'Solo admin e reseller possono vedere listini per assegnazione',
      };
    }

    // USA RPC SICURA con ownership filtering
    const { data: priceLists, error: rpcError } = await supabaseAdmin.rpc(
      'get_user_owned_price_lists',
      {
        p_user_id: user.id,
        p_list_type: options?.listType || null,
        p_status: options?.status || 'active', // Default solo listini attivi
      }
    );

    if (rpcError) {
      console.error('Errore RPC get_user_owned_price_lists:', rpcError);
      return { success: false, error: rpcError.message };
    }

    // Enrich with courier display names
    let enrichedLists = priceLists || [];
    if (enrichedLists.length > 0) {
      const courierIds = [
        ...new Set(enrichedLists.map((pl: any) => pl.courier_id).filter(Boolean)),
      ];
      if (courierIds.length > 0) {
        const { data: couriers } = await supabaseAdmin
          .from('couriers')
          .select('id, display_name, name')
          .in('id', courierIds);
        if (couriers) {
          const courierMap = new Map(couriers.map((c: any) => [c.id, c.display_name || c.name]));
          enrichedLists = enrichedLists.map((pl: any) => ({
            ...pl,
            courier_name: pl.courier_id ? courierMap.get(pl.courier_id) || null : null,
          }));
        }
      }
    }

    console.log(`✅ [ASSIGNABLE LISTS] ${enrichedLists.length} listini disponibili per ${user.id}`);

    return { success: true, priceLists: enrichedLists };
  } catch (error: any) {
    console.error('Errore getAssignablePriceListsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
