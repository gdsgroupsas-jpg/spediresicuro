/**
 * Database Functions: Price Lists
 *
 * CRUD operations per listini prezzi corrieri
 */

import { calculatePriceFromList } from '@/lib/pricing/calculator';
import type {
  CreatePriceListInput,
  PriceList,
  PriceListEntry,
  UpdatePriceListInput,
} from '@/types/listini';
import { supabase, supabaseAdmin } from './client';
import { assertValidUserId } from '@/lib/validators';

// Re-export funzioni avanzate
export { calculatePriceWithRules, getApplicablePriceList } from './price-lists-advanced';

/**
 * Crea nuovo listino
 */
export async function createPriceList(
  data: CreatePriceListInput,
  userId: string
): Promise<PriceList> {
  // Metadata ora esiste (migration 059 applicata), possiamo includerlo direttamente
  const { data: priceList, error } = await supabaseAdmin
    .from('price_lists')
    .insert({
      ...data,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating price list:', error);
    throw new Error(`Errore creazione listino: ${error.message}`);
  }

  return priceList as PriceList;
}

/**
 * Aggiorna listino esistente
 */
export async function updatePriceList(
  id: string,
  data: UpdatePriceListInput,
  userId: string
): Promise<PriceList> {
  const { data: priceList, error } = await supabaseAdmin
    .from('price_lists')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
      // Nota: updated_by non esiste nella tabella, solo created_by
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating price list:', error);
    throw new Error(`Errore aggiornamento listino: ${error.message}`);
  }

  return priceList as PriceList;
}

/**
 * Ottieni listino per ID
 */
export async function getPriceListById(id: string): Promise<PriceList | null> {
  const { data, error } = await supabaseAdmin
    .from('price_lists')
    .select('*, entries:price_list_entries(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching price list:', error);
    return null;
  }

  // Manual fetch for courier to avoid missing FK relationship error (PGRST200)
  if (data && data.courier_id) {
    const { data: courier } = await supabaseAdmin
      .from('couriers')
      .select('*')
      .eq('id', data.courier_id)
      .single();

    if (courier) {
      (data as any).courier = courier;
    }
  }

  // Parse rules JSONB se presente
  if (data.rules && typeof data.rules === 'string') {
    try {
      data.rules = JSON.parse(data.rules);
    } catch {
      data.rules = [];
    }
  }

  return data as PriceList;
}

/**
 * Lista listini per corriere
 */
export async function listPriceListsByCourier(courierId: string) {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*, courier:couriers(*)')
    .eq('courier_id', courierId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing price lists:', error);
    throw new Error(`Errore recupero listini: ${error.message}`);
  }

  return data || [];
}

/**
 * Lista tutti i listini
 */
export async function listAllPriceLists() {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*, courier:couriers(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing all price lists:', error);
    throw new Error(`Errore recupero listini: ${error.message}`);
  }

  return data || [];
}

/**
 * Ottieni listino attivo per corriere
 */
export async function getActivePriceList(courierId: string): Promise<PriceList | null> {
  const now = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('price_lists')
    .select('*, entries:price_list_entries(*)')
    .eq('courier_id', courierId)
    .eq('status', 'active')
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching active price list:', error);
    return null;
  }

  return data as PriceList;
}

/**
 * Aggiungi righe al listino
 * ⚠️ NOTA: Usa INSERT semplice, può creare duplicati se chiamato più volte
 */
export async function addPriceListEntries(
  priceListId: string,
  entries: Omit<PriceListEntry, 'id' | 'price_list_id' | 'created_at'>[]
): Promise<void> {
  const entriesWithListId = entries.map((entry) => ({
    ...entry,
    price_list_id: priceListId,
  }));

  const { error } = await supabaseAdmin.from('price_list_entries').insert(entriesWithListId);

  if (error) {
    console.error('Error adding price list entries:', error);
    throw new Error(`Errore aggiunta righe listino: ${error.message}`);
  }
}

