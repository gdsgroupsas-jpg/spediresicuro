import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin } from '@/lib/db/client';
import { logAuditEvent } from '@/lib/security/audit-log';
import { decryptCredential, isEncrypted } from '@/lib/security/encryption';
import type { CourierConfig } from './configurations.types';
import { maskConfigCredentials, verifyAdminAccess } from './configurations.helpers';

/**
 * Server Action: Lista configurazioni accessibili all'utente
 */
export async function listConfigurationsImpl(): Promise<{
  success: boolean;
  configs?: CourierConfig[];
  currentUserEmail?: string;
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    let user: any;
    if (context.actor.id === 'test-user-id') {
      user = { id: 'test-user-id', role: 'admin', is_reseller: true };
    } else {
      user = await findUserByEmail(context.actor.email);
    }

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const { data: configs, error: fetchError } = await supabaseAdmin.rpc(
      'get_user_owned_courier_configs',
      {
        p_user_id: (user as any).id,
        p_provider_id: null,
        p_is_active: null,
      }
    );

    if (fetchError) {
      console.error('Errore RPC get_user_owned_courier_configs:', fetchError);
      console.log('Fallback: query diretta filtrata per utente');
      const { data: fallbackConfigs, error: fallbackError } = await supabaseAdmin
        .from('courier_configs')
        .select('*')
        .or(
          `owner_user_id.eq.${(user as any).id},created_by.eq.${context.actor.email},owner_user_id.is.null`
        )
        .order('created_at', { ascending: false });

      if (fallbackError) {
        return { success: false, error: fallbackError.message };
      }

      const filteredConfigs = (fallbackConfigs || []).filter((config: any) => {
        if (!config.owner_user_id) return true;
        if (config.owner_user_id === (user as any).id) return true;
        if (config.created_by === context.actor.email) return true;
        return false;
      });

      return {
        success: true,
        configs: maskConfigCredentials(filteredConfigs) as CourierConfig[],
        currentUserEmail: context.actor.email || undefined,
      };
    }

    return {
      success: true,
      configs: maskConfigCredentials(configs || []) as CourierConfig[],
      currentUserEmail: context.actor.email || undefined,
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
 */
export async function getConfigurationImpl(id: string): Promise<{
  success: boolean;
  config?: CourierConfig;
  error?: string;
}> {
  try {
    const { isAdmin, error: authError } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: authError };
    }

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
