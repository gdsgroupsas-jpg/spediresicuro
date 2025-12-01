'use server'

/**
 * Server Actions per Gestione Integrazioni
 * 
 * Server Actions sicure per salvare e testare le integrazioni e-commerce
 * con validazione Zod e test connessione immediato
 * 
 * Usa Supabase per persistenza dati con RLS (Row Level Security)
 */

import { z } from 'zod'
import { createEcommerceAdapter } from '@/lib/adapters/ecommerce/base'
import { createServerActionClient } from '@/lib/supabase-server'
import { auth } from '@/lib/auth-config'
import { findUserByEmail } from '@/lib/database'

/**
 * Helper per mappare email NextAuth a UUID Supabase
 * 
 * Cerca prima in user_profiles, poi in auth.users
 * Se non trova, crea un nuovo profilo (senza Supabase Auth user)
 */
async function getSupabaseUserIdFromEmail(
  supabase: any,
  email: string
): Promise<{ userId: string | null; source: 'profiles' | 'auth' | 'created' | null }> {
  try {
    // 1. Cerca in user_profiles (mapping table)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('supabase_user_id, email')
      .eq('email', email)
      .single()

    if (!profileError && profile?.supabase_user_id) {
      return { userId: profile.supabase_user_id, source: 'profiles' }
    }

    // 2. Cerca direttamente in auth.users per email
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    
    if (!authError && users) {
      const supabaseUser = users.find((u: any) => u.email === email)
      if (supabaseUser) {
        // Aggiorna user_profiles con il mapping trovato
        await supabase
          .from('user_profiles')
          .upsert(
            {
              email,
              supabase_user_id: supabaseUser.id,
            },
            { onConflict: 'email' }
          )
        
        return { userId: supabaseUser.id, source: 'auth' }
      }
    }

    // 3. Se non esiste in Supabase Auth, crea solo il profilo (senza auth user)
    // Questo permette di salvare integrazioni anche senza Supabase Auth
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          email,
          supabase_user_id: null, // Nessun utente Supabase Auth
        },
        { onConflict: 'email' }
      )
      .select()
      .single()

    if (!createError && newProfile) {
      // Usa l'ID del profilo come fallback (non ideale, ma funziona)
      // NOTA: Questo richiede di modificare user_integrations per accettare anche profile.id
      // Per ora restituiamo null e useremo il fallback JSON locale
      return { userId: null, source: 'created' }
    }

    return { userId: null, source: null }
  } catch (error) {
    console.error('Errore getSupabaseUserIdFromEmail:', error)
    return { userId: null, source: null }
  }
}

// Schema Validazione WooCommerce
const WooCommerceSchema = z.object({
  store_url: z.string().url('URL non valido'),
  api_key: z.string().min(1, 'Consumer Key obbligatorio').startsWith('ck_', 'Consumer Key deve iniziare con ck_'),
  api_secret: z.string().min(1, 'Consumer Secret obbligatorio').startsWith('cs_', 'Consumer Secret deve iniziare con cs_'),
})

// Schema Validazione Shopify
const ShopifySchema = z.object({
  store_url: z.string().min(1, 'Shop URL obbligatorio').refine(
    (url: string) => url.includes('.myshopify.com') || /^[a-zA-Z0-9-]+$/.test(url),
    'Shop URL deve essere nel formato mystore.myshopify.com o solo il nome del shop'
  ),
  access_token: z.string().min(1, 'Access Token obbligatorio').startsWith('shpat_', 'Access Token deve iniziare con shpat_'),
})

// Schema Validazione Magento
const MagentoSchema = z.object({
  store_url: z.string().url('URL non valido'),
  access_token: z.string().min(1, 'Access Token obbligatorio'),
})

// Schema Validazione PrestaShop
const PrestaShopSchema = z.object({
  store_url: z.string().url('URL non valido'),
  api_key: z.string().min(1, 'API Key obbligatoria'),
  api_secret: z.string().min(1, 'API Secret obbligatorio'),
})

// Schema Validazione Amazon
const AmazonSchema = z.object({
  lwa_client_id: z.string().min(1, 'LWA Client ID obbligatorio'),
  lwa_client_secret: z.string().min(1, 'LWA Client Secret obbligatorio'),
  lwa_refresh_token: z.string().min(1, 'LWA Refresh Token obbligatorio'),
  aws_access_key: z.string().min(1, 'AWS Access Key obbligatorio'),
  aws_secret_key: z.string().min(1, 'AWS Secret Key obbligatorio'),
  seller_id: z.string().min(1, 'Seller ID obbligatorio'),
  region: z.string().default('eu-west-1'),
})

