'use server';

/**
 * Server Actions per Gestione Reseller (Rivenditore)
 *
 * Permette agli Admin/Rivenditori di creare e gestire i propri Sub-Users (utenti finali).
 * Un Reseller può:
 * - Creare nuovi Sub-Users
 * - Visualizzare i propri Sub-Users
 * - Visualizzare le spedizioni aggregate dei Sub-Users
 * - Gestire la configurazione corrieri per i Sub-Users
 */

import crypto from 'crypto';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { createUser } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { validateEmail } from '@/lib/validators';
import { userExists, getUserWorkspaceId } from '@/lib/db/user-helpers';
import { hasCapability } from '@/lib/db/capability-helpers';

/**
 * Verifica se l'utente corrente è un Reseller
 */
async function isCurrentUserReseller(): Promise<{
  isReseller: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();

    if (!wsContext) {
      return { isReseller: false, error: 'Non autenticato' };
    }

    return {
      isReseller: wsContext.actor.is_reseller === true,
      userId: wsContext.actor.id,
    };
  } catch (error: any) {
    console.error('Errore verifica Reseller:', error);
    return { isReseller: false, error: error.message };
  }
}

/**
 * Verifica se l'utente corrente è Superadmin o ha capability can_view_all_clients
 */
async function canViewAllClients(): Promise<{ canView: boolean; userId?: string; error?: string }> {
  try {
    const wsContext = await getWorkspaceAuth();

    if (!wsContext) {
      console.error('❌ [canViewAllClients] Non autenticato');
      return { canView: false, error: 'Non autenticato' };
    }

    const actorId = wsContext.actor.id;
    const accountType = wsContext.actor.account_type;
    const role = wsContext.actor.role;

    console.log('🔍 [canViewAllClients] Verifica per:', wsContext.actor.email);

    // Superadmin può sempre vedere tutto
    if (accountType === 'superadmin') {
      console.log('✅ [canViewAllClients] Superadmin - accesso concesso');
      return { canView: true, userId: actorId };
    }

    // Verifica capability can_view_all_clients
    const hasCap = await hasCapability(actorId, 'can_view_all_clients', {
      account_type: accountType,
      role,
    });

    console.log('🔍 [canViewAllClients] Capability check:', {
      hasCap,
      account_type: accountType,
    });

    return {
      canView: hasCap,
      userId: actorId,
    };
  } catch (error: any) {
    console.error('❌ [canViewAllClients] Errore critico:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    });
    return { canView: false, error: error.message };
  }
}

/**
 * Server Action: Crea un nuovo Sub-User (utente finale creato da un Reseller)
 *
 * @param data - Dati del nuovo Sub-User
 * @returns Oggetto con success e dati utente creato
 */
export async function createSubUser(data: {
  email: string;
  name: string;
  password?: string;
  companyName?: string;
  phone?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  userId?: string;
  generatedPassword?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato. Devi essere loggato per creare Sub-Users.',
      };
    }

    // 2. Verifica che l'utente sia un Reseller
    const resellerCheck = await isCurrentUserReseller();
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono creare Sub-Users.',
      };
    }

    // 3. Valida input
    if (!data.email || !data.email.trim() || !data.name || !data.name.trim()) {
      return {
        success: false,
        error: 'Email e nome sono obbligatori.',
      };
    }

    // Validazione email
    if (!validateEmail(data.email)) {
      return {
        success: false,
        error: 'Email non valida.',
      };
    }

    // 4. Verifica se Sub-User esiste già
    const exists = await userExists(data.email.trim());

    if (exists) {
      return {
        success: false,
        error: 'Un utente con questa email esiste già.',
      };
    }

    // 5. Genera password se non fornita
    let password = data.password;
    let generatedPassword: string | undefined;

    if (!password) {
      // Genera password casuale sicura
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
      password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      generatedPassword = password;
    }

    // Hash password (obbligatorio per sicurezza)
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (hashError) {
      console.error('❌ Errore critico hash password:', hashError);
      throw new Error('Impossibile creare utente: errore hash password');
    }

    // 6. Crea nuovo Sub-User in Supabase
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email: data.email.trim(),
          password: hashedPassword,
          name: data.name.trim(),
          role: 'user',
          account_type: 'user',
          parent_id: resellerCheck.userId, // Collegamento al Reseller creatore (legacy)
          parent_reseller_id: resellerCheck.userId, // Collegamento al Reseller (usato da listini)
          is_reseller: false,
          wallet_balance: 0.0,
          company_name: data.companyName || null,
          phone: data.phone || null,
          provider: 'credentials',
        },
      ])
      .select()
      .single();

    if (createError) {
      console.error('Errore creazione Sub-User:', createError);
      return {
        success: false,
        error: createError.message || 'Errore durante la creazione del Sub-User.',
      };
    }

    // 7. Crea workspace client per il sub-user (sotto il workspace del reseller)
    try {
      // Ottieni workspace del reseller
      const { data: resellerUser } = await supabaseAdmin
        .from('users')
        .select('primary_workspace_id')
        .eq('id', resellerCheck.userId)
        .single();

      if (resellerUser?.primary_workspace_id) {
        // Ottieni organization_id dal workspace del reseller
        const { data: resellerWs } = await supabaseAdmin
          .from('workspaces')
          .select('organization_id')
          .eq('id', resellerUser.primary_workspace_id)
          .single();

        if (resellerWs?.organization_id) {
          const wsName = `${data.name.trim()} Workspace`;

          // Crea workspace client (depth 2) con sub-user come owner
          const { data: clientWsId, error: wsError } = await supabaseAdmin.rpc(
            'create_workspace_with_owner',
            {
              p_organization_id: resellerWs.organization_id,
              p_name: wsName,
              p_parent_workspace_id: resellerUser.primary_workspace_id,
              p_owner_user_id: newUser.id,
              p_type: 'client',
              p_depth: 2,
            }
          );

          if (wsError) {
            console.error('⚠️ Errore creazione workspace client:', wsError.message);
            // Non blocchiamo: l'utente e' stato creato, il workspace si puo' creare dopo
          } else if (clientWsId) {
            console.log('✅ Workspace client creato:', clientWsId, 'per sub-user:', newUser.id);

            // Imposta primary_workspace_id sul sub-user
            await supabaseAdmin
              .from('users')
              .update({ primary_workspace_id: clientWsId })
              .eq('id', newUser.id);

            // Aggiungi il reseller come admin nel workspace del client
            // (per poter operare per conto del cliente via workspace switcher)
            const { error: memberError } = await supabaseAdmin.from('workspace_members').insert({
              workspace_id: clientWsId,
              user_id: resellerCheck.userId,
              role: 'admin',
              status: 'active',
              accepted_at: new Date().toISOString(),
              invited_by: resellerCheck.userId,
            });

            if (memberError) {
              console.error('⚠️ Errore aggiunta reseller come admin:', memberError.message);
            }
          }
        }
      }
    } catch (wsSetupError: any) {
      // Non blocchiamo la creazione utente se il workspace fallisce
      console.error('⚠️ Errore setup workspace client (non critico):', wsSetupError.message);
    }

    // 8. Crea anche nel database locale (compatibilita)
    try {
      await createUser({
        email: data.email.trim(),
        password: hashedPassword,
        name: data.name.trim(),
        role: 'user',
        accountType: 'user',
        parentAdminId: resellerCheck.userId, // Usa parentAdminId per compatibilita con sistema esistente
      });
    } catch (localError: any) {
      // Non critico se Supabase ha funzionato
      console.warn('Errore creazione locale (non critico):', localError.message);
    }

    return {
      success: true,
      message: generatedPassword
        ? `Sub-User creato con successo! Password generata: ${generatedPassword}`
        : 'Sub-User creato con successo!',
      userId: newUser.id,
      generatedPassword: generatedPassword, // Ritorna password generata per mostrare all'admin
    };
  } catch (error: any) {
    console.error('Errore in createSubUser:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la creazione del Sub-User.',
    };
  }
}

