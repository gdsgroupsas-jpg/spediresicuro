/**
 * Formatta la risposta pricing per il client (web chat e WhatsApp).
 */

import type { PricingResult } from '@/lib/ai/pricing-engine';

/**
 * Formatta i preventivi in un messaggio leggibile per l'utente.
 */
export function formatPricingResponse(pricingOptions: PricingResult[]): string {
  if (pricingOptions.length === 0) {
    return 'Non sono riuscita a calcolare preventivi. Puoi fornirmi peso, CAP e provincia di destinazione?';
  }

  const bestOption = pricingOptions[0];
  const otherOptions = pricingOptions.slice(1, 4); // Max 3 alternative

  let response = `💰 **Preventivo Spedizione**\n\n`;
  response += `**Opzione Consigliata:**\n`;
  response += `• Corriere: ${bestOption.courier}\n`;
  response += `• Servizio: ${bestOption.serviceType}\n`;
  response += `• Prezzo: €${bestOption.finalPrice.toFixed(2)}\n`;
  response += `• Consegna stimata: ${bestOption.estimatedDeliveryDays.min}-${bestOption.estimatedDeliveryDays.max} giorni\n\n`;

  if (otherOptions.length > 0) {
    response += `**Altre opzioni disponibili:**\n`;
    otherOptions.forEach((opt, idx) => {
      response += `${idx + 2}. ${opt.courier} (${opt.serviceType}): €${opt.finalPrice.toFixed(2)}\n`;
    });
  }

  response += `\n💡 *Prezzi calcolati con margine applicato. I dati sono indicativi.*`;

  return response;
}
