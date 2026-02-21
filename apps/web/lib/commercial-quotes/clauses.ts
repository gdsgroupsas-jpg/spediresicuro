/**
 * Clausole standard per preventivi commerciali
 *
 * Clausole obbligatorie e configurabili per i PDF preventivo.
 * Il reseller puo' aggiungere clausole custom oltre a queste.
 */

import type { QuoteClause, DeliveryMode } from '@/types/commercial-quotes';

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
    deliveryMode?: DeliveryMode;
    pickupFee?: number | null;
    goodsNeedsProcessing?: boolean;
    processingFee?: number | null;
  }
): QuoteClause[] {
  const codFee = options?.codFee ?? 2.0;
  const insuranceLimit = options?.insuranceLimit ?? 100;
  const volumetricDivisor = options?.volumetricDivisor ?? 5000;
  const deliveryTimeDays = options?.deliveryTimeDays ?? '24-48h';
  const deliveryTimeIslands = options?.deliveryTimeIslands ?? '48-72h';
  const deliveryMode = options?.deliveryMode ?? 'carrier_pickup';
  const pickupFee = options?.pickupFee ?? null;
  const goodsNeedsProcessing = options?.goodsNeedsProcessing ?? false;
  const processingFee = options?.processingFee ?? null;

  const vatText =
    vatMode === 'excluded'
      ? `Prezzi IVA esclusa (${vatRate}%)`
      : `Prezzi IVA inclusa (${vatRate}%)`;

  // Clausola ritiro dinamica in base al delivery mode
  const pickupClause = buildPickupClause(deliveryMode, pickupFee);

  // Clausola lavorazione (solo se attiva)
  const processingClause = goodsNeedsProcessing ? buildProcessingClause(processingFee) : null;

  const clauses: QuoteClause[] = [
    {
      title: 'IVA',
      text: vatText,
      type: 'standard',
    },
    pickupClause,
  ];

  if (processingClause) {
    clauses.push(processingClause);
  }

  clauses.push(
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
    }
  );

  return clauses;
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

/**
 * Genera la clausola lavorazione merce.
 */
function buildProcessingClause(processingFee: number | null): QuoteClause {
  const feeText =
    processingFee && processingFee > 0
      ? `Lavorazione merce (etichettatura, imballaggio): ${processingFee.toFixed(2)}\u20AC + IVA per spedizione`
      : 'Lavorazione merce (etichettatura, imballaggio) inclusa nel servizio';
  return { title: 'Lavorazione', text: feeText, type: 'standard' };
}

/**
 * Genera la clausola ritiro dinamica in base alla modalita' consegna.
 */
function buildPickupClause(deliveryMode: DeliveryMode, pickupFee: number | null): QuoteClause {
  switch (deliveryMode) {
    case 'carrier_pickup': {
      const feeText =
        pickupFee && pickupFee > 0
          ? `Ritiro a cura del corriere presso la sede del mittente (supplemento ${pickupFee.toFixed(2)}\u20AC + IVA)`
          : 'Ritiro gratuito a cura del corriere presso la sede del mittente';
      return { title: 'Ritiro', text: feeText, type: 'standard' };
    }
    case 'own_fleet': {
      const feeText =
        pickupFee && pickupFee > 0
          ? `Ritiro con nostra flotta presso la sede del mittente (supplemento ${pickupFee.toFixed(2)}\u20AC + IVA)`
          : 'Ritiro gratuito con nostra flotta presso la sede del mittente';
      return { title: 'Ritiro', text: feeText, type: 'standard' };
    }
    case 'client_dropoff':
      return {
        title: 'Consegna',
        text: 'Il cliente consegna la merce presso il nostro punto/magazzino',
        type: 'standard',
      };
    default:
      return {
        title: 'Ritiro',
        text: 'Ritiro gratuito presso la sede del mittente',
        type: 'standard',
      };
  }
}
