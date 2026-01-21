/**
 * Server Actions: Customer Price Lists Management
 *
 * Gestione listini cliente per reseller
 * Permette di creare listini personalizzati per i propri clienti (sub-users)
 */

'use server';

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { createPriceList } from '@/lib/db/price-lists';
import type { CreatePriceListInput } from '@/types/listini';

/**
 * Crea listino cliente vuoto per reseller
 *
 * @param data - Dati listino cliente: nome, cliente (assigned_to_user_id), margine %
 * @returns Listino creato
 */
export async function createCustomerPriceListAction(data: {
  name: string;
  assigned_to_user_id: string; // Cliente (sub-user) che utilizzerà il listino
  default_margin_percent: number; // Margine percentuale (es. 20 per +20%)
  courier_id?: string; // Opzionale: corriere associato
  description?: string;
}): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const isReseller = user.is_reseller === true;
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: 'Solo Reseller e Admin possono creare listini cliente',
      };
    }

    // Verifica che il cliente assegnato esista e sia sub-user del reseller (se reseller)
    if (isReseller) {
      const { data: assignedUser } = await supabaseAdmin
        .from('users')
        .select('id, parent_reseller_id')
        .eq('id', data.assigned_to_user_id)
        .single();

      if (!assignedUser) {
        return { success: false, error: 'Cliente non trovato' };
      }

      // Verifica che sia sub-user del reseller corrente
      if (assignedUser.parent_reseller_id !== user.id) {
        return {
          success: false,
          error: 'Non puoi assegnare listini a clienti che non sono tuoi sub-users',
        };
      }
    }

    // Valida margine
    if (data.default_margin_percent < 0) {
      return {
        success: false,
        error: 'Il margine percentuale non può essere negativo',
      };
    }

    // Crea listino cliente vuoto
    const priceListData: CreatePriceListInput = {
      name: data.name,
      version: '1.0',
      status: 'draft', // Parte come bozza, utente completa manualmente
      list_type: 'custom', // Listino cliente
      is_global: false,
      assigned_to_user_id: data.assigned_to_user_id,
      courier_id: data.courier_id || null,
      default_margin_percent: data.default_margin_percent,
      description: data.description,
      source_type: 'manual',
      priority: 'client', // Priorità per listini cliente
    };

    const priceList = await createPriceList(priceListData, user.id);

    return { success: true, priceList };
  } catch (error: any) {
    console.error('Errore creazione listino cliente:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Ottiene lista sub-users del reseller corrente
 *
 * @returns Array di sub-users
 */
export async function getResellerSubUsersAction(): Promise<{
  success: boolean;
  subUsers?: Array<{ id: string; email: string; name?: string }>;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const isReseller = user.is_reseller === true;
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: 'Solo Reseller e Admin possono vedere sub-users',
      };
    }

    // Recupera sub-users (utenti con parent_reseller_id = user.id)
    const { data: subUsers, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('parent_reseller_id', user.id);

    if (error) {
      console.error('Errore recupero sub-users:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      subUsers: subUsers || [],
    };
  } catch (error: any) {
    console.error('Errore getResellerSubUsersAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Aggiorna margine percentuale di un listino cliente
 *
 * @param priceListId - ID listino
 * @param marginPercent - Nuovo margine percentuale
 * @returns Listino aggiornato
 */
export async function updateCustomerPriceListMarginAction(
  priceListId: string,
  marginPercent: number
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    // Verifica permessi sul listino
    const { getPriceListById } = await import('@/lib/db/price-lists');
    const priceList = await getPriceListById(priceListId);

    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    // Verifica che sia listino cliente
    if (priceList.list_type !== 'custom') {
      return {
        success: false,
        error: 'Puoi modificare solo listini cliente',
      };
    }

    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';
    const isOwner = priceList.created_by === user.id;
    const isReseller = user.is_reseller === true;

    // Reseller può modificare solo i propri listini
    if (isReseller && !isOwner && !isAdmin) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questo listino',
      };
    }

    // Valida margine
    if (marginPercent < 0) {
      return {
        success: false,
        error: 'Il margine percentuale non può essere negativo',
      };
    }

    // Aggiorna margine
    const { updatePriceList } = await import('@/lib/db/price-lists');
    const updated = await updatePriceList(
      priceListId,
      { default_margin_percent: marginPercent },
      user.id
    );

    return { success: true, priceList: updated };
  } catch (error: any) {
    console.error('Errore aggiornamento margine:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Assegna listino cliente a più sub-users (assegnazione multipla)
 *
 * @param priceListId - ID listino cliente
 * @param userIds - Array di ID sub-users
 * @returns Risultato assegnazioni
 */
export async function assignCustomerPriceListToMultipleUsersAction(
  priceListId: string,
  userIds: string[]
): Promise<{
  success: boolean;
  assigned?: number;
  errors?: Array<{ userId: string; error: string }>;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const isReseller = user.is_reseller === true;
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';

    if (!isReseller && !isAdmin) {
      return {
        success: false,
        error: 'Solo Reseller e Admin possono assegnare listini',
      };
    }

    // Verifica che il listino esista e sia listino cliente
    const { getPriceListById } = await import('@/lib/db/price-lists');
    const priceList = await getPriceListById(priceListId);

    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    if (priceList.list_type !== 'custom') {
      return {
        success: false,
        error: 'Puoi assegnare solo listini cliente',
      };
    }

    // Verifica permessi sul listino (reseller può assegnare solo i propri listini)
    if (isReseller && priceList.created_by !== user.id && !isAdmin) {
      return {
        success: false,
        error: 'Non hai i permessi per assegnare questo listino',
      };
    }

    // Verifica che tutti i sub-users appartengano al reseller (se reseller)
    if (isReseller) {
      const { data: subUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .in('id', userIds)
        .eq('parent_reseller_id', user.id);

      if (!subUsers || subUsers.length !== userIds.length) {
        return {
          success: false,
          error: 'Alcuni utenti selezionati non sono tuoi sub-users',
        };
      }
    }

    // Assegna listino a tutti gli utenti
    const errors: Array<{ userId: string; error: string }> = [];
    let assigned = 0;

    for (const userId of userIds) {
      try {
        // Verifica se esiste già un'assegnazione attiva
        const { data: existing } = await supabaseAdmin
          .from('price_list_assignments')
          .select('id')
          .eq('price_list_id', priceListId)
          .eq('user_id', userId)
          .is('revoked_at', null)
          .single();

        if (existing) {
          // Assegnazione già esistente, salta
          continue;
        }

        // Crea assegnazione
        const { error: assignError } = await supabaseAdmin.from('price_list_assignments').insert({
          price_list_id: priceListId,
          user_id: userId,
          assigned_by: user.id,
          assigned_at: new Date().toISOString(),
          notes: `Assegnazione multipla da reseller`,
        });

        if (assignError) {
          errors.push({ userId, error: assignError.message });
        } else {
          assigned++;
        }
      } catch (err: any) {
        errors.push({ userId, error: err.message || 'Errore sconosciuto' });
      }
    }

    if (assigned === 0 && errors.length > 0) {
      return {
        success: false,
        error: 'Nessuna assegnazione riuscita',
        errors,
      };
    }

    return {
      success: true,
      assigned,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error('Errore assegnazione multipla:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
