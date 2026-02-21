import { addPriceListEntries, upsertPriceListEntries } from '@/lib/db/price-lists';
import type {
  SpedisciOnlineRate,
  SyncMode,
  SyncPriceListsOptions,
  SyncZone,
} from './spedisci-online-rates.types';

export async function syncEntriesForCarrierGroup(params: {
  groupRates: SpedisciOnlineRate[];
  carrierCode: string;
  contractCode: string;
  groupIndex: number;
  totalGroups: number;
  priceListId: string;
  zones: SyncZone[];
  mode: SyncMode;
  weightsToProbe: number[];
  probedWeightsSorted: number[];
  options?: SyncPriceListsOptions;
  workspaceId: string;
}): Promise<number> {
  const {
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
  } = params;

  let entriesAddedDelta = 0;

  if (!groupRates || groupRates.length === 0) {
    console.log(
      `[SYNC] [${groupIndex}/${totalGroups}] Zero rates per ${carrierCode}/${contractCode}: creo entry vuote per tutte le zone (listino fornitore)`
    );

    const emptyEntries = zones.map((zone) => {
      const weightFrom = 0;
      const weightTo = mode === 'semi-auto' ? 1 : weightsToProbe[0] || 1;

      return {
        weight_from: weightFrom,
        weight_to: weightTo,
        zone_code: zone.code,
        base_price: 0,
        service_type: 'standard' as const,
        fuel_surcharge_percent: 0,
        cash_on_delivery_surcharge: 0,
        insurance_rate_percent: 0,
      };
    });

    try {
      if (!options?.overwriteExisting) {
        const upsertResult = await upsertPriceListEntries(priceListId, emptyEntries);
        entriesAddedDelta += upsertResult.inserted + upsertResult.updated;
        console.log(
          `? [SYNC] ${upsertResult.inserted} entry vuote inserite, ${upsertResult.updated} aggiornate per ${carrierCode}`
        );
      } else {
        await addPriceListEntries(priceListId, emptyEntries, workspaceId);
        entriesAddedDelta += emptyEntries.length;
        console.log(
          `? [SYNC] ${emptyEntries.length} entry vuote aggiunte per ${carrierCode} (overwrite mode)`
        );
      }
    } catch (err: any) {
      console.error(`? [SYNC] Errore aggiunta entry vuote per ${carrierCode}:`, err.message || err);
    }

    return entriesAddedDelta;
  }

  const seenEntries = new Set<string>();
  const uniqueRates = groupRates.filter((rate) => {
    const probeWeight = (rate as any)._probe_weight || 0;
    const probeZone = (rate as any)._probe_zone || 'IT';
    const rateContractCode = rate.contractCode || 'standard';
    const key = `${probeWeight}-${probeZone}-${rateContractCode}`;
    if (seenEntries.has(key)) {
      return false;
    }
    seenEntries.add(key);
    return true;
  });

  console.log(
    `[SYNC] ${groupRates.length} rates totali, ${uniqueRates.length} unici per ${carrierCode}/${contractCode}`
  );

  const entries = uniqueRates.map((rate) => {
    if (rate.carrierCode !== carrierCode) {
      console.error(
        `? [SYNC] MISMATCH: Rate con carrierCode=${rate.carrierCode} trovato in gruppo ${carrierCode}!`,
        {
          rateCarrierCode: rate.carrierCode,
          expectedCarrierCode: carrierCode,
          contractCode: rate.contractCode,
        }
      );
    }

    const basePrice = Math.max(0, parseFloat(rate.weight_price) || 0);
    const insurancePrice = Math.max(0, parseFloat(rate.insurance_price) || 0);
    const codPrice = Math.max(0, parseFloat(rate.cod_price) || 0);
    const fuelPrice = Math.max(0, parseFloat(rate.fuel) || 0);

    const fuelSurchargePercent = Math.min(100, basePrice > 0 ? (fuelPrice / basePrice) * 100 : 0);

    const insuranceRatePercent = Math.min(
      100,
      basePrice > 0 ? (insurancePrice / basePrice) * 100 : 0
    );

    const contractCodeLower = (rate.contractCode || '').toLowerCase();
    let serviceType: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day' = 'standard';

    if (contractCodeLower.includes('express') || contractCodeLower.includes('rapid')) {
      serviceType = 'express';
    } else if (contractCodeLower.includes('economy') || contractCodeLower.includes('economico')) {
      serviceType = 'economy';
    } else if (
      contractCodeLower.includes('same_day') ||
      contractCodeLower.includes('stesso_giorno')
    ) {
      serviceType = 'same_day';
    } else if (
      contractCodeLower.includes('next_day') ||
      contractCodeLower.includes('giorno_successivo')
    ) {
      serviceType = 'next_day';
    }

    const validatedBasePrice = Math.min(99999999.99, Math.max(0, basePrice));
    const validatedCodPrice = Math.min(99999999.99, Math.max(0, codPrice));
    const validatedFuelPercent = Math.min(999.99, Math.max(0, fuelSurchargePercent));
    const validatedInsurancePercent = Math.min(999.99, Math.max(0, insuranceRatePercent));

    const probeWeight = (rate as any)._probe_weight;
    const probeZone = (rate as any)._probe_zone || 'IT';

    if (!probeWeight || probeWeight === 999.999) {
      console.warn(`[SYNC] Rate senza _probe_weight valido, uso fallback: ${JSON.stringify(rate)}`);
      return {
        weight_from: 0,
        weight_to: probedWeightsSorted[0] || 1,
        zone_code: probeZone,
        base_price: validatedBasePrice,
        service_type: serviceType,
        fuel_surcharge_percent: validatedFuelPercent,
        cash_on_delivery_surcharge: validatedCodPrice,
        insurance_rate_percent: validatedInsurancePercent,
      };
    }

    const currentIndex = probedWeightsSorted.indexOf(probeWeight);
    if (currentIndex === -1) {
      console.warn(
        `[SYNC] probeWeight ${probeWeight} non trovato in probedWeightsSorted, uso fallback`
      );
      const closestWeight = probedWeightsSorted.reduce((prev, curr) =>
        Math.abs(curr - probeWeight) < Math.abs(prev - probeWeight) ? curr : prev
      );
      const closestIndex = probedWeightsSorted.indexOf(closestWeight);
      const weightFrom = closestIndex > 0 ? probedWeightsSorted[closestIndex - 1] : 0;
      return {
        weight_from: weightFrom,
        weight_to: closestWeight,
        zone_code: probeZone,
        base_price: validatedBasePrice,
        service_type: serviceType,
        fuel_surcharge_percent: validatedFuelPercent,
        cash_on_delivery_surcharge: validatedCodPrice,
        insurance_rate_percent: validatedInsurancePercent,
      };
    }

    const weightFrom = currentIndex > 0 ? probedWeightsSorted[currentIndex - 1] : 0;

    return {
      weight_from: weightFrom,
      weight_to: probeWeight,
      zone_code: probeZone,
      base_price: validatedBasePrice,
      service_type: serviceType,
      fuel_surcharge_percent: validatedFuelPercent,
      cash_on_delivery_surcharge: validatedCodPrice,
      insurance_rate_percent: validatedInsurancePercent,
    };
  });

  console.log(
    `[SYNC] Aggiungo ${entries.length} entries al listino ${priceListId.substring(0, 8)}...`
  );

  const zonesWithEntries = new Set(entries.map((e) => e.zone_code).filter((z) => z));
  const missingZones = zones.filter((z) => !zonesWithEntries.has(z.code));

  if (missingZones.length > 0) {
    console.log(
      `[SYNC] Listino fornitore: creo ${missingZones.length} entry vuote per zone mancanti: ${missingZones
        .map((z) => z.code)
        .join(', ')}`
    );

    const emptyEntriesForMissingZones = missingZones.map((zone) => {
      const weightFrom = 0;
      const weightTo = mode === 'semi-auto' ? 1 : weightsToProbe[0] || 1;

      return {
        weight_from: weightFrom,
        weight_to: weightTo,
        zone_code: zone.code,
        base_price: 0,
        service_type: 'standard' as const,
        fuel_surcharge_percent: 0,
        cash_on_delivery_surcharge: 0,
        insurance_rate_percent: 0,
      };
    });

    entries.push(...emptyEntriesForMissingZones);
  }

  try {
    if (!options?.overwriteExisting) {
      const upsertResult = await upsertPriceListEntries(priceListId, entries);
      entriesAddedDelta += upsertResult.inserted + upsertResult.updated;
      console.log(
        `? [SYNC] ${upsertResult.inserted} inserite, ${upsertResult.updated} aggiornate, ${upsertResult.skipped} saltate per ${carrierCode}`
      );
    } else {
      await addPriceListEntries(priceListId, entries, workspaceId);
      entriesAddedDelta += entries.length;
      console.log(
        `? [SYNC] ${entries.length} entries aggiunte con successo per ${carrierCode} (overwrite mode)`
      );
    }
  } catch (err: any) {
    console.error(`? [SYNC] Errore aggiunta entries per ${carrierCode}:`, err.message || err);
  }

  return entriesAddedDelta;
}
