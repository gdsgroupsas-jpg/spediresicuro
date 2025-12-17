'use server';

/**
 * Server Actions per Gestione Configurazioni Corrieri
 * 
 * CRUD completo per configurazioni API corrieri gestite dinamicamente.
 * Solo gli admin possono eseguire queste operazioni.
 */

import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';
import { findUserByEmail } from '@/lib/database';
import { encryptCredential, decryptCredential, isEncrypted } from '@/lib/security/encryption';
import { logAuditEvent } from '@/lib/security/audit-log';

// Tipi per le configurazioni
export interface CourierConfigInput {
  id?: string; // Se presente, è un update
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>; // Es: { "poste": "CODE123", "gls": "CODE456" }
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
  notes?: string;
  // Integration Hub: nuovi campi (opzionali per backward compatibility)
  status?: 'active' | 'error' | 'testing' | 'inactive';
  account_type?: 'admin' | 'byoc' | 'reseller';
  owner_user_id?: string;
}

export interface CourierConfig {
  id: string;
  name: string;
  provider_id: string;
  api_key: string; // ⚠️ In produzione, considerare mascherare o non esporre
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
  // Integration Hub: nuovi campi (opzionali per backward compatibility)
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
 * Verifica se l'utente corrente è admin
 */
async function verifyAdminAccess(): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { isAdmin: false, error: 'Non autenticato' };
    }

    const user = await findUserByEmail(session.user.email);
    
    if (!user || user.role !== 'admin') {
      return { isAdmin: false, error: 'Accesso negato. Solo gli admin possono gestire le configurazioni.' };
    }

    return { isAdmin: true };
  } catch (error: any) {
    console.error('Errore verifica admin:', error);
    return { isAdmin: false, error: error.message || 'Errore verifica permessi' };
  }
}

/**
 * Server Action: Salva configurazione (Create o Update)
 * 
 * @param data - Dati configurazione
 * @returns Risultato operazione
 */
export async function saveConfiguration(
  data: CourierConfigInput
): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    const session = await auth();
    const adminEmail = session?.user?.email || 'system';

    // 2. Validazione input
    if (!data.name || !data.provider_id || !data.api_key || !data.base_url) {
      return {
        success: false,
        error: 'Campi obbligatori mancanti: name, provider_id, api_key, base_url',
      };
    }

    // 3. Se è un update, verifica che la configurazione esista
    if (data.id) {
      const { data: existingConfig, error: fetchError } = await supabaseAdmin
        .from('courier_configs')
        .select('id')
        .eq('id', data.id)
        .single();

      if (fetchError || !existingConfig) {
        return {
          success: false,
          error: 'Configurazione non trovata',
        };
      }
    }

    // 4. Se is_default = true, rimuovi default da altre config dello stesso provider
    if (data.is_default) {
      await supabaseAdmin
        .from('courier_configs')
        .update({ is_default: false })
        .eq('provider_id', data.provider_id)
        .neq('id', data.id || '00000000-0000-0000-0000-000000000000'); // Evita conflitto se è nuovo
    }

    // 5. Prepara dati per insert/update
    // ⚠️ SICUREZZA: Cripta credenziali sensibili prima di salvare
    const configData: any = {
      name: data.name,
      provider_id: data.provider_id,
      api_key: isEncrypted(data.api_key) ? data.api_key : encryptCredential(data.api_key),
      base_url: data.base_url,
      contract_mapping: data.contract_mapping || {},
      is_active: data.is_active ?? true,
      is_default: data.is_default ?? false,
      description: data.description || null,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
      // Integration Hub: nuovi campi (opzionali)
      ...(data.status && { status: data.status }),
      ...(data.account_type && { account_type: data.account_type }),
      ...(data.owner_user_id && { owner_user_id: data.owner_user_id }),
    };

    // Aggiungi api_secret se fornito (criptato)
    if (data.api_secret) {
      configData.api_secret = isEncrypted(data.api_secret) 
        ? data.api_secret 
        : encryptCredential(data.api_secret);
    }

    // 6. Esegui insert o update
    let result;
    if (data.id) {
      // Update
      const { data: updatedConfig, error: updateError } = await supabaseAdmin
        .from('courier_configs')
        .update(configData)
        .eq('id', data.id)
        .select()
        .single();

      if (updateError) {
        console.error('Errore update configurazione:', updateError);
        return {
          success: false,
          error: updateError.message || 'Errore durante l\'aggiornamento',
        };
      }

      result = updatedConfig;
      
      // Audit log: credenziale aggiornata
      await logAuditEvent('credential_updated', 'courier_config', data.id, {
        provider_id: data.provider_id,
        name: data.name,
      });
    } else {
      // Insert
      configData.created_by = adminEmail;
      const { data: newConfig, error: insertError } = await supabaseAdmin
        .from('courier_configs')
        .insert(configData)
        .select()
        .single();

      if (insertError) {
        console.error('Errore inserimento configurazione:', insertError);
        return {
          success: false,
          error: insertError.message || 'Errore durante la creazione',
        };
      }

      result = newConfig;
      
      // Audit log: credenziale creata
      await logAuditEvent('credential_created', 'courier_config', result.id, {
        provider_id: data.provider_id,
        name: data.name,
      });
    }

    console.log(`✅ Configurazione ${data.id ? 'aggiornata' : 'creata'}:`, result.id);

    return {
      success: true,
      config: result as CourierConfig,
    };
  } catch (error: any) {
    console.error('Errore saveConfiguration:', error);
    return {
      success: false,
      error: error.message || 'Errore durante il salvataggio',
    };
  }
}

