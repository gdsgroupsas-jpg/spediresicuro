import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { isSuperAdminCheck } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db/client';
import { logAuditEvent } from '@/lib/security/audit-log';
import { verifyConfigAccess } from './configurations.helpers';

/**
 * Server Action: Elimina configurazione personale (per utenti non-admin)
 */
export async function deletePersonalConfigurationImpl(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

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

    if (config.created_by !== context.actor.email) {
      return {
        success: false,
        error: 'Non hai i permessi per eliminare questa configurazione',
      };
    }

    if (config.is_default) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, reseller_role, is_reseller')
        .eq('email', context.actor.email)
        .single();

      if (userData?.is_reseller && userData?.reseller_role !== 'admin') {
        return {
          success: false,
          error: "Solo l'amministratore reseller puo eliminare configurazioni default.",
        };
      }
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, assigned_config_id')
      .eq('email', context.actor.email)
      .single();

    if (userData?.assigned_config_id === id) {
      await supabaseAdmin.from('users').update({ assigned_config_id: null }).eq('id', userData.id);
    }

    const { error: deleteError } = await supabaseAdmin
      .from('courier_configs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Errore eliminazione configurazione personale:', deleteError);
      return {
        success: false,
        error: deleteError.message || "Errore durante l'eliminazione",
      };
    }

    console.log('Configurazione personale eliminata:', id);

    return {
      success: true,
      message: 'Configurazione eliminata con successo',
    };
  } catch (error: any) {
    console.error('Errore deletePersonalConfiguration:', error);
    return {
      success: false,
      error: error.message || "Errore durante l'eliminazione",
    };
  }
}

/**
 * Server Action: Elimina configurazione
 */
export async function deleteConfigurationImpl(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, provider_id, owner_user_id')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    const { canAccess, error: accessError } = await verifyConfigAccess(
      config.owner_user_id || null
    );
    if (!canAccess) {
      return { success: false, error: accessError };
    }

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
        error: `Impossibile eliminare: la configurazione e assegnata a ${usersUsingConfig.length} utente/i. 
                Rimuovi prima l'assegnazione agli utenti.`,
      };
    }

    if (config.provider_id) {
      const { data: defaultCheck } = await supabaseAdmin
        .from('courier_configs')
        .select('is_default')
        .eq('id', id)
        .single();

      if (defaultCheck?.is_default) {
        const context = await getWorkspaceAuth();
        if (context?.actor?.email) {
          const { data: currentUser } = await supabaseAdmin
            .from('users')
            .select('id, reseller_role, is_reseller, account_type')
            .eq('email', context.actor.email)
            .single();

          if (
            currentUser?.is_reseller &&
            currentUser?.reseller_role !== 'admin' &&
            !isSuperAdminCheck(currentUser)
          ) {
            return {
              success: false,
              error: "Solo l'amministratore reseller puo eliminare configurazioni default.",
            };
          }
        }

        if (config.owner_user_id) {
          console.log(
            'Configurazione default personale eliminabile (owner_user_id presente, utente admin)'
          );
        } else {
          const { count: globalConfigCount } = await supabaseAdmin
            .from('courier_configs')
            .select('id', { count: 'exact', head: true })
            .eq('provider_id', config.provider_id)
            .is('owner_user_id', null);

          if (globalConfigCount && globalConfigCount <= 1) {
            return {
              success: false,
              error: "Impossibile eliminare l'unica configurazione globale default.",
            };
          }
          console.log('Configurazione default globale eliminabile: esistono altre config');
        }
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('courier_configs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Errore eliminazione configurazione:', deleteError);
      return {
        success: false,
        error: deleteError.message || "Errore durante l'eliminazione",
      };
    }

    console.log('Configurazione eliminata:', id);

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
      error: error.message || "Errore durante l'eliminazione",
    };
  }
}

/**
 * Server Action: Aggiorna status attivo/inattivo di una configurazione
 */
