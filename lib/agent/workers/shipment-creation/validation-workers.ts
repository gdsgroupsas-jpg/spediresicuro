/**
 * Validazione draft spedizione: campi obbligatori e calcolo campi mancanti.
 * Usato dall'orchestratore (chain) dopo l'estrazione LLM.
 * Nessuna estrazione rule-based: i dati arrivano dai worker LLM.
 */

import type { ShipmentDraft } from '@/lib/address/shipment-draft';

export const SHIPMENT_CREATION_REQUIRED_FIELDS = [
  'sender.name',
  'sender.phone',
  'recipient.fullName',
  'recipient.addressLine1',
  'recipient.city',
  'recipient.postalCode',
  'recipient.province',
  'recipient.phone',
  'parcel.weightKg',
] as const;

/**
 * Restituisce la lista di campi obbligatori mancanti nel draft.
 * Usato dall'orchestratore per decidere se chiedere clarification o procedere con pricing/booking.
 */
export function getMissingFromDraft(draft: ShipmentDraft): string[] {
  const missing: string[] = [];
  if (!draft.sender?.name) missing.push('sender.name');
  if (!draft.sender?.phone) missing.push('sender.phone');
  if (!draft.recipient?.fullName) missing.push('recipient.fullName');
  if (!draft.recipient?.addressLine1) missing.push('recipient.addressLine1');
  if (!draft.recipient?.city) missing.push('recipient.city');
  if (!draft.recipient?.postalCode) missing.push('recipient.postalCode');
  if (!draft.recipient?.province) missing.push('recipient.province');
  if (!draft.recipient?.phone) missing.push('recipient.phone');
  if (!draft.parcel?.weightKg || draft.parcel.weightKg <= 0) missing.push('parcel.weightKg');
  return missing;
}