/**
 * Server Action: Salva configurazione personale (per utenti non-admin)
 * 
 * Permette agli utenti di salvare la propria configurazione personale per Spedisci.Online.
 * La configurazione viene automaticamente assegnata all'utente corrente.
 * 
 * @param data - Dati configurazione
 * @returns Risultato operazione
 */
export async function savePersonalConfiguration(
  data: Omit<CourierConfigInput, 'is_default'> & { is_default?: never }
): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // 2. Validazione input
    if (!data.name || !data.provider_id || !data.api_key || !data.base_url) {
      return {
        success: false,
        error: 'Campi obbligatori mancanti: name, provider_id, api_key, base_url',
      };
    }

    // 3. Trova o crea configurazione personale per questo utente
    // Recupera user_id e assigned_config_id direttamente da Supabase
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, assigned_config_id')
      .eq('email', session.user.email)
      .single();

    if (userError || !userData) {
      return { success: false, error: 'Utente non trovato' };
    }

    // Cerca configurazione esistente per questo utente e provider
    let existingConfigId: string | null = null;
    if (userData.assigned_config_id) {
      const { data: existingConfig } = await supabaseAdmin
        .from('courier_configs')
        .select('id, created_by')
        .eq('id', userData.assigned_config_id)
        .eq('provider_id', data.provider_id)
        .single();
      
      if (existingConfig && existingConfig.created_by === session.user.email) {
        existingConfigId = existingConfig.id;
      }
    }

    // 4. Prepara dati per insert/update
    // ⚠️ SICUREZZA: Cripta credenziali sensibili prima di salvare
    const configData: any = {
      name: data.name,
      provider_id: data.provider_id,
      api_key: isEncrypted(data.api_key) ? data.api_key : encryptCredential(data.api_key),
      base_url: data.base_url,
      contract_mapping: data.contract_mapping || {},
      is_active: data.is_active ?? true,
      is_default: false, // Mai default per configurazioni personali
      description: data.description || null,
      notes: data.notes || null,
      updated_at: new Date().toISOString(),
    };

    // Aggiungi api_secret se fornito (criptato)
    if (data.api_secret) {
      configData.api_secret = isEncrypted(data.api_secret) 
        ? data.api_secret 
        : encryptCredential(data.api_secret);
    }

    // 5. Esegui insert o update
    let result;
    if (existingConfigId) {
      // Update configurazione esistente
      const { data: updatedConfig, error: updateError } = await supabaseAdmin
        .from('courier_configs')
        .update(configData)
        .eq('id', existingConfigId)
        .select()
        .single();

      if (updateError) {
        console.error('Errore update configurazione personale:', updateError);
        return {
          success: false,
          error: updateError.message || 'Errore durante l\'aggiornamento',
        };
      }

      result = updatedConfig;
    } else {
      // Insert nuova configurazione personale
      configData.created_by = session.user.email;
      const { data: newConfig, error: insertError } = await supabaseAdmin
        .from('courier_configs')
        .insert(configData)
        .select()
        .single();

      if (insertError) {
        console.error('Errore inserimento configurazione personale:', insertError);
        return {
          success: false,
          error: insertError.message || 'Errore durante la creazione',
        };
      }

      result = newConfig;

      // Assegna automaticamente la configurazione all'utente
      await supabaseAdmin
        .from('users')
        .update({ assigned_config_id: result.id })
        .eq('id', userData.id);
    }

    console.log(`✅ Configurazione personale ${existingConfigId ? 'aggiornata' : 'creata'}:`, result.id);

    return {
      success: true,
      config: result as CourierConfig,
    };
  } catch (error: any) {
    console.error('Errore savePersonalConfiguration:', error);
    return {
      success: false,
      error: error.message || 'Errore durante il salvataggio',
    };
  }
}

