import { supabaseAdmin } from '@/lib/db/client';
import { createPriceList } from '@/lib/db/price-lists';
import type { CreatePriceListInput } from '@/types/listini';
import { syncEntriesForCarrierGroup } from './spedisci-online-rates-sync.entries.impl';
import type {
  SpedisciOnlineRate,
  SyncMode,
  SyncPriceListsOptions,
  SyncZone,
} from './spedisci-online-rates.types';

export async function syncGroupedRatesToPriceLists(params: {
  ratesByCarrierAndContract: Record<string, SpedisciOnlineRate[]>;
  options?: SyncPriceListsOptions;
  userId: string;
  workspaceId: string;
  wq: any;
  zones: SyncZone[];
  mode: SyncMode;
  weightsToProbe: number[];
  probedWeightsSorted: number[];
}): Promise<{
  priceListsCreated: number;
  priceListsUpdated: number;
  entriesAdded: number;
}> {
  const {
    ratesByCarrierAndContract,
    options,
    userId,
    workspaceId,
    wq,
    zones,
    mode,
    weightsToProbe,
    probedWeightsSorted,
  } = params;

  let priceListsCreated = 0;
  let priceListsUpdated = 0;
  let entriesAdded = 0;

  let configName: string | null = null;
  if (options?.configId) {
    try {
      const { data: configData } = await supabaseAdmin
        .from('courier_configs')
        .select('name')
        .eq('id', options.configId)
        .maybeSingle();
      if (configData?.name) {
        configName = configData.name;
        console.log(
          `[SYNC] Nome configurazione trovato: "${configName}" per configId ${options.configId.substring(0, 8)}...`
        );
      }
    } catch (e) {
      console.warn(`[SYNC] Errore recupero nome configurazione:`, e);
    }
  }

  let couriers: Array<{
    id: string;
    code: string | null;
    name: string | null;
  }> | null = null;
  try {
    const { data, error } = await supabaseAdmin.from('couriers').select('id, code, name');

    if (!error && data) {
      couriers = data;
    }
  } catch {
    console.log('?? Tabella couriers non accessibile, proseguo senza matching corrieri');
  }

  const courierMap = new Map<string, { id: string; code: string | null; name: string | null }>();
  if (couriers) {
    couriers.forEach((c) => {
      if (c.code) {
        courierMap.set(c.code.toLowerCase(), c);
      }
      if (c.name) {
        const normalizedName = c.name.toLowerCase().replace(/\s+/g, '');
        courierMap.set(normalizedName, c);
      }
    });
  }

  const courierAliases: Record<string, string[]> = {
    postedeliverybusiness: ['poste', 'posteitaliane', 'sda'],
    poste: ['poste', 'posteitaliane'],
    sda: ['sda'],
    gls: ['gls'],
    brt: ['bartolini', 'brt'],
    bartolini: ['bartolini', 'brt'],
    dhl: ['dhl'],
    ups: ['ups'],
    fedex: ['fedex', 'fdx'],
    tnt: ['tnt'],
  };

  console.log(
    `[SYNC] Gruppi (carrierCode + contractCode) da processare: ${Object.keys(ratesByCarrierAndContract).length}`
  );
  console.log(
    `[SYNC] Dettagli ratesByCarrierAndContract:`,
    Object.keys(ratesByCarrierAndContract).map((key) => {
      const [carrierCode, contractCode] = key.split('::');
      return {
        groupKey: key,
        carrierCode,
        contractCode,
        ratesCount: ratesByCarrierAndContract[key].length,
      };
    })
  );

  let groupIndex = 0;
  const totalGroups = Object.keys(ratesByCarrierAndContract).length;

  for (const [groupKey, groupRates] of Object.entries(ratesByCarrierAndContract)) {
    groupIndex++;
    const [carrierCode, contractCode] = groupKey.split('::');
    console.log(
      `[SYNC] [${groupIndex}/${totalGroups}] Processando: ${carrierCode} / ${contractCode} (${groupRates.length} rates)`
    );

    try {
      let courierId: string | undefined = undefined;

      if (options?.courierId) {
        courierId = options.courierId;
      } else if (courierMap.size > 0) {
        const normalizedCarrierCode = carrierCode.toLowerCase().replace(/\s+/g, '');
        let courier = courierMap.get(normalizedCarrierCode);

        if (!courier) {
          const aliases = courierAliases[normalizedCarrierCode] || [];
          for (const alias of aliases) {
            courier = courierMap.get(alias.toLowerCase().replace(/\s+/g, ''));
            if (courier) break;
          }
        }

        if (courier) {
          courierId = courier.id;
        }
      }

      if (courierId) {
        console.log(`? Corriere ${carrierCode} associato a ID: ${courierId}`);
      } else {
        console.log(
          `?? Corriere ${carrierCode}: creazione listino senza courier_id (tabella couriers non disponibile o corriere non trovato)`
        );
      }

      let existingPriceList: { id: string } | null = null;

      const contractCodeForName = contractCode
        .replace(/---/g, '-')
        .replace(/--/g, '-')
        .substring(0, 50);

      if (options?.configId) {
        const { data: dataByMetadata } = await supabaseAdmin
          .from('price_lists')
          .select('id, name, metadata, source_metadata')
          .eq('created_by', userId)
          .eq('list_type', 'supplier')
          .order('created_at', { ascending: false })
          .limit(200);

        if (dataByMetadata) {
          const normalizedContractCode = contractCode
            .toLowerCase()
            .replace(/---/g, '-')
            .replace(/--/g, '-')
            .trim();

          const expectedNamePattern = `${carrierCode.toUpperCase()}_${contractCodeForName}_${
            configName || options.configId.substring(0, 8)
          }`.toLowerCase();

          const matchingList = dataByMetadata.find((pl: any) => {
            const metadata = pl.metadata || pl.source_metadata || {};
            const plNameLower = (pl.name || '').toLowerCase();

            const matchesConfigId = metadata.courier_config_id === options.configId;
            if (!matchesConfigId) return false;

            const metadataCarrierCode = metadata.carrier_code?.toLowerCase();
            const matchesCarrierCode = metadataCarrierCode
              ? metadataCarrierCode === carrierCode.toLowerCase()
              : plNameLower.startsWith(carrierCode.toLowerCase() + '_');
            if (!matchesCarrierCode) return false;

            const metadataContractCode = metadata.contract_code?.toLowerCase();
            if (metadataContractCode) {
              const normalizedMetadataContract = metadataContractCode
                .replace(/---/g, '-')
                .replace(/--/g, '-')
                .trim();
              if (normalizedMetadataContract === normalizedContractCode) {
                return true;
              }
            }

            const contractCodeParts = normalizedContractCode
              .split(/[-_]/)
              .filter((p) => p.length > 2)
              .slice(0, 3);

            const contractCodeInName =
              contractCodeParts.length >= 2
                ? contractCodeParts.filter((part) => plNameLower.includes(part)).length >= 2
                : plNameLower.includes(normalizedContractCode.substring(0, 20)) ||
                  plNameLower.includes(contractCode.toLowerCase().substring(0, 20));

            const configNameLower = (
              configName ||
              options.configId?.substring(0, 8) ||
              ''
            ).toLowerCase();
            const nameMatchesPattern =
              plNameLower.includes(configNameLower) ||
              plNameLower.includes(expectedNamePattern) ||
              plNameLower.includes(carrierCode.toLowerCase());

            if (contractCodeInName && nameMatchesPattern) {
              console.log(
                `[SYNC] Match trovato per nome: "${pl.name}" (contractCode: ${contractCode.substring(0, 30)}, config: ${configNameLower})`
              );
            }

            return contractCodeInName && nameMatchesPattern;
          });

          if (matchingList) {
            existingPriceList = { id: matchingList.id };
            console.log(
              `[SYNC] Trovato listino esistente: id=${matchingList.id.substring(0, 8)}... configId=${options.configId.substring(0, 8)}... carrier=${carrierCode} contractCode=${contractCode.substring(0, 30)}`
            );
          } else {
            console.log(
              `[SYNC] Nessun listino esistente per configId=${options.configId.substring(0, 8)}... carrier=${carrierCode} contractCode=${contractCode.substring(0, 30)} -> creo nuovo`
            );
            if (dataByMetadata.length > 0) {
              console.log(
                `[SYNC] DEBUG: Trovati ${dataByMetadata.length} listini, ma nessuno matcha. Listini trovati:`,
                dataByMetadata.slice(0, 5).map((pl: any) => ({
                  name: pl.name,
                  metadata: pl.metadata || pl.source_metadata,
                }))
              );
            }
          }
        }
      } else {
        if (courierId) {
          const { data } = await supabaseAdmin
            .from('price_lists')
            .select('id')
            .eq('courier_id', courierId)
            .eq('created_by', userId)
            .eq('list_type', 'supplier')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          existingPriceList = data;
        }

        if (!existingPriceList) {
          const { data } = await supabaseAdmin
            .from('price_lists')
            .select('id')
            .eq('created_by', userId)
            .eq('list_type', 'supplier')
            .ilike('name', `%${carrierCode}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          existingPriceList = data;
        }
      }

      const priceListName =
        options?.priceListName ||
        (configName
          ? `${carrierCode.toUpperCase()}_${contractCodeForName}_${configName}`
          : options?.configId
            ? `${carrierCode.toUpperCase()}_${contractCodeForName}_Config${options.configId.substring(0, 8)}`
            : `${carrierCode.toUpperCase()}_${contractCodeForName}_${new Date().toLocaleDateString('it-IT')}`);

      let priceListId: string;

      if (existingPriceList && !options?.overwriteExisting) {
        priceListId = existingPriceList.id;
        priceListsUpdated++;

        if (options?.configId) {
          try {
            const { data: existingList } = await supabaseAdmin
              .from('price_lists')
              .select('metadata, source_metadata')
              .eq('id', priceListId)
              .single();

            const existingMetadata = existingList?.metadata || existingList?.source_metadata || {};

            const mergedMetadata = {
              ...existingMetadata,
              carrier_code: carrierCode,
              contract_code: contractCode,
              courier_config_id: options.configId,
              synced_at: new Date().toISOString(),
            };

            await supabaseAdmin
              .from('price_lists')
              .update({
                metadata: mergedMetadata,
              })
              .eq('id', priceListId);

            console.log(
              `? [SYNC] Metadata aggiornati (MERGE): carrier_code=${carrierCode}, contract_code=${contractCode}, configId=${options.configId.substring(0, 8)}...`
            );
          } catch (err: any) {
            if (err?.code === 'PGRST204' || err?.message?.includes('metadata')) {
              const { data: existingList } = await supabaseAdmin
                .from('price_lists')
                .select('source_metadata')
                .eq('id', priceListId)
                .single();

              const existingMetadata = existingList?.source_metadata || {};

              const mergedMetadata = {
                ...existingMetadata,
                carrier_code: carrierCode,
                contract_code: contractCode,
                courier_config_id: options.configId,
                synced_at: new Date().toISOString(),
              };

              await supabaseAdmin
                .from('price_lists')
                .update({
                  source_metadata: mergedMetadata,
                })
                .eq('id', priceListId);
            } else {
              throw err;
            }
          }
        }

        await wq.from('price_list_entries').delete().eq('price_list_id', priceListId);
      } else {
        if (!existingPriceList) {
          const priceListData: CreatePriceListInput = {
            name: priceListName,
            version: '1.0',
            status: 'draft',
            courier_id: courierId || null,
            list_type: 'supplier',
            is_global: false,
            source_type: 'api',
            notes: `Corriere: ${carrierCode.toUpperCase()} | Contratto: ${contractCode} | Sincronizzato da spedisci.online il ${new Date().toISOString()}`,
          };

          console.log(
            `[SYNC] Creazione listino: ${priceListName}, courier_id=${courierId}, list_type=supplier, created_by=${userId}`
          );
          const newPriceList = await createPriceList(
            priceListData as CreatePriceListInput,
            userId,
            workspaceId
          );
          console.log(
            `? [SYNC] Listino creato con successo: id=${newPriceList.id}, name=${newPriceList.name}`
          );

          const metadataToSave = {
            carrier_code: carrierCode,
            contract_code: contractCode,
            ...(options?.configId && { courier_config_id: options.configId }),
            synced_at: new Date().toISOString(),
          };

          try {
            await supabaseAdmin
              .from('price_lists')
              .update({ metadata: metadataToSave })
              .eq('id', newPriceList.id);
            console.log(
              `? [SYNC] Metadata salvati: carrier_code=${carrierCode}, contract_code=${contractCode}, configId=${options?.configId?.substring(0, 8) || 'N/A'}`
            );
          } catch (err: any) {
            if (err?.code === 'PGRST204' || err?.message?.includes('metadata')) {
              await supabaseAdmin
                .from('price_lists')
                .update({ source_metadata: metadataToSave })
                .eq('id', newPriceList.id);
            }
          }
          priceListId = newPriceList.id;
          priceListsCreated++;
          console.log(
            `? Listino creato: ${priceListName} (id=${String(priceListId).slice(0, 8)}...)`
          );
        } else {
          priceListId = existingPriceList.id;
          priceListsUpdated++;
          console.log(
            `? [SYNC] Listino trovato dopo retry, uso esistente: id=${priceListId.substring(0, 8)}...`
          );
        }
      }

      const delta = await syncEntriesForCarrierGroup({
        groupRates,
        carrierCode,
        contractCode,
        groupIndex,
        totalGroups,
        priceListId,
        zones,
        mode,
        weightsToProbe,
        probedWeightsSorted,
        options,
        workspaceId,
      });

      entriesAdded += delta;

      console.log(
        `? [SYNC] [${groupIndex}/${totalGroups}] ${carrierCode}/${contractCode} processato con successo: listino "${priceListName}", delta entries=${delta}`
      );
    } catch (carrierError: any) {
      console.error(
        `? [SYNC] [${groupIndex}/${totalGroups}] Errore processamento ${carrierCode}/${contractCode}:`,
        carrierError.message || carrierError,
        carrierError.stack
      );
      continue;
    }
  }

  console.log(
    `[SYNC] Riepilogo finale: ${priceListsCreated} listini creati, ${priceListsUpdated} aggiornati, ${entriesAdded} entries totali su ${totalGroups} gruppi (carrierCode + contractCode)`
  );

  return {
    priceListsCreated,
    priceListsUpdated,
    entriesAdded,
  };
}
