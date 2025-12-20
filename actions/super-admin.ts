'use server'

/**
 * Server Actions per Gestione Super Admin
 * 
 * Il Super Admin può:
 * - Promuovere utenti a Reseller
 * - Gestire il wallet (aggiungere/rimuovere credito)
 * - Attivare feature (gratuite o a pagamento)
 * - Visualizzare tutti gli utenti
 */

import { auth } from '@/lib/auth-config'
import { supabaseAdmin } from '@/lib/db/client'

/**
 * Verifica se l'utente corrente è Super Admin
 */
async function isCurrentUserSuperAdmin(): Promise<{ isSuperAdmin: boolean; userId?: string; error?: string }> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return { isSuperAdmin: false, error: 'Non autenticato' }
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', session.user.email)
      .single()

    if (error || !user) {
      return { isSuperAdmin: false, error: 'Utente non trovato' }
    }

    return { 
      isSuperAdmin: user.account_type === 'superadmin', 
      userId: user.id 
    }
  } catch (error: any) {
    console.error('Errore verifica Super Admin:', error)
    return { isSuperAdmin: false, error: error.message }
  }
}

/**
 * Server Action: Attiva/Disattiva status Reseller per un utente
 * 
 * @param userId - ID dell'utente da promuovere/declassare
 * @param isReseller - true per promuovere a Reseller, false per declassare
 * @returns Risultato operazione
 */
