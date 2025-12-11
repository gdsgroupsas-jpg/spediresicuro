'use server'

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

import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'
import { createUser } from '@/lib/database'
import bcrypt from 'bcryptjs'
import { validateEmail } from '@/lib/validators'
import { userExists } from '@/lib/db/user-helpers'

/**
 * Verifica se l'utente corrente è un Reseller
 */
async function isCurrentUserReseller(): Promise<{ isReseller: boolean; userId?: string; error?: string }> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return { isReseller: false, error: 'Non autenticato' }
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller')
      .eq('email', session.user.email)
      .single()

    if (error || !user) {
      return { isReseller: false, error: 'Utente non trovato' }
    }

    return { 
      isReseller: user.is_reseller === true, 
      userId: user.id 
    }
  } catch (error: any) {
    console.error('Errore verifica Reseller:', error)
    return { isReseller: false, error: error.message }
  }
}

/**
 * Server Action: Crea un nuovo Sub-User (utente finale creato da un Reseller)
 * 
 * @param data - Dati del nuovo Sub-User
 * @returns Oggetto con success e dati utente creato
 */
export async function createSubUser(data: {
  email: string
  name: string
  password?: string
  companyName?: string
  phone?: string
}): Promise<{
  success: boolean
  message?: string
  error?: string
  userId?: string
  generatedPassword?: string
}> {
  try {
    // 1. Verifica autenticazione
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato. Devi essere loggato per creare Sub-Users.',
      }
    }

    // 2. Verifica che l'utente sia un Reseller
    const resellerCheck = await isCurrentUserReseller()
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono creare Sub-Users.',
      }
    }

    // 3. Valida input
    if (!data.email || !data.email.trim() || !data.name || !data.name.trim()) {
      return {
        success: false,
        error: 'Email e nome sono obbligatori.',
      }
    }

    // Validazione email
    if (!validateEmail(data.email)) {
      return {
        success: false,
        error: 'Email non valida.',
      }
    }

    // 4. Verifica se Sub-User esiste già
    const exists = await userExists(data.email.trim())

    if (exists) {
      return {
        success: false,
        error: 'Un utente con questa email esiste già.',
      }
    }

    // 5. Genera password se non fornita
    let password = data.password
    let generatedPassword: string | undefined
    
    if (!password) {
      // Genera password casuale sicura
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*'
      password = ''
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      generatedPassword = password
    }

    // Hash password (obbligatorio per sicurezza)
    let hashedPassword: string
    try {
      hashedPassword = await bcrypt.hash(password, 10)
    } catch (hashError) {
      console.error('❌ Errore critico hash password:', hashError)
      throw new Error('Impossibile creare utente: errore hash password')
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
          parent_id: resellerCheck.userId, // Collegamento al Reseller creatore
          is_reseller: false,
          wallet_balance: 0.00,
          company_name: data.companyName || null,
          phone: data.phone || null,
          provider: 'credentials',
        },
      ])
      .select()
      .single()

    if (createError) {
      console.error('Errore creazione Sub-User:', createError)
      return {
        success: false,
        error: createError.message || 'Errore durante la creazione del Sub-User.',
      }
    }

    // 7. Crea anche nel database locale (compatibilità)
    try {
      await createUser({
        email: data.email.trim(),
        password: hashedPassword,
        name: data.name.trim(),
        role: 'user',
        accountType: 'user',
        parentAdminId: resellerCheck.userId, // Usa parentAdminId per compatibilità con sistema esistente
      })
    } catch (localError: any) {
      // Non critico se Supabase ha funzionato
      console.warn('Errore creazione locale (non critico):', localError.message)
    }

    return {
      success: true,
      message: generatedPassword 
        ? `Sub-User creato con successo! Password generata: ${generatedPassword}` 
        : 'Sub-User creato con successo!',
      userId: newUser.id,
      generatedPassword: generatedPassword, // Ritorna password generata per mostrare all'admin
    }
  } catch (error: any) {
    console.error('Errore in createSubUser:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la creazione del Sub-User.',
    }
  }
}

/**
 * Server Action: Ottiene la lista dei Sub-Users del Reseller corrente
 * 
 * @returns Lista dei Sub-Users
 */
