/**
 * Server Action: Sincronizzazione Incrementale Entries Listino
 *
 * ✨ FASE 4: Sincronizza solo zone mancanti con atomic commit per zona
 * - Trova zone mancanti nel listino
 * - Sincronizza solo quelle zone
 * - Atomic commit per zona (transaction)
 * - Automatic rollback on error
 * - Report zones processed/failed
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { testSpedisciOnlineRates } from './spedisci-online-rates';
import { PRICING_MATRIX, getZonesForMode, getWeightsForMode } from '@/lib/constants/pricing-matrix';
import { getSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online';
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';

interface SyncIncrementalEntriesOptions {
  priceListId: string;
  targetZones?: string[]; // Zone specifiche da sincronizzare (se non fornite, trova automaticamente quelle mancanti)
  mode?: 'fast' | 'balanced' | 'matrix';
  configId?: string; // Configurazione API da usare
}

interface ZoneSyncResult {
  zone: string;
  zoneName: string;
  success: boolean;
  entriesAdded: number;
  error?: string;
}

export async function syncIncrementalPriceListEntries(
  options: SyncIncrementalEntriesOptions
): Promise<{
  success: boolean;
  zonesProcessed: number;
  zonesSucceeded: number;
  zonesFailed: number;
  totalEntriesAdded: number;
  results: ZoneSyncResult[];
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return {
        success: false,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Non autenticato',
      };
    }

    // Recupera utente
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return {
        success: false,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Utente non trovato',
      };
    }

    // Verifica permessi
    const isAdmin = user.account_type === 'admin' || user.account_type === 'superadmin';
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === 'byoc';

    if (!isAdmin && !isReseller && !isBYOC) {
      return {
        success: false,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Solo admin, reseller e BYOC possono sincronizzare listini',
      };
    }

    // Recupera listino
    const { data: priceList, error: listError } = await supabaseAdmin
      .from('price_lists')
      .select('id, name, metadata, source_metadata, courier_id')
      .eq('id', options.priceListId)
      .single();

    if (listError || !priceList) {
      return {
        success: false,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Listino non trovato',
      };
    }

    // Estrai metadata
    const metadata = (priceList.metadata || priceList.source_metadata || {}) as any;
    const configId = options.configId || metadata.courier_config_id;
    const carrierCode = metadata.carrier_code;
    const contractCode = metadata.contract_code;

    if (!configId || !carrierCode || !contractCode) {
      return {
        success: false,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Listino non ha metadata completi (configId, carrierCode, contractCode)',
      };
    }

    // Recupera credenziali API
    const credentialsResult = await getSpedisciOnlineCredentials(configId);
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return {
        success: false,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Credenziali API non configurate',
      };
    }

    const credentials = credentialsResult.credentials;
    const adapter = new SpedisciOnlineAdapter({
      api_key: credentials.api_key,
      api_secret: credentials.api_secret,
      base_url: credentials.base_url || 'https://api.spedisci.online/api/v2',
      contract_mapping: credentials.contract_mapping || {},
    });

    // Determina zone da sincronizzare
    let zonesToSync: typeof PRICING_MATRIX.ZONES;

    if (options.targetZones && options.targetZones.length > 0) {
      // Zone specifiche richieste
      zonesToSync = PRICING_MATRIX.ZONES.filter((z) => options.targetZones!.includes(z.code));
    } else {
      // Trova zone mancanti
      const { data: existingEntries } = await supabaseAdmin
        .from('price_list_entries')
        .select('zone_code')
        .eq('price_list_id', options.priceListId);

      const existingZones = new Set(
        (existingEntries || []).map((e) => e.zone_code).filter((z) => z)
      );

      const mode = options.mode || 'balanced';
      const allZones = getZonesForMode(mode);
      zonesToSync = allZones.filter((z) => !existingZones.has(z.code));
    }

    if (zonesToSync.length === 0) {
      return {
        success: true,
        zonesProcessed: 0,
        zonesSucceeded: 0,
        zonesFailed: 0,
        totalEntriesAdded: 0,
        results: [],
        error: 'Nessuna zona da sincronizzare',
      };
    }

    // Pesi da testare
    const mode = options.mode || 'balanced';
    const weightsToProbe = getWeightsForMode(mode);

    // Sincronizza ogni zona atomicamente
    const results: ZoneSyncResult[] = [];
    let totalEntriesAdded = 0;

    for (const zone of zonesToSync) {
      const zoneResult: ZoneSyncResult = {
        zone: zone.code,
        zoneName: zone.name,
        success: false,
        entriesAdded: 0,
      };

      try {
        // ✨ ATOMIC TRANSACTION: Inizia transaction per questa zona
        // Nota: Supabase non supporta transazioni esplicite, quindi usiamo un pattern
        // di "all or nothing" inserendo tutte le entries in un'unica operazione

        const zoneEntries: any[] = [];

        // Prova ogni peso per questa zona
        for (const weight of weightsToProbe) {
          const testAddress = zone.sampleAddress || {
            city: 'Milano',
            state: 'MI',
            postalCode: '20100',
            country: 'IT',
          };

          try {
            const apiResult = await adapter.getRates({
              packages: [
                {
                  length: 30,
                  width: 20,
                  height: 15,
                  weight: weight,
                },
              ],
              shipFrom: {
                name: 'Mittente Test',
                company: 'Azienda Test',
                street1: 'Via Roma 1',
                city: 'Roma',
                state: 'RM',
                postalCode: '00100',
                country: 'IT',
                email: 'test@example.com',
              },
              shipTo: {
                name: 'Destinatario Test',
                street1: 'Via Test 1',
                city: testAddress.city,
                state: testAddress.state,
                postalCode: testAddress.postalCode,
                country: testAddress.country,
                email: 'test@example.com',
              },
              notes: `Incremental sync: ${zone.code}`,
              insuranceValue: 0,
              codValue: 0,
              accessoriServices: [],
            });

            if (apiResult.success && apiResult.rates) {
              // Cerca rate che matcha carrierCode e contractCode
              const matchingRate = apiResult.rates.find((rate: any) => {
                const rateCarrierCode = rate.carrierCode?.toLowerCase();
                const rateContractCode = rate.contractCode?.toLowerCase();
                return (
                  rateCarrierCode === carrierCode.toLowerCase() &&
                  rateContractCode?.includes(contractCode.toLowerCase())
                );
              });

              if (matchingRate && matchingRate.total_price) {
                const basePrice = parseFloat(matchingRate.total_price) || 0;
                const fuelSurcharge = parseFloat(matchingRate.fuel) || 0;

                // Calcola weight_from (peso precedente o 0)
                const weightFrom =
                  weightsToProbe.indexOf(weight) > 0
                    ? weightsToProbe[weightsToProbe.indexOf(weight) - 1]
                    : 0;

                zoneEntries.push({
                  price_list_id: options.priceListId,
                  zone_code: zone.code,
                  weight_from: weightFrom,
                  weight_to: weight,
                  base_price: basePrice,
                  service_type: 'standard',
                  fuel_surcharge_percent: fuelSurcharge,
                  cash_on_delivery_surcharge: 0,
                  insurance_rate_percent: 0,
                  island_surcharge: 0,
                  ztl_surcharge: 0,
                });
              }
            }
          } catch (rateError: any) {
            console.error(`Errore rate per zona ${zone.code}, peso ${weight}:`, rateError);
            // Continua con il prossimo peso
          }
        }

        // ✨ ATOMIC COMMIT: Inserisci tutte le entries di questa zona in una volta
        if (zoneEntries.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('price_list_entries')
            .insert(zoneEntries);

          if (insertError) {
            // ✨ AUTOMATIC ROLLBACK: Se errore, tutte le entries di questa zona vengono rifiutate
            zoneResult.error = insertError.message;
            console.error(`Errore inserimento entries per zona ${zone.code}:`, insertError);
          } else {
            zoneResult.success = true;
            zoneResult.entriesAdded = zoneEntries.length;
            totalEntriesAdded += zoneEntries.length;
          }
        } else {
          zoneResult.error = "Nessuna entry ottenuta dall'API per questa zona";
        }
      } catch (error: any) {
        zoneResult.error = error.message || 'Errore sconosciuto';
        console.error(`Errore sincronizzazione zona ${zone.code}:`, error);
      }

      results.push(zoneResult);
    }

    const zonesSucceeded = results.filter((r) => r.success).length;
    const zonesFailed = results.filter((r) => !r.success).length;

    return {
      success: zonesFailed === 0, // Success se tutte le zone sono state sincronizzate
      zonesProcessed: results.length,
      zonesSucceeded,
      zonesFailed,
      totalEntriesAdded,
      results,
    };
  } catch (error: any) {
    console.error('Errore syncIncrementalPriceListEntries:', error);
    return {
      success: false,
      zonesProcessed: 0,
      zonesSucceeded: 0,
      zonesFailed: 0,
      totalEntriesAdded: 0,
      results: [],
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Recupera le zone esistenti per un listino
 *
 * ⚠️ SERVER ACTION: Sostituisce query diretta a Supabase dal client
 * per evitare errori 401 (supabase client non autenticato)
 *
 * @param priceListId - ID del listino
 * @returns Set di zone_code esistenti
 */
export async function getExistingZonesForPriceListAction(priceListId: string): Promise<{
  success: boolean;
  zones?: string[];
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: existingEntries, error } = await supabaseAdmin
      .from('price_list_entries')
      .select('zone_code')
      .eq('price_list_id', priceListId);

    if (error) {
      console.error('Errore recupero zone esistenti:', error);
      return { success: false, error: error.message };
    }

    const zones = (existingEntries || [])
      .map((e) => e.zone_code)
      .filter((z): z is string => z !== null && z !== undefined);

    return { success: true, zones };
  } catch (error: any) {
    console.error('Errore getExistingZonesForPriceListAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
