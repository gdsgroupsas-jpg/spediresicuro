/**
 * User Database Helpers
 *
 * Utility condivise per operazioni database sugli utenti
 * Consolida le query duplicate (30+ occorrenze) per lookup utenti
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  created_at?: string;
  parent_id?: string;
  [key: string]: any;
}

/**
 * Cerca un utente per email
 * Consolida il pattern ripetuto 30+ volte nelle API routes
 *
 * @param email - Email dell'utente
 * @param select - Campi da selezionare (default: tutti)
 * @returns Utente trovato o null
 *
 * @example
 * const user = await getUserByEmail(session.user.email);
 * if (!user) return ApiErrors.NOT_FOUND('Utente');
 */
export async function getUserByEmail(email: string, select: string = '*'): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(select)
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return data as unknown as User;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
}

/**
 * Cerca un utente per ID
 *
 * @param id - ID dell'utente
 * @param select - Campi da selezionare (default: tutti)
 * @returns Utente trovato o null
 *
 * @example
 * const user = await getUserById(userId);
 */
export async function getUserById(id: string, select: string = '*'): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin.from('users').select(select).eq('id', id).single();

    if (error || !data) {
      return null;
    }

    return data as unknown as User;
  } catch (error) {
    console.error('Error fetching user by ID:', error);
    return null;
  }
}

/**
 * Verifica se un utente esiste dato l'email
 *
 * @param email - Email da verificare
 * @returns true se esiste, false altrimenti
 *
 * @example
 * if (await userExists(email)) {
 *   return ApiErrors.CONFLICT('Email già registrata');
 * }
 */
export async function userExists(email: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    return !!data && !error;
  } catch (error) {
    return false;
  }
}

/**
 * Ottiene tutti gli utenti figli di un parent
 *
 * @param parentId - ID del parent
 * @param select - Campi da selezionare
 * @returns Array di utenti
 *
 * @example
 * const children = await getUserChildren(adminId);
 */
export async function getUserChildren(parentId: string, select: string = '*'): Promise<User[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(select)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data as unknown as User[];
  } catch (error) {
    console.error('Error fetching user children:', error);
    return [];
  }
}

/**
 * Aggiorna un utente
 *
 * @param id - ID dell'utente
 * @param updates - Campi da aggiornare
 * @returns Utente aggiornato o null
 *
 * @example
 * const updated = await updateUser(userId, { name: 'Nuovo Nome' });
 */
export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return null;
    }

    return data as unknown as User;
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
}

/**
 * Crea un nuovo utente
 *
 * @param userData - Dati dell'utente da creare
 * @returns Utente creato o null
 *
 * @example
 * const user = await createUser({
 *   email: 'test@example.com',
 *   role: 'customer',
 *   parent_id: adminId
 * });
 */
export async function createUser(userData: Partial<User>): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin.from('users').insert(userData).select().single();

    if (error || !data) {
      console.error('Error creating user:', error);
      return null;
    }

    return data as unknown as User;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

/**
 * Elimina un utente
 *
 * @param id - ID dell'utente da eliminare
 * @returns true se eliminato, false altrimenti
 *
 * @example
 * const deleted = await deleteUser(userId);
 */
export async function deleteUser(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('users').delete().eq('id', id);

    return !error;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

/**
 * Cerca utenti con filtri
 *
 * @param filters - Filtri da applicare
 * @param select - Campi da selezionare
 * @returns Array di utenti
 *
 * @example
 * const admins = await findUsers({ role: 'admin' });
 */
export async function findUsers(
  filters: Record<string, any>,
  select: string = '*'
): Promise<User[]> {
  try {
    let query = supabaseAdmin.from('users').select(select);

    // Applica filtri
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data as unknown as User[];
  } catch (error) {
    console.error('Error finding users:', error);
    return [];
  }
}
