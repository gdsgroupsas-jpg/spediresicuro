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
  source: 'custom' | 'parent_imposed' | 'parent_cascaded' | 'default';
  /** ID utente */
  userId: string;
  /** ID utente sorgente (se fee viene da parent) */
  sourceUserId?: string;
  /** Email utente sorgente (se fee viene da parent) */
  sourceUserEmail?: string;
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
 * Usa il sistema a CASCATA:
 * 1. platform_fee_override (massima priorità)
 * 2. parent_imposed_fee (fee imposta dal parent)
 * 3. Fee del parent (ricorsivo)
 * 4. Default €0.50
 *
 * @param userId - UUID dell'utente
 * @returns PlatformFeeResult con fee e metadati
 * @throws Error se utente non trovato o errore DB
 */
export async function getPlatformFee(userId: string): Promise<PlatformFeeResult> {
  // Prima prova la funzione cascading (se esiste)
  // Fallback alla vecchia funzione per backward compatibility
  let feeFromRpc: number | null = null;
  let usedCascading = false;

  // Prova prima la funzione cascading
  const { data: cascadingFee, error: cascadingError } = await supabaseAdmin
    .rpc('get_platform_fee_cascading', { p_user_id: userId });

  if (!cascadingError && cascadingFee !== null) {
    feeFromRpc = cascadingFee;
    usedCascading = true;
  } else {
    // Fallback alla vecchia funzione
    const { data: oldFee, error: oldError } = await supabaseAdmin
      .rpc('get_platform_fee', { p_user_id: userId });

    if (oldError) {
      if (oldError.message?.includes('not found')) {
        throw new Error(`User ${userId} not found`);
      }
      console.error('[PlatformFee] RPC error:', oldError);
      throw new Error(`Error fetching platform fee: ${oldError.message}`);
    }
    feeFromRpc = oldFee;
  }

  // Recupera dettagli utente per determinare source
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('platform_fee_override, platform_fee_notes, parent_imposed_fee, parent_id, fee_applied_by_parent_id')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('[PlatformFee] User query error:', userError);
    throw new Error(`Error fetching user data: ${userError.message}`);
  }

  // Determina source della fee
  let source: 'custom' | 'parent_imposed' | 'parent_cascaded' | 'default' = 'default';
  let sourceUserId: string | undefined;
  let sourceUserEmail: string | undefined;

  if (userData.platform_fee_override !== null) {
    // Priorità 1: Override utente
    source = 'custom';
    sourceUserId = userId;
  } else if (userData.parent_imposed_fee !== null) {
    // Priorità 2: Fee imposta dal parent
    source = 'parent_imposed';
    sourceUserId = userData.fee_applied_by_parent_id || undefined;

    // Recupera email del parent che ha imposto la fee
    if (sourceUserId) {
      const { data: parentData } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', sourceUserId)
        .single();
      sourceUserEmail = parentData?.email || undefined;
    }
  } else if (userData.parent_id !== null && usedCascading) {
    // Priorità 3: Fee cascaded dal parent
    source = 'parent_cascaded';

    // Prova a ottenere dettagli dalla funzione get_platform_fee_details
    const { data: detailsData } = await supabaseAdmin
      .rpc('get_platform_fee_details', { p_user_id: userId });

    if (detailsData && detailsData.length > 0) {
      const detail = detailsData[0];
      source = detail.source as typeof source;
      sourceUserId = detail.source_user_id || undefined;
      sourceUserEmail = detail.source_user_email || undefined;
    }
  }

  const isCustom = source === 'custom';

  return {
    fee: feeFromRpc ?? DEFAULT_PLATFORM_FEE,
    isCustom,
    notes: userData.platform_fee_notes,
    source,
    userId,
    sourceUserId,
    sourceUserEmail,
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

  // Esegui update
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

  // Inserisci record audit manualmente (controllo su changed_by)
  const newFeeValue = newFee ?? 0.50; // Valore effettivo da loggare
  const { error: auditError } = await supabaseAdmin
    .from('platform_fee_history')
    .insert({
      user_id: targetUserId,
      old_fee: previousFee,
      new_fee: newFeeValue,
      notes: notes || null,
      changed_by: adminUserId, // ✅ ID admin che ha fatto la modifica
    });

  if (auditError) {
    // Log errore audit ma non bloccare l'operazione
    console.error('[PlatformFee] Audit error (non bloccante):', auditError);
    // Non lanciare errore - l'update è andato a buon fine
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

// ============================================
// FUNZIONI CASCADING FEE (RESELLER → SUB-USER)
// ============================================

/** Input per impostare fee a un sub-user */
export interface SetParentImposedFeeInput {
  /** ID del sub-user a cui applicare la fee */
  childUserId: string;
  /** Fee da imporre (null per rimuovere) */
  fee: number | null;
  /** Note opzionali */
  notes?: string;
}

/** Risultato operazione set parent fee */
export interface SetParentImposedFeeResult {
  success: boolean;
  message: string;
  previousFee: number | null;
  newFee: number | null;
}

/**
 * Imposta una fee per un sub-user.
 * Solo RESELLER/SUPERADMIN possono chiamare questa funzione
 * e solo per i propri sub-user.
 *
 * @param input - Dati fee da impostare
 * @param parentUserId - ID del RESELLER/SUPERADMIN che esegue l'operazione
 * @returns Risultato operazione
 * @throws Error se non autorizzato o sub-user non valido
 */
export async function setParentImposedFee(
  input: SetParentImposedFeeInput,
  parentUserId: string
): Promise<SetParentImposedFeeResult> {
  const { childUserId, fee, notes } = input;

  // Validazione input
  if (fee !== null && fee < 0) {
    throw new Error('Fee cannot be negative');
  }

  // 1. Verifica che parentUserId sia RESELLER o SUPERADMIN
  const { data: parentData, error: parentError } = await supabaseAdmin
    .from('users')
    .select('account_type, role, is_reseller')
    .eq('id', parentUserId)
    .single();

  if (parentError) {
    console.error('[PlatformFee] Parent check error:', parentError);
    throw new Error('Error verifying parent privileges');
  }

  const canImposeFee =
    parentData.account_type === 'superadmin' ||
    parentData.account_type === 'reseller' ||
    parentData.role === 'SUPERADMIN' ||
    parentData.role === 'ADMIN' ||
    parentData.is_reseller === true;

  if (!canImposeFee) {
    throw new Error('Only RESELLER or SUPERADMIN can impose fees on sub-users');
  }

  // 2. Verifica che childUserId sia un sub-user del parent
  const { data: isSubUser, error: subUserError } = await supabaseAdmin
    .rpc('is_sub_user_of', {
      p_sub_user_id: childUserId,
      p_admin_id: parentUserId,
    });

  if (subUserError) {
    console.error('[PlatformFee] Sub-user check error:', subUserError);
    throw new Error('Error verifying sub-user relationship');
  }

  // SUPERADMIN può impostare fee a chiunque
  const isSuperAdmin =
    parentData.account_type === 'superadmin' ||
    parentData.role === 'SUPERADMIN';

  if (!isSubUser && !isSuperAdmin) {
    throw new Error('Target user is not a sub-user of your organization');
  }

  // 3. Recupera fee precedente per audit
  const { data: childData, error: childError } = await supabaseAdmin
    .from('users')
    .select('parent_imposed_fee')
    .eq('id', childUserId)
    .single();

  if (childError) {
    console.error('[PlatformFee] Child data error:', childError);
    throw new Error('Error fetching sub-user data');
  }

  const previousFee = childData.parent_imposed_fee;

  // 4. Aggiorna parent_imposed_fee
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      parent_imposed_fee: fee,
      fee_applied_by_parent_id: fee !== null ? parentUserId : null,
    })
    .eq('id', childUserId);

  if (updateError) {
    console.error('[PlatformFee] Update error:', updateError);
    throw new Error(`Error updating parent imposed fee: ${updateError.message}`);
  }

  // 5. Registra in audit log
  const { error: auditError } = await supabaseAdmin
    .from('parent_fee_history')
    .insert({
      parent_id: parentUserId,
      child_id: childUserId,
      old_parent_fee: previousFee,
      new_parent_fee: fee,
      notes: notes || null,
      changed_by: parentUserId,
    });

  if (auditError) {
    // Log errore audit ma non bloccare l'operazione
    console.error('[PlatformFee] Audit error (non bloccante):', auditError);
  }

  // Log operazione
  console.log('[PlatformFee] Parent imposed fee updated:', {
    parentUserId,
    childUserId,
    previousFee,
    newFee: fee,
  });

  return {
    success: true,
    message: fee === null
      ? 'Parent imposed fee removed - sub-user will inherit parent fee'
      : `Parent imposed fee set to €${fee.toFixed(2)}`,
    previousFee,
    newFee: fee,
  };
}