/**
 * Server Action: Elimina configurazione personale (per utenti non-admin)
 * 
 * Permette agli utenti di eliminare la propria configurazione personale.
 * 
 * @param id - ID configurazione da eliminare
 * @returns Risultato operazione
 */
export async function deletePersonalConfiguration(
  id: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // Verifica che la configurazione esista e appartenga all'utente
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, provider_id, created_by, is_default')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    // Verifica che la configurazione appartenga all'utente corrente
    if (config.created_by !== session.user.email) {
      return {
        success: false,
        error: 'Non hai i permessi per eliminare questa configurazione',
      };
    }

    // Non permettere eliminazione se è default
    if (config.is_default) {
      return {
        success: false,
        error: 'Impossibile eliminare la configurazione default. Imposta prima un\'altra configurazione come default.',
      };
    }

    // Rimuovi assegnazione dall'utente se presente
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, assigned_config_id')
      .eq('email', session.user.email)
      .single();

    if (userData?.assigned_config_id === id) {
      await supabaseAdmin
        .from('users')
        .update({ assigned_config_id: null })
        .eq('id', userData.id);
    }

    // Elimina configurazione
    const { error: deleteError } = await supabaseAdmin
      .from('courier_configs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Errore eliminazione configurazione personale:', deleteError);
      return {
        success: false,
        error: deleteError.message || 'Errore durante l\'eliminazione',
      };
    }

    console.log(`✅ Configurazione personale eliminata:`, id);

    return {
      success: true,
      message: 'Configurazione eliminata con successo',
    };
  } catch (error: any) {
    console.error('Errore deletePersonalConfiguration:', error);
    return {
      success: false,
      error: error.message || 'Errore durante l\'eliminazione',
    };
  }
}

/**
 * Server Action: Elimina configurazione
 * 
 * ⚠️ Verifica se la configurazione è in uso prima di eliminare
 * 
 * @param id - ID configurazione da eliminare
 * @returns Risultato operazione
 */
