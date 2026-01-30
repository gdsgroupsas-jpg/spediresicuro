'use server';

/**
 * Server Actions per integrazione SpediamoPro
 *
 * Gestisce il recupero configurazioni e preventivi da SpediamoPro.
 * Segue lo stesso pattern di spedisci-online.ts per consistenza.
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { SpediamoProClient } from '@/lib/services/couriers/spediamopro.client';

interface SpediamoProConfig {
  configId: string;
  configName: string;
  api_key: string; // authCode (decifrato)
  base_url: string;
  contract_mapping: Record<string, string>;
}

/**
 * Recupera TUTTE le configurazioni SpediamoPro dell'utente.
 * Stessa logica di getAllUserSpedisciOnlineConfigs ma per provider_id='spediamopro'.
 */
export async function getAllUserSpediamoProConfigs(): Promise<{
  success: boolean;
  configs: SpediamoProConfig[];
  error?: string;
}> {
  try {
    const context = await getSafeAuth();

    if (!context?.actor?.email) {
      return { success: false, configs: [], error: 'Non autenticato' };
    }

    const userEmail = context.actor.email!;
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('id, account_type, assigned_config_id')
      .eq('email', userEmail)
      .maybeSingle();

    const currentUserId = currentUser?.id ?? null;
    const assignedConfigId = currentUser?.assigned_config_id ?? null;

    const { decryptCredential, isEncrypted } = await import('@/lib/security/encryption');

    const configs: SpediamoProConfig[] = [];
    const addedIds = new Set<string>();

    const addConfig = (config: any) => {
      if (addedIds.has(config.id)) return;
      addedIds.add(config.id);

      let apiKey = config.api_key;
      if (apiKey && isEncrypted(apiKey)) {
        apiKey = decryptCredential(apiKey);
      }

      configs.push({
        configId: config.id,
        configName:
          config.name || config.config_label || `SpediamoPro ${config.id.substring(0, 8)}`,
        api_key: apiKey,
        base_url: config.base_url || 'https://core.spediamopro.com',
        contract_mapping: config.contract_mapping || {},
      });
    };

    // 1. Configurazioni personali (owner_user_id = currentUserId)
    if (currentUserId) {
      const { data: personalConfigs } = await supabaseAdmin
        .from('courier_configs')
        .select('*')
        .eq('provider_id', 'spediamopro')
        .eq('owner_user_id', currentUserId)
        .eq('is_active', true);

      if (personalConfigs) {
        personalConfigs.forEach(addConfig);
      }
    }

    // 2. Configurazione assegnata (se provider_id = spediamopro)
    if (assignedConfigId) {
      const { data: assignedConfig } = await supabaseAdmin
        .from('courier_configs')
        .select('*')
        .eq('id', assignedConfigId)
        .eq('provider_id', 'spediamopro')
        .eq('is_active', true)
        .maybeSingle();

      if (assignedConfig) {
        addConfig(assignedConfig);
      }
    }

    // 3. Configurazioni default globali
    const { data: defaultConfigs } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('provider_id', 'spediamopro')
      .eq('is_default', true)
      .eq('is_active', true);

    if (defaultConfigs) {
      defaultConfigs.forEach(addConfig);
    }

    console.log(`[SPEDIAMOPRO] Trovate ${configs.length} configurazioni per utente`);

    return { success: true, configs };
  } catch (error: any) {
    console.error('[SPEDIAMOPRO] Errore recupero configurazioni:', error.message);
    return { success: false, configs: [], error: error.message };
  }
}

/**
 * Ottiene preventivi da SpediamoPro tramite API simulazione.
 * Restituisce rates nello stesso formato di SpedisciOnline per compatibilita.
 */
export async function getSpediamoProQuotes(params: {
  configId: string;
  senderCap: string;
  senderCity: string;
  senderProv: string;
  senderNation?: string;
  recipientCap: string;
  recipientCity: string;
  recipientProv: string;
  recipientNation?: string;
  parcels: Array<{ weight: number; length: number; width: number; height: number }>;
  insuranceValue?: number;
  codValue?: number;
}): Promise<{
  success: boolean;
  rates?: any[];
  error?: string;
}> {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // Recupera config specifica
    const { decryptCredential, isEncrypted } = await import('@/lib/security/encryption');

    const { data: config } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', params.configId)
      .eq('provider_id', 'spediamopro')
      .eq('is_active', true)
      .single();

    if (!config) {
      return { success: false, error: 'Configurazione SpediamoPro non trovata' };
    }

    let apiKey = config.api_key;
    if (apiKey && isEncrypted(apiKey)) {
      apiKey = decryptCredential(apiKey);
    }

    // Crea client SpediamoPro e chiama simulazione
    const client = new SpediamoProClient({
      apiKey,
      baseUrl: config.base_url || 'https://core.spediamopro.com',
    });

    const rates = await client.getQuotes({
      senderCap: params.senderCap,
      senderCity: params.senderCity,
      senderProv: params.senderProv,
      senderNation: params.senderNation,
      recipientCap: params.recipientCap,
      recipientCity: params.recipientCity,
      recipientProv: params.recipientProv,
      recipientNation: params.recipientNation,
      parcels: params.parcels,
      insuranceValue: params.insuranceValue,
      codValue: params.codValue,
    });

    // Normalizza rates al formato standard del sistema
    const normalizedRates = rates.map((rate) => ({
      carrierCode: rate.carrier,
      contractCode: rate.carrier, // SpediamoPro usa il codice carrier come contratto
      weight_price: (rate.price || 0).toString(),
      insurance_price: '0',
      cod_price: '0',
      services_price: '0',
      fuel: '0',
      total_price: (rate.price || 0).toString(),
      total_price_vat: (rate.price_vat || 0).toString(),
      delivery_time: rate.delivery_time || '',
      source: 'spediamopro',
      _provider: 'spediamopro',
      _simulationId: rate.id, // Necessario per creare la spedizione
    }));

    return { success: true, rates: normalizedRates };
  } catch (error: any) {
    console.error('[SPEDIAMOPRO] Errore quote:', error.message);
    return { success: false, error: error.message };
  }
}