/**
 * Recupera la lista di sub-user con le loro fee configurate.
 * Per dashboard RESELLER.
 *
 * @param parentUserId - ID del RESELLER/SUPERADMIN
 * @returns Lista sub-user con dettagli fee
 */
export async function getSubUsersWithFees(parentUserId: string): Promise<
  Array<{
    userId: string;
    name: string;
    email: string;
    parentImposedFee: number | null;
    effectiveFee: number;
    feeSource: string;
  }>
> {
  // Recupera sub-user diretti
  const { data: subUsers, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, parent_imposed_fee')
    .eq('parent_id', parentUserId)
    .order('name');

  if (error) {
    console.error('[PlatformFee] Get sub-users error:', error);
    throw new Error(`Error fetching sub-users: ${error.message}`);
  }

  // Per ogni sub-user, calcola la fee effettiva
  const result = await Promise.all(
    (subUsers || []).map(async (user) => {
      let effectiveFee = DEFAULT_PLATFORM_FEE;
      let feeSource = 'default';

      try {
        const feeResult = await getPlatformFee(user.id);
        effectiveFee = feeResult.fee;
        feeSource = feeResult.source;
      } catch (e) {
        console.warn(`[PlatformFee] Error getting fee for user ${user.id}:`, e);
      }

      return {
        userId: user.id,
        name: user.name || '',
        email: user.email,
        parentImposedFee: user.parent_imposed_fee,
        effectiveFee,
        feeSource,
      };
    })
  );

  return result;
}

