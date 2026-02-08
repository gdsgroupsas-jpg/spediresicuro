'use server';

/**
 * Server Actions: Reseller Clients Management
 *
 * Gestione unificata clienti per Reseller con informazioni su listini assegnati.
 *
 * @module actions/reseller-clients
 * @since Sprint 2 - UX Unification
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

export interface ListinoInfo {
  id: string;
  name: string;
  margin_percent: number | null;
  status: string;
}

export interface ClientWithListino {
  id: string;
  email: string;
  name: string;
  company_name: string | null;
  phone: string | null;
  wallet_balance: number;
  created_at: string;
  shipments_count: number;
  total_spent: number;
  assigned_listini: ListinoInfo[];
}

export interface ClientsStatsResult {
  totalClients: number;
  activeClients: number;
  totalWalletBalance: number;
  totalShipments: number;
  clientsWithListino: number;
  clientsWithoutListino: number;
  totalRevenue: number;
}

/**
 * Ottiene i clienti del reseller con informazioni sui listini assegnati
 */
export async function getResellerClientsWithListino(): Promise<{
  success: boolean;
  clients?: ClientWithListino[];
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // Ottieni l'utente corrente
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type')
      .eq('email', context.actor.email)
      .single();

    if (userError || !currentUser) {
      return { success: false, error: 'Utente non trovato' };
    }

    // Verifica sia reseller o superadmin
    if (!currentUser.is_reseller && currentUser.account_type !== 'superadmin') {
      return { success: false, error: 'Non sei un reseller' };
    }

    // Strategia: workspace V2 (primaria) + fallback parent_id (legacy)
    let clientIds: string[] = [];

    // Trova il workspace dell'utente corrente
    const { data: userWs } = await supabaseAdmin
      .from('users')
      .select('primary_workspace_id')
      .eq('id', currentUser.id)
      .single();

    if (userWs?.primary_workspace_id) {
      // Workspace V2: trova tutti i workspace figli (reseller o client)
      const { data: childWorkspaces } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('parent_workspace_id', userWs.primary_workspace_id)
        .eq('status', 'active');

      if (childWorkspaces && childWorkspaces.length > 0) {
        const childWsIds = childWorkspaces.map((w) => w.id);

        // Trova gli owner di ogni workspace figlio
        const { data: childMembers } = await supabaseAdmin
          .from('workspace_members')
          .select('user_id')
          .in('workspace_id', childWsIds)
          .eq('role', 'owner')
          .eq('status', 'active');

        if (childMembers) {
          clientIds = childMembers.map((m) => m.user_id);
        }
      }
    }

    // Fallback legacy: cerca anche per parent_id (utenti pre-workspace)
    const { data: legacyClients } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', currentUser.id);

    if (legacyClients) {
      for (const lc of legacyClients) {
        if (!clientIds.includes(lc.id)) {
          clientIds.push(lc.id);
        }
      }
    }

    // Carica dati completi dei clienti trovati
    let clients: any[] = [];
    if (clientIds.length > 0) {
      const { data: clientsData, error: clientsError } = await supabaseAdmin
        .from('users')
        .select(
          `
          id,
          email,
          name,
          wallet_balance,
          created_at,
          dati_cliente,
          assigned_price_list_id
        `
        )
        .in('id', clientIds)
        .order('created_at', { ascending: false });

      if (clientsError) {
        console.error('Errore caricamento clienti:', clientsError);
        return { success: false, error: 'Errore nel caricamento dei clienti' };
      }

      clients = clientsData || [];
    }

    if (!clients || clients.length === 0) {
      return { success: true, clients: [] };
    }

    // Ottieni conteggio spedizioni e totale speso per ogni cliente
    const { data: shipmentsStats } = await supabaseAdmin
      .from('shipments')
      .select('user_id, cost')
      .in('user_id', clientIds);

    // Aggrega per utente
    const statsMap = new Map<string, { count: number; total: number }>();
    shipmentsStats?.forEach((s) => {
      const current = statsMap.get(s.user_id) || { count: 0, total: 0 };
      statsMap.set(s.user_id, {
        count: current.count + 1,
        total: current.total + (s.cost || 0),
      });
    });

    // Mappa multi-listino per utente (user_id -> ListinoInfo[])
    const assignmentMap = new Map<string, ListinoInfo[]>();
    const seenIds = new Map<string, Set<string>>(); // user_id -> Set<price_list_id> per dedup

    const addListino = (userId: string, pl: any) => {
      if (!pl?.id) return;
      if (!seenIds.has(userId)) seenIds.set(userId, new Set());
      if (seenIds.get(userId)!.has(pl.id)) return;
      seenIds.get(userId)!.add(pl.id);
      if (!assignmentMap.has(userId)) assignmentMap.set(userId, []);
      assignmentMap.get(userId)!.push({
        id: pl.id,
        name: pl.name,
        margin_percent: pl.default_margin_percent ?? pl.margin_percent ?? null,
        status: pl.status,
      });
    };

    // Fonte 1: price_list_assignments (N:N, revoked_at IS NULL)
    const { data: assignments } = await supabaseAdmin
      .from('price_list_assignments')
      .select(
        `
        user_id,
        price_list:price_lists!price_list_assignments_price_list_id_fkey(
          id,
          name,
          default_margin_percent,
          status
        )
      `
      )
      .in('user_id', clientIds)
      .is('revoked_at', null);

    assignments?.forEach((a) => {
      if (a.price_list) addListino(a.user_id, a.price_list);
    });

    // Fonte 2: price_lists.assigned_to_user_id (legacy diretto)
    const { data: directAssignments } = await supabaseAdmin
      .from('price_lists')
      .select('id, name, default_margin_percent, status, assigned_to_user_id')
      .in('assigned_to_user_id', clientIds)
      .eq('status', 'active');

    directAssignments?.forEach((pl) => {
      if (pl.assigned_to_user_id) addListino(pl.assigned_to_user_id, pl);
    });

    // Fonte 3: users.assigned_price_list_id (legacy singolo dalla RPC)
    const clientsWithAssignedPl = clients.filter((c) => (c as any).assigned_price_list_id);
    if (clientsWithAssignedPl.length > 0) {
      const plIds = clientsWithAssignedPl.map((c) => (c as any).assigned_price_list_id);
      const { data: userAssignedPls } = await supabaseAdmin
        .from('price_lists')
        .select('id, name, default_margin_percent, status')
        .in('id', plIds);

      const plMap = new Map<string, any>();
      userAssignedPls?.forEach((pl) => plMap.set(pl.id, pl));

      clientsWithAssignedPl.forEach((c) => {
        const pl = plMap.get((c as any).assigned_price_list_id);
        if (pl) addListino(c.id, pl);
      });
    }

    // Costruisci risultato finale
    const clientsWithListino: ClientWithListino[] = clients.map((client) => {
      const shipmentStats = statsMap.get(client.id) || { count: 0, total: 0 };

      return {
        id: client.id,
        email: client.email,
        name: client.name || client.email.split('@')[0],
        company_name: (client as any).dati_cliente?.ragioneSociale || null,
        phone:
          (client as any).dati_cliente?.telefono || (client as any).dati_cliente?.cellulare || null,
        wallet_balance: client.wallet_balance || 0,
        created_at: client.created_at,
        shipments_count: shipmentStats.count,
        total_spent: shipmentStats.total,
        assigned_listini: assignmentMap.get(client.id) || [],
      };
    });

    return { success: true, clients: clientsWithListino };
  } catch (error: any) {
    console.error('Errore getResellerClientsWithListino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export interface WorkspaceChild {
  id: string;
  name: string;
  type: string;
  depth: number;
  status: string;
  ownerName: string | null;
  ownerEmail: string | null;
}

/**
 * Ottiene i workspace figli per il pannello superadmin
 */
export async function getChildWorkspaces(): Promise<{
  success: boolean;
  workspaces?: WorkspaceChild[];
  platformName?: string;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('id, account_type, primary_workspace_id')
      .eq('email', context.actor.email)
      .single();

    if (!currentUser?.primary_workspace_id) {
      return { success: true, workspaces: [] };
    }

    // Carica workspace corrente (per il nome)
    const { data: parentWs } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', currentUser.primary_workspace_id)
      .single();

    // Carica workspace figli
    const { data: children } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, type, depth, status')
      .eq('parent_workspace_id', currentUser.primary_workspace_id)
      .eq('status', 'active')
      .order('name');

    if (!children || children.length === 0) {
      return { success: true, workspaces: [], platformName: parentWs?.name };
    }

    // Carica owner di ogni workspace figlio
    const wsIds = children.map((w) => w.id);
    const { data: owners } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id, user_id, users(name, email)')
      .in('workspace_id', wsIds)
      .eq('role', 'owner')
      .eq('status', 'active');

    const ownerMap = new Map<string, { name: string | null; email: string | null }>();
    owners?.forEach((o) => {
      const user = o.users as any;
      ownerMap.set(o.workspace_id, { name: user?.name, email: user?.email });
    });

    const workspaces: WorkspaceChild[] = children.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      depth: w.depth,
      status: w.status,
      ownerName: ownerMap.get(w.id)?.name || null,
      ownerEmail: ownerMap.get(w.id)?.email || null,
    }));

    return { success: true, workspaces, platformName: parentWs?.name };
  } catch (error: any) {
    console.error('Errore getChildWorkspaces:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Versione leggera: restituisce solo id, email, name dei clienti del reseller.
 * Usa la stessa logica Workspace V2 + fallback parent_id di getResellerClientsWithListino.
 * Utile per select/dropdown nei form (listini personalizzati, clonazione, ecc.)
 */
export async function getResellerClientsBasic(): Promise<{
  success: boolean;
  clients?: Array<{ id: string; email: string; name?: string }>;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: currentUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type, primary_workspace_id')
      .eq('email', context.actor.email)
      .single();

    if (userError || !currentUser) {
      return { success: false, error: 'Utente non trovato' };
    }

    if (!currentUser.is_reseller && currentUser.account_type !== 'superadmin') {
      return { success: false, error: 'Non sei un reseller' };
    }

    // Strategia: workspace V2 (primaria) + fallback parent_id (legacy)
    let clientIds: string[] = [];

    if (currentUser.primary_workspace_id) {
      const { data: childWorkspaces } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('parent_workspace_id', currentUser.primary_workspace_id)
        .eq('status', 'active');

      if (childWorkspaces && childWorkspaces.length > 0) {
        const childWsIds = childWorkspaces.map((w) => w.id);
        const { data: childMembers } = await supabaseAdmin
          .from('workspace_members')
          .select('user_id')
          .in('workspace_id', childWsIds)
          .eq('role', 'owner')
          .eq('status', 'active');

        if (childMembers) {
          clientIds = childMembers.map((m) => m.user_id);
        }
      }
    }

    // Fallback legacy: parent_id
    const { data: legacyClients } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', currentUser.id);

    if (legacyClients) {
      for (const lc of legacyClients) {
        if (!clientIds.includes(lc.id)) {
          clientIds.push(lc.id);
        }
      }
    }

    if (clientIds.length === 0) {
      return { success: true, clients: [] };
    }

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .in('id', clientIds)
      .order('name', { ascending: true });

    if (clientsError) {
      return { success: false, error: 'Errore caricamento clienti' };
    }

    return {
      success: true,
      clients: (clients || []).map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name || undefined,
      })),
    };
  } catch (error: any) {
    console.error('Errore getResellerClientsBasic:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function getResellerClientsStats(): Promise<{
  success: boolean;
  stats?: ClientsStatsResult;
  error?: string;
}> {
  try {
    const result = await getResellerClientsWithListino();

    if (!result.success || !result.clients) {
      return {
        success: true,
        stats: {
          totalClients: 0,
          activeClients: 0,
          totalWalletBalance: 0,
          totalShipments: 0,
          clientsWithListino: 0,
          clientsWithoutListino: 0,
          totalRevenue: 0,
        },
      };
    }

    const clients = result.clients;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Clienti attivi = almeno 1 spedizione negli ultimi 30 giorni
    // Per semplicità, consideriamo attivi quelli con shipments_count > 0
    const activeClients = clients.filter((c) => c.shipments_count > 0).length;

    const stats: ClientsStatsResult = {
      totalClients: clients.length,
      activeClients,
      totalWalletBalance: clients.reduce((sum, c) => sum + c.wallet_balance, 0),
      totalShipments: clients.reduce((sum, c) => sum + c.shipments_count, 0),
      clientsWithListino: clients.filter((c) => c.assigned_listini.length > 0).length,
      clientsWithoutListino: clients.filter((c) => c.assigned_listini.length === 0).length,
      totalRevenue: clients.reduce((sum, c) => sum + c.total_spent, 0),
    };

    return { success: true, stats };
  } catch (error: any) {
    console.error('Errore getResellerClientsStats:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
