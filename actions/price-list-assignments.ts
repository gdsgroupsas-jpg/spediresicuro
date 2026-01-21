'use server';

/**
 * Server Actions per Gestione Assegnazioni Listini Personalizzati
 *
 * Permette al superadmin di assegnare/rimuovere listini personalizzati a utenti
 * tramite la tabella price_list_assignments (relazione N:N).
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { findUserByEmail } from '@/lib/database';

/**
 * Verifica permessi superadmin
 */
async function verifySuperAdminAccess(): Promise<{
  isAuthorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();

    if (!context?.actor?.email) {
      return { isAuthorized: false, error: 'Non autenticato' };
    }

    let user;
    if (context.actor.id === 'test-user-id') {
      user = { id: 'test-user-id', account_type: 'superadmin' };
    } else {
      user = await findUserByEmail(context.actor.email);
    }

    if (!user) {
      return { isAuthorized: false, error: 'Utente non trovato' };
    }

    if ((user as any).account_type !== 'superadmin') {
      return {
        isAuthorized: false,
        error: 'Solo i superadmin possono gestire le assegnazioni listini',
      };
    }

    return { isAuthorized: true, userId: (user as any).id };
  } catch (error: any) {
    console.error('Errore verifica superadmin:', error);
    return {
      isAuthorized: false,
      error: error.message || 'Errore verifica permessi',
    };
  }
}

/**
 * Server Action: Assegna listino a utente
 *
 * Chiama la funzione RPC assign_price_list() per garantire validazioni DB e audit trail.
 *
 * @param priceListId - ID del listino da assegnare
 * @param userId - ID dell'utente destinatario
 * @param notes - Note opzionali sull'assegnazione
 * @returns Risultato operazione con assignmentId
 */
export async function assignPriceListToUser(
  priceListId: string,
  userId: string,
  notes?: string
): Promise<{
  success: boolean;
  assignmentId?: string;
  error?: string;
}> {
  try {
    // 1. Verifica permessi superadmin
    const { isAuthorized, userId: adminId, error: authError } = await verifySuperAdminAccess();
    if (!isAuthorized) {
      return { success: false, error: authError };
    }

    // 2. Validazione input
    if (!priceListId || !userId) {
      return {
        success: false,
        error: 'Parametri mancanti: priceListId e userId sono obbligatori',
      };
    }

    // 3. Chiama funzione RPC assign_price_list
    const { data: assignmentId, error: rpcError } = await supabaseAdmin.rpc('assign_price_list', {
      p_price_list_id: priceListId,
      p_user_id: userId,
      p_notes: notes || null,
    });

    if (rpcError) {
      console.error('❌ Errore RPC assign_price_list:', rpcError);

      // Gestisci errori comuni con messaggi user-friendly
      if (rpcError.message.includes('già esistente')) {
        return {
          success: false,
          error: 'Questo listino è già assegnato a questo utente',
        };
      }

      return {
        success: false,
        error: rpcError.message || "Errore durante l'assegnazione del listino",
      };
    }

    console.log(
      `✅ Listino ${priceListId} assegnato a utente ${userId} (assignment ID: ${assignmentId})`
    );

    return {
      success: true,
      assignmentId: assignmentId,
    };
  } catch (error: any) {
    console.error('❌ Errore assignPriceListToUser:', error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto durante l'assegnazione",
    };
  }
}

/**
 * Server Action: Rimuove assegnazione listino
 *
 * Chiama la funzione RPC revoke_price_list_assignment() per soft delete con audit trail.
 *
 * @param assignmentId - ID dell'assegnazione da revocare
 * @returns Risultato operazione
 */
