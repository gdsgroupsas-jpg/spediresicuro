'use server'

/**
 * Server Actions per Gestione Wallet Utente
 * 
 * Permette all'utente di:
 * - Richiedere una ricarica wallet (se non è admin)
 * - Ricaricare direttamente il proprio wallet (se è admin/superadmin)
 * - Visualizzare le proprie transazioni
 */

import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'

/**
 * Verifica se l'utente corrente è Admin o Super Admin
 */
async function isCurrentUserAdmin(): Promise<{ isAdmin: boolean; userId?: string; isSuperAdmin?: boolean }> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return { isAdmin: false }
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', session.user.email)
      .single()

    if (error || !user) {
      return { isAdmin: false }
    }

    const isSuperAdmin = user.account_type === 'superadmin'
    const isAdmin = isSuperAdmin || user.account_type === 'admin'

    return { 
      isAdmin,
      isSuperAdmin,
      userId: user.id 
    }
  } catch (error: any) {
    console.error('Errore verifica Admin:', error)
    return { isAdmin: false }
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
  success: boolean
  message?: string
  error?: string
  transactionId?: string
  newBalance?: number
}> {
  try {
    // 1. Verifica autenticazione
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      }
    }

    // 2. Valida importo
    if (amount <= 0) {
      return {
        success: false,
        error: 'L\'importo deve essere positivo.',
      }
    }

    // 3. Verifica se l'utente è admin
    const adminCheck = await isCurrentUserAdmin()
    const userId = adminCheck.userId

    if (!userId) {
      return {
        success: false,
        error: 'Utente non trovato.',
      }
    }

    // 4. Se l'utente è admin/superadmin, ricarica direttamente
    if (adminCheck.isAdmin) {
      // Usa la funzione SQL per aggiungere credito
      const { data: txData, error: txError } = await supabaseAdmin.rpc('add_wallet_credit', {
        p_user_id: userId,
        p_amount: amount,
        p_description: reason,
        p_created_by: userId,
      })

      if (txError) {
        // Fallback: inserisci transazione manualmente
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('wallet_balance')
          .eq('id', userId)
          .single()

        const { data: tx, error: insertError } = await supabaseAdmin
          .from('wallet_transactions')
          .insert([
            {
              user_id: userId,
              amount: amount,
              type: 'self_recharge',
              description: reason,
              created_by: userId,
            },
          ])
          .select('id')
          .single()

        if (insertError) {
          console.error('Errore creazione transazione:', insertError)
          return {
            success: false,
            error: insertError.message || 'Errore durante la creazione della transazione.',
          }
        }

        // Aggiorna wallet_balance
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            wallet_balance: (user?.wallet_balance || 0) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        if (updateError) {
          console.error('Errore aggiornamento wallet:', updateError)
          return {
            success: false,
            error: updateError.message || 'Errore durante l\'aggiornamento del wallet.',
          }
        }

        const { data: updatedUser } = await supabaseAdmin
          .from('users')
          .select('wallet_balance')
          .eq('id', userId)
          .single()

        return {
          success: true,
          message: `Ricarica di €${amount} completata con successo.`,
          transactionId: tx.id,
          newBalance: updatedUser?.wallet_balance || 0,
        }
      } else {
        // Funzione SQL ha funzionato
        const { data: updatedUser } = await supabaseAdmin
          .from('users')
          .select('wallet_balance')
          .eq('id', userId)
          .single()

        return {
          success: true,
          message: `Ricarica di €${amount} completata con successo.`,
          transactionId: txData,
          newBalance: updatedUser?.wallet_balance || 0,
        }
      }
    } else {
      // Utente normale: crea richiesta di ricarica (per ora ricarica direttamente)
      // TODO: Implementare sistema di richieste approvate da admin
      const { data: tx, error: insertError } = await supabaseAdmin
        .from('wallet_transactions')
        .insert([
          {
            user_id: userId,
            amount: amount,
            type: 'recharge_request',
            description: reason,
            created_by: userId,
          },
        ])
        .select('id')
        .single()

      if (insertError) {
        return {
          success: false,
          error: insertError.message || 'Errore durante la creazione della richiesta.',
        }
      }

      return {
        success: true,
        message: 'Richiesta di ricarica inviata. Verrà processata a breve.',
        transactionId: tx.id,
      }
    }
  } catch (error: any) {
    console.error('Errore in rechargeMyWallet:', error)
    return {
      success: false,
      error: error.message || 'Errore durante la ricarica del wallet.',
    }
  }
}

/**
 * Server Action: Ottieni transazioni wallet dell'utente corrente
 */
export async function getMyWalletTransactions(): Promise<{
  success: boolean
  transactions?: any[]
  error?: string
}> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      }
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return {
        success: false,
        error: 'Utente non trovato.',
      }
    }

    const { data: transactions, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return {
        success: false,
        error: error.message || 'Errore durante il caricamento delle transazioni.',
      }
    }

    return {
      success: true,
      transactions: transactions || [],
    }
  } catch (error: any) {
    console.error('Errore in getMyWalletTransactions:', error)
    return {
      success: false,
      error: error.message || 'Errore durante il caricamento delle transazioni.',
    }
  }
}
