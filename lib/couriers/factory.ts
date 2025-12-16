/**
 * Courier Factory - Database-Backed Provider Instantiation
 * 
 * Factory per istanziare provider corrieri usando configurazioni dinamiche dal database.
 * ⚠️ SOLO DATABASE: Nessun fallback a variabili d'ambiente.
 * 
 * Logica:
 * 1. Recupera configurazione per utente (assigned_config_id o default)
 * 2. Istanzia provider con credenziali dalla configurazione
 * 3. Se non trovata, ritorna null (nessun fallback)
 */

import { supabaseAdmin } from '@/lib/db/client';
import { SpedisciOnlineAdapter, type SpedisciOnlineCredentials } from '@/lib/adapters/couriers/spedisci-online';
import { PosteAdapter } from '@/lib/adapters/couriers/poste';
import { CourierAdapter } from '@/lib/adapters/couriers/base';
import type { Shipment, CreateShipmentInput } from '@/types/shipments';
import { decryptCredential, isEncrypted } from '@/lib/security/encryption';

// Tipo per configurazione corriere dal DB
export interface CourierConfig {
  id: string;
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>;
  is_active: boolean;
}

/**
 * Decifra credenziali sensibili da configurazione DB
 *
 * ⚠️ SICUREZZA:
 * - Decripta solo in memoria server-side
 * - Log solo fingerprint (primi 8 char), mai token completi
 * - Gestisce retrocompatibilità (plain text se non cifrato)
 *
 * @param config - Configurazione dal DB (credenziali cifrate)
 * @returns Configurazione con credenziali decifrate
 */
function decryptConfigCredentials(config: CourierConfig): CourierConfig {
  const decrypted = { ...config };

  try {
    // Decripta api_key se cifrata
    if (config.api_key && isEncrypted(config.api_key)) {
      decrypted.api_key = decryptCredential(config.api_key);
      const fingerprint = decrypted.api_key.substring(0, 8) + '***';
      console.log(`🔓 [Factory] api_key decifrata per ${config.provider_id} (fingerprint: ${fingerprint})`);
    } else {
      console.warn(`⚠️ [Factory] api_key NON cifrata per ${config.provider_id} (retrocompatibilità)`);
    }

    // Decripta api_secret se presente e cifrata
    if (config.api_secret && isEncrypted(config.api_secret)) {
      decrypted.api_secret = decryptCredential(config.api_secret);
      console.log(`🔓 [Factory] api_secret decifrata per ${config.provider_id}`);
    }
  } catch (error: any) {
    console.error('❌ [Factory] Errore decifrazione credenziali:', error.message);
    throw new Error(`Impossibile decifrare credenziali per ${config.provider_id}: ${error.message}`);
  }

  return decrypted;
}

/**
 * Recupera configurazione corriere per utente
 * 
 * ⚠️ SOLO DATABASE: Nessun fallback a variabili d'ambiente.
 * 
 * Priorità:
 * 1. Configurazione assegnata specificamente all'utente (assigned_config_id)
 * 2. Configurazione default per il provider (is_default = true)
 * 
 * @param userId - ID utente
 * @param providerId - ID provider (es: 'spedisci_online')
 * @returns Configurazione o null se non trovata
 */
export async function getCourierConfigForUser(
  userId: string,
  providerId: string
): Promise<CourierConfig | null> {
  try {
    // Usa funzione SQL helper se disponibile
    const { data: configs, error } = await supabaseAdmin.rpc('get_courier_config_for_user', {
      p_user_id: userId,
      p_provider_id: providerId,
    });

    if (error) {
      console.warn('Errore recupero config tramite RPC, provo query diretta:', error);

      // Fallback: query diretta
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('assigned_config_id')
        .eq('id', userId)
        .single();

      let query = supabaseAdmin
        .from('courier_configs')
        .select('*')
        .eq('provider_id', providerId)
        .eq('is_active', true);

      if (user?.assigned_config_id) {
        // Cerca config assegnata
        query = query.eq('id', user.assigned_config_id);
      } else {
        // Cerca config default
        query = query.eq('is_default', true);
      }

      const { data: configData, error: configError } = await query.single();

      if (configError || !configData) {
        console.error('❌ Nessuna configurazione trovata nel DB');
        return null;
      }

      return configData as CourierConfig;
    }

    if (configs && configs.length > 0) {
      return configs[0] as CourierConfig;
    }

    return null;
  } catch (error: any) {
    console.error('Errore getCourierConfigForUser:', error);
    return null;
  }
}

/**
 * Factory: Ottieni provider corriere per utente
 * 
 * ⚠️ SOLO DATABASE: Nessun fallback a variabili d'ambiente.
 * Se non c'è configurazione nel DB, ritorna null.
 * 
 * @param userId - ID utente
 * @param providerId - ID provider (es: 'spedisci_online', 'gls', 'brt')
 * @param shipmentData - Dati spedizione (opzionale, per validazione)
 * @returns Provider istanziato o null se non disponibile
 */