export async function updateConfigurationStatusImpl(
  id: string,
  isActive: boolean
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('id, name, provider_id, owner_user_id')
      .eq('id', id)
      .single();

    if (fetchError || !config) {
      return {
        success: false,
        error: 'Configurazione non trovata',
      };
    }

    const { canAccess, error: accessError } = await verifyConfigAccess(
      config.owner_user_id || null
    );
    if (!canAccess) {
      return { success: false, error: accessError };
    }

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
        error: updateError.message || "Errore durante l'aggiornamento",
      };
    }

    if (!isActive) {
      try {
        const { data: priceLists } = await supabaseAdmin
          .from('price_lists')
          .select('id, name, metadata, source_metadata')
          .eq('list_type', 'supplier')
          .in('status', ['active', 'draft']);

        if (priceLists && priceLists.length > 0) {
          const listsToDisable = priceLists.filter((priceList: any) => {
            const metadata = priceList.metadata || priceList.source_metadata || {};
            return metadata.courier_config_id === id;
          });

          if (listsToDisable.length > 0) {
            const listIds = listsToDisable.map((priceList: any) => priceList.id);

            const { error: disableError } = await supabaseAdmin
              .from('price_lists')
              .update({
                status: 'archived',
                notes: `Listino archiviato automaticamente: configurazione "${
                  config.name
                }" disattivata il ${new Date().toISOString()}`,
                updated_at: new Date().toISOString(),
              })
              .in('id', listIds);

            if (disableError) {
              console.warn('Errore disabilitazione listini:', disableError);
            } else {
              console.log(
                `[AUTO-DISABLE] Archiviati ${listsToDisable.length} listini per config ${id.substring(
                  0,
                  8
                )}...`
              );
            }
          }
        }
      } catch (listError: any) {
        console.warn('Errore durante auto-disable listini:', listError.message);
      }
    }

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
      error: error.message || "Errore durante l'aggiornamento",
    };
  }
}

/**
 * Server Action: Imposta configurazione personale come default
 */
export async function setPersonalConfigurationAsDefaultImpl(id: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

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

    if (config.created_by !== context.actor.email) {
      return {
        success: false,
        error: 'Non hai i permessi per modificare questa configurazione',
      };
    }

    await supabaseAdmin
      .from('courier_configs')
      .update({ is_default: false })
      .eq('provider_id', config.provider_id)
      .neq('id', id);

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
        error: updateError.message || "Errore durante l'aggiornamento",
      };
    }

    console.log('Configurazione impostata come default:', id);

    return {
      success: true,
      message: 'Configurazione impostata come default con successo',
    };
  } catch (error: any) {
    console.error('Errore setPersonalConfigurationAsDefault:', error);
    return {
      success: false,
      error: error.message || "Errore durante l'aggiornamento",
    };
  }
}

/**
 * Server Action: Assegna configurazione a utente
 */
export async function assignConfigurationToUserImpl(
  userId: string,
  configId: string | null
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: callerData, error: callerError } = await supabaseAdmin
      .from('users')
      .select('id, account_type, role')
      .eq('email', context.actor.email.toLowerCase())
      .single();

    if (callerError || !callerData) {
      return { success: false, error: 'Utente non trovato' };
    }

    if (!configId) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ assigned_config_id: null })
        .eq('id', userId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      console.log('Assegnazione configurazione rimossa per utente:', userId);
      return { success: true, message: 'Assegnazione rimossa con successo' };
    }

    const { error: rpcError } = await supabaseAdmin.rpc('assign_config_to_user_secure', {
      p_caller_id: callerData.id,
      p_user_id: userId,
      p_config_id: configId,
    });

    if (rpcError) {
      console.error('Errore RPC assegnazione configurazione:', rpcError);

      const errorMessage = rpcError.message || '';

      if (errorMessage.includes('UNAUTHORIZED')) {
        return {
          success: false,
          error:
            'Non puoi assegnare questa configurazione. Puoi assegnare solo configurazioni globali o create da te.',
        };
      }

      if (errorMessage.includes('USER_NOT_FOUND')) {
        return { success: false, error: 'Utente non trovato' };
      }

      if (errorMessage.includes('FORBIDDEN')) {
        return {
          success: false,
          error: 'Puoi assegnare configurazioni solo ai tuoi clienti',
        };
      }

      if (errorMessage.includes('CONFIG_NOT_ACTIVE')) {
        return {
          success: false,
          error: 'Impossibile assegnare una configurazione inattiva',
        };
      }

      return { success: false, error: rpcError.message };
    }

    console.log('Configurazione assegnata per utente:', userId);

    return {
      success: true,
      message: 'Configurazione assegnata con successo',
    };
  } catch (error: any) {
    console.error('Errore assignConfigurationToUser:', error);
    return {
      success: false,
      error: error.message || "Errore durante l'assegnazione",
    };
  }
}