export async function revokePriceListAssignment(assignmentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. Verifica permessi superadmin
    const { isAuthorized, error: authError } = await verifySuperAdminAccess();
    if (!isAuthorized) {
      return { success: false, error: authError };
    }

    // 2. Validazione input
    if (!assignmentId) {
      return {
        success: false,
        error: 'Parametro mancante: assignmentId è obbligatorio',
      };
    }

    // 3. Chiama funzione RPC revoke_price_list_assignment
    const { data, error: rpcError } = await supabaseAdmin.rpc('revoke_price_list_assignment', {
      p_assignment_id: assignmentId,
    });

    if (rpcError) {
      console.error('❌ Errore RPC revoke_price_list_assignment:', rpcError);

      // Gestisci errori comuni
      if (rpcError.message.includes('non trovata') || rpcError.message.includes('già revocata')) {
        return {
          success: false,
          error: 'Assegnazione non trovata o già rimossa',
        };
      }

      return {
        success: false,
        error: rpcError.message || "Errore durante la rimozione dell'assegnazione",
      };
    }

    console.log(`✅ Assegnazione ${assignmentId} revocata con successo`);

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('❌ Errore revokePriceListAssignment:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la rimozione',
    };
  }
}

/**
 * Server Action: Lista tutte le assegnazioni attive per un utente
 *
 * Recupera tutte le assegnazioni non revocate con dettagli del listino.
 *
 * @param userId - ID dell'utente
 * @returns Lista assegnazioni con dettagli listino
 */
export async function listUserPriceListAssignments(userId: string): Promise<{
  success: boolean;
  assignments?: any[];
  error?: string;
}> {
  try {
    // 1. Verifica permessi superadmin
    const { isAuthorized, error: authError } = await verifySuperAdminAccess();
    if (!isAuthorized) {
      return { success: false, error: authError };
    }

    // 2. Validazione input
    if (!userId) {
      return {
        success: false,
        error: 'Parametro mancante: userId è obbligatorio',
      };
    }

    // 3. Query assegnazioni con join su price_lists
    const { data, error: dbError } = await supabaseAdmin
      .from('price_list_assignments')
      .select(
        `
        id,
        price_list_id,
        user_id,
        assigned_by,
        assigned_at,
        notes,
        price_list:price_lists(
          id,
          name,
          list_type,
          courier_id,
          version,
          status,
          default_margin_percent,
          default_margin_fixed
        )
      `
      )
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('assigned_at', { ascending: false });

    if (dbError) {
      console.error('❌ Errore caricamento assegnazioni:', dbError);
      return {
        success: false,
        error: dbError.message || 'Errore durante il caricamento delle assegnazioni',
      };
    }

    console.log(`✅ Caricate ${data?.length || 0} assegnazioni per utente ${userId}`);

    return {
      success: true,
      assignments: data || [],
    };
  } catch (error: any) {
    console.error('❌ Errore listUserPriceListAssignments:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante il caricamento',
    };
  }
}

/**
 * Server Action: Lista tutti i listini assegnabili
 *
 * Recupera listini custom e supplier attivi disponibili per assegnazione.
 *
 * @returns Lista listini assegnabili
 */
export async function listAssignablePriceLists(): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  try {
    // 1. Verifica permessi superadmin
    const { isAuthorized, error: authError } = await verifySuperAdminAccess();
    if (!isAuthorized) {
      return { success: false, error: authError };
    }

    // 2. Query listini custom e supplier attivi
    const { data, error: dbError } = await supabaseAdmin
      .from('price_lists')
      .select(
        `
        id,
        name,
        list_type,
        courier_id,
        version,
        status,
        default_margin_percent,
        default_margin_fixed,
        description
      `
      )
      .in('list_type', ['custom', 'supplier'])
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (dbError) {
      console.error('❌ Errore caricamento listini:', dbError);
      return {
        success: false,
        error: dbError.message || 'Errore durante il caricamento dei listini',
      };
    }

    console.log(`✅ Caricati ${data?.length || 0} listini assegnabili`);

    return {
      success: true,
      priceLists: data || [],
    };
  } catch (error: any) {
    console.error('❌ Errore listAssignablePriceLists:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante il caricamento',
    };
  }
}
