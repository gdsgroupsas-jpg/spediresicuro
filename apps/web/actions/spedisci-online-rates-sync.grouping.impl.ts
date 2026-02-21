import type { SpedisciOnlineRate } from './spedisci-online-rates.types';

export function groupRatesByCarrierAndContract(
  rates: SpedisciOnlineRate[]
): Record<string, SpedisciOnlineRate[]> {
  const ratesByCarrierAndContract: Record<string, SpedisciOnlineRate[]> = {};

  for (const rate of rates) {
    const carrierCode = rate.carrierCode;
    const contractCode = rate.contractCode || 'default';

    if (!carrierCode) {
      console.warn(`[SYNC] Rate senza carrierCode, salto:`, JSON.stringify(rate).substring(0, 200));
      continue;
    }

    const sanitizedCarrierCode = String(carrierCode)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');

    if (!sanitizedCarrierCode || sanitizedCarrierCode !== carrierCode.toLowerCase()) {
      console.warn(
        `[SYNC] CarrierCode non valido/sanitizzato: "${carrierCode}" -> "${sanitizedCarrierCode}", salto per sicurezza`
      );
      continue;
    }

    const groupKey = `${carrierCode}::${contractCode}`;

    if (!ratesByCarrierAndContract[groupKey]) {
      ratesByCarrierAndContract[groupKey] = [];
    }
    ratesByCarrierAndContract[groupKey].push(rate);
  }

  const groupingSummary = Object.keys(ratesByCarrierAndContract).map((key) => {
    const [carrierCode, contractCode] = key.split('::');
    return {
      groupKey: key,
      carrierCode,
      contractCode,
      ratesCount: ratesByCarrierAndContract[key].length,
      sampleRate: ratesByCarrierAndContract[key][0]
        ? {
            carrierCode: ratesByCarrierAndContract[key][0].carrierCode,
            contractCode: ratesByCarrierAndContract[key][0].contractCode,
          }
        : null,
    };
  });

  console.log(
    `[SYNC] Raggruppamento rates per (carrierCode, contractCode) completato:`,
    JSON.stringify(groupingSummary, null, 2)
  );
  console.log(
    `[SYNC] Totale gruppi (listini da creare): ${Object.keys(ratesByCarrierAndContract).length}`
  );

  return ratesByCarrierAndContract;
}
