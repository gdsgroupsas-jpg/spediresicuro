import { supabaseAdmin } from '@/lib/db/client';
import { testSpedisciOnlineRatesImpl } from './spedisci-online-rates-test.impl';
import type {
  SpedisciOnlineRate,
  SyncMode,
  SyncPriceListsOptions,
  SyncScanCollectResult,
  SyncZone,
} from './spedisci-online-rates.types';

export async function collectSyncRatesForPriceLists(params: {
  options?: SyncPriceListsOptions;
  userId: string;
}): Promise<SyncScanCollectResult> {
  const options = params.options;

  const { getZonesForMode, getWeightsForMode, estimateSyncCalls } =
    await import('@/lib/constants/pricing-matrix');

  const allRates: SpedisciOnlineRate[] = [];
  const processedCombinations = new Set<string>();
  const processedZonesByCarrier: Record<string, Set<string>> = {};

  const mode: SyncMode = options?.mode ?? 'balanced';

  let zones = getZonesForMode(mode) as SyncZone[];
  const weightsToProbe = getWeightsForMode(mode);

  if (options?.targetZones && options.targetZones.length > 0) {
    console.log(`[SYNC] Filtering zones based on targetZones: ${options.targetZones.join(', ')}`);
    zones = zones.filter((z) => options.targetZones!.includes(z.code));

    if (zones.length === 0) {
      return {
        earlyResult: {
          success: true,
          error: 'Nessuna zona trovata per i codici richiesti',
        },
      };
    }
  }

  const estimate = estimateSyncCalls(mode);
  console.log(
    `?? Starting Price List Sync (${mode}): ${zones.length} Zones (filtered) x ${weightsToProbe.length} Weights`
  );

  let shouldSkipSync = false;
  if (!options?.overwriteExisting && options?.configId) {
    const { data: recentPriceLists } = await supabaseAdmin
      .from('price_lists')
      .select('id, updated_at, metadata, source_metadata')
      .eq('created_by', params.userId)
      .eq('list_type', 'supplier')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (recentPriceLists) {
      const matchingList = recentPriceLists.find((pl: any) => {
        const metadata = pl.metadata || pl.source_metadata || {};
        return metadata.courier_config_id === options.configId;
      });

      if (matchingList) {
        const lastSync = new Date(matchingList.updated_at);
        const daysSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceSync < 7) {
          console.log(
            `[CACHE] Skip sync: listino sincronizzato ${Math.round(daysSinceSync)} giorni fa (< 7 giorni)`
          );
          shouldSkipSync = true;
        }
      }
    }
  }

  if (shouldSkipSync && !options?.overwriteExisting) {
    console.log(`[CACHE] Skip sync completo: listino recente e overwriteExisting=false`);
    return {
      earlyResult: {
        success: true,
        priceListsCreated: 0,
        priceListsUpdated: 0,
        entriesAdded: 0,
        details: {
          ratesProcessed: 0,
          carriersProcessed: [],
        },
      },
    };
  }

  if (shouldSkipSync && options?.overwriteExisting) {
    console.log(`[CACHE] Cache bypassata: overwriteExisting=true, procedo con sync completa`);
  }

  const existingCombinations = new Set<string>();
  if (!options?.overwriteExisting && options?.configId) {
    const { data: priceListsForConfig } = await supabaseAdmin
      .from('price_lists')
      .select('id, metadata, source_metadata')
      .eq('created_by', params.userId)
      .eq('list_type', 'supplier')
      .limit(100);

    if (priceListsForConfig) {
      const matchingPriceListIds = priceListsForConfig
        .filter((pl: any) => {
          const metadata = pl.metadata || pl.source_metadata || {};
          return metadata.courier_config_id === options.configId;
        })
        .map((pl: any) => pl.id);

      if (matchingPriceListIds.length > 0) {
        const { data: existingEntries } = await supabaseAdmin
          .from('price_list_entries')
          .select('zone_code, weight_from, weight_to')
          .in('price_list_id', matchingPriceListIds);

        if (existingEntries) {
          for (const entry of existingEntries) {
            const weightKey = `${entry.weight_from}-${entry.weight_to}`;
            existingCombinations.add(`${entry.zone_code}_${weightKey}`);
          }
          console.log(`[INCREMENTALE] Trovate ${existingCombinations.size} combinazioni esistenti`);
        }
      }
    }
  }

  const combinations: Array<{ zone: SyncZone; weight: number }> = [];
  for (const zone of zones) {
    for (const weight of weightsToProbe) {
      const combinationKey = `${zone.code}_${weight}`;

      if (!options?.overwriteExisting) {
        const exists = Array.from(existingCombinations).some((key) => {
          const [entryZone, weightRange] = key.split('_');
          if (entryZone !== zone.code) return false;
          const [from, to] = weightRange.split('-').map(Number);
          return weight >= from && weight <= to;
        });

        if (exists || processedCombinations.has(combinationKey)) {
          console.log(`[INCREMENTALE] Skip ${zone.code}/${weight}kg: già presente`);
          continue;
        }
      }

      processedCombinations.add(combinationKey);
      combinations.push({ zone, weight });
    }
  }

  console.log(
    `[PARALLEL] Processando ${combinations.length} combinazioni (${combinations.length} nuove, ${estimate.totalCalls - combinations.length} già presenti)`
  );

  if (combinations.length === 0) {
    console.log(`? [SYNC] Nessuna combinazione nuova da sincronizzare (tutte già presenti)`);
    return {
      earlyResult: {
        success: true,
        priceListsCreated: 0,
        priceListsUpdated: 0,
        entriesAdded: 0,
        details: {
          ratesProcessed: 0,
          carriersProcessed: [],
        },
      },
    };
  }

  const batchSize = mode === 'matrix' ? 3 : mode === 'balanced' ? 4 : 5;
  const delayBetweenBatches = mode === 'matrix' ? 200 : mode === 'balanced' ? 100 : 50;

  for (let i = 0; i < combinations.length; i += batchSize) {
    const batch = combinations.slice(i, i + batchSize);

    const batchPromises = batch.map(async ({ zone, weight }) => {
      const currentParams = {
        packages: [{ length: 30, width: 20, height: 15, weight }],
        shipFrom: {
          name: 'Mittente Test',
          city: 'Roma',
          state: 'RM',
          postalCode: '00100',
          country: 'IT',
          street1: 'Via Roma 1',
        },
        shipTo: {
          name: 'Destinatario Test',
          street1: 'Via Test 123',
          city: zone.sampleAddress.city,
          state: zone.sampleAddress.state,
          postalCode: zone.sampleAddress.postalCode,
          country: zone.sampleAddress.country,
        },
        configId: options?.configId,
      };

      try {
        const result = await testSpedisciOnlineRatesImpl(currentParams);

        if (result.success && result.rates) {
          for (const rate of result.rates) {
            (rate as any)._probe_weight = weight;
            (rate as any)._probe_zone = zone.code;
            allRates.push(rate as SpedisciOnlineRate);

            const carrierCode = (rate as any).carrierCode;
            if (carrierCode) {
              if (!processedZonesByCarrier[carrierCode]) {
                processedZonesByCarrier[carrierCode] = new Set();
              }
              processedZonesByCarrier[carrierCode].add(zone.code);
            }
          }

          return { success: true, zone: zone.code, weight };
        }

        return {
          success: false,
          zone: zone.code,
          weight,
          error: result.error,
        };
      } catch (error: any) {
        console.error(`? [BATCH] Errore ${zone.code}/${weight}kg:`, error.message);
        return {
          success: false,
          zone: zone.code,
          weight,
          error: error.message,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const successCount = batchResults.filter((r) => r.success).length;
    console.log(
      `? [BATCH ${Math.floor(i / batchSize) + 1}] Completato: ${successCount}/${batch.length} successi`
    );

    if (i + batchSize < combinations.length) {
      await new Promise((r) => setTimeout(r, delayBetweenBatches));
    }
  }

  if (allRates.length === 0) {
    return {
      earlyResult: {
        success: false,
        error: 'Nessun rate ottenuto durante il Matrix Scan. Verifica credenziali.',
      },
    };
  }

  const rates = allRates;
  const carriersProcessed = [...new Set(rates.map((r) => r.carrierCode))];
  const probedWeightsSorted = [...weightsToProbe].sort((a, b) => a - b);

  return {
    scanOutput: {
      rates,
      carriersProcessed,
      weightsToProbe,
      zones,
      mode,
      probedWeightsSorted,
    },
  };
}
