import type { SupabaseClient } from '@supabase/supabase-js';
import { CourierFactory } from '@/lib/services/couriers/courier-factory';
import type { CreateShipmentInput } from '@/lib/validations/shipment';
import type { CourierClient } from './create-shipment-core';
import { decryptCredential } from '@/lib/security/encryption';

export interface GetCourierClientOptions {
  /** ID utente target (chi paga) */
  userId: string;
  /** ConfigId specifico (opzionale, priorità massima) */
  configId?: string;
}

export interface GetCourierClientResult {
  client: CourierClient;
  configId: string;
  configSource: 'specific' | 'personal' | 'assigned' | 'default';
}

/**
 * Recupera il client corriere con logica multi-tenant.
 *
 * Estratta da `app/api/shipments/create/route.ts` per riuso.
 *
 * ## Priorità configurazione:
 * 0. ConfigId specifico fornito (se l'utente ha accesso)
 * 1. Config personale (owner_user_id = userId)
 * 2. Config assegnata (user.assigned_config_id)
 * 3. Config default per provider (is_default = true)
 *
 * ## Security:
 * Se viene fornito un configId specifico, verifica che l'utente abbia accesso
 * (owner, assigned, o è una config default).
 *
 * @param supabaseAdmin - Client Supabase con permessi admin
 * @param validated - Dati spedizione validati (contiene provider, carrier)
 * @param options.userId - ID utente target (chi paga la spedizione)
 * @param options.configId - ConfigId specifico (opzionale, priorità massima)
 * @returns Client corriere + info sulla config usata
 * @throws Error se nessuna configurazione trovata per il provider
 *
 * @example
 * const { client, configSource } = await getCourierClientReal(supabaseAdmin, validated, {
 *   userId: context.target.id,
 *   configId: body.configId,
 * });
 * console.log(`Using ${configSource} config`);
 * const result = await client.createShipping(payload);
 */
export async function getCourierClientReal(
  supabaseAdmin: SupabaseClient,
  validated: CreateShipmentInput,
  options: GetCourierClientOptions
): Promise<GetCourierClientResult> {
  const { userId, configId: specificConfigId } = options;

  // Normalizza provider ID per DB
  const providerId =
    validated.provider === 'spediscionline' ? 'spedisci_online' : validated.provider;

  // Recupera assigned_config_id dell'utente
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('assigned_config_id')
    .eq('id', userId)
    .single();

  let courierConfig: any = null;
  let configSource: 'specific' | 'personal' | 'assigned' | 'default' = 'default';

  // ============================================
  // PRIORITÀ 0: ConfigId specifico fornito
  // ============================================
  if (specificConfigId) {
    const { data: specificConfig } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', specificConfigId)
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .maybeSingle();

    if (specificConfig) {
      // Security check: utente deve avere accesso
      const isOwner = specificConfig.owner_user_id === userId;
      const isAssigned = userData?.assigned_config_id === specificConfigId;
      const isDefault = specificConfig.is_default === true;

      if (isOwner || isAssigned || isDefault) {
        courierConfig = specificConfig;
        configSource = 'specific';
        console.log('✅ [CONFIG] Trovata config specifica (configId fornito):', {
          configId: specificConfig.id,
          providerId,
          userId: userId.substring(0, 8) + '...',
          reason: isOwner ? 'owner' : isAssigned ? 'assigned' : 'default',
        });
      } else {
        console.warn('⚠️ [CONFIG] ConfigId fornito ma utente non ha accesso:', {
          configId: specificConfigId,
          userId: userId.substring(0, 8) + '...',
        });
      }
    } else {
      console.warn('⚠️ [CONFIG] ConfigId fornito non trovato:', {
        configId: specificConfigId,
        providerId,
      });
    }
  }

  // ============================================
  // PRIORITÀ 1: Config personale
  // ============================================
  if (!courierConfig) {
    const { data: personalConfig } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('provider_id', providerId)
      .eq('owner_user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (personalConfig) {
      courierConfig = personalConfig;
      configSource = 'personal';
      console.log('✅ [CONFIG] Trovata config personale:', {
        configId: personalConfig.id,
        providerId,
        userId: userId.substring(0, 8) + '...',
      });
    }
  }

  // ============================================
  // PRIORITÀ 2: Config assegnata
  // ============================================
  if (!courierConfig && userData?.assigned_config_id) {
    const { data: assignedConfig } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('id', userData.assigned_config_id)
      .eq('provider_id', providerId)
      .eq('is_active', true)
      .maybeSingle();

    if (assignedConfig) {
      courierConfig = assignedConfig;
      configSource = 'assigned';
      console.log('✅ [CONFIG] Trovata config assegnata:', {
        configId: assignedConfig.id,
        providerId,
        userId: userId.substring(0, 8) + '...',
      });
    }
  }

  // ============================================
  // PRIORITÀ 3: Config default
  // ============================================
  if (!courierConfig) {
    const { data: defaultConfig } = await supabaseAdmin
      .from('courier_configs')
      .select('*')
      .eq('provider_id', providerId)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (defaultConfig) {
      courierConfig = defaultConfig;
      configSource = 'default';
      console.log('✅ [CONFIG] Trovata config default:', {
        configId: defaultConfig.id,
        providerId,
      });
    }
  }

  // ============================================
  // ERRORE: Nessuna config trovata
  // ============================================
  if (!courierConfig) {
    console.error('❌ [CONFIG] Nessuna configurazione trovata:', {
      providerId,
      userId: userId.substring(0, 8) + '...',
      assignedConfigId: userData?.assigned_config_id,
    });
    throw new Error(
      `Configurazione non trovata per ${validated.carrier} tramite ${validated.provider}. Vai su Integrazioni per configurare le credenziali.`
    );
  }

  // ============================================
  // CONTRACT MAPPING
  // ============================================
  const carrierLower = validated.carrier.toLowerCase();
  const contractMapping = courierConfig.contract_mapping || {};

  console.log('🔍 [CONTRACT] Looking up contract:', {
    validatedCarrier: validated.carrier,
    carrierLower,
    contractMappingKeys: Object.keys(contractMapping),
    validatedContractId: validated.contract_id,
  });

  // Try multiple key formats to find the contract
  // NOTE: contract_mapping structure: { "contractCode": "displayName" }
  // We need the KEY (contractCode), not the VALUE (displayName)
  const contractId =
    validated.contract_id ||
    contractMapping[carrierLower] ||
    contractMapping[validated.carrier] ||
    // Also try to find by partial match (for normalized carriers like POSTE)
    Object.entries(contractMapping).find(
      ([key]) =>
        key.toLowerCase().includes(carrierLower) || carrierLower.includes(key.toLowerCase())
    )?.[0] || // ← [0] = KEY (contractCode), NOT [1] (displayName)
    contractMapping['default'] ||
    undefined;

  console.log('📋 [CONTRACT] Selected contract:', {
    contractId: contractId || '(none - will use default)',
    source: validated.contract_id
      ? 'validated.contract_id'
      : contractMapping[carrierLower]
        ? 'carrierLower'
        : contractMapping[validated.carrier]
          ? 'carrier'
          : 'partial-match or default',
  });

  // ============================================
  // CREATE CLIENT
  // ============================================
  // ⚠️ CRITICAL: API key is stored encrypted in DB - must decrypt before use
  const decryptedApiKey = decryptCredential(courierConfig.api_key);

  const client = CourierFactory.getClient(validated.provider, validated.carrier, {
    apiKey: decryptedApiKey,
    baseUrl: courierConfig.base_url,
    contractId: contractId,
  });

  return {
    client,
    configId: courierConfig.id,
    configSource,
  };
}
