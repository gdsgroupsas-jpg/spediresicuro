'use server';

/**
 * Server Actions per Gestione Wallet Utente
 *
 * CRITICAL: Migrato a Acting Context (Impersonation Support)
 * - Usa requireWorkspaceAuth() per supportare impersonation
 * - Opera sempre su context.target (chi paga), non su actor (chi clicca)
 * - Audit log completo con actor + target
 *
 * Permette all'utente di:
 * - Richiedere una ricarica wallet (se non è admin)
 * - Ricaricare direttamente il proprio wallet (se è admin/superadmin)
 * - Visualizzare le proprie transazioni
 */

import { requireWorkspaceAuth, getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { writeWalletAuditLog } from '@/lib/security/audit-log';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';

/**
 * DEPRECATED: Legacy function, migrato a getWorkspaceAuth() + isSuperAdmin()
 * Mantenuto per compatibilità temporanea, ma NON usare in nuovo codice
 */
async function isCurrentUserAdmin_DEPRECATED(): Promise<{
  isAdmin: boolean;
  userId?: string;
  isSuperAdmin?: boolean;
}> {
  console.warn(
    '⚠️ [DEPRECATED] isCurrentUserAdmin() is deprecated. Use getWorkspaceAuth() + isSuperAdmin() instead.'
  );

  try {
    const context = await getWorkspaceAuth();

    if (!context) {
      return { isAdmin: false };
    }

    const isAdmin = isSuperAdmin(context);

    return {
      isAdmin,
      isSuperAdmin: isAdmin,
      userId: context.target.id,
    };
  } catch (error: any) {
    console.error('Errore verifica Admin:', error);
    return { isAdmin: false };
  }
}

/**
 * Server Action: Ricarica wallet dell'utente corrente
 *
 * Se l'utente è admin/superadmin, può ricaricare direttamente.
 * Se l'utente è normale, crea una richiesta di ricarica.
 *
 * @param amount - Importo da aggiungere (deve essere positivo)
 * @param reason - Motivo della ricarica
 * @returns Risultato operazione
 */
export async function rechargeMyWallet(
  amount: number,
  reason: string = 'Ricarica wallet utente'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  transactionId?: string;
  newBalance?: number;
}> {
  try {
    // 1. Get Safe Auth (Acting Context)
    const context = await requireWorkspaceAuth();

    // 2. Extract target and actor (target = who receives credit, actor = who clicked)
    const targetId = context.target.id;
    const actorId = context.actor.id;
    const impersonationActive = context.isImpersonating;

    // 3. Valida importo
    if (amount <= 0) {
      return {
        success: false,
        error: "L'importo deve essere positivo.",
      };
    }

    // 4. Verifica se l'actor è admin/superadmin
    const isAdmin = isSuperAdmin(context);

    // 5. Se l'actor è admin/superadmin, ricarica direttamente il wallet del target
    if (isAdmin) {
      // Usa la funzione SQL per aggiungere credito (con dual-write workspace)
      const walletWorkspaceId = await getUserWorkspaceId(targetId);
      const { data: txData, error: txError } = await supabaseAdmin.rpc('add_wallet_credit_v2', {
        p_workspace_id: walletWorkspaceId,
        p_user_id: targetId, // Target ID (who receives credit)
        p_amount: amount,
        p_description: reason,
        p_created_by: actorId, // Actor ID (who clicked)
      });

      if (txError) {
        // RPC fallito: ritorna errore (no fallback manuale per evitare doppio accredito)
        console.error('Errore RPC add_wallet_credit:', txError);
        return {
          success: false,
          error: txError.message || 'Errore durante la ricarica del wallet. Riprova più tardi.',
        };
      } else {
        // Funzione SQL ha funzionato - Audit log con Acting Context
        try {
          await writeWalletAuditLog(context, AUDIT_ACTIONS.WALLET_RECHARGE, amount, txData, {
            reason,
            type: impersonationActive ? 'admin_recharge_for_user' : 'self_recharge',
          });
        } catch (auditError) {
          console.warn('⚠️ [AUDIT] Errore audit log (fail-open):', auditError);
        }

        const { data: updatedUser } = await supabaseAdmin
          .from('users')
          .select('wallet_balance')
          .eq('id', targetId) // Target ID (who received credit)
          .single();

        return {
          success: true,
          message: `Ricarica di €${amount} completata con successo.`,
          transactionId: txData,
          newBalance: updatedUser?.wallet_balance || 0,
        };
      }
    } else {
      // Utente normale: crea richiesta di ricarica (per ora ricarica direttamente)
      // TODO: Implementare sistema di richieste approvate da admin
      const { data: tx, error: insertError } = await supabaseAdmin
        .from('wallet_transactions')
        .insert([
          {
            user_id: targetId, // Target ID (who receives credit)
            amount: amount,
            type: 'recharge_request',
            description: reason,
            created_by: actorId, // Actor ID (who clicked)
          },
        ])
        .select('id')
        .single();

      if (insertError) {
        return {
          success: false,
          error: insertError.message || 'Errore durante la creazione della richiesta.',
        };
      }

      // Audit log
      try {
        await writeWalletAuditLog(context, AUDIT_ACTIONS.WALLET_RECHARGE, amount, tx.id, {
          reason,
          type: 'user_recharge_request',
          status: 'pending_approval',
        });
      } catch (auditError) {
        console.warn('⚠️ [AUDIT] Errore audit log (fail-open):', auditError);
      }

      return {
        success: true,
        message: 'Richiesta di ricarica inviata. Verrà processata a breve.',
        transactionId: tx.id,
      };
    }
  } catch (error: any) {
    console.error('Errore in rechargeMyWallet:', error);
    return {
      success: false,
      error: error.message || 'Errore durante la ricarica del wallet.',
    };
  }
}

/**
 * Server Action: Ottieni transazioni wallet dell'utente corrente
 *
 * CRITICAL: Migrato a Acting Context (Impersonation Support)
 * - Usa requireWorkspaceAuth() per supportare impersonation
 * - Ritorna transazioni del TARGET (non dell'actor se impersonating)
 */
export async function getMyWalletTransactions(): Promise<{
  success: boolean;
  transactions?: any[];
  error?: string;
}> {
  try {
    // Get Safe Auth (Acting Context)
    const context = await requireWorkspaceAuth();

    // Extract target ID (who owns the wallet)
    const targetId = context.target.id;

    // Query transactions del TARGET (non dell'actor)
    const { data: transactions, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', targetId) // Target ID (wallet owner)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return {
        success: false,
        error: error.message || 'Errore durante il caricamento delle transazioni.',
      };
    }

    // Audit log (view wallet transactions)
    try {
      await writeWalletAuditLog(
        context,
        AUDIT_ACTIONS.VIEW_WALLET_TRANSACTIONS,
        0, // No amount for view operation
        'N/A',
        {
          transactions_count: transactions?.length || 0,
        }
      );
    } catch (auditError) {
      console.warn('⚠️ [AUDIT] Errore audit log (fail-open):', auditError);
    }

    return {
      success: true,
      transactions: transactions || [],
    };
  } catch (error: any) {
    console.error('Errore in getMyWalletTransactions:', error);
    return {
      success: false,
      error: error.message || 'Errore durante il caricamento delle transazioni.',
    };
  }
}
