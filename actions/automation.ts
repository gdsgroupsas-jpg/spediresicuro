'use server'

/**
 * Server Actions per Automation Spedisci.Online
 * 
 * Gestisce:
 * - Abilitazione/disabilitazione automation
 * - Configurazione settings
 * - Sync manuale
 * - Verifica stato
 */

import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';
import { syncCourierConfig } from '@/lib/automation/spedisci-online-agent';
import type { AutomationSettings } from '@/lib/automation/spedisci-online-agent';
import { encryptCredential, decryptCredential } from '@/lib/security/encryption';

/**
 * Verifica accesso admin
 */
async function verifyAdminAccess(): Promise<{ isAdmin: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { isAdmin: false, error: 'Non autenticato' };
    }

    // Cerca prima con account_type, poi con role (per compatibilità)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('account_type, role')
      .eq('email', session.user.email)
      .single();

    if (error || !user) {
      return { isAdmin: false, error: 'Utente non trovato. Verifica di essere loggato correttamente.' };
    }

    // Verifica admin usando account_type o role (per compatibilità)
    const isAdmin = 
      user.account_type === 'superadmin' || 
      user.account_type === 'admin' ||
      user.role === 'admin' ||
      user.role === 'superadmin';

    if (!isAdmin) {
      return { isAdmin: false, error: 'Solo admin può gestire automation' };
    }

    return { isAdmin: true };
  } catch (error: any) {
    console.error('Errore verifyAdminAccess:', error);
    return { isAdmin: false, error: error.message || 'Errore verifica permessi' };
  }
}

/**
 * Abilita/disabilita automation per una configurazione
 */
export async function toggleAutomation(
  configId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: error || 'Accesso negato' };
    }

    const { error: updateError } = await supabaseAdmin
      .from('courier_configs')
      .update({ automation_enabled: enabled })
      .eq('id', configId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Errore toggle automation:', error);
    return {
      success: false,
      error: error.message || 'Errore durante aggiornamento',
    };
  }
}

/**
 * Salva automation settings per una configurazione
 */
export async function saveAutomationSettings(
  configId: string,
  settings: AutomationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: error || 'Accesso negato' };
    }

    // Validazione settings
    if (!settings.spedisci_online_username) {
      return {
        success: false,
        error: 'Settings incompleti. Richiesto: spedisci_online_username',
      };
    }

    // Validazione in base al metodo 2FA
    if (settings.two_factor_method === 'email') {
      if (!settings.email_2fa || !settings.imap_server) {
        return {
          success: false,
          error: 'Settings incompleti per 2FA email. Richiesti: email_2fa, imap_server',
        };
      }
    }

    // ============================================
    // 🔐 CRITTAZIONE PASSWORD (SICUREZZA CRITICA)
    // ============================================
    
    // Crea copia settings per criptare password
    const encryptedSettings: any = { ...settings };
    
    // Cripta password Spedisci.Online
    if (encryptedSettings.spedisci_online_password) {
      encryptedSettings.spedisci_online_password = encryptCredential(
        encryptedSettings.spedisci_online_password
      );
    }
    
    // Cripta password IMAP (se presente)
    if (encryptedSettings.imap_password) {
      encryptedSettings.imap_password = encryptCredential(
        encryptedSettings.imap_password
      );
    }
    
    // Marca come criptato
    const { error: updateError } = await supabaseAdmin
      .from('courier_configs')
      .update({
        automation_settings: encryptedSettings,
        automation_enabled: settings.enabled || false,
        automation_encrypted: true, // Marca come criptato
      })
      .eq('id', configId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  } catch (error: any) {
    console.error('❌ Errore salvataggio automation settings:', error);
    return {
      success: false,
      error: error.message || 'Errore durante salvataggio',
    };
  }
}

/**
 * Esegue sync manuale per una configurazione
 */
export async function manualSync(
  configId: string,
  forceRefresh: boolean = false
): Promise<{
  success: boolean;
  error?: string;
  session_data?: any;
  contracts?: Record<string, string>;
}> {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: error || 'Accesso negato' };
    }

    const result = await syncCourierConfig(configId, forceRefresh);

    if (result.success) {
      return {
        success: true,
        session_data: result.session_data,
        contracts: result.contracts,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Errore durante sync',
      };
    }
  } catch (error: any) {
    console.error('❌ Errore sync manuale:', error);
    return {
      success: false,
      error: error.message || 'Errore durante sync',
    };
  }
}

/**
 * Ottiene stato automation per una configurazione
 */
