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
import { getShippingProvider } from '@/lib/couriers/factory'
import { supabaseAdmin } from '@/lib/db/client'
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
    const user = await findUserByEmail(session.user.email)
    if (user?.integrazioni) {
      const spedisciOnlineIntegration = user.integrazioni.find(
        (i: any) => i.platform === 'spedisci_online' || i.platform === 'spedisci-online'
      )
      if (spedisciOnlineIntegration) {
        return {
          success: true,
          credentials: spedisciOnlineIntegration.credentials,
        }
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

    // 2. Ottieni user_id per factory
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (!user) {
      return {
        success: false,
        tracking_number: '',
        carrier: courierCode,
        method: 'fallback',
        error: 'Utente non trovato',
      }
    }

    // 3. Ottieni orchestrator
    const orchestrator = getFulfillmentOrchestrator()

    // 4. Registra broker adapter usando factory (SOLO DATABASE, nessun fallback env)
    // Se courierCode è spedisci_online, usa factory per recuperare provider dal DB
    if (courierCode.toLowerCase() === 'spedisci_online' || courierCode.toLowerCase() === 'spedisci-online') {
      try {
        const provider = await getShippingProvider(user.id, 'spedisci_online', shipmentData)
        if (provider && provider instanceof SpedisciOnlineAdapter) {
          orchestrator.registerBrokerAdapter(provider)
          console.log('✅ Broker adapter registrato tramite configurazione DB')
        } else {
          console.error('❌ Impossibile recuperare provider dal database. Configura una configurazione in /dashboard/admin/configurations')
          throw new Error('Configurazione corriere non trovata nel database')
        }
      } catch (error) {
        console.error('❌ Errore registrazione broker adapter:', error)
        throw error
      }
    }

    // 5. Crea spedizione tramite orchestrator (routing intelligente)
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
    const { findUserByEmail: findUser, updateUser } = await import('@/lib/database')
    const user = await findUser(session.user.email)

    if (user) {
      const integrations = user.integrazioni || []
      const existingIndex = integrations.findIndex(
        (i: any) => i.platform === 'spedisci_online' || i.platform === 'spedisci-online'
      )

      const integration = {
        platform: 'spedisci-online',
        credentials,
        connectedAt: new Date().toISOString(),
        status: 'active' as const,
      }

      if (existingIndex >= 0) {
        integrations[existingIndex] = integration
      } else {
        integrations.push(integration)
      }

      await updateUser(user.id, { integrazioni: integrations })

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