// Schema Validazione Custom API
const CustomSchema = z.object({
  store_url: z.string().url('URL non valido'),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
})

function getSchemaForProvider(provider: string) {
  switch (provider.toLowerCase()) {
    case 'woocommerce':
      return WooCommerceSchema
    case 'shopify':
      return ShopifySchema
    case 'magento':
      return MagentoSchema
    case 'prestashop':
      return PrestaShopSchema
    case 'amazon':
      return AmazonSchema
    case 'custom':
      return CustomSchema
    default:
      throw new Error(`Provider non supportato: ${provider}`)
  }
}

/**
 * Normalizza le credenziali per l'adapter
 */
function normalizeCredentials(provider: string, data: any) {
  switch (provider.toLowerCase()) {
    case 'shopify':
      // Normalizza shop URL (rimuove https:// e .myshopify.com se presente)
      const shopUrl: string = String(data.store_url || '').replace(/^https?:\/\//, '').replace(/\.myshopify\.com.*$/, '')
      return {
        store_url: shopUrl,
        access_token: data.access_token,
      }
    case 'woocommerce':
      return {
        store_url: data.store_url,
        api_key: data.api_key,
        api_secret: data.api_secret,
      }
    case 'magento':
      return {
        store_url: data.store_url,
        access_token: data.access_token,
      }
    case 'prestashop':
      return {
        store_url: data.store_url,
        api_key: data.api_key,
        api_secret: data.api_secret,
      }
    case 'amazon':
      return {
        lwa_client_id: data.lwa_client_id,
        lwa_client_secret: data.lwa_client_secret,
        lwa_refresh_token: data.lwa_refresh_token,
        aws_access_key: data.aws_access_key,
        aws_secret_key: data.aws_secret_key,
        seller_id: data.seller_id,
        region: data.region || 'eu-west-1',
      }
    case 'custom':
      return {
        store_url: data.store_url,
        api_key: data.api_key || '',
        api_secret: data.api_secret || '',
      }
    default:
      return data
  }
}

/**
 * Testa la connessione a una piattaforma
 */
export async function testIntegration(provider: string, credentials: any) {
  try {
    // 1. Valida i dati con Zod
    const schema = getSchemaForProvider(provider)
    const validatedData = schema.parse(credentials)

    // 2. Normalizza le credenziali per l'adapter
    const normalizedCredentials = normalizeCredentials(provider, validatedData)

    // 3. Crea adapter e testa connessione
    const adapter = createEcommerceAdapter(provider, normalizedCredentials)
    const isConnected = await adapter.connect()

    if (isConnected) {
      return {
        success: true,
        message: 'Connessione riuscita!',
      }
    } else {
      return {
        success: false,
        error: 'Impossibile connettersi allo shop. Controlla i dati.',
      }
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e: z.ZodIssue) => `${String(e.path.join('.'))}: ${e.message}`).join(', '),
      }
    }
    return {
      success: false,
      error: error.message || 'Errore durante il test di connessione',
    }
  }
}

/**
 * Salva un'integrazione nel database Supabase
 * 
 * Usa upsert per creare o aggiornare l'integrazione
 * con validazione Zod e test connessione automatico
 */
