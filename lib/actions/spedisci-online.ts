'use server'

/**
 * Server Actions per Integrazione Spedisci.Online e Fulfillment Orchestrator
 * 
 * Gestisce l'invio automatico delle spedizioni tramite orchestrator intelligente
 * per la creazione automatica delle LDV con routing ottimale.
 */

import { auth } from '@/lib/auth-config'
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online'
import { getFulfillmentOrchestrator, ShipmentResult } from '@/lib/engine/fulfillment-orchestrator'
import { findUserByEmail } from '@/lib/database'
import { createServerActionClient } from '@/lib/supabase-server'
import type { Shipment, CreateShipmentInput } from '@/types/shipments'

/**
 * Recupera credenziali spedisci.online dell'utente
 */
export async function getSpedisciOnlineCredentials() {
  try {
    const session = await auth()
    
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
 * Crea spedizione tramite Fulfillment Orchestrator
 * 
 * Usa routing intelligente:
 * 1. Adapter diretto (se disponibile) - massima velocità
 * 2. Broker spedisci.online (se configurato) - copertura completa
 * 3. Fallback CSV (se tutto fallisce) - zero perdita ordini
 */
export async function createShipmentWithOrchestrator(
  shipmentData: Shipment | CreateShipmentInput | any,
  courierCode: string
): Promise<ShipmentResult> {
  try {
    // 1. Verifica autenticazione
    const session = await auth()
    
    if (!session?.user?.email) {
      return {
        success: false,
        tracking_number: '',
        carrier: courierCode,
        method: 'fallback',
        error: 'Non autenticato',
      }
    }

    // 2. Ottieni orchestrator
    const orchestrator = getFulfillmentOrchestrator()

    // 3. Registra broker adapter (spedisci.online) se disponibile
    const credentialsResult = await getSpedisciOnlineCredentials()
    if (credentialsResult.success && credentialsResult.credentials) {
      try {
        const brokerAdapter = new SpedisciOnlineAdapter(credentialsResult.credentials)
        orchestrator.registerBrokerAdapter(brokerAdapter)
      } catch (error) {
        console.warn('Impossibile registrare broker adapter:', error)
      }
    }

    // 4. Crea spedizione tramite orchestrator (routing intelligente)
    const result = await orchestrator.createShipment(shipmentData, courierCode)

    return result
  } catch (error) {
    console.error('Errore creazione spedizione tramite orchestrator:', error)
    return {
      success: false,
      tracking_number: '',
      carrier: courierCode,
      method: 'fallback',
      error: error instanceof Error ? error.message : 'Errore durante la creazione',
      message: 'Errore durante la creazione LDV',
    }
  }
}

/**
 * @deprecated Usa createShipmentWithOrchestrator invece
 * Mantenuto per retrocompatibilità
 */
export async function sendShipmentToSpedisciOnline(shipmentData: any) {
  const result = await createShipmentWithOrchestrator(shipmentData, 'GLS')
  
  return {
    success: result.success,
    tracking_number: result.tracking_number,
    label_url: result.label_url,
    message: result.message || 'Spedizione processata',
    error: result.error,
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
    const session = await auth()
    
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

