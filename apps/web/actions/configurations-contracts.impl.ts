import { supabaseAdmin } from '@/lib/db/client';
import { parseContractMapping, verifyConfigAccess } from './configurations.helpers';

/**
 * Server Action: Rimuove contratto Spedisci.Online
 *
 * Rimuove un contratto dal contract_mapping.
 */
export async function removeSpedisciOnlineContractImpl(
  configId: string,
  contractCode: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', configId)
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
      return {
        success: false,
        error: accessError || 'Accesso negato',
      };
    }

    if (config.provider_id !== 'spedisci_online') {
      return {
        success: false,
        error: 'Questa funzione e solo per configurazioni Spedisci.Online',
      };
    }

    const parsed = parseContractMapping(config.contract_mapping);
    if (!parsed.ok) {
      return {
        success: false,
        error: parsed.error,
      };
    }

    const contractMapping = parsed.mapping;

    if (contractMapping[contractCode]) {
      delete contractMapping[contractCode];
      console.log(`Rimosso contratto: ${contractCode}`);
    } else {
      return {
        success: false,
        error: `Contratto "${contractCode}" non trovato nel mapping`,
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from('courier_configs')
      .update({
        contract_mapping: contractMapping,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId);

    if (updateError) {
      console.error('Errore rimozione contratto:', updateError);
      return {
        success: false,
        error: updateError.message || 'Errore durante rimozione',
      };
    }

    return {
      success: true,
      message: `Contratto "${contractCode}" rimosso con successo`,
    };
  } catch (error: any) {
    console.error('Errore removeSpedisciOnlineContract:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Server Action: Aggiorna contratto Spedisci.Online
 *
 * Rimuove un contratto vecchio e aggiunge un nuovo contratto per lo stesso corriere.
 */
export async function updateSpedisciOnlineContractImpl(
  configId: string,
  oldContractCode: string,
  newContractCode: string,
  courierName: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const { data: config, error: fetchError } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', configId)
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
      return {
        success: false,
        error: accessError || 'Accesso negato',
      };
    }

    if (config.provider_id !== 'spedisci_online') {
      return {
        success: false,
        error: 'Questa funzione e solo per configurazioni Spedisci.Online',
      };
    }

    const parsed = parseContractMapping(config.contract_mapping);
    if (!parsed.ok) {
      return {
        success: false,
        error: parsed.error,
      };
    }

    const contractMapping = parsed.mapping;

    if (contractMapping[oldContractCode]) {
      delete contractMapping[oldContractCode];
      console.log(`Rimosso contratto vecchio: ${oldContractCode}`);
    } else {
      console.warn(`Contratto vecchio non trovato nel mapping: ${oldContractCode}`);
    }

    contractMapping[newContractCode] = courierName;
    console.log(`Aggiunto nuovo contratto: ${newContractCode} -> ${courierName}`);

    const { error: updateError } = await supabaseAdmin
      .from('courier_configs')
      .update({
        contract_mapping: contractMapping,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId);

    if (updateError) {
      console.error('Errore aggiornamento contratto:', updateError);
      return {
        success: false,
        error: updateError.message || 'Errore durante aggiornamento',
      };
    }

    return {
      success: true,
      message: `Contratto aggiornato: rimosso "${oldContractCode}", aggiunto "${newContractCode}"`,
    };
  } catch (error: any) {
    console.error('Errore updateSpedisciOnlineContract:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}