export async function saveIntegration(provider: string, credentials: any) {
  try {
    // 1. Verifica autenticazione tramite NextAuth
    const session = await auth()
    
    if (!session?.user?.email) {
      throw new Error('Non autenticato')
    }

    // 2. Valida i dati con Zod PRIMA di procedere
    const schema = getSchemaForProvider(provider)
    const validatedData = schema.parse(credentials)

    // 3. Testa connessione PRIMA di salvare
    const testResult = await testIntegration(provider, validatedData)
    if (!testResult.success) {
      return {
        success: false,
        error: testResult.error || 'Impossibile connettersi allo shop. Controlla i dati.',
      }
    }

    // 4. Normalizza le credenziali per il salvataggio
    const normalizedCredentials = normalizeCredentials(provider, validatedData)

    // 5. Crea client Supabase per Server Actions
    const supabase = createServerActionClient()

    // 6. Verifica se Supabase è configurato
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const useSupabase = !!supabaseUrl

    let userId: string | null = null
    let useLocalFallback = false

    if (useSupabase) {
      // Prova a mappare email NextAuth -> UUID Supabase
      const mappingResult = await getSupabaseUserIdFromEmail(supabase, session.user.email)
      
      if (mappingResult.userId) {
        // Utente trovato in Supabase (via profiles o auth)
        userId = mappingResult.userId
      } else {
        // Utente non esiste in Supabase Auth
        // Usa fallback al database locale
        useLocalFallback = true
      }
    } else {
      // Supabase non configurato, usa database locale
      useLocalFallback = true
    }

    // 7. Fallback al database JSON locale se necessario
    if (useLocalFallback) {
      const localUser = await findUserByEmail(session.user.email)
      if (!localUser) {
        throw new Error('Utente non trovato')
      }

      const { updateUser } = await import('@/lib/database')
      const integrations = localUser.integrazioni || []
      const existingIndex = integrations.findIndex((i: any) => i.platform === provider.toLowerCase())

      const integration = {
        platform: provider.toLowerCase(),
        credentials: normalizedCredentials,
        connectedAt: new Date().toISOString(),
        status: 'active' as const,
      }

      if (existingIndex >= 0) {
        integrations[existingIndex] = integration
      } else {
        integrations.push(integration)
      }

      updateUser(localUser.id, {
        integrazioni: integrations,
      })

      return {
        success: true,
        message: 'Integrazione salvata con successo (database locale)',
        integration,
      }
    }

    // 7. Salva in Supabase con upsert
    const { data, error } = await supabase
      .from('user_integrations')
      .upsert(
        {
          user_id: userId,
          provider: provider.toLowerCase(),
          credentials: normalizedCredentials,
          is_active: true,
          error_log: null,
          last_sync: null,
        },
        {
          onConflict: 'user_id,provider',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Errore Supabase upsert:', error)
      throw new Error(error.message || 'Errore durante il salvataggio in Supabase')
    }

    return {
      success: true,
      message: 'Integrazione salvata con successo',
      integration: data,
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map((e: z.ZodIssue) => `${String(e.path.join('.'))}: ${e.message}`).join(', '),
      }
    }
    console.error('Errore saveIntegration:', error)
    return {
      success: false,
      error: error.message || 'Errore durante il salvataggio',
    }
  }
}

/**
 * Recupera tutte le integrazioni dell'utente
 * 
 * Alias per getIntegrations() per compatibilità
 */
export async function getUserIntegrations() {
  return getIntegrations()
}

/**
 * Recupera tutte le integrazioni dell'utente
 * 
 * Usa Supabase con RLS per garantire che l'utente veda solo le sue integrazioni
 */
export async function getIntegrations() {
  try {
    // 1. Verifica autenticazione tramite NextAuth
    const session = await auth()
    
    if (!session?.user?.email) {
      throw new Error('Non autenticato')
    }

    // 2. Crea client Supabase per Server Actions
    const supabase = createServerActionClient()

    // 3. Recupera user ID da Supabase Auth
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser()
    
    let userId: string | null = null

    if (supabaseUser) {
      userId = supabaseUser.id
    } else {
      // Fallback: usa database locale se Supabase non è configurato
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        const user = await findUserByEmail(session.user.email)
        if (!user) {
          return {
            success: true,
            integrations: [],
          }
        }
        return {
          success: true,
          integrations: user.integrazioni || [],
        }
      }
      
      // Se Supabase è configurato ma l'utente non esiste in Auth, restituisci vuoto
      return {
        success: true,
        integrations: [],
      }
    }

    // 4. Recupera integrazioni da Supabase (RLS garantisce sicurezza)
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore Supabase select:', error)
      // Fallback al database locale in caso di errore
      const user = await findUserByEmail(session.user.email)
      return {
        success: true,
        integrations: user?.integrazioni || [],
      }
    }

    // 5. Mappa i dati Supabase al formato atteso dalla UI
    const integrations = (data || []).map((integration: any) => ({
      platform: integration.provider,
      credentials: integration.credentials,
      connectedAt: integration.created_at,
      status: integration.is_active ? 'active' : 'inactive',
    }))

    return {
      success: true,
      integrations,
    }
  } catch (error: any) {
    console.error('Errore getIntegrations:', error)
    // Fallback al database locale in caso di errore
    try {
      const session = await auth()
      if (session?.user?.email) {
        const user = await findUserByEmail(session.user.email)
        return {
          success: true,
          integrations: user?.integrazioni || [],
        }
      }
    } catch (fallbackError) {
      // Ignora errori nel fallback
    }
    
    return {
      success: false,
      error: error.message || 'Errore durante il recupero',
      integrations: [],
    }
  }
}

