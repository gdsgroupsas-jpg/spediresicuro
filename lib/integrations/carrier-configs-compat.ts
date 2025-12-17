/**
 * Integration Hub: Carrier Configs Compatibility Layer
 * 
 * Mantiene compatibilità con codice esistente durante migrazione a Integration Hub.
 * 
 * ⚠️ IMPORTANTE: Questo è un compatibility layer - il codice esistente continua
 * a funzionare mentre il nuovo codice può usare le funzionalità estese.
 */

import { supabaseAdmin } from '@/lib/db/client';
import { decryptCredential, isEncrypted } from '@/lib/security/encryption';

// Type alias per backward compatibility
export type CourierConfig = CarrierConfig;

/**
 * Carrier Configuration (Extended)
 * 
 * Estende courier_configs con:
 * - Status/health check
 * - BYOC/Reseller support
 * - Test results
 */
export interface CarrierConfig {
  // Campi esistenti (invariati)
  id: string;
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Nuovi campi (opzionali per backward compatibility)
  status?: 'active' | 'error' | 'testing' | 'inactive';
  last_tested_at?: string;
  test_result?: {
    success: boolean;
    error?: string;
    tested_at: string;
    response_time_ms?: number;
  };
  account_type?: 'admin' | 'byoc' | 'reseller';
  owner_user_id?: string;
  
  // Automation (già esistenti da migration 015)
  automation_enabled?: boolean;
  automation_settings?: any;
  session_data?: any;
  last_automation_sync?: string;
  automation_encrypted?: boolean;
}

/**
 * Filtri per lista configurazioni
 */