export async function getAutomationStatus(
  configId: string
): Promise<{
  success: boolean;
  enabled?: boolean;
  last_sync?: string;
  session_valid?: boolean;
  error?: string;
}> {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: error || 'Accesso negato' };
    }

    const { data: config, error: configError } = await supabaseAdmin
      .from('courier_configs')
      .select('automation_enabled, last_automation_sync, session_data')
      .eq('id', configId)
      .single();

    if (configError || !config) {
      return { success: false, error: 'Configurazione non trovata' };
    }

    // Verifica se session è valida (non scaduta)
    let sessionValid = false;
    if (config.session_data) {
      const expiresAt = config.session_data?.expires_at;
      if (expiresAt) {
        sessionValid = new Date(expiresAt) > new Date();
      } else {
        sessionValid = true; // Se non c'è expires_at, assumiamo valida
      }
    }

    return {
      success: true,
      enabled: config.automation_enabled || false,
      last_sync: config.last_automation_sync || undefined,
      session_valid: sessionValid,
    };
  } catch (error: any) {
    console.error('❌ Errore recupero stato automation:', error);
    return {
      success: false,
      error: error.message || 'Errore durante recupero stato',
    };
  }
}

/**
 * Ottiene automation settings per una configurazione
 */
export async function getAutomationSettings(
  configId: string
): Promise<{
  success: boolean;
  settings?: AutomationSettings;
  error?: string;
}> {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) {
      return { success: false, error: error || 'Accesso negato' };
    }

    const { data: config, error: configError } = await supabaseAdmin
      .from('courier_configs')
      .select('automation_settings, automation_encrypted')
      .eq('id', configId)
      .single();

    if (configError || !config) {
      return { success: false, error: 'Configurazione non trovata' };
    }

    const settings = (config.automation_settings as any) || {};
    
    // ============================================
    // 🔓 DECRITTAZIONE PASSWORD (se criptate)
    // ============================================
    
    if (config.automation_encrypted) {
      // Decripta password se presenti
      if (settings.spedisci_online_password) {
        try {
          settings.spedisci_online_password = decryptCredential(
            settings.spedisci_online_password
          );
        } catch (error) {
          console.error('❌ Errore decriptazione password Spedisci.Online:', error);
          // Se decriptazione fallisce, rimuovi password (non esporre dati corrotti)
          settings.spedisci_online_password = '';
        }
      }
      
      if (settings.imap_password) {
        try {
          settings.imap_password = decryptCredential(settings.imap_password);
        } catch (error) {
          console.error('❌ Errore decriptazione password IMAP:', error);
          settings.imap_password = '';
        }
      }
    }

    return {
      success: true,
      settings: settings as AutomationSettings,
    };
  } catch (error: any) {
    console.error('❌ Errore recupero automation settings:', error);
    return {
      success: false,
      error: error.message || 'Errore durante recupero settings',
    };
  }
}

/**
 * Acquisisce lock manuale (quando utente sta usando Spedisci.Online)
 */
export async function acquireManualLock(
  configId: string,
  durationMinutes: number = 60
): Promise<{ success: boolean; lock_id?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: lockId, error } = await supabaseAdmin.rpc('acquire_automation_lock', {
      p_config_id: configId,
      p_lock_type: 'manual',
      p_locked_by: session.user.email,
      p_reason: 'Uso manuale Spedisci.Online',
      p_duration_minutes: durationMinutes,
    });

    if (error) {
      return { success: false, error: error.message || 'Impossibile acquisire lock' };
    }

    return { success: true, lock_id: lockId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Errore durante acquisizione lock' };
  }
}

/**
 * Rilascia lock manuale
 */
export async function releaseManualLock(
  configId: string,
  lockId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('release_automation_lock', {
      p_config_id: configId,
      p_lock_id: lockId || null,
    });

    if (error) {
      return { success: false, error: error.message || 'Impossibile rilasciare lock' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Errore durante rilascio lock' };
  }
}

/**
 * Verifica lock attivo per configurazione
 */
export async function checkLock(configId: string): Promise<{
  success: boolean;
  has_lock?: boolean;
  lock_type?: string;
  locked_by?: string;
  expires_at?: string;
  minutes_remaining?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_automation_lock', {
      p_config_id: configId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      return {
        success: true,
        has_lock: data[0].has_lock || false,
        lock_type: data[0].lock_type,
        locked_by: data[0].locked_by,
        expires_at: data[0].expires_at,
        minutes_remaining: data[0].minutes_remaining,
      };
    }

    return { success: true, has_lock: false };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

