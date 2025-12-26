/**
 * Platform Fee Service
 * 
 * Gestione fee di piattaforma dinamiche per utente.
 * 
 * ARCHITETTURA:
 * - DB: tabella `users` con colonne `platform_fee_override`, `platform_fee_notes`
 * - DB: tabella `platform_fee_history` per audit trail
 * - SQL: funzione `get_platform_fee(user_id)` per recupero fee
 * - RLS: solo SUPERADMIN può vedere history
 * 
 * RIFERIMENTI:
 * - Migration: supabase/migrations/050_dynamic_platform_fees.sql
 * - MIGRATION_MEMORY.md sezione FASE 2.7
 */

import { supabaseAdmin } from '@/lib/db/client';

// ============================================
// COSTANTI
// ============================================

/** Fee di default applicata se non c'è override per l'utente */
export const DEFAULT_PLATFORM_FEE = 0.50;

// ============================================
// TIPI
// ============================================

/** Risultato della query per la platform fee */
export interface PlatformFeeResult {
  /** Fee effettiva da applicare (€) */
  fee: number;
  /** True se è una fee custom, false se è default */
  isCustom: boolean;
  /** Note sulla fee personalizzata (se presenti) */
  notes: string | null;
  /** Sorgente della fee */
  source: 'custom' | 'default';
  /** ID utente */
  userId: string;
}

/** Entry nella history delle modifiche fee */
export interface PlatformFeeHistoryEntry {
  /** ID record */
  id: string;
  /** ID utente target */
  userId: string;
  /** Fee precedente (null se era default) */
  oldFee: number | null;
  /** Nuova fee impostata */
  newFee: number;
  /** Note sulla modifica */
  notes: string | null;
  /** ID SUPERADMIN che ha fatto la modifica */
  changedBy: string;
  /** Nome SUPERADMIN (se disponibile) */
  changedByName: string | null;
  /** Email SUPERADMIN (se disponibile) */
  changedByEmail: string | null;
  /** Data modifica */
  changedAt: Date;
}

/** Input per aggiornamento fee */
export interface UpdatePlatformFeeInput {
  /** ID utente target */
  targetUserId: string;
  /** Nuova fee (null per tornare a default) */
  newFee: number | null;
  /** Note opzionali */
  notes?: string;
}

/** Risultato operazione update */
export interface UpdatePlatformFeeResult {
  success: boolean;
  message: string;
  previousFee: number | null;
  newFee: number;
}

// ============================================
// FUNZIONI
// ============================================

/**
 * Recupera la platform fee per un utente.
 * Usa la funzione SQL `get_platform_fee` per garantire consistenza.
 * 
 * @param userId - UUID dell'utente
 * @returns PlatformFeeResult con fee e metadati
 * @throws Error se utente non trovato o errore DB
 */
export async function getPlatformFee(userId: string): Promise<PlatformFeeResult> {
  // Chiamata RPC alla funzione SQL
  const { data: feeFromRpc, error: rpcError } = await supabaseAdmin
    .rpc('get_platform_fee', { p_user_id: userId });

  if (rpcError) {
    // Gestisci errore "user not found"
    if (rpcError.message?.includes('not found')) {
      throw new Error(`User ${userId} not found`);
    }
    console.error('[PlatformFee] RPC error:', rpcError);
    throw new Error(`Error fetching platform fee: ${rpcError.message}`);
  }

  // Recupera anche i dettagli utente per sapere se è custom
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('platform_fee_override, platform_fee_notes')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('[PlatformFee] User query error:', userError);
    throw new Error(`Error fetching user data: ${userError.message}`);
  }

  const isCustom = userData.platform_fee_override !== null;
  
  return {
    fee: feeFromRpc,
    isCustom,
    notes: userData.platform_fee_notes,
    source: isCustom ? 'custom' : 'default',
    userId,
  };
}

/**
 * Recupera la platform fee in modo "fail-safe".
 * Se errore, ritorna default senza lanciare eccezione.
 * Usare per calcoli pricing dove non si vuole bloccare il flusso.
 * 
 * @param userId - UUID dell'utente
 * @returns Fee effettiva (default se errore)
 */
export async function getPlatformFeeSafe(userId: string): Promise<number> {
  try {
    const result = await getPlatformFee(userId);
    return result.fee;
  } catch (error) {
    console.warn('[PlatformFee] Error fetching fee, using default:', error);
    return DEFAULT_PLATFORM_FEE;
  }
}

