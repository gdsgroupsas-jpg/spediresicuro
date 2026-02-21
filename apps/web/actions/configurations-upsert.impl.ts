import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { logAuditEvent } from '@/lib/security/audit-log';
import { encryptCredential, isEncrypted } from '@/lib/security/encryption';
import type { CourierConfig, CourierConfigInput } from './configurations.types';
import { verifyAdminAccess } from './configurations.helpers';

/**
 * Server Action: Salva configurazione (Create o Update)
 *
 * @param data - Dati configurazione
 * @returns Risultato operazione
 */
export async function saveConfigurationImpl(data: CourierConfigInput): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

    const context = await getWorkspaceAuth();
    const adminEmail = context?.actor?.email || 'system';

    if (!data.name || !data.provider_id || !data.api_key || !data.base_url) {
      return {
        success: false,
        error: 'Campi obbligatori mancanti: name, provider_id, api_key, base_url',
      };
    }

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

    if (data.is_default) {
      await supabaseAdmin
        .from('courier_configs')
        .update({ is_default: false })
        .eq('provider_id', data.provider_id)
        .neq('id', data.id || '00000000-0000-0000-0000-000000000000');
    }

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
      ...(data.status && { status: data.status }),
      ...(data.account_type && { account_type: data.account_type }),
      ...(data.owner_user_id && { owner_user_id: data.owner_user_id }),
    };

    if (data.api_secret) {
      configData.api_secret = isEncrypted(data.api_secret)
        ? data.api_secret
        : encryptCredential(data.api_secret);
    }

    let result;
    if (data.id) {
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
          error: updateError.message || "Errore durante l'aggiornamento",
        };
      }

      result = updatedConfig;

      await logAuditEvent('credential_updated', 'courier_config', data.id, {
        provider_id: data.provider_id,
        name: data.name,
      });
    } else {
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

      await logAuditEvent('credential_created', 'courier_config', result.id, {
        provider_id: data.provider_id,
        name: data.name,
      });
    }

    console.log(`Configurazione ${data.id ? 'aggiornata' : 'creata'}:`, result.id);

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
export async function savePersonalConfigurationImpl(
  data: Omit<CourierConfigInput, 'is_default'> & { is_default?: never }
): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    if (!data.name || !data.provider_id || !data.api_key || !data.base_url) {
      return {
        success: false,
        error: 'Campi obbligatori mancanti: name, provider_id, api_key, base_url',
      };
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, assigned_config_id, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (userError || !userData) {
      return { success: false, error: 'Utente non trovato' };
    }

    const isReseller = userData.is_reseller === true;
    const accountType = isReseller ? 'reseller' : 'byoc';

    console.log(
      `[savePersonalConfiguration] User: ${context.actor.email}, is_reseller: ${isReseller}, account_type: ${accountType}`
    );

    const configData: any = {
      name: data.name,
      provider_id: data.provider_id,
      api_key: isEncrypted(data.api_key) ? data.api_key : encryptCredential(data.api_key),
      base_url: data.base_url,
      contract_mapping: data.contract_mapping || {},
      is_active: data.is_active ?? true,
      is_default: false,
      description: data.description || null,
      notes: data.notes || null,
      account_type: accountType,
      owner_user_id: userData.id,
      updated_at: new Date().toISOString(),
    };

    if (data.api_secret) {
      configData.api_secret = isEncrypted(data.api_secret)
        ? data.api_secret
        : encryptCredential(data.api_secret);
    }

    configData.created_by = context.actor.email;
    let result;

    if (data.id) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('courier_configs')
        .update(configData)
        .eq('id', data.id)
        .eq('owner_user_id', userData.id)
        .select()
        .single();

      if (updateError) throw updateError;
      result = updated;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('courier_configs')
        .insert(configData)
        .select()
        .single();

      if (insertError) throw insertError;
      result = inserted;
    }

    if (!userData.assigned_config_id) {
      await supabaseAdmin
        .from('users')
        .update({ assigned_config_id: result.id })
        .eq('id', userData.id);
    }

    console.log(`Configurazione personale salvata (Multi-Account):`, {
      id: result.id,
      name: result.name,
      account_type: result.account_type,
      owner_user_id: result.owner_user_id,
      provider_id: result.provider_id,
      contract_mapping_keys: Object.keys(result.contract_mapping || {}),
      contract_mapping_count: Object.keys(result.contract_mapping || {}).length,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SAVE] Contract mapping dettaglio:`, result.contract_mapping);
    }

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
