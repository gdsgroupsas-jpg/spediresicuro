'use server';

/**
 * Server Actions per gestione preferenze AI Provider
 * Solo Superadmin può modificare
 */

import { supabaseAdmin } from '@/lib/db/client';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';

/**
 * Verifica se l'utente corrente è Superadmin
 */
async function verifySuperAdmin(): Promise<{ isSuperAdmin: boolean; error?: string }> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { isSuperAdmin: false, error: 'Non autenticato' };
    }

    return { isSuperAdmin: isSuperAdmin(context) };
  } catch (error: any) {
    console.error('Errore verifica Superadmin:', error);
    return { isSuperAdmin: false, error: error.message };
  }
}

/**
 * Ottiene la configurazione AI provider corrente
 */
export async function getAIProviderSetting() {
  try {
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value, updated_at, updated_by')
      .eq('setting_key', 'ai_provider')
      .single();

    if (error) {
      // Se non esiste, ritorna default
      return {
        success: true,
        data: {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
        },
      };
    }

    const value = data.setting_value as any;
    return {
      success: true,
      data: {
        provider: value.provider || 'anthropic',
        model: value.model || 'claude-3-haiku-20240307',
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
      },
    };
  } catch (error: any) {
    console.error('Errore lettura AI provider setting:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Aggiorna la configurazione AI provider (solo Superadmin)
 */
export async function updateAIProviderSetting(
  provider: 'anthropic' | 'deepseek' | 'gemini',
  model?: string
) {
  try {
    // Verifica permessi
    const authCheck = await verifySuperAdmin();
    if (!authCheck.isSuperAdmin) {
      return {
        success: false,
        error: 'Solo i Superadmin possono modificare questa impostazione',
      };
    }

    // Ottieni email utente corrente
    const context = await getWorkspaceAuth();
    const updatedBy = context?.actor?.email || 'unknown';

    // Determina model default se non specificato
    const defaultModel =
      model ||
      (provider === 'deepseek'
        ? 'deepseek-chat'
        : provider === 'gemini'
          ? 'gemini-2.0-flash-exp'
          : 'claude-3-haiku-20240307');

    const settingValue = {
      provider,
      model: defaultModel,
    };

    // Upsert setting
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert(
        {
          setting_key: 'ai_provider',
          setting_value: settingValue,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'setting_key',
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: {
        provider: settingValue.provider,
        model: settingValue.model,
      },
    };
  } catch (error: any) {
    console.error('Errore aggiornamento AI provider setting:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Lista provider AI disponibili con info
 */
export async function getAvailableAIProviders() {
  return {
    success: true,
    data: [
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        description: 'Claude 3 Haiku - Veloce ed economico',
        model: 'claude-3-haiku-20240307',
        hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek Chat - Alternativa performante',
        model: 'deepseek-chat',
        hasApiKey: !!process.env.DEEPSEEK_API_KEY,
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini 2.0 Flash - Multimodale e performante',
        model: 'gemini-2.0-flash-exp',
        hasApiKey: !!process.env.GOOGLE_API_KEY,
      },
    ],
  };
}