/**
 * Aggiorna la platform fee per un utente.
 * 
 * IMPORTANTE: Solo SUPERADMIN può chiamare questa funzione.
 * La verifica del ruolo avviene lato DB tramite la funzione SQL.
 * 
 * @param input - Dati per l'aggiornamento
 * @param adminUserId - ID del SUPERADMIN che esegue l'operazione
 * @returns Risultato operazione
 * @throws Error se non autorizzato o errore DB
 */
export async function updatePlatformFee(
  input: UpdatePlatformFeeInput,
  adminUserId: string
): Promise<UpdatePlatformFeeResult> {
  const { targetUserId, newFee, notes } = input;

  // Validazione input
  if (newFee !== null && newFee < 0) {
    throw new Error('Platform fee cannot be negative');
  }

  // Verifica che adminUserId sia SUPERADMIN
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('users')
    .select('account_type, role')
    .eq('id', adminUserId)
    .single();

  if (adminError) {
    console.error('[PlatformFee] Admin check error:', adminError);
    throw new Error('Error verifying admin privileges');
  }

  const isSuperAdmin = 
    adminData.account_type === 'superadmin' || 
    adminData.role === 'admin';

  if (!isSuperAdmin) {
    throw new Error('Only SUPERADMIN can update platform fees');
  }

  // Recupera fee precedente
  let previousFee: number | null = null;
  try {
    const current = await getPlatformFee(targetUserId);
    previousFee = current.isCustom ? current.fee : null;
  } catch {
    // Utente non trovato - verrà gestito dall'update
  }

  // Esegui update (il trigger DB registrerà l'audit)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      platform_fee_override: newFee,
      platform_fee_notes: notes || null,
    })
    .eq('id', targetUserId);

  if (updateError) {
    console.error('[PlatformFee] Update error:', updateError);
    throw new Error(`Error updating platform fee: ${updateError.message}`);
  }

  // Log operazione (NO PII - solo IDs)
  console.log('[PlatformFee] Fee updated:', {
    targetUserId,
    adminUserId,
    previousFee,
    newFee: newFee ?? DEFAULT_PLATFORM_FEE,
  });

  return {
    success: true,
    message: newFee === null 
      ? 'Platform fee reset to default' 
      : `Platform fee updated to €${newFee.toFixed(2)}`,
    previousFee,
    newFee: newFee ?? DEFAULT_PLATFORM_FEE,
  };
}

/**
 * Recupera lo storico delle modifiche fee per un utente.
 * 
 * IMPORTANTE: Solo SUPERADMIN può vedere la history (RLS attivo).
 * 
 * @param userId - UUID dell'utente target
 * @param limit - Numero massimo di record (default 50)
 * @returns Array di entry history, ordinate per data DESC
 */
export async function getPlatformFeeHistory(
  userId: string,
  limit: number = 50
): Promise<PlatformFeeHistoryEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('platform_fee_history')
    .select(`
      id,
      user_id,
      old_fee,
      new_fee,
      notes,
      changed_by,
      changed_at,
      changer:users!platform_fee_history_changed_by_fkey(name, email)
    `)
    .eq('user_id', userId)
    .order('changed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PlatformFee] History query error:', error);
    throw new Error(`Error fetching fee history: ${error.message}`);
  }

  // Mappa al tipo di ritorno
  // Nota: Supabase restituisce le relazioni come array anche se è 1:1
  return (data || []).map((row) => {
    // Gestisci il caso array (Supabase) vs oggetto singolo
    const changer = Array.isArray(row.changer) 
      ? row.changer[0] 
      : row.changer;
    
    return {
      id: row.id as string,
      userId: row.user_id as string,
      oldFee: row.old_fee as number | null,
      newFee: row.new_fee as number,
      notes: row.notes as string | null,
      changedBy: row.changed_by as string,
      changedByName: (changer?.name as string) || null,
      changedByEmail: (changer?.email as string) || null,
      changedAt: new Date(row.changed_at as string),
    };
  });
}

/**
 * Lista utenti con fee personalizzate.
 * Utile per dashboard admin.
 * 
 * @param limit - Numero massimo di record
 * @returns Array di utenti con fee custom
 */
export async function listUsersWithCustomFees(
  limit: number = 100
): Promise<Array<{
  userId: string;
  name: string;
  email: string;
  customFee: number;
  notes: string | null;
}>> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, platform_fee_override, platform_fee_notes')
    .not('platform_fee_override', 'is', null)
    .order('platform_fee_override', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[PlatformFee] List custom fees error:', error);
    throw new Error(`Error listing users with custom fees: ${error.message}`);
  }

  return (data || []).map((row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    customFee: row.platform_fee_override,
    notes: row.platform_fee_notes,
  }));
}