export async function getSubUsers(): Promise<{
  success: boolean
  subUsers?: Array<{
    id: string
    email: string
    name: string
    company_name: string | null
    phone: string | null
    wallet_balance: number
    created_at: string
  }>
  error?: string
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

    // 2. Verifica che l'utente sia un Reseller
    const resellerCheck = await isCurrentUserReseller()
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono visualizzare i Sub-Users.',
      }
    }

    // 3. Ottieni Sub-Users
    const { data: subUsers, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, company_name, phone, wallet_balance, created_at')
      .eq('parent_id', resellerCheck.userId)
      .eq('is_reseller', false)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore recupero Sub-Users:', error)
      return {
        success: false,
        error: error.message || 'Errore durante il recupero dei Sub-Users.',
      }
    }

    return {
      success: true,
      subUsers: subUsers || [],
    }
  } catch (error: any) {
    console.error('Errore in getSubUsers:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}

/**
 * Server Action: Ottiene statistiche aggregate dei Sub-Users
 * 
 * @returns Statistiche aggregate
 */
export async function getSubUsersStats(): Promise<{
  success: boolean
  stats?: {
    totalSubUsers: number
    totalShipments: number
    totalRevenue: number
    activeSubUsers: number // Sub-Users con almeno una spedizione
  }
  error?: string
}> {
  try {
    // 1. Verifica autenticazione e Reseller status
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      }
    }

    const resellerCheck = await isCurrentUserReseller()
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono visualizzare le statistiche.',
      }
    }

    // 2. Ottieni Sub-Users
    const { data: subUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('parent_id', resellerCheck.userId)
      .eq('is_reseller', false)

    const subUserIds = subUsers?.map(u => u.id) || []
    const totalSubUsers = subUserIds.length

    if (totalSubUsers === 0) {
      return {
        success: true,
        stats: {
          totalSubUsers: 0,
          totalShipments: 0,
          totalRevenue: 0,
          activeSubUsers: 0,
        },
      }
    }

    // 3. Ottieni statistiche spedizioni
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('final_price, user_id')
      .in('user_id', subUserIds)
      .eq('deleted', false)

    if (shipmentsError) {
      console.error('Errore recupero spedizioni:', shipmentsError)
    }

    const totalShipments = shipments?.length || 0
    const totalRevenue = shipments?.reduce(
      (sum: number, s: any) => sum + (parseFloat(s.final_price || '0') || 0),
      0
    ) || 0

    // 4. Calcola Sub-Users attivi (con almeno una spedizione)
    const activeUserIds = new Set(shipments?.map((s: any) => s.user_id) || [])
    const activeSubUsers = activeUserIds.size

    return {
      success: true,
      stats: {
        totalSubUsers,
        totalShipments,
        totalRevenue,
        activeSubUsers,
      },
    }
  } catch (error: any) {
    console.error('Errore in getSubUsersStats:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
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
  success: boolean
  message?: string
  error?: string
  transactionId?: string
  newBalance?: number
}> {
  try {
    // 1. Verifica autenticazione e Reseller status
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      }
    }

    const resellerCheck = await isCurrentUserReseller()
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono gestire il wallet dei Sub-Users.',
      }
    }

    // 2. Valida importo (solo positivo per sicurezza)
    if (amount <= 0) {
      return {
        success: false,
        error: 'L\'importo deve essere positivo. I Reseller possono solo aggiungere credito, non rimuoverlo.',
      }
    }

    // 3. Verifica che il Sub-User appartenga al Reseller corrente
    const { data: subUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, wallet_balance, parent_id')
      .eq('id', subUserId)
      .single()

    if (userError || !subUser) {
      return {
        success: false,
        error: 'Sub-User non trovato.',
      }
    }

    // Verifica che il Sub-User appartenga al Reseller
    if (subUser.parent_id !== resellerCheck.userId) {
      return {
        success: false,
        error: 'Non hai i permessi per gestire il wallet di questo utente. Il Sub-User non appartiene al tuo account.',
      }
    }

    // 4. Aggiungi credito usando funzione SQL se disponibile
    let transactionId: string

    try {
      const { data: txData, error: txError } = await supabaseAdmin.rpc('add_wallet_credit', {
        p_user_id: subUserId,
        p_amount: amount,
        p_description: reason,
        p_created_by: resellerCheck.userId,
      })

      if (txError) {
        // Fallback: inserisci transazione manualmente
        const { data: tx, error: insertError } = await supabaseAdmin
          .from('wallet_transactions')
          .insert([
            {
              user_id: subUserId,
              amount: amount,
              type: 'reseller_recharge',
              description: reason,
              created_by: resellerCheck.userId,
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

        transactionId = tx.id

        // Aggiorna wallet_balance manualmente se la funzione SQL non esiste
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            wallet_balance: (subUser.wallet_balance || 0) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subUserId)

        if (updateError) {
          console.error('Errore aggiornamento wallet:', updateError)
          return {
            success: false,
            error: updateError.message || 'Errore durante l\'aggiornamento del wallet.',
          }
        }
      } else {
        transactionId = txData
      }
    } catch (error: any) {
      console.error('Errore in manageSubUserWallet:', error)
      return {
        success: false,
        error: error.message || 'Errore sconosciuto durante la gestione del wallet.',
      }
    }

    // 5. Ottieni nuovo balance
    const { data: updatedUser } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', subUserId)
      .single()

    return {
      success: true,
      message: `Ricarica di €${amount} completata con successo.`,
      transactionId,
      newBalance: updatedUser?.wallet_balance || 0,
    }
  } catch (error: any) {
    console.error('Errore in manageSubUserWallet:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}

/**
 * Server Action: Ottiene le spedizioni aggregate dei Sub-Users
 * 
 * @param limit - Numero massimo di risultati (default: 50)
 * @returns Lista spedizioni aggregate
 */
export async function getSubUsersShipments(limit: number = 50): Promise<{
  success: boolean
  shipments?: Array<any>
  error?: string
}> {
  try {
    // 1. Verifica autenticazione e Reseller status
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        error: 'Non autenticato.',
      }
    }

    const resellerCheck = await isCurrentUserReseller()
    if (!resellerCheck.isReseller || !resellerCheck.userId) {
      return {
        success: false,
        error: 'Solo i Reseller possono visualizzare le spedizioni dei Sub-Users.',
      }
    }

    // 2. Ottieni Sub-Users
    const { data: subUsers } = await supabaseAdmin
      .from('users')
      .select('id, email, name')
      .eq('parent_id', resellerCheck.userId)
      .eq('is_reseller', false)

    const subUserIds = subUsers?.map(u => u.id) || []

    if (subUserIds.length === 0) {
      return {
        success: true,
        shipments: [],
      }
    }

    // 3. Ottieni spedizioni
    const { data: shipments, error } = await supabaseAdmin
      .from('shipments')
      .select('*, users!shipments_user_id_fkey(email, name)')
      .in('user_id', subUserIds)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Errore recupero spedizioni:', error)
      return {
        success: false,
        error: error.message || 'Errore durante il recupero delle spedizioni.',
      }
    }

    return {
      success: true,
      shipments: shipments || [],
    }
  } catch (error: any) {
    console.error('Errore in getSubUsersShipments:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}
