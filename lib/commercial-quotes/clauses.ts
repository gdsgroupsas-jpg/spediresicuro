/**
 * Clausole standard per preventivi commerciali
 *
 * Clausole obbligatorie e configurabili per i PDF preventivo.
 * Il reseller puo' aggiungere clausole custom oltre a queste.
 */

import type { QuoteClause } from '@/types/commercial-quotes';

/**
 * Ritorna le clausole standard per un preventivo commerciale.
 * Tutte le clausole sono configurate dinamicamente in base a vatMode e vatRate.
 */
export function getDefaultClauses(
  vatMode: 'included' | 'excluded',
  vatRate: number = 22,
  options?: {
    codFee?: number;
    insuranceLimit?: number;
    volumetricDivisor?: number;
    deliveryTimeDays?: string;
    deliveryTimeIslands?: string;
  }
): QuoteClause[] {
  const codFee = options?.codFee ?? 2.0;
  const insuranceLimit = options?.insuranceLimit ?? 100;
  const volumetricDivisor = options?.volumetricDivisor ?? 5000;
  const deliveryTimeDays = options?.deliveryTimeDays ?? '24-48h';
  const deliveryTimeIslands = options?.deliveryTimeIslands ?? '48-72h';

  const vatText =
    vatMode === 'excluded'
      ? `Prezzi IVA esclusa (${vatRate}%)`
      : `Prezzi IVA inclusa (${vatRate}%)`;

  return [
    {
      title: 'IVA',
      text: vatText,
      type: 'standard',
    },
    {
      title: 'Ritiro',
      text: 'Ritiro gratuito presso la sede del mittente',
      type: 'standard',
    },
    {
      title: 'Tempi di consegna',
      text: `Tempi di consegna: ${deliveryTimeDays} per Italia, ${deliveryTimeIslands} per isole`,
      type: 'standard',
    },
    {
      title: 'Tracking',
      text: 'Tracking numero incluso per ogni spedizione',
      type: 'standard',
    },
    {
      title: 'Assicurazione',
      text: `Assicurazione base inclusa fino a ${insuranceLimit}\u20AC di valore dichiarato`,
      type: 'standard',
    },
    {
      title: 'Contrassegno',
      text: `Contrassegno disponibile con supplemento di ${codFee.toFixed(2)}\u20AC + IVA`,
      type: 'standard',
    },
    {
      title: 'Peso volumetrico',
      text: `Peso volumetrico: (Lunghezza \u00D7 Larghezza \u00D7 Altezza in cm) / ${volumetricDivisor}`,
      type: 'standard',
    },
    {
      title: 'Supplementi esclusi',
      text: 'Supplementi per ZTL, fermo deposito e giacenza non inclusi nel prezzo base',
      type: 'standard',
    },
  ];
}

/**
 * Unisce clausole standard con clausole custom del reseller.
 * Le custom vengono aggiunte dopo le standard.
 */
export function mergeWithCustomClauses(
  defaults: QuoteClause[],
  custom: QuoteClause[]
): QuoteClause[] {
  return [...defaults, ...custom];
}