export async function deleteConfiguration(
  id: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Verifica se la configurazione esiste
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, provider_id')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    // 3. Verifica se è in uso (assegnata ad utenti)
    const { data: usersUsingConfig, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('assigned_config_id', id)
      .limit(1);

    if (usersError) {
      console.error('Errore verifica utenti:', usersError);
    }

    if (usersUsingConfig && usersUsingConfig.length > 0) {
      return {
        success: false,
        error: `Impossibile eliminare: la configurazione è assegnata a ${usersUsingConfig.length} utente/i. 
                Rimuovi prima l'assegnazione agli utenti.`,
      };
    }

    // 4. Se è default, non permettere eliminazione (o richiedere conferma speciale)
    if (config.provider_id) {
      const { data: defaultCheck } = await supabaseAdmin
        .from('courier_configs')
        .select('is_default')
        .eq('id', id)
        .single();

      if (defaultCheck?.is_default) {
        return {
          success: false,
          error: 'Impossibile eliminare la configurazione default. Imposta prima un\'altra configurazione come default.',
        };
      }
    }

    // 5. Elimina configurazione
    const { error: deleteError } = await supabaseAdmin
      .from('courier_configs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Errore eliminazione configurazione:', deleteError);
      return {
        success: false,
        error: deleteError.message || 'Errore durante l\'eliminazione',
      };
    }

    console.log(`✅ Configurazione eliminata:`, id);

    // Audit log: credenziale eliminata
    await logAuditEvent('credential_deleted', 'courier_config', id, {
      provider_id: config.provider_id,
      name: config.name,
    });

    return {
      success: true,
      message: 'Configurazione eliminata con successo',
    };
  } catch (error: any) {
    console.error('Errore deleteConfiguration:', error);
    return {
      success: false,
      error: error.message || 'Errore durante l\'eliminazione',
    };
  }
}

/**
 * Server Action: Aggiorna status attivo/inattivo di una configurazione
 * 
 * @param id - ID configurazione
 * @param isActive - Nuovo stato (true = attiva, false = inattiva)
 * @returns Risultato operazione
 */
export async function updateConfigurationStatus(
  id: string,
  isActive: boolean
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Verifica se la configurazione esiste
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, provider_id')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    // 3. Aggiorna status
    const { error: updateError } = await supabaseAdmin
      .from('courier_configs')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Errore aggiornamento status configurazione:', updateError);
      return {
        success: false,
        error: updateError.message || 'Errore durante l\'aggiornamento',
      };
    }

    // Audit log
    await logAuditEvent(
      isActive ? 'credential_activated' : 'credential_deactivated',
      'courier_config',
      id,
      {
        provider_id: config.provider_id,
        name: config.name,
        is_active: isActive,
      }
    );

    return {
      success: true,
      message: `Configurazione ${isActive ? 'attivata' : 'disattivata'} con successo`,
    };
  } catch (error: any) {
    console.error('Errore updateConfigurationStatus:', error);
    return {
      success: false,
      error: error.message || 'Errore durante l\'aggiornamento',
    };
  }
}

/**
 * Server Action: Imposta configurazione personale come default
 * 
 * Permette agli utenti di impostare la propria configurazione come default.
 * 
 * @param id - ID configurazione
 * @returns Risultato operazione
 */
export async function setPersonalConfigurationAsDefault(
  id: string
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // Verifica che la configurazione esista e appartenga all'utente
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, provider_id, created_by')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    // Verifica che la configurazione appartenga all'utente corrente
    if (config.created_by !== session.user.email) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questa configurazione',
      };
    }

    // Rimuovi default da altre configurazioni dello stesso provider
    await supabaseAdmin
      .from('courier_configs')
      .update({ is_default: false })
      .eq('provider_id', config.provider_id)
      .neq('id', id);

    // Imposta questa configurazione come default
    const { error: updateError } = await supabaseAdmin
      .from('courier_configs')
      .update({
        is_default: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Errore impostazione default:', updateError);
      return {
        success: false,
        error: updateError.message || 'Errore durante l\'aggiornamento',
      };
    }

    console.log(`✅ Configurazione impostata come default:`, id);

    return {
      success: true,
      message: 'Configurazione impostata come default con successo',
    };
  } catch (error: any) {
    console.error('Errore setPersonalConfigurationAsDefault:', error);
    return {
      success: false,
      error: error.message || 'Errore durante l\'aggiornamento',
    };
  }
}

/**
 * Server Action: Assegna configurazione a utente
 * 
 * @param userId - ID utente
 * @param configId - ID configurazione (null per rimuovere assegnazione)
 * @returns Risultato operazione
 */
