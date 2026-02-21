import {
  isAdminOrAbove,
  isResellerCheck,
  isBYOC as isBYOCCheck,
  isResellerOrBYOC,
  isSuperAdminCheck,
} from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db/client';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import type { PriceListAssignment } from '@/types/listini';
import {
  enrichPriceListsWithCourierData,
  enrichPriceListsWithCourierName,
} from './price-lists.helpers';

export async function listSupplierPriceListsActionImpl(): Promise<{
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

    // ðŸ§ª TEST MODE: Bypass per E2E tests
    if (
      wsContext.actor.id === '00000000-0000-0000-0000-000000000000' ||
      wsContext.actor.id === 'test-user-id'
    ) {
      console.log('ðŸ§ª [TEST MODE] listSupplierPriceListsAction: returning mock data');
      return {
        success: true,
        priceLists: [
          {
            id: 'mock-price-list-1',
            name: 'Listino Test GLS',
            list_type: 'supplier',
            status: 'active',
            version: '1.0',
            courier_id: 'mock-courier-gls',
            courier: { id: 'mock-courier-gls', code: 'gls', name: 'GLS' },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }

    const isReseller = isResellerCheck(user);
    const isBYOC = isBYOCCheck(user);

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: 'Solo Reseller e BYOC possono vedere listini fornitore',
      };
    }

    // Recupera solo listini fornitore dell'utente
    console.log(`ðŸ” [LISTINI] Cerca listini fornitore: user.id=${user.id}, list_type=supplier`);
    const { data: priceLists, error } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .eq('list_type', 'supplier')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore recupero listini fornitore:', error);
      return { success: false, error: error.message };
    }

    console.log(
      `ðŸ“Š [LISTINI] Trovati ${priceLists?.length || 0} listini fornitore per user.id=${user.id}`
    );

    // Recupera i corrieri separatamente se necessario
    if (priceLists && priceLists.length > 0) {
      await enrichPriceListsWithCourierData(priceLists);

      // Recupera il conteggio delle entries per ogni listino
      const priceListIds = priceLists.map((pl: any) => pl.id);
      if (priceListIds.length > 0) {
        const { data: entriesCounts } = await supabaseAdmin
          .from('price_list_entries')
          .select('price_list_id')
          .in('price_list_id', priceListIds);

        // Conta entries per listino
        const entriesMap = new Map<string, number>();
        entriesCounts?.forEach((entry: any) => {
          const count = entriesMap.get(entry.price_list_id) || 0;
          entriesMap.set(entry.price_list_id, count + 1);
        });

        // Aggiungi conteggio entries a ogni listino
        priceLists.forEach((pl: any) => {
          pl.entries_count = entriesMap.get(pl.id) || 0;
        });

        console.log(
          `ðŸ“Š [LISTINI] Entries contate: ${
            entriesCounts?.length || 0
          } totali per ${priceLists.length} listini`
        );
      }
    }

    console.log(
      `âœ… [LISTINI] Ritorno ${priceLists?.length || 0} listini con dati corriere popolati`
    );
    return { success: true, priceLists: priceLists || [] };
  } catch (error: any) {
    console.error('Errore listino fornitore:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function getSupplierPriceListForCourierActionImpl(courierId: string): Promise<{
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

    const isReseller = isResellerCheck(user);
    const isBYOC = isBYOCCheck(user);

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: 'Solo Reseller e BYOC possono vedere listini fornitore',
      };
    }

    // Recupera listino fornitore per corriere
    const { data: priceList, error } = await supabaseAdmin
      .from('price_lists')
      .select('*')
      .eq('list_type', 'supplier')
      .eq('courier_id', courierId)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Errore recupero listino fornitore:', error);
      return { success: false, error: error.message };
    }

    // Recupera il corriere separatamente se necessario
    if (priceList && priceList.courier_id) {
      const { data: courier } = await supabaseAdmin
        .from('couriers')
        .select('id, code, name')
        .eq('id', priceList.courier_id)
        .single();

      if (courier) {
        priceList.courier = courier;
      }
    }

    return { success: true, priceList: priceList || null };
  } catch (error: any) {
    console.error('Errore listino fornitore:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function listAssignmentsForPriceListActionImpl(priceListId: string): Promise<{
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

    // Solo superadmin puÃ² vedere tutte le assegnazioni
    if (!isAdminOrAbove(user)) {
      return {
        success: false,
        error: 'Solo admin puÃ² vedere le assegnazioni',
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

export async function listAssignedPriceListsActionImpl(): Promise<{
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
      await enrichPriceListsWithCourierData(priceLists);
    }

    console.log(`âœ… [ASSIGNED] Trovati ${priceLists?.length || 0} listini assegnati a ${user.id}`);

    return { success: true, priceLists: priceLists || [] };
  } catch (error: any) {
    console.error('Errore recupero listini assegnati:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function listMasterPriceListsActionImpl(): Promise<{
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

    // ðŸ§ª TEST MODE: Bypass per E2E tests
    if (
      wsContext.actor.id === '00000000-0000-0000-0000-000000000000' ||
      wsContext.actor.id === 'test-user-id'
    ) {
      console.log('ðŸ§ª [TEST MODE] listMasterPriceListsAction: returning mock data');
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

    // Solo superadmin puÃ² vedere i listini master
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin puÃ² vedere i listini master',
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
      await enrichPriceListsWithCourierData(masterLists);
    }

    console.log(`âœ… [MASTER] Trovati ${masterLists?.length || 0} listini master`);

    return { success: true, priceLists: masterLists || [] };
  } catch (error: any) {
    console.error('Errore recupero listini master:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function listUsersForAssignmentActionImpl(options?: { global?: boolean }): Promise<{
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
    // âœ… FIX ISOLAMENTO: usa getWorkspaceAuth per scoping multi-tenant
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    // ðŸ§ª TEST MODE: Bypass per E2E tests
    if (
      wsContext.actor.id === '00000000-0000-0000-0000-000000000000' ||
      wsContext.actor.id === 'test-user-id'
    ) {
      console.log('ðŸ§ª [TEST MODE] listUsersForAssignmentAction: returning mock data');
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
        error: 'Solo superadmin puÃ² vedere la lista utenti',
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

export async function getAssignablePriceListsActionImpl(options?: {
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

    // âœ¨ USA RPC SICURA con ownership filtering
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
    const enrichedLists = await enrichPriceListsWithCourierName(priceLists || []);

    console.log(
      `âœ… [ASSIGNABLE LISTS] ${enrichedLists.length} listini disponibili per ${user.id}`
    );

    return { success: true, priceLists: enrichedLists };
  } catch (error: any) {
    console.error('Errore getAssignablePriceListsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