/**
 * ✨ NUOVO: Upsert righe al listino (INSERT o UPDATE se esiste già)
 *
 * Previene duplicati verificando combinazione univoca:
 * price_list_id + zone_code + weight_from + weight_to + service_type
 *
 * Se esiste già una entry con stessa combinazione:
 * - Aggiorna il prezzo e i supplementi con i nuovi valori
 * - Mantiene l'ID esistente (non crea duplicati)
 *
 * @param priceListId - ID del listino
 * @param entries - Array di entries da aggiungere/aggiornare
 * @returns Statistiche: { inserted: number, updated: number, skipped: number }
 */
export async function upsertPriceListEntries(
  priceListId: string,
  entries: Omit<PriceListEntry, 'id' | 'price_list_id' | 'created_at'>[]
): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
}> {
  const entriesWithListId = entries.map((entry) => ({
    ...entry,
    price_list_id: priceListId,
  }));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Processa entries in batch per evitare query eccessive
  const BATCH_SIZE = 100;
  for (let i = 0; i < entriesWithListId.length; i += BATCH_SIZE) {
    const batch = entriesWithListId.slice(i, i + BATCH_SIZE);

    // Per ogni entry, verifica se esiste già
    for (const entry of batch) {
      try {
        // Cerca entry esistente con stessa combinazione
        const { data: existing } = await supabaseAdmin
          .from('price_list_entries')
          .select('id, base_price')
          .eq('price_list_id', priceListId)
          .eq('zone_code', entry.zone_code || null)
          .eq('weight_from', entry.weight_from)
          .eq('weight_to', entry.weight_to)
          .eq('service_type', entry.service_type)
          .maybeSingle();

        if (existing) {
          // Entry esiste: verifica se il prezzo è cambiato
          const priceChanged = Math.abs(existing.base_price - entry.base_price) > 0.01;

          if (priceChanged) {
            // Prezzo diverso: aggiorna
            const { error: updateError } = await supabaseAdmin
              .from('price_list_entries')
              .update({
                base_price: entry.base_price,
                fuel_surcharge_percent: entry.fuel_surcharge_percent || 0,
                cash_on_delivery_surcharge: entry.cash_on_delivery_surcharge || 0,
                insurance_rate_percent: entry.insurance_rate_percent || 0,
                island_surcharge: entry.island_surcharge || 0,
                ztl_surcharge: entry.ztl_surcharge || 0,
                estimated_delivery_days_min: entry.estimated_delivery_days_min,
                estimated_delivery_days_max: entry.estimated_delivery_days_max,
              })
              .eq('id', existing.id);

            if (updateError) {
              console.warn(
                `⚠️ [UPSERT] Errore aggiornamento entry ${existing.id}:`,
                updateError.message
              );
              skipped++;
            } else {
              updated++;
            }
          } else {
            // Prezzo identico: skip (evita update inutile)
            skipped++;
          }
        } else {
          // Entry non esiste: inserisci nuova
          const { error: insertError } = await supabaseAdmin
            .from('price_list_entries')
            .insert(entry);

          if (insertError) {
            // Se errore per duplicato (race condition), prova update
            if (
              insertError.code === '23505' ||
              insertError.message?.includes('duplicate') ||
              insertError.message?.includes('unique')
            ) {
              // Race condition: entry creata da altro processo, prova update
              const { data: raceExisting } = await supabaseAdmin
                .from('price_list_entries')
                .select('id')
                .eq('price_list_id', priceListId)
                .eq('zone_code', entry.zone_code || null)
                .eq('weight_from', entry.weight_from)
                .eq('weight_to', entry.weight_to)
                .eq('service_type', entry.service_type)
                .maybeSingle();

              if (raceExisting) {
                await supabaseAdmin
                  .from('price_list_entries')
                  .update({
                    base_price: entry.base_price,
                    fuel_surcharge_percent: entry.fuel_surcharge_percent || 0,
                    cash_on_delivery_surcharge: entry.cash_on_delivery_surcharge || 0,
                    insurance_rate_percent: entry.insurance_rate_percent || 0,
                  })
                  .eq('id', raceExisting.id);
                updated++;
              } else {
                console.warn(
                  `⚠️ [UPSERT] Errore insert e update fallito per entry:`,
                  insertError.message
                );
                skipped++;
              }
            } else {
              console.warn(`⚠️ [UPSERT] Errore insert entry:`, insertError.message);
              skipped++;
            }
          } else {
            inserted++;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [UPSERT] Errore processamento entry:`, err.message);
        skipped++;
      }
    }
  }

  return { inserted, updated, skipped };
}

/**
 * Calcola prezzo per spedizione
 */
export async function calculatePrice(
  courierId: string,
  weight: number,
  destinationZip: string,
  serviceType: string = 'standard',
  options?: {
    declaredValue?: number;
    cashOnDelivery?: boolean;
    insurance?: boolean;
  }
): Promise<{
  basePrice: number;
  surcharges: number;
  totalCost: number;
  details: any;
} | null> {
  const priceList = await getActivePriceList(courierId);

  if (!priceList) {
    return null;
  }

  // Usa la funzione pura per calcolare il prezzo (Single Source of Truth)
  const result = calculatePriceFromList(priceList, weight, destinationZip, serviceType, options);

  if (!result) {
    return null;
  }

  // Mappa il risultato al formato atteso dalla funzione async
  return {
    basePrice: result.basePrice,
    surcharges: result.surcharges,
    totalCost: result.totalCost,
    details: result.details,
  };
}

/**
 * Aggiorna status listino
 */
export async function updatePriceListStatus(
  id: string,
  status: 'draft' | 'active' | 'archived'
): Promise<void> {
  const { error } = await supabase.from('price_lists').update({ status }).eq('id', id);

  if (error) {
    console.error('Error updating price list status:', error);
    throw new Error(`Errore aggiornamento status listino: ${error.message}`);
  }
}

/**
 * Elimina listino
 */
export async function deletePriceList(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('price_lists').delete().eq('id', id);

  if (error) {
    console.error('Error deleting price list:', error);
    throw new Error(`Errore eliminazione listino: ${error.message}`);
  }
}

/**
 * Recupera corrieri disponibili per un utente
 *
 * Basato su logica a 3 priorità (allineata con get_courier_config_for_user RPC):
 * 1. Configurazioni API personali (owner_user_id = userId)
 * 2. Configurazioni assegnate (assigned_config_id)
 * 3. Configurazioni default globali (is_default = true)
 *
 * ⚠️ IMPORTANTE: Include TUTTE le configurazioni valide (personali + assegnate + default)
 * per mostrare TUTTI i contratti disponibili. Le config personali/assegnate hanno priorità
 * nella deduplicazione (se stesso corriere da più config, mantiene il primo trovato).
 *
 * FIX: Risolve bug dove configurazioni default non venivano incluse se utente aveva
 * configurazioni personali, causando perdita di contratti disponibili.
 *
 * @param userId - ID utente
 * @returns Array di oggetti { courierId: string, courierName: string, providerId: string, contractCode: string }
 */
export async function getAvailableCouriersForUser(userId: string): Promise<
  Array<{
    courierId: string;
    courierName: string;
    displayName: string; // ✨ Nome formattato per UI (es. "GLS 5000")
    providerId: string;
    contractCode: string;
    carrierCode: string; // ✨ Carrier code unico (chiave)
    configId: string; // ✨ ID configurazione API
  }>
> {
  try {
    // ⚠️ SICUREZZA: Valida userId prima di usarlo nelle query
    assertValidUserId(userId);

    // 1+2. Recupera user info E configurazioni in PARALLELO (Performance: ~60ms → ~20ms)
    const [userResult, personalResult, defaultResult] = await Promise.all([
      supabaseAdmin.from('users').select('assigned_config_id').eq('id', userId).maybeSingle(),
      supabaseAdmin
        .from('courier_configs')
        .select('id, provider_id, contract_mapping')
        .eq('owner_user_id', userId)
        .eq('is_active', true),
      supabaseAdmin
        .from('courier_configs')
        .select('id, provider_id, contract_mapping')
        .eq('is_default', true)
        .eq('is_active', true)
        .is('owner_user_id', null),
    ]);

    const user = userResult.data;
    const assignedConfigId = user?.assigned_config_id;
    const personalConfigs = personalResult.data;
    if (personalResult.error) {
      console.error('Errore recupero configurazioni personali:', personalResult.error);
    }
    const defaultConfigs = !defaultResult.error && defaultResult.data ? defaultResult.data : [];

    // Priorità 2: Configurazione assegnata (se presente) — dipende da user query
    let assignedConfigs: any[] = [];
    if (assignedConfigId) {
      const { data: assignedConfig, error: assignedError } = await supabaseAdmin
        .from('courier_configs')
        .select('id, provider_id, contract_mapping')
        .eq('id', assignedConfigId)
        .eq('is_active', true)
        .maybeSingle();

      if (!assignedError && assignedConfig) {
        assignedConfigs = [assignedConfig];
      }
    }

    // 3. Unisci tutte le configurazioni (priorità: personali > assegnate > default)
    const allConfigs = [...(personalConfigs || []), ...assignedConfigs, ...defaultConfigs];

    if (allConfigs.length === 0) {
      return [];
    }

    // 4. Estrai corrieri da contract_mapping di TUTTE le configurazioni
    // ✨ SCHEMA CORRETTO:
    // - Le CHIAVI di contract_mapping sono i contract_code COMPLETI e UNIVOCI (es. "gls-GLS-5000")
    // - I VALORI sono i nomi corriere per l'API (es. "Gls")
    // - Ogni contract_code è UNICO e deve essere mostrato separatamente
    // - Il matching con price_lists.metadata.contract_code deve essere ESATTO (stesso contract_code)

    // Mapping per normalizzare il nome base del corriere
    const COURIER_BASE_NAMES: Record<string, string> = {
      gls: 'GLS',
      postedeliverybusiness: 'Poste Italiane',
      poste: 'Poste Italiane',
      bartolini: 'Bartolini',
      brt: 'Bartolini',
      sda: 'SDA',
      dhl: 'DHL',
      tnt: 'TNT',
      ups: 'UPS',
      fedex: 'FedEx',
      interno: 'Interno',
    };

    // Ottiene il nome base del corriere (es. "Gls" → "GLS")
    const getBaseCourierName = (courierName: string): string => {
      const normalized = courierName.toLowerCase().trim().replace(/\s+/g, '');
      if (COURIER_BASE_NAMES[normalized]) {
        return COURIER_BASE_NAMES[normalized];
      }
      // Match parziale
      for (const [key, baseName] of Object.entries(COURIER_BASE_NAMES)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return baseName;
        }
      }
      return courierName; // Fallback al nome originale
    };

    // Formatta il carrier_code per display (es. "gls-GLS-5000" → "5000")
    const formatCarrierCodeForDisplay = (carrierCode: string, baseCourierName: string): string => {
      // Rimuovi il prefisso del corriere (es. "gls-", "postedeliverybusiness-")
      let formatted = carrierCode
        .replace(/^gls-/i, '')
        .replace(/^postedeliverybusiness-/i, '')
        .replace(/^brt-/i, '')
        .replace(/^sda-/i, '')
        .replace(/^dhl-/i, '')
        .replace(/^ups-/i, '')
        .replace(/^tnt-/i, '')
        .replace(/^fedex-/i, '')
        .replace(/^interno-/i, '');

      // Rimuovi prefissi ripetuti del nome corriere (es. "GLS-5000" → "5000")
      formatted = formatted
        .replace(/^GLS-/i, '')
        .replace(/^Poste-/i, '')
        .replace(/^SDA-/i, '')
        .replace(/^UPS-/i, '');

      // Sostituisci --- con spazi e formatta
      formatted = formatted
        .replace(/---/g, ' ')
        .replace(/--/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Se rimane vuoto o è solo il nome del corriere, usa "Standard"
      if (!formatted || formatted.toLowerCase() === baseCourierName.toLowerCase()) {
        return '';
      }

      return formatted;
    };

    // ✨ CHIAVE UNICA: carrier_code (ogni tariffa è separata)
    const couriersMap = new Map<
      string,
      { courierName: string; providerId: string; carrierCode: string; configId: string }
    >();

    for (const config of allConfigs) {
      const contractMapping = (config.contract_mapping as Record<string, string>) || {};
      const providerId = config.provider_id;
      const configId = config.id;

      // ✨ CORRETTO: La CHIAVE è il contract_code completo e univoco (es. "gls-GLS-5000")
      // Il VALORE è il nome corriere per l'API (es. "Gls")
      for (const [contractCodeKey, courierName] of Object.entries(contractMapping)) {
        // ✨ CHIAVE UNICA: contract_code completo (NON displayName!)
        // Ogni contract_code rappresenta una tariffa diversa e deve essere mostrato separatamente
        // Questo contract_code deve matchare ESATTAMENTE con price_lists.metadata.contract_code
        const mapKey = contractCodeKey;

        // Se non esiste già, aggiungi. Se esiste, mantieni il primo (priorità personali > assegnate > default)
        if (!couriersMap.has(mapKey)) {
          couriersMap.set(mapKey, {
            courierName,
            providerId,
            carrierCode: contractCodeKey, // ✨ La chiave è il contract_code completo
            configId,
          });
        }
      }
    }

    // 5. Batch lookup courier IDs (Performance: N queries → 1 query)
    const uniqueCourierNames = [
      ...new Set(Array.from(couriersMap.values()).map((d) => d.courierName)),
    ];
    const { data: allCouriers } = await supabaseAdmin.from('couriers').select('id, name');

    // Build a lookup map for courier name → id
    const courierIdMap = new Map<string, string>();
    if (allCouriers) {
      for (const courier of allCouriers) {
        for (const name of uniqueCourierNames) {
          if (
            courier.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(courier.name.toLowerCase())
          ) {
            courierIdMap.set(name, courier.id);
            break;
          }
        }
      }
    }

    // 6. Converti in array con displayName formattato
    const result = [];
    for (const [, data] of Array.from(couriersMap.entries())) {
      const baseName = getBaseCourierName(data.courierName);
      const carrierSuffix = formatCarrierCodeForDisplay(data.carrierCode, baseName);

      // DisplayName = "Corriere" o "Corriere - Suffisso" (es. "GLS 5000", "Poste Italiane SDA Express H24+")
      const displayName = carrierSuffix ? `${baseName} ${carrierSuffix}` : baseName;

      result.push({
        courierId: courierIdMap.get(data.courierName) || data.courierName,
        courierName: data.courierName, // Nome interno per matching API
        displayName, // ✨ Nome formattato per UI (es. "GLS 5000")
        providerId: data.providerId,
        contractCode: data.carrierCode, // ✨ CORRETTO: contract_code completo e univoco (chiave di contract_mapping)
        carrierCode: data.carrierCode, // ✨ Alias per retrocompatibilità (stesso valore di contractCode)
        configId: data.configId, // ✨ ID configurazione API
      });
    }

    console.log(
      `✅ [getAvailableCouriersForUser] Contract codes disponibili: ${result.length} (TUTTI, senza deduplicazione)`
    );
    console.log(`   Contract codes: ${result.map((r) => r.contractCode).join(', ')}`);
    return result;
  } catch (error: any) {
    console.error('Errore getAvailableCouriersForUser:', error);
    return [];
  }
}