/**
 * Server Action: Ottiene la lista dei Sub-Users del Reseller corrente
 *
 * Supporta anche Superadmin (vede tutti i sub-users, ma restituisce formato compatibile)
 *
 * @returns Lista dei Sub-Users
 */
export async function getSubUsers(): Promise<{
  success: boolean;
  subUsers?: Array<{
    id: string;
    email: string;
    name: string;
    company_name: string | null;
    phone: string | null;
    wallet_balance: number;
    created_at: string;
  }>;
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      };
    }

    // 2. Verifica se può vedere tutti i clienti (superadmin) o è reseller
    const canViewAll = await canViewAllClients();
    const resellerCheck = await isCurrentUserReseller();

    // Se superadmin, restituisci tutti i sub-users (per compatibilità)
    if (canViewAll.canView && canViewAll.userId) {
      // Per superadmin, restituisci tutti i sub-users di tutti i reseller
      const { data: allSubUsers, error } = await supabaseAdmin
        .from('users')
        .select('id, email, name, company_name, phone, wallet_balance, created_at')
        .not('parent_id', 'is', null)
        .eq('is_reseller', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Errore recupero Sub-Users (superadmin):', error);
        return {
          success: false,
          error: error.message || 'Errore durante il recupero dei Sub-Users.',
        };
      }

      return {
        success: true,
        subUsers: allSubUsers || [],
      };
    }

    // Comportamento originale per reseller
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono visualizzare i Sub-Users.',
      };
    }

    // 3. Ottieni Sub-Users del reseller
    const { data: subUsers, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, company_name, phone, wallet_balance, created_at')
      .eq('parent_id', resellerCheck.userId)
      .eq('is_reseller', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore recupero Sub-Users:', error);
      return {
        success: false,
        error: error.message || 'Errore durante il recupero dei Sub-Users.',
      };
    }

    return {
      success: true,
      subUsers: subUsers || [],
    };
  } catch (error: any) {
    console.error('Errore in getSubUsers:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Server Action: Ottiene statistiche aggregate dei Sub-Users
 *
 * @returns Statistiche aggregate
 */
export async function getSubUsersStats(): Promise<{
  success: boolean;
  stats?: {
    totalSubUsers: number;
    totalShipments: number;
    totalRevenue: number;
    activeSubUsers: number; // Sub-Users con almeno una spedizione
  };
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione e Reseller status
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      };
    }

    const resellerCheck = await isCurrentUserReseller();
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono visualizzare le statistiche.',
      };
    }

    // 2. Ottieni Sub-Users
    const { data: subUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', resellerCheck.userId)
      .eq('is_reseller', false);

    const subUserIds = subUsers?.map((u) => u.id) || [];
    const totalSubUsers = subUserIds.length;

    if (totalSubUsers === 0) {
      return {
        success: true,
        stats: {
          totalSubUsers: 0,
          totalShipments: 0,
          totalRevenue: 0,
          activeSubUsers: 0,
        },
      };
    }

    // 3. Ottieni statistiche spedizioni
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('final_price, user_id')
      .in('user_id', subUserIds)
      .eq('deleted', false);

    if (shipmentsError) {
      console.error('Errore recupero spedizioni:', shipmentsError);
    }

    const totalShipments = shipments?.length || 0;
    const totalRevenue =
      shipments?.reduce(
        (sum: number, s: any) => sum + (parseFloat(s.final_price || '0') || 0),
        0
      ) || 0;

    // 4. Calcola Sub-Users attivi (con almeno una spedizione)
    const activeUserIds = new Set(shipments?.map((s: any) => s.user_id) || []);
    const activeSubUsers = activeUserIds.size;

    return {
      success: true,
      stats: {
        totalSubUsers,
        totalShipments,
        totalRevenue,
        activeSubUsers,
      },
    };
  } catch (error: any) {
    console.error('Errore in getSubUsersStats:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Server Action: Gestisce il wallet di un Sub-User (solo ricariche, no prelievi)
 *
 * I Reseller possono solo AGGIUNGERE credito ai loro Sub-Users, non rimuoverlo.
 * Questo per sicurezza e per evitare abusi.
 *
 * @param subUserId - ID del Sub-User
 * @param amount - Importo da aggiungere (deve essere positivo)
 * @param reason - Motivo della ricarica (es. "Ricarica mensile", "Bonus", ecc.)
 * @returns Risultato operazione
 */
export async function manageSubUserWallet(
  subUserId: string,
  amount: number,
  reason: string = 'Ricarica manuale Reseller'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  transactionId?: string;
  newBalance?: number;
}> {
  try {
    // 1. Verifica autenticazione e Reseller status
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      };
    }

    const resellerCheck = await isCurrentUserReseller();
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono gestire il wallet dei Sub-Users.',
      };
    }

    // 2. Valida importo (solo positivo, max 10.000 per sicurezza - coerente con RPC SQL)
    if (amount <= 0) {
      return {
        success: false,
        error:
          "L'importo deve essere positivo. I Reseller possono solo aggiungere credito, non rimuoverlo.",
      };
    }

    if (amount > 10000) {
      return {
        success: false,
        error: "L'importo massimo per singolo trasferimento e' €10.000.",
      };
    }

    // 3. Verifica che il Sub-User appartenga al Reseller (workspace V2 + legacy parent_id)
    const { data: subUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, wallet_balance, parent_id')
      .eq('id', subUserId)
      .single();

    if (userError || !subUser) {
      return {
        success: false,
        error: 'Sub-User non trovato.',
      };
    }

    // Check 1: Legacy parent_id
    let isOwner = subUser.parent_id === resellerCheck.userId;

    // Check 2: Workspace V2 (se legacy fallisce)
    if (!isOwner) {
      const { data: resellerUser } = await supabaseAdmin
        .from('users')
        .select('primary_workspace_id')
        .eq('id', resellerCheck.userId)
        .single();

      if (resellerUser?.primary_workspace_id) {
        // Trova workspace del sub-user che ha parent = workspace del reseller
        const { data: subUserWs } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id, workspaces!inner(parent_workspace_id)')
          .eq('user_id', subUserId)
          .eq('status', 'active')
          .eq('role', 'owner');

        if (subUserWs) {
          isOwner = subUserWs.some(
            (m: any) => m.workspaces?.parent_workspace_id === resellerUser.primary_workspace_id
          );
        }
      }
    }

    if (!isOwner) {
      return {
        success: false,
        error:
          'Non hai i permessi per gestire il wallet di questo utente. Il Sub-User non appartiene al tuo account.',
      };
    }

    // 4. Trasferimento atomico: debita reseller + accredita sub-user
    // Usa RPC reseller_transfer_credit per atomicita e lock deterministico
    let transferResult: any;

    try {
      // Idempotency key stabile: hash dei parametri + finestra temporale 5s
      // Protegge da double-click/retry: stessa operazione nella stessa finestra = stessa key
      const idempotencyKey = `reseller-transfer-${crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            resellerId: resellerCheck.userId,
            subUserId,
            amount,
            timestamp: Math.floor(Date.now() / 5000),
          })
        )
        .digest('hex')
        .substring(0, 16)}`;

      // Lookup workspace_id per dual-write (entrambi gli utenti)
      const resellerWorkspaceId = await getUserWorkspaceId(resellerCheck.userId);
      const subUserWorkspaceId = await getUserWorkspaceId(subUserId);

      const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
        'reseller_transfer_credit',
        {
          p_reseller_id: resellerCheck.userId,
          p_sub_user_id: subUserId,
          p_amount: amount,
          p_description: reason,
          p_idempotency_key: idempotencyKey,
          p_reseller_workspace_id: resellerWorkspaceId,
          p_sub_user_workspace_id: subUserWorkspaceId,
        }
      );

      if (rpcError) {
        console.error('Errore RPC reseller_transfer_credit:', rpcError);
        // Messaggio user-friendly per saldo insufficiente
        const isInsufficientBalance =
          rpcError.message?.includes('insufficiente') || rpcError.message?.includes('Insufficient');
        return {
          success: false,
          error: isInsufficientBalance
            ? `Saldo insufficiente. Il tuo wallet non ha abbastanza credito per trasferire €${amount}.`
            : rpcError.message || 'Errore durante il trasferimento. Riprova più tardi.',
        };
      }

      transferResult = rpcResult;
    } catch (error: any) {
      console.error('Errore in manageSubUserWallet:', error);
      return {
        success: false,
        error: error.message || 'Errore sconosciuto durante la gestione del wallet.',
      };
    }

    // 5. Audit log
    try {
      const auditContext = await getWorkspaceAuth();
      await supabaseAdmin.from('audit_logs').insert({
        action: 'reseller_transfer_credit',
        resource_type: 'wallet',
        resource_id: subUserId,
        user_email: auditContext?.actor?.email || 'unknown',
        user_id: resellerCheck.userId,
        metadata: {
          amount: amount,
          reason: reason,
          transaction_id_out: transferResult?.transaction_id_out,
          transaction_id_in: transferResult?.transaction_id_in,
          type: 'reseller_transfer',
          target_user_id: subUserId,
          reseller_new_balance: transferResult?.reseller_new_balance,
          sub_user_new_balance: transferResult?.sub_user_new_balance,
        },
      });
    } catch (auditError) {
      console.warn('Errore audit log:', auditError);
    }

    return {
      success: true,
      message: `Trasferimento di €${amount} completato. Il tuo saldo e stato aggiornato.`,
      transactionId: transferResult?.transaction_id_in,
      newBalance: transferResult?.sub_user_new_balance || 0,
    };
  } catch (error: any) {
    console.error('Errore in manageSubUserWallet:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Server Action: Cambia il billing_mode di un Sub-User (prepagato / postpagato)
 *
 * Solo il Reseller proprietario puo' cambiare il contratto del proprio sub-user.
 *
 * @param subUserId - ID del Sub-User
 * @param billingMode - 'prepagato' o 'postpagato'
 * @returns Risultato operazione
 */
export async function updateSubUserBillingMode(
  subUserId: string,
  billingMode: 'prepagato' | 'postpagato'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato.' };
    }

    // 2. Verifica che sia reseller
    const resellerCheck = await isCurrentUserReseller();
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono cambiare il contratto dei Sub-Users.',
      };
    }

    // 3. Validazione input
    if (!['prepagato', 'postpagato'].includes(billingMode)) {
      return {
        success: false,
        error: "Modalita' di fatturazione non valida. Valori ammessi: prepagato, postpagato.",
      };
    }

    if (!subUserId || typeof subUserId !== 'string') {
      return { success: false, error: 'ID Sub-User non valido.' };
    }

    // 4. Verifica ownership (parent_id legacy + workspace V2)
    const { data: subUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, billing_mode, parent_id')
      .eq('id', subUserId)
      .single();

    if (userError || !subUser) {
      return { success: false, error: 'Sub-User non trovato.' };
    }

    // Check 1: Legacy parent_id
    let isOwner = subUser.parent_id === resellerCheck.userId;

    // Check 2: Workspace V2
    if (!isOwner) {
      const { data: resellerUser } = await supabaseAdmin
        .from('users')
        .select('primary_workspace_id')
        .eq('id', resellerCheck.userId)
        .single();

      if (resellerUser?.primary_workspace_id) {
        const { data: subUserWs } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id, workspaces!inner(parent_workspace_id)')
          .eq('user_id', subUserId)
          .eq('status', 'active')
          .eq('role', 'owner');

        if (subUserWs) {
          isOwner = subUserWs.some(
            (m: any) => m.workspaces?.parent_workspace_id === resellerUser.primary_workspace_id
          );
        }
      }
    }

    if (!isOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per cambiare il contratto di questo utente.',
      };
    }

    // 5. Se gia' nella modalita' richiesta, return OK
    if (subUser.billing_mode === billingMode) {
      return {
        success: true,
        message: `Il cliente e' gia' in modalita' ${billingMode}.`,
      };
    }

    // 5b. Se passaggio postpagato -> prepagato: verifica POSTPAID_CHARGE non fatturate
    if (subUser.billing_mode === 'postpagato' && billingMode === 'prepagato') {
      const { data: unfatturate } = await supabaseAdmin
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', subUserId)
        .eq('type', 'POSTPAID_CHARGE')
        .limit(1);

      // Verifica che non siano gia' linkate a fatture
      if (unfatturate && unfatturate.length > 0) {
        const { data: linked } = await supabaseAdmin
          .from('invoice_recharge_links')
          .select('id')
          .eq('wallet_transaction_id', unfatturate[0].id)
          .limit(1);

        if (!linked || linked.length === 0) {
          return {
            success: false,
            error:
              'Impossibile passare a Prepagato: ci sono spedizioni postpagate non ancora fatturate. Genera prima la fattura mensile.',
          };
        }
      }
    }

    // 6. Aggiorna billing_mode
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ billing_mode: billingMode })
      .eq('id', subUserId);

    if (updateError) {
      console.error('Errore aggiornamento billing_mode:', updateError);
      return {
        success: false,
        error: updateError.message || "Errore durante l'aggiornamento del contratto.",
      };
    }

    // 7. Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'billing_mode_changed',
        resource_type: 'user',
        resource_id: subUserId,
        user_email: context.actor.email,
        user_id: resellerCheck.userId,
        metadata: {
          type: 'billing_mode_change',
          target_user_id: subUserId,
          target_email: subUser.email,
          old_billing_mode: subUser.billing_mode || 'prepagato',
          new_billing_mode: billingMode,
        },
      });
    } catch (auditError) {
      console.warn('Errore audit log billing_mode:', auditError);
    }

    const modeLabel =
      billingMode === 'prepagato' ? 'Prepagato' : 'Postpagato (fattura a fine mese)';
    return {
      success: true,
      message: `Contratto aggiornato a "${modeLabel}" per ${subUser.name || subUser.email}.`,
    };
  } catch (error: any) {
    console.error('Errore in updateSubUserBillingMode:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Server Action: Ottiene le spedizioni aggregate dei Sub-Users
 *
 * @param limit - Numero massimo di risultati (default: 50)
 * @returns Lista spedizioni aggregate
 */
export async function getSubUsersShipments(limit: number = 50): Promise<{
  success: boolean;
  shipments?: Array<any>;
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione e Reseller status
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      };
    }

    const resellerCheck = await isCurrentUserReseller();
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono visualizzare le spedizioni dei Sub-Users.',
      };
    }

    // 2. Ottieni Sub-Users
    const { data: subUsers } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('parent_id', resellerCheck.userId)
      .eq('is_reseller', false);

    const subUserIds = subUsers?.map((u) => u.id) || [];

    if (subUserIds.length === 0) {
      return {
        success: true,
        shipments: [],
      };
    }

    // 3. Ottieni spedizioni
    const { data: shipments, error } = await supabaseAdmin
      .from('shipments')
      .select('*, users!shipments_user_id_fkey(email, name)')
      .in('user_id', subUserIds)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Errore recupero spedizioni:', error);
      return {
        success: false,
        error: error.message || 'Errore durante il recupero delle spedizioni.',
      };
    }

    return {
      success: true,
      shipments: shipments || [],
    };
  } catch (error: any) {
    console.error('Errore in getSubUsersShipments:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}

/**
 * Server Action: Ottiene tutti i clienti in modo gerarchico (Superadmin/Admin)
 *
 * Restituisce:
 * - Reseller con i loro Sub-Users nested
 * - BYOC clients standalone
 *
 * @returns Struttura gerarchica di tutti i clienti
 */
export async function getAllClientsForUser(): Promise<{
  success: boolean;
  clients?: {
    resellers: Array<{
      reseller: {
        id: string;
        email: string;
        name: string;
        company_name: string | null;
        phone: string | null;
        wallet_balance: number;
        created_at: string;
        reseller_tier: string | null;
      };
      subUsers: Array<{
        id: string;
        email: string;
        name: string;
        company_name: string | null;
        phone: string | null;
        wallet_balance: number;
        created_at: string;
      }>;
      stats: {
        totalSubUsers: number;
        totalWalletBalance: number;
      };
    }>;
    byocClients: Array<{
      id: string;
      email: string;
      name: string;
      company_name: string | null;
      phone: string | null;
      wallet_balance: number;
      created_at: string;
    }>;
    stats: {
      totalResellers: number;
      totalSubUsers: number;
      totalBYOC: number;
      totalWalletBalance: number;
    };
  };
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      console.error('❌ [getAllClientsForUser] Non autenticato');
      return {
        success: false,
        error: 'Non autenticato.',
      };
    }

    console.log('✅ [getAllClientsForUser] Utente autenticato:', context.actor.email);

    // 2. Verifica che l'utente possa vedere tutti i clienti
    const canViewAll = await canViewAllClients();
    console.log('🔍 [getAllClientsForUser] canViewAllClients result:', {
      canView: canViewAll.canView,
      userId: canViewAll.userId,
      error: canViewAll.error,
    });

    if (!canViewAll.canView || !canViewAll.userId) {
      console.error('❌ [getAllClientsForUser] Accesso negato:', canViewAll.error);
      return {
        success: false,
        error: canViewAll.error || 'Solo Superadmin/Admin possono visualizzare tutti i clienti.',
      };
    }

    // 3. Recupera tutti i Reseller con statistiche (incluso reseller_tier)
    // FIX: Resiliente a colonne opzionali mancanti (company_name, phone, reseller_tier)
    let resellers: any[] | null = null;
    let resellersError: any = null;

    // Strategia fallback progressivo:
    // 1. Prova con tutte le colonne (incluse opzionali)
    // 2. Se fallisce per colonna mancante, prova solo colonne essenziali
    // 3. Aggiungi campi opzionali come null se mancanti

    const { data: resellersFull, error: errorFull } = await supabaseAdmin
      .from('users')
      .select('id, email, name, company_name, phone, wallet_balance, created_at, reseller_tier')
      .eq('is_reseller', true)
      .order('created_at', { ascending: false });

    if (errorFull) {
      // Se errore per colonna mancante, prova solo colonne essenziali
      const isColumnMissing =
        errorFull.message?.includes('column') && errorFull.message?.includes('does not exist');

      if (isColumnMissing) {
        const missingColumn = errorFull.message.match(/column "?(\w+)"? does not exist/i)?.[1];
        console.warn(
          `⚠️ [RESILIENCE] Colonna ${missingColumn} non trovata, uso query con solo colonne essenziali`
        );

        const { data: resellersEssential, error: errorEssential } = await supabaseAdmin
          .from('users')
          .select('id, email, name, wallet_balance, created_at')
          .eq('is_reseller', true)
          .order('created_at', { ascending: false });

        if (errorEssential) {
          resellersError = errorEssential;
        } else {
          // Aggiungi campi opzionali come null per compatibilità
          resellers = (resellersEssential || []).map((r) => ({
            ...r,
            company_name: null,
            phone: null,
            reseller_tier: null,
          }));
        }
      } else {
        // Errore diverso, fallisce
        resellersError = errorFull;
      }
    } else {
      resellers = resellersFull;
    }

    if (resellersError) {
      console.error('❌ [getAllClientsForUser] Errore recupero Reseller:', {
        message: resellersError.message,
        code: resellersError.code,
        details: resellersError.details,
        hint: resellersError.hint,
      });
      return {
        success: false,
        error: resellersError.message || 'Errore durante il recupero dei Reseller.',
      };
    }

    console.log('✅ [getAllClientsForUser] Reseller recuperati:', resellers?.length || 0);

    // 4. Per ogni Reseller, recupera i Sub-Users
    // FIX: Resiliente a colonne opzionali mancanti
    const resellersWithSubUsers = await Promise.all(
      (resellers || []).map(async (reseller) => {
        // Prova prima con tutte le colonne
        let subUsers: any[] = [];
        const { data: subUsersFull, error: subUsersErrorFull } = await supabaseAdmin
          .from('users')
          .select('id, email, name, company_name, phone, wallet_balance, created_at')
          .eq('parent_id', reseller.id)
          .eq('is_reseller', false)
          .order('created_at', { ascending: false });

        if (subUsersErrorFull) {
          // Se errore per colonna mancante, prova solo colonne essenziali
          const isColumnMissing =
            subUsersErrorFull.message?.includes('column') &&
            subUsersErrorFull.message?.includes('does not exist');

          if (isColumnMissing) {
            const { data: subUsersEssential, error: subUsersErrorEssential } = await supabaseAdmin
              .from('users')
              .select('id, email, name, wallet_balance, created_at')
              .eq('parent_id', reseller.id)
              .eq('is_reseller', false)
              .order('created_at', { ascending: false });

            if (subUsersErrorEssential) {
              console.error(
                `❌ [getAllClientsForUser] Errore recupero Sub-Users per reseller ${reseller.id}:`,
                subUsersErrorEssential
              );
              return {
                reseller,
                subUsers: [],
                stats: {
                  totalSubUsers: 0,
                  totalWalletBalance: 0,
                },
              };
            } else {
              // Aggiungi campi opzionali come null
              subUsers = (subUsersEssential || []).map((su) => ({
                ...su,
                company_name: null,
                phone: null,
              }));
            }
          } else {
            console.error(
              `❌ [getAllClientsForUser] Errore recupero Sub-Users per reseller ${reseller.id}:`,
              subUsersErrorFull
            );
            return {
              reseller,
              subUsers: [],
              stats: {
                totalSubUsers: 0,
                totalWalletBalance: 0,
              },
            };
          }
        } else {
          subUsers = subUsersFull || [];
        }

        const totalWalletBalance = subUsers.reduce((sum, su) => sum + (su.wallet_balance || 0), 0);

        return {
          reseller,
          subUsers,
          stats: {
            totalSubUsers: subUsers.length,
            totalWalletBalance,
          },
        };
      })
    );

    // 5. Recupera tutti i BYOC clients
    // FIX: Resiliente a colonne opzionali mancanti
    let byocClients: any[] = [];
    const { data: byocClientsFull, error: byocErrorFull } = await supabaseAdmin
      .from('users')
      .select('id, email, name, company_name, phone, wallet_balance, created_at')
      .eq('account_type', 'byoc')
      .order('created_at', { ascending: false });

    if (byocErrorFull) {
      // Se errore per colonna mancante, prova solo colonne essenziali
      const isColumnMissing =
        byocErrorFull.message?.includes('column') &&
        byocErrorFull.message?.includes('does not exist');

      if (isColumnMissing) {
        console.warn('⚠️ [RESILIENCE] Colonna opzionale mancante per BYOC, uso query essenziali');
        const { data: byocClientsEssential, error: byocErrorEssential } = await supabaseAdmin
          .from('users')
          .select('id, email, name, wallet_balance, created_at')
          .eq('account_type', 'byoc')
          .order('created_at', { ascending: false });

        if (byocErrorEssential) {
          console.error(
            '❌ [getAllClientsForUser] Errore recupero BYOC clients:',
            byocErrorEssential
          );
          // Non bloccante, continua con reseller
        } else {
          // Aggiungi campi opzionali come null
          byocClients = (byocClientsEssential || []).map((b) => ({
            ...b,
            company_name: null,
            phone: null,
          }));
        }
      } else {
        console.error('❌ [getAllClientsForUser] Errore recupero BYOC clients:', byocErrorFull);
        // Non bloccante, continua con reseller
      }
    } else {
      byocClients = byocClientsFull || [];
    }

    // 6. Calcola statistiche aggregate
    const totalResellers = resellersWithSubUsers.length;
    const totalSubUsers = resellersWithSubUsers.reduce((sum, r) => sum + r.stats.totalSubUsers, 0);
    const totalBYOC = (byocClients || []).length;
    const totalWalletBalance =
      resellersWithSubUsers.reduce(
        (sum, r) => sum + (r.reseller.wallet_balance || 0) + r.stats.totalWalletBalance,
        0
      ) + (byocClients || []).reduce((sum, b) => sum + (b.wallet_balance || 0), 0);

    console.log('✅ [getAllClientsForUser] Dati completati:', {
      resellers: resellersWithSubUsers.length,
      byocClients: (byocClients || []).length,
      totalResellers,
      totalSubUsers,
      totalBYOC,
      totalWalletBalance,
    });

    return {
      success: true,
      clients: {
        resellers: resellersWithSubUsers,
        byocClients: byocClients || [],
        stats: {
          totalResellers,
          totalSubUsers,
          totalBYOC,
          totalWalletBalance,
        },
      },
    };
  } catch (error: any) {
    console.error('❌ [getAllClientsForUser] Errore critico:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
    });
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}