export interface CarrierConfigFilters {
  provider_id?: string;
  account_type?: 'admin' | 'byoc' | 'reseller';
  status?: 'active' | 'error' | 'testing' | 'inactive';
  owner_user_id?: string;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * Lista configurazioni con filtri Integration Hub
 * 
 * Backward compatible: se non passi filtri, ritorna tutte (come prima)
 */
export async function listCarrierConfigs(
  filters?: CarrierConfigFilters
): Promise<CarrierConfig[]> {
  try {
    let query = supabaseAdmin
      .from('courier_configs')
      .select('*');
    
    // Applica filtri se forniti
    if (filters?.provider_id) {
      query = query.eq('provider_id', filters.provider_id);
    }
    if (filters?.account_type) {
      query = query.eq('account_type', filters.account_type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.owner_user_id) {
      query = query.eq('owner_user_id', filters.owner_user_id);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters?.is_default !== undefined) {
      query = query.eq('is_default', filters.is_default);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ [INTEGRATION_HUB] Errore listCarrierConfigs:', error);
      throw error;
    }
    
    // Decripta credenziali se necessario (per backward compatibility)
    const decrypted = (data || []).map((config: any) => {
      const result: any = { ...config };
      
      // Decripta api_key se criptata
      if (config.api_key && isEncrypted(config.api_key)) {
        try {
          result.api_key = decryptCredential(config.api_key);
        } catch (error) {
          console.error('❌ [INTEGRATION_HUB] Errore decriptazione api_key:', error);
          // Mantieni criptato in caso di errore
        }
      }
      
      // Decripta api_secret se criptata
      if (config.api_secret && isEncrypted(config.api_secret)) {
        try {
          result.api_secret = decryptCredential(config.api_secret);
        } catch (error) {
          console.error('❌ [INTEGRATION_HUB] Errore decriptazione api_secret:', error);
        }
      }
      
      // Default values per backward compatibility
      if (!result.status) {
        result.status = result.is_active ? 'active' : 'inactive';
      }
      if (!result.account_type) {
        result.account_type = result.created_by && result.created_by !== 'system' ? 'byoc' : 'admin';
      }
      
      return result;
    }) as CarrierConfig[];
    
    return decrypted;
  } catch (error: any) {
    console.error('❌ [INTEGRATION_HUB] Errore listCarrierConfigs:', error);
    throw error;
  }
}

/**
 * Ottieni configurazione per utente (con supporto BYOC/Reseller)
 * 
 * Logica:
 * 1. Se utente ha assigned_config_id, usa quella
 * 2. Se utente ha config BYOC (owner_user_id = user.id), usa quella
 * 3. Altrimenti, usa config default per provider
 */
export async function getCarrierConfigForUser(
  userId: string,
  providerId: string
): Promise<CarrierConfig | null> {
  try {
    // 1. Verifica assigned_config_id
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('assigned_config_id')
      .eq('id', userId)
      .single();
    
    if (user?.assigned_config_id) {
      const { data: assignedConfig } = await supabaseAdmin
        .from('courier_configs')
        .select('*')
        .eq('id', user.assigned_config_id)
        .eq('provider_id', providerId)
        .eq('is_active', true)
        .single();
      
      if (assignedConfig) {
        return assignedConfig as CarrierConfig;
      }
    }
    
    // 2. Verifica config BYOC (owner_user_id = userId)
    const { data: byocConfig } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('owner_user_id', userId)
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (byocConfig) {
      return byocConfig as CarrierConfig;
    }
    
    // 3. Fallback: config default
    const { data: defaultConfig } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('provider_id', providerId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();
    
    return defaultConfig as CarrierConfig | null;
  } catch (error: any) {
    console.error('❌ [INTEGRATION_HUB] Errore getCarrierConfigForUser:', error);
    return null;
  }
}

/**
 * Testa credenziali di una configurazione
 * 
 * @param configId - ID configurazione
 * @returns Risultato test
 */
export async function testCarrierCredentials(
  configId: string
): Promise<{
  success: boolean;
  error?: string;
  response_time_ms?: number;
}> {
  try {
    // 1. Recupera configurazione
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', configId)
      .single();
    
    if (fetchError || !config) {
      return { success: false, error: 'Configurazione non trovata' };
    }
    
    // 2. Aggiorna status a 'testing'
    await supabaseAdmin
      .from('courier_configs')
      .update({ status: 'testing' })
      .eq('id', configId);
    
    // 3. Testa credenziali (provider-specific)
    const startTime = Date.now();
    let testResult: { success: boolean; error?: string };
    
    try {
      switch (config.provider_id) {
        case 'spedisci_online':
          testResult = await testSpedisciOnlineCredentials(config);
          break;
        case 'poste':
          testResult = await testPosteCredentials(config);
          break;
        case 'gls':
        case 'brt':
          // Test generico per altri provider
          testResult = await testGenericCredentials(config);
          break;
        default:
          testResult = { success: false, error: 'Provider non supportato per test automatico' };
      }
    } catch (error: any) {
      testResult = { success: false, error: error.message || 'Errore durante test' };
    }
    
    const responseTime = Date.now() - startTime;
    
    // 4. Aggiorna configurazione con risultato
    const updateData: any = {
      status: testResult.success ? 'active' : 'error',
      last_tested_at: new Date().toISOString(),
      test_result: {
        success: testResult.success,
        error: testResult.error,
        tested_at: new Date().toISOString(),
        response_time_ms: responseTime,
      },
      updated_at: new Date().toISOString(),
    };
    
    await supabaseAdmin
      .from('courier_configs')
      .update(updateData)
      .eq('id', configId);
    
    return {
      success: testResult.success,
      error: testResult.error,
      response_time_ms: responseTime,
    };
  } catch (error: any) {
    console.error('❌ [INTEGRATION_HUB] Errore testCarrierCredentials:', error);
    return {
      success: false,
      error: error.message || 'Errore durante test',
    };
  }
}

/**
 * Testa credenziali Spedisci.Online
 */
async function testSpedisciOnlineCredentials(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { decryptCredential, isEncrypted } = await import('@/lib/security/encryption');
    
    let apiKey = config.api_key;
    if (isEncrypted(apiKey)) {
      apiKey = decryptCredential(apiKey);
    }
    
    const baseUrl = config.base_url || 'https://api.spedisci.online/api/v2';
    const testUrl = `${baseUrl}/v1/auth/test`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      return { success: true };
    } else if (response.status === 401) {
      return { success: false, error: 'API key non valida o scaduta' };
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Errore di connessione' };
  }
}

/**
 * Testa credenziali Poste Italiane
 */
async function testPosteCredentials(config: any): Promise<{ success: boolean; error?: string }> {
  // TODO: Implementare test Poste se necessario
  return { success: false, error: 'Test Poste non ancora implementato' };
}

/**
 * Test generico per altri provider
 */
async function testGenericCredentials(config: any): Promise<{ success: boolean; error?: string }> {
  // Test base: verifica che api_key e base_url siano presenti
  if (!config.api_key || !config.base_url) {
    return { success: false, error: 'API key o Base URL mancanti' };
  }
  
  // Per ora, considera valido se i campi sono presenti
  // I provider specifici possono implementare test più dettagliati
  return { success: true };
}
