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
  console.log('🚀 [ORCHESTRATOR] createShipmentWithOrchestrator chiamato', {
    courierCode,
    hasShipmentData: !!shipmentData,
  });

  try {
    // 1. Verifica autenticazione
    const session = await auth()

    if (!session?.user?.email) {
      console.warn('⚠️ [ORCHESTRATOR] Non autenticato');
      return {
        success: false,
        tracking_number: '',
        carrier: courierCode,
        method: 'fallback',
        error: 'Non autenticato',
      }
    }

    console.log('✅ [ORCHESTRATOR] Utente autenticato:', session.user.email);

    // 2. Ottieni user_id (prova prima in users, poi user_profiles, poi auth.users)
    let userId: string | null = null

    // Prova prima nella tabella users
    const { data: userFromUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (userFromUsers?.id) {
      userId = userFromUsers.id
    } else {
      // Prova a recuperare da user_profiles o auth.users
      try {
        const { getSupabaseUserIdFromEmail } = await import('@/lib/database')
        userId = await getSupabaseUserIdFromEmail(session.user.email)
      } catch (error) {
        console.warn('⚠️ Impossibile recuperare user_id:', error)
      }
    }

    // 3. Ottieni orchestrator
    const orchestrator = getFulfillmentOrchestrator()

    // 4. SEMPRE registra broker adapter (Spedisci.Online) se configurato nel database
    // Questo permette di usare Spedisci.Online come broker per qualsiasi corriere (GLS, SDA, ecc.)
    // Se userId è null, prova comunque a recuperare configurazione default
    if (userId) {
      try {
        const provider = await getShippingProvider(userId, 'spedisci_online', shipmentData)
        if (provider && provider instanceof SpedisciOnlineAdapter) {
          orchestrator.registerBrokerAdapter(provider)
          console.log('✅ Broker adapter (Spedisci.Online) registrato tramite configurazione DB')
        } else {
          console.warn('⚠️ Spedisci.Online non configurato per questo utente. Provo configurazione default...')
          // Continua - proveremo a recuperare config default
        }
      } catch (error) {
        console.warn('⚠️ Errore recupero configurazione per utente:', error)
        // Continua - proveremo config default
      }
    }

    // Se non abbiamo ancora registrato il broker, prova a recuperare configurazione default (admin)
    // Verifica se il broker è registrato controllando internamente
    let brokerRegistered = false
    try {
      // Verifica se il broker è già registrato (usando reflection)
      const brokerAdapter = (orchestrator as any).brokerAdapter
      brokerRegistered = !!brokerAdapter
    } catch {
      brokerRegistered = false
    }

    if (!brokerRegistered) {
      try {
        // Prova a recuperare configurazione default (is_default = true) o qualsiasi configurazione attiva
        let { data: defaultConfig } = await supabaseAdmin
          .from('courier_configs')
          .select('*')
          .eq('provider_id', 'spedisci_online')
          .eq('is_active', true)
          .eq('is_default', true)
          .single()

        // Se non c'è default, prova qualsiasi configurazione attiva
        if (!defaultConfig) {
          const { data: activeConfigs } = await supabaseAdmin
            .from('courier_configs')
            .select('*')
            .eq('provider_id', 'spedisci_online')
            .eq('is_active', true)
            .limit(1)

          if (activeConfigs && activeConfigs.length > 0) {
            defaultConfig = activeConfigs[0]
          }
        }

        if (defaultConfig) {
          // Decripta credenziali se necessario
          const { decryptCredential, isEncrypted } = await import('@/lib/security/encryption')

          let api_key = defaultConfig.api_key
          let api_secret = defaultConfig.api_secret

          // Decripta se necessario
          if (api_key && isEncrypted(api_key)) {
            try {
              api_key = decryptCredential(api_key)
            } catch (decryptError) {
              console.error('❌ Errore decriptazione api_key:', decryptError)
              throw new Error('Impossibile decriptare credenziali')
            }
          }

          if (api_secret && isEncrypted(api_secret)) {
            try {
              api_secret = decryptCredential(api_secret)
            } catch (decryptError) {
              console.error('❌ Errore decriptazione api_secret:', decryptError)
              // api_secret è opzionale, continua senza
            }
          }

          // Prepara contract_mapping
          let contractMapping: Record<string, string> = {}
          if (defaultConfig.contract_mapping) {
            if (typeof defaultConfig.contract_mapping === 'string') {
              try {
                contractMapping = JSON.parse(defaultConfig.contract_mapping)
              } catch {
                console.warn('⚠️ Errore parsing contract_mapping, uso come oggetto')
              }
            } else if (typeof defaultConfig.contract_mapping === 'object') {
              contractMapping = defaultConfig.contract_mapping
            }
          }

          // Istanzia provider dalla configurazione
          const credentials = {
            api_key: api_key,
            api_secret: api_secret,
            base_url: defaultConfig.base_url,
            customer_code: contractMapping['default'] || undefined,
            contract_mapping: contractMapping, // Passa il mapping completo
          }

          console.log('🔧 [SPEDISCI.ONLINE] Istanzio adapter con credenziali:', {
            has_api_key: !!credentials.api_key,
            base_url: credentials.base_url,
            contract_mapping_count: Object.keys(credentials.contract_mapping || {}).length,
          });

          const provider = new SpedisciOnlineAdapter(credentials)
          orchestrator.registerBrokerAdapter(provider)
          console.log('✅ [SPEDISCI.ONLINE] Broker adapter registrato tramite configurazione DEFAULT')
          console.log('✅ [SPEDISCI.ONLINE] Contratti configurati:', Object.keys(credentials.contract_mapping || {}))
        } else {
          console.warn('⚠️ Spedisci.Online non configurato (né per utente né default).')
          console.warn('⚠️ Configura Spedisci.Online in /dashboard/integrazioni per abilitare chiamate API reali.')
        }
      } catch (error: any) {
        console.warn('⚠️ Impossibile registrare broker adapter (Spedisci.Online):', error?.message || error)
        console.warn('⚠️ La spedizione verrà creata solo localmente (fallback CSV).')
        // Non bloccare il processo - continuerà con fallback CSV
      }
    }

    // 4.5 Tentativo registrazione Adapter Diretto per il corriere richiesto
    // Mappa codici UI -> Provider ID
    const providerMap: Record<string, string> = {
      'sda': 'poste',
      'poste': 'poste',
      'poste italiane': 'poste',
      'brt': 'brt',
      'bartolini': 'brt',
      'gls': 'gls'
    };

    const normalizedCourier = courierCode.toLowerCase();
    const providerId = providerMap[normalizedCourier] || normalizedCourier;

    console.log(`🔍 [ORCHESTRATOR] Cerco adapter diretto per ${courierCode} (Provider: ${providerId})...`);

    if (userId) {
      try {
        const directProvider = await getShippingProvider(userId, providerId, shipmentData);
        if (directProvider) {
          orchestrator.registerDirectAdapter(normalizedCourier, directProvider);
          // Registra anche con il codice originale per sicurezza
          if (normalizedCourier !== courierCode) {
            orchestrator.registerDirectAdapter(courierCode, directProvider);
          }
          console.log(`✅ [ORCHESTRATOR] Adapter diretto (${providerId}) registrato con successo`);
        } else {
          console.log(`ℹ️ [ORCHESTRATOR] Nessun adapter diretto trovato per ${providerId}`);
        }
      } catch (error) {
        console.warn(`⚠️ [ORCHESTRATOR] Errore caricamento adapter diretto:`, error);
      }
    }

    // 5. Crea spedizione tramite orchestrator (routing intelligente)
    // L'orchestrator userà:
    // 1. Adapter diretto (se disponibile per il corriere)
    // 2. Broker Spedisci.Online (se registrato sopra)
    // 3. Fallback CSV (se tutto fallisce)
    console.log('🎯 [ORCHESTRATOR] Chiamo orchestrator.createShipment con corriere:', courierCode);
    const result = await orchestrator.createShipment(shipmentData, courierCode)
    console.log('🎯 [ORCHESTRATOR] Risultato orchestrator:', {
      success: result.success,
      method: result.method,
      has_tracking: !!result.tracking_number,
      error: result.error,
    });

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