export async function getShippingProvider(
  userId: string,
  providerId: string,
  shipmentData?: Shipment | CreateShipmentInput
): Promise<CourierAdapter | null> {
  try {
    // Recupera configurazione dal DB (SOLO DB, nessun fallback)
    const config = await getCourierConfigForUser(userId, providerId);

    if (!config) {
      console.error(`❌ Configurazione DB non trovata per provider ${providerId} e utente ${userId}`);
      console.error(`⚠️ Configura una configurazione nel database tramite /dashboard/admin/configurations`);
      return null;
    }

    // Istanzia provider dalla configurazione DB
    return instantiateProviderFromConfig(providerId, config);
  } catch (error: any) {
    console.error('❌ Errore getShippingProvider:', error);
    return null;
  }
}

/**
 * Istanzia provider da configurazione DB
 *
 * ⚠️ SICUREZZA: Decifra credenziali prima di istanziare adapter
 */
function instantiateProviderFromConfig(
  providerId: string,
  config: CourierConfig
): CourierAdapter | null {
  try {
    // 🔓 DECRYPT CENTRALE: Decifra credenziali prima di usarle
    const decryptedConfig = decryptConfigCredentials(config);

    switch (providerId.toLowerCase()) {
      case 'spedisci_online':
      case 'spedisci-online': {
        // Prepara contract_mapping (può essere già un oggetto o una stringa JSON)
        let contractMapping: Record<string, string> = {};
        if (decryptedConfig.contract_mapping) {
          if (typeof decryptedConfig.contract_mapping === 'string') {
            try {
              contractMapping = JSON.parse(decryptedConfig.contract_mapping);
            } catch {
              console.warn('Errore parsing contract_mapping come JSON, provo formato semplice');
            }
          } else if (typeof decryptedConfig.contract_mapping === 'object') {
            contractMapping = decryptedConfig.contract_mapping;
          }
        }

        const credentials: SpedisciOnlineCredentials = {
          api_key: decryptedConfig.api_key,
          api_secret: decryptedConfig.api_secret,
          base_url: decryptedConfig.base_url,
          customer_code: contractMapping['default'] || undefined,
          contract_mapping: contractMapping, // Passa il mapping completo
        };

        return new SpedisciOnlineAdapter(credentials);
      }

      // Altri provider possono essere aggiunti qui
      case 'gls':
      case 'brt':
        // TODO: Implementare adapter per altri provider
        console.warn(`Provider ${providerId} non ancora supportato con config DB`);
        return null;
      case 'poste':
        // Instantiate Poste adapter using DB config
        // ⚠️ IMPORTANTE: Mapping DB fields to Adapter fields
        // Il database salva come api_key/api_secret (schema standard per tutti i corrieri)
        // L'adapter Poste si aspetta client_id/client_secret
        // Mapping:
        //   api_key (DB, decifrato) -> client_id (Adapter)
        //   api_secret (DB, decifrato) -> client_secret (Adapter)
        //   contract_mapping['cdc'] -> cost_center_code (Adapter)
        const { api_key, api_secret, base_url, contract_mapping } = decryptedConfig;

        let cdc = 'CDC-DEFAULT';
        if (contract_mapping) {
          // Check if contract_mapping is object or string JSON
          const mapping = typeof contract_mapping === 'string'
            ? JSON.parse(contract_mapping)
            : contract_mapping;

          if (mapping['cdc']) cdc = mapping['cdc'];
        }

        const posteCreds = {
          client_id: api_key,
          client_secret: api_secret,
          base_url,
          cost_center_code: cdc
        } as any;
        return new PosteAdapter(posteCreds);

      default:
        console.warn(`Provider sconosciuto: ${providerId}`);
        return null;
    }
  } catch (error: any) {
    console.error('Errore istanziazione provider da config:', error);
    return null;
  }
}

// ⚠️ RIMOSSO: Fallback a variabili d'ambiente
// Il sistema funziona SOLO con configurazioni dal database

/**
 * Verifica se un provider è disponibile per un utente
 * 
 * @param userId - ID utente
 * @param providerId - ID provider
 * @returns true se provider disponibile
 */
export async function isProviderAvailable(
  userId: string,
  providerId: string
): Promise<boolean> {
  try {
    const provider = await getShippingProvider(userId, providerId);
    return provider !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Ottieni lista provider disponibili per un utente
 * 
 * @param userId - ID utente
 * @returns Array di provider ID disponibili
 */
export async function getAvailableProviders(userId: string): Promise<string[]> {
  const providers = ['spedisci_online', 'gls', 'brt', 'poste'];
  const available: string[] = [];

  for (const providerId of providers) {
    const isAvailable = await isProviderAvailable(userId, providerId);
    if (isAvailable) {
      available.push(providerId);
    }
  }

  return available;
}

