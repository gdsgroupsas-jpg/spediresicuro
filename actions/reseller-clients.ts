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
  assigned_listino: {
    id: string;
    name: string;
    margin_percent: number | null;
    status: string;
  } | null;
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

    // Verifica sia reseller
    if (!currentUser.is_reseller && currentUser.account_type !== 'superadmin') {
      return { success: false, error: 'Non sei un reseller' };
    }

    // Query per ottenere i sub-users (clienti) del reseller
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('users')
      .select(
        `
        id,
        email,
        name,
        company_name,
        phone,
        wallet_balance,
        created_at
      `
      )
      .eq('parent_user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (clientsError) {
      console.error('Errore caricamento clienti:', clientsError);
      return { success: false, error: 'Errore nel caricamento dei clienti' };
    }

    if (!clients || clients.length === 0) {
      return { success: true, clients: [] };
    }

    const clientIds = clients.map((c) => c.id);

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

    // Ottieni listini assegnati via price_list_assignments
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
      .eq('is_active', true);

    // Mappa assegnazioni per utente
    const assignmentMap = new Map<string, any>();
    assignments?.forEach((a) => {
      if (a.price_list) {
        assignmentMap.set(a.user_id, a.price_list);
      }
    });

    // Ottieni anche listini assegnati direttamente (assigned_to_user_id)
    const { data: directAssignments } = await supabaseAdmin
      .from('price_lists')
      .select('id, name, default_margin_percent, status, assigned_to_user_id')
      .in('assigned_to_user_id', clientIds)
      .eq('status', 'active');

    directAssignments?.forEach((pl) => {
      if (pl.assigned_to_user_id && !assignmentMap.has(pl.assigned_to_user_id)) {
        assignmentMap.set(pl.assigned_to_user_id, pl);
      }
    });

    // Costruisci risultato finale
    const clientsWithListino: ClientWithListino[] = clients.map((client) => {
      const shipmentStats = statsMap.get(client.id) || { count: 0, total: 0 };
      const listino = assignmentMap.get(client.id);

      return {
        id: client.id,
        email: client.email,
        name: client.name || client.email.split('@')[0],
        company_name: client.company_name,
        phone: client.phone,
        wallet_balance: client.wallet_balance || 0,
        created_at: client.created_at,
        shipments_count: shipmentStats.count,
        total_spent: shipmentStats.total,
        assigned_listino: listino
          ? {
              id: listino.id,
              name: listino.name,
              margin_percent: listino.default_margin_percent,
              status: listino.status,
            }
          : null,
      };
    });

    return { success: true, clients: clientsWithListino };
  } catch (error: any) {
    console.error('Errore getResellerClientsWithListino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Ottiene le statistiche aggregate dei clienti del reseller
 */
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
      clientsWithListino: clients.filter((c) => c.assigned_listino !== null).length,
      clientsWithoutListino: clients.filter((c) => c.assigned_listino === null).length,
      totalRevenue: clients.reduce((sum, c) => sum + c.total_spent, 0),
    };

    return { success: true, stats };
  } catch (error: any) {
    console.error('Errore getResellerClientsStats:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
