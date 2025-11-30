'use server'

/**
 * Server Actions per Integrazione Spedisci.Online
 * 
 * Gestisce l'invio automatico delle spedizioni a spedisci.online
 * per la creazione automatica delle LDV.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-config'
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online'
import { findUserByEmail } from '@/lib/database'
import { createServerActionClient } from '@/lib/supabase-server'

/**
 * Recupera credenziali spedisci.online dell'utente
 */
export async function getSpedisciOnlineCredentials() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    // Prova Supabase prima
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const supabase = createServerActionClient()
      const { data: { user: supabaseUser } } = await supabase.auth.getUser()
      
      if (supabaseUser) {
        const { data, error } = await supabase
          .from('user_integrations')
          .select('credentials')
          .eq('provider', 'spedisci-online')
          .eq('is_active', true)
          .single()

        if (!error && data) {
          return {
            success: true,
            credentials: data.credentials,
          }
        }
      }
    }

    // Fallback: database locale
    const user = findUserByEmail(session.user.email)
    if (user?.integrazioni?.spedisci_online) {
      return {
        success: true,
        credentials: user.integrazioni.spedisci_online,
      }
    }

    return {
      success: false,
      error: 'Credenziali spedisci.online non configurate',
    }
  } catch (error) {
    console.error('Errore recupero credenziali spedisci.online:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto',
    }
  }
}

/**
 * Invia spedizione a spedisci.online
 */
export async function sendShipmentToSpedisciOnline(shipmentData: any) {
  try {
    // 1. Verifica autenticazione
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    // 2. Recupera credenziali
    const credentialsResult = await getSpedisciOnlineCredentials()
    
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return {
        success: false,
        error: 'Credenziali spedisci.online non configurate. Configurale nelle Impostazioni.',
      }
    }

    // 3. Crea adapter
    const adapter = new SpedisciOnlineAdapter(credentialsResult.credentials)

    // 4. Test connessione
    const isConnected = await adapter.connect()
    if (!isConnected) {
      return {
        success: false,
        error: 'Impossibile connettersi a spedisci.online. Verifica le credenziali.',
      }
    }

    // 5. Crea spedizione
    const result = await adapter.createShipment(shipmentData)

    return {
      success: true,
      tracking_number: result.tracking_number,
      label_url: result.label_url,
      message: 'Spedizione inviata a spedisci.online con successo',
    }
  } catch (error) {
    console.error('Errore invio spedizione a spedisci.online:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante l\'invio',
    }
  }
}

/**
 * Salva credenziali spedisci.online
 */
export async function saveSpedisciOnlineCredentials(credentials: {
  api_key: string
  api_secret?: string
  customer_code?: string
  base_url?: string
}) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' }
    }

    // Validazione base
    if (!credentials.api_key) {
      return { success: false, error: 'API Key obbligatoria' }
    }

    // Prova Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const supabase = createServerActionClient()
      const { data: { user: supabaseUser } } = await supabase.auth.getUser()
      
      if (supabaseUser) {
        const { error } = await supabase
          .from('user_integrations')
          .upsert({
            user_id: supabaseUser.id,
            provider: 'spedisci-online',
            credentials: credentials,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,provider',
          })

        if (!error) {
          return { success: true, message: 'Credenziali salvate con successo' }
        }
      }
    }

    // Fallback: database locale
    const { readDatabase, writeDatabase } = await import('@/lib/database')
    const db = readDatabase()
    const user = db.users.find((u: any) => u.email === session.user.email)
    
    if (user) {
      if (!user.integrazioni) {
        user.integrazioni = {}
      }
      user.integrazioni.spedisci_online = credentials
      writeDatabase(db)
      
      return { success: true, message: 'Credenziali salvate con successo' }
    }

    return { success: false, error: 'Utente non trovato' }
  } catch (error) {
    console.error('Errore salvataggio credenziali spedisci.online:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore durante il salvataggio',
    }
  }
}

