import type { DeliveryMode } from '@/types/commercial-quotes';

/** Info sezione lavorazione merce */
export function getProcessingDisplayInfo(processingFee: number | null): {
  title: string;
  description: string;
} {
  if (processingFee && processingFee > 0) {
    return {
      title: 'LAVORAZIONE MERCE',
      description: `Etichettatura e imballaggio a cura dei nostri operatori — ${processingFee.toFixed(2)}€ + IVA per spedizione`,
    };
  }
  return {
    title: 'LAVORAZIONE MERCE',
    description: 'Etichettatura e imballaggio a cura dei nostri operatori — Incluso nel servizio',
  };
}

/** Info sezione ritiro */
export function getPickupDisplayInfo(
  deliveryMode: DeliveryMode,
  pickupFee: number | null
): { title: string; description: string } {
  const feeText =
    pickupFee && pickupFee > 0
      ? ` — Supplemento: ${pickupFee.toFixed(2)}€ + IVA per ritiro`
      : ' — Incluso nel prezzo';

  switch (deliveryMode) {
    case 'carrier_pickup':
      return {
        title: 'RITIRO A CURA DEL CORRIERE',
        description: `Il corriere ritira la merce presso la sede del mittente${feeText}`,
      };
    case 'own_fleet':
      return {
        title: 'RITIRO CON NOSTRA FLOTTA',
        description: `Ritiriamo la merce con la nostra flotta e la affidiamo al vettore${feeText}`,
      };
    case 'client_dropoff':
      return {
        title: 'CONSEGNA AL NOSTRO PUNTO',
        description: 'Il cliente consegna la merce presso il nostro magazzino/punto di raccolta',
      };
    default:
      return {
        title: 'RITIRO',
        description: `Ritiro presso la sede del mittente${feeText}`,
      };
  }
}