export async function toggleResellerStatus(
  userId: string,
  isReseller: boolean
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // 1. Verifica che l'utente corrente sia Super Admin
    const superAdminCheck = await isCurrentUserSuperAdmin()
    if (!superAdminCheck.isSuperAdmin) {
      return {
        success: false,
        error: 'Solo i Super Admin possono modificare lo status Reseller.',
      }
    }

    // 2. Verifica che l'utente target esista
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, is_reseller, account_type')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return {
        success: false,
        error: 'Utente non trovato.',
      }
    }

    // 3. Non permettere di declassare un Super Admin
    if (targetUser.account_type === 'superadmin' && !isReseller) {
      return {
        success: false,
        error: 'Non puoi declassare un Super Admin.',
      }
    }

    // 4. Aggiorna is_reseller
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        is_reseller: isReseller,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Errore aggiornamento Reseller status:', updateError)
      return {
        success: false,
        error: updateError.message || 'Errore durante l\'aggiornamento dello status.',
      }
    }

    return {
      success: true,
      message: isReseller
        ? `${targetUser.name} è stato promosso a Reseller.`
        : `${targetUser.name} non è più un Reseller.`,
    }
  } catch (error: any) {
    console.error('Errore in toggleResellerStatus:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}

/**
 * Server Action: Gestisce il wallet di un utente (aggiunge/rimuove credito)
 * 
 * @param userId - ID dell'utente
 * @param amount - Importo da aggiungere (positivo) o rimuovere (negativo)
 * @param reason - Motivo della modifica (es. "Ricarica manuale", "Regalo", ecc.)
 * @returns Risultato operazione
 */
export async function manageWallet(
  userId: string,
  amount: number,
  reason: string = 'Gestione manuale credito'
): Promise<{
  success: boolean
  message?: string
  error?: string
  transactionId?: string
  newBalance?: number
}> {
  try {
    // 1. Verifica che l'utente corrente sia Super Admin
    const superAdminCheck = await isCurrentUserSuperAdmin()
    if (!superAdminCheck.isSuperAdmin) {
      return {
        success: false,
        error: 'Solo i Super Admin possono gestire il wallet.',
      }
    }

    // 2. Valida importo
    if (amount === 0) {
      return {
        success: false,
        error: 'L\'importo non può essere zero.',
      }
    }

    // 3. Verifica che l'utente target esista
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, wallet_balance')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return {
        success: false,
        error: 'Utente non trovato.',
      }
    }

    // 4. Verifica balance se si sta rimuovendo credito
    if (amount < 0 && (targetUser.wallet_balance || 0) < Math.abs(amount)) {
      return {
        success: false,
        error: `Credito insufficiente. Disponibile: €${targetUser.wallet_balance || 0}, Richiesto: €${Math.abs(amount)}`,
      }
    }

    // 5. Determina tipo transazione
    const transactionType = amount > 0 ? 'admin_gift' : 'admin_deduction'

    // 6. Crea transazione wallet (usa funzione SQL se disponibile, altrimenti insert diretto)
    let transactionId: string

    if (amount > 0) {
      // Aggiungi credito usando funzione SQL
      const { data: txData, error: txError } = await supabaseAdmin.rpc('add_wallet_credit', {
        p_user_id: userId,
        p_amount: amount,
        p_description: reason,
        p_created_by: superAdminCheck.userId,
      })

      if (txError) {
        // RPC fallito: ritorna errore (no fallback manuale per evitare doppio accredito)
        console.error('Errore RPC add_wallet_credit:', txError)
        return {
          success: false,
          error: txError.message || 'Errore durante la ricarica del wallet. Riprova più tardi.',
        }
      } else {
        transactionId = txData
      }
    } else {
      // Rimuovi credito (usa funzione SQL se disponibile)
      const { data: txData, error: txError } = await supabaseAdmin.rpc('deduct_wallet_credit', {
        p_user_id: userId,
        p_amount: Math.abs(amount),
        p_type: transactionType,
        p_description: reason,
      })

      if (txError) {
        // RPC fallito: ritorna errore (no fallback manuale per evitare doppio accredito)
        console.error('Errore RPC deduct_wallet_credit:', txError)
        return {
          success: false,
          error: txError.message || 'Errore durante la rimozione del credito. Riprova più tardi.',
        }
      } else {
        transactionId = txData
      }
    }

    // 7. Audit log
    try {
      const session = await auth()
      await supabaseAdmin.from('audit_logs').insert({
        action: amount > 0 ? 'wallet_credit_added' : 'wallet_credit_removed',
        resource_type: 'wallet',
        resource_id: userId,
        user_email: session?.user?.email || 'unknown',
        user_id: superAdminCheck.userId,
        metadata: {
          amount: Math.abs(amount),
          reason: reason,
          transaction_id: transactionId,
          type: transactionType,
          target_user_id: userId,
        }
      })
    } catch (auditError) {
      console.warn('Errore audit log:', auditError)
    }

    // 8. Ottieni nuovo balance
    const { data: updatedUser } = await supabaseAdmin
      .from('users')
      .select('wallet_balance')
      .eq('id', userId)
      .single()

    return {
      success: true,
      message: amount > 0
        ? `Credito di €${amount} aggiunto con successo.`
        : `Credito di €${Math.abs(amount)} rimosso con successo.`,
      transactionId,
      newBalance: updatedUser?.wallet_balance || 0,
    }
  } catch (error: any) {
    console.error('Errore in manageWallet:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}

/**
 * Server Action: Attiva una feature per un utente (gratuita o a pagamento)
 * 
 * @param userId - ID dell'utente
 * @param featureCode - Codice della feature da attivare
 * @param isFree - Se true, attiva senza scalare credito (regalo)
 * @returns Risultato operazione
 */
export async function grantFeature(
  userId: string,
  featureCode: string,
  isFree: boolean = false
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    // 1. Verifica che l'utente corrente sia Super Admin
    const superAdminCheck = await isCurrentUserSuperAdmin()
    if (!superAdminCheck.isSuperAdmin) {
      return {
        success: false,
        error: 'Solo i Super Admin possono attivare feature.',
      }
    }

    // 2. Verifica che l'utente target esista
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, wallet_balance')
      .eq('id', userId)
      .single()

    if (userError || !targetUser) {
      return {
        success: false,
        error: 'Utente non trovato.',
      }
    }

    // 3. Verifica che la feature esista
    const { data: feature, error: featureError } = await supabaseAdmin
      .from('killer_features')
      .select('code, name, is_free, price_monthly_cents')
      .eq('code', featureCode)
      .single()

    if (featureError || !feature) {
      return {
        success: false,
        error: 'Feature non trovata.',
      }
    }

    // 4. Se non è gratis e non è un regalo, controlla credito e scala
    if (!isFree && !feature.is_free && feature.price_monthly_cents) {
      const priceInEuros = feature.price_monthly_cents / 100
      const currentBalance = targetUser.wallet_balance || 0

      if (currentBalance < priceInEuros) {
        return {
          success: false,
          error: `Credito insufficiente. Disponibile: €${currentBalance}, Richiesto: €${priceInEuros}`,
        }
      }

      // Scala credito
      const deductResult = await manageWallet(
        userId,
        -priceInEuros,
        `Attivazione feature: ${feature.name}`
      )

      if (!deductResult.success) {
        return {
          success: false,
          error: deductResult.error || 'Errore durante la scala del credito.',
        }
      }
    }

    // 5. Attiva feature (usa funzione SQL esistente o insert diretto)
    // Assumiamo che esista una tabella user_features o similar
    const { error: activateError } = await supabaseAdmin
      .from('user_features')
      .upsert(
        {
          user_id: userId,
          feature_code: featureCode,
          is_active: true,
          is_free: isFree || feature.is_free,
          activated_by: superAdminCheck.userId,
          activated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,feature_code',
        }
      )

    if (activateError) {
      console.error('Errore attivazione feature:', activateError)
      // Potrebbe non esistere la tabella user_features, quindi proviamo con rpc se disponibile
      return {
        success: false,
        error: activateError.message || 'Errore durante l\'attivazione della feature.',
      }
    }

    return {
      success: true,
      message: isFree || feature.is_free
        ? `Feature "${feature.name}" attivata gratuitamente.`
        : `Feature "${feature.name}" attivata. Credito scalato: €${(feature.price_monthly_cents || 0) / 100}`,
    }
  } catch (error: any) {
    console.error('Errore in grantFeature:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}

/**
 * Server Action: Ottiene tutti gli utenti (solo Super Admin)
 * 
 * @param limit - Numero massimo di risultati (default: 100)
 * @returns Lista utenti
 */
export async function getAllUsers(limit: number = 100): Promise<{
  success: boolean
  users?: Array<{
    id: string
    email: string
    name: string
    account_type: string
    is_reseller: boolean
    wallet_balance: number
    created_at: string
  }>
  error?: string
}> {
  try {
    // 1. Verifica che l'utente corrente sia Super Admin
    const superAdminCheck = await isCurrentUserSuperAdmin()
    if (!superAdminCheck.isSuperAdmin) {
      return {
        success: false,
        error: 'Solo i Super Admin possono visualizzare tutti gli utenti.',
      }
    }

    // 2. Ottieni utenti
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, account_type, is_reseller, wallet_balance, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Errore recupero utenti:', error)
      return {
        success: false,
        error: error.message || 'Errore durante il recupero degli utenti.',
      }
    }

    return {
      success: true,
      users: users || [],
    }
  } catch (error: any) {
    console.error('Errore in getAllUsers:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}

/**
 * Server Action: Crea un nuovo utente Reseller completo
 *
 * @param data - Dati del nuovo reseller
 * @returns Risultato operazione
 */
export async function createReseller(data: {
  email: string
  name: string
  password: string
  initialCredit?: number
  notes?: string
}): Promise<{
  success: boolean
  message?: string
  error?: string
  userId?: string
}> {
  try {
    // 1. Verifica che l'utente corrente sia Super Admin
    const superAdminCheck = await isCurrentUserSuperAdmin()
    if (!superAdminCheck.isSuperAdmin) {
      return {
        success: false,
        error: 'Solo i Super Admin possono creare reseller.',
      }
    }

    // 2. Valida dati input
    if (!data.email || !data.name || !data.password) {
      return {
        success: false,
        error: 'Email, nome e password sono obbligatori.',
      }
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      return {
        success: false,
        error: 'Email non valida.',
      }
    }

    // Validazione password
    if (data.password.length < 8) {
      return {
        success: false,
        error: 'La password deve essere di almeno 8 caratteri.',
      }
    }

    // 3. Verifica che l'email non sia già in uso
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', data.email.toLowerCase().trim())
      .single()

    if (existingUser) {
      return {
        success: false,
        error: 'Questa email è già registrata.',
      }
    }

    // 4. Crea utente usando la funzione esistente createUser
    // Import necessario già presente all'inizio del file
    const bcrypt = require('bcryptjs')
    const hashedPassword = await bcrypt.hash(data.password, 10)

    // 5. Crea utente nel database
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email: data.email.toLowerCase().trim(),
          name: data.name.trim(),
          password: hashedPassword,
          account_type: 'user', // Inizialmente user
          is_reseller: true, // Ma con flag reseller attivo
          wallet_balance: data.initialCredit || 0,
          email_verified: true, // Auto-verificato da super admin
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single()

    if (createError) {
      console.error('Errore creazione reseller:', createError)
      return {
        success: false,
        error: createError.message || 'Errore durante la creazione del reseller.',
      }
    }

    const userId = newUser.id

    // 6. Se c'è credito iniziale, crea transazione wallet
    if (data.initialCredit && data.initialCredit > 0) {
      await supabaseAdmin
        .from('wallet_transactions')
        .insert([
          {
            user_id: userId,
            amount: data.initialCredit,
            type: 'admin_gift',
            description: 'Credito iniziale alla creazione account reseller',
            created_by: superAdminCheck.userId,
          },
        ])
    }

    // 7. Se ci sono note, salvale (opzionale, se esiste una tabella notes)
    if (data.notes) {
      // Potremmo salvare le note in una tabella separata o nel campo note dell'utente
      await supabaseAdmin
        .from('users')
        .update({ notes: data.notes })
        .eq('id', userId)
    }

    return {
      success: true,
      message: `Reseller "${data.name}" creato con successo!`,
      userId: userId,
    }
  } catch (error: any) {
    console.error('Errore in createReseller:', error)
    return {
      success: false,
      error: error.message || 'Errore sconosciuto.',
    }
  }
}