export async function assignConfigurationToUser(
  userId: string,
  configId: string | null
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Verifica che l'utente esista
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return {
        success: false,
        error: 'Utente non trovato',
      };
    }

    // 3. Se configId è fornito, verifica che la configurazione esista e sia attiva
    if (configId) {
      const { data: config, error: configError } = await supabaseAdmin
        .from('courier_configs')
        .select('id, is_active')
        .eq('id', configId)
        .single();

      if (configError || !config) {
        return {
          success: false,
          error: 'Configurazione non trovata',
        };
      }

      if (!config.is_active) {
        return {
          success: false,
          error: 'Impossibile assegnare una configurazione inattiva',
        };
      }
    }

    // 4. Aggiorna utente
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ assigned_config_id: configId })
      .eq('id', userId);

    if (updateError) {
      console.error('Errore assegnazione configurazione:', updateError);
      return {
        success: false,
        error: updateError.message || 'Errore durante l\'assegnazione',
      };
    }

    console.log(`✅ Configurazione ${configId ? 'assegnata' : 'rimossa'} per utente:`, userId);

    return {
      success: true,
      message: configId 
        ? 'Configurazione assegnata con successo' 
        : 'Assegnazione rimossa con successo',
    };
  } catch (error: any) {
    console.error('Errore assignConfigurationToUser:', error);
    return {
      success: false,
      error: error.message || 'Errore durante l\'assegnazione',
    };
  }
}

/**
 * Server Action: Lista tutte le configurazioni (solo admin)
 * 
 * @returns Lista configurazioni
 */
export async function listConfigurations(): Promise<{
  success: boolean;
  configs?: CourierConfig[];
  error?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Recupera tutte le configurazioni
    const { data: configs, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Errore recupero configurazioni:', fetchError);
      return {
        success: false,
        error: fetchError.message || 'Errore durante il recupero',
      };
    }

    // ⚠️ SICUREZZA: Decripta credenziali solo se necessario (per visualizzazione)
    // In produzione, considerare di non esporre mai le credenziali decriptate
    const decryptedConfigs = (configs || []).map((config: any) => {
      const decrypted: any = { ...config };
      
      // Decripta solo se richiesto (per ora decriptiamo sempre, ma potremmo aggiungere un flag)
      try {
        if (config.api_key && isEncrypted(config.api_key)) {
          decrypted.api_key = decryptCredential(config.api_key);
        }
        if (config.api_secret && isEncrypted(config.api_secret)) {
          decrypted.api_secret = decryptCredential(config.api_secret);
        }
      } catch (error) {
        console.error('Errore decriptazione credenziali:', error);
        // In caso di errore, mantieni criptato
      }
      
      return decrypted;
    }) as CourierConfig[];

    return {
      success: true,
      configs: decryptedConfigs,
    };
  } catch (error: any) {
    console.error('Errore listConfigurations:', error);
    return {
      success: false,
      error: error.message || 'Errore durante il recupero',
    };
  }
}

/**
 * Server Action: Ottieni configurazione specifica (solo admin)
 * 
 * @param id - ID configurazione
 * @returns Configurazione
 */
export async function getConfiguration(
  id: string
): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    // 1. Verifica permessi admin
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    // 2. Recupera configurazione
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    // ⚠️ SICUREZZA: Decripta credenziali
    const decrypted: any = { ...config };
    try {
      if (config.api_key && isEncrypted(config.api_key)) {
        decrypted.api_key = decryptCredential(config.api_key);
      }
      if (config.api_secret && isEncrypted(config.api_secret)) {
        decrypted.api_secret = decryptCredential(config.api_secret);
      }
    } catch (error) {
      console.error('Errore decriptazione credenziali:', error);
    }

    // Audit log: credenziale visualizzata
    await logAuditEvent('credential_viewed', 'courier_config', id);

    return {
      success: true,
      config: decrypted as CourierConfig,
    };
  } catch (error: any) {
    console.error('Errore getConfiguration:', error);
    return {
      success: false,
      error: error.message || 'Errore durante il recupero',
    };
  }
}

