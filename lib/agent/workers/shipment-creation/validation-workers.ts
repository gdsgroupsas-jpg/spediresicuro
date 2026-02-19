/**
 * Sette worker di validazione per la catena creazione spedizione.
 * Ogni worker controlla un sotto-insieme di campi (nomi, località, CAP, indirizzi, telefoni, province, peso/misure).
 * Estrazione rule-based (regex + normalize-it-address); output: present/value/missingLabel.
 */

import type { ShipmentDraft, Recipient, Sender, Parcel } from '@/lib/address/shipment-draft';
import {
  extractAddressDataFromText,
  extractPostalCode,
  extractProvince,
  extractCity,
  extractAddressLine1,
  extractWeight,
  normalizeText,
  normalizeStreetForPostal,
} from '@/lib/address/normalize-it-address';
import { extractFullName } from '@/lib/address/normalize-it-address';
import { mergeShipmentDraft } from '@/lib/address/shipment-draft';
import type { WorkerFieldResult } from './types';

// ---------- Helpers estrazione mittente / telefono (non in normalize-it-address) ----------

/** Pattern: "da Nome Cognome", "mittente: Nome Cognome" */
const SENDER_NAME_PATTERNS = [
  /(?:da|mittente|spedente)\s*[:\s]+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)+)/i,
  /^([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)+)\s*(?:,\s*)?(?:da|mittente)/im,
];

function extractSenderName(text: string): string | undefined {
  for (const pattern of SENDER_NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return normalizeText(match[1]);
    }
  }
  return undefined;
}

/** Numeri di telefono italiani: +39 xxx, 0xx, 3xx */
const PHONE_REGEX = /(\+39\s*)?(\d{2,4}\s*\d{6,8})/g;

function extractPhones(text: string): string[] {
  const phones: string[] = [];
  let m: RegExpExecArray | null;
  PHONE_REGEX.lastIndex = 0;
  while ((m = PHONE_REGEX.exec(text)) !== null) {
    const normalized = m[0].replace(/\s+/g, '').replace(/^\+39/, '');
    if (normalized.length >= 9 && normalized.length <= 11 && !phones.includes(normalized)) {
      phones.push(normalized);
    }
  }
  return phones.slice(0, 2); // max 2: mittente + destinatario
}

// ---------- Campi richiesti per creazione spedizione (allineato a booking + schema) ----------

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

function getMissingFromDraft(draft: ShipmentDraft): string[] {
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

// ---------- Worker 1: Nomi (mittente + destinatario) ----------

export function workerNames(
  message: string,
  draft?: ShipmentDraft
): WorkerFieldResult<{ senderName?: string; recipientName?: string }> {
  const senderName = draft?.sender?.name || extractSenderName(message);
  const recipientName = draft?.recipient?.fullName || extractFullName(message);
  const senderPresent = !!senderName;
  const recipientPresent = !!recipientName;
  return {
    present: senderPresent && recipientPresent,
    value: senderName || recipientName ? { senderName, recipientName } : undefined,
    missingLabel:
      !senderPresent && !recipientPresent
        ? 'nome mittente e nome destinatario'
        : !senderPresent
          ? 'nome mittente'
          : 'nome destinatario',
  };
}

// ---------- Worker 2: Località (città destinatario) ----------

export function workerLocalita(message: string, draft?: ShipmentDraft): WorkerFieldResult<string> {
  const city = draft?.recipient?.city || extractCity(message);
  return {
    present: !!city,
    value: city,
    missingLabel: 'città destinatario',
  };
}

// ---------- Worker 3: CAP ----------

export function workerCap(message: string, draft?: ShipmentDraft): WorkerFieldResult<string> {
  const cap = draft?.recipient?.postalCode || extractPostalCode(message);
  return {
    present: !!(cap && /^\d{5}$/.test(cap)),
    value: cap,
    missingLabel: 'CAP destinatario (5 cifre)',
  };
}

// ---------- Worker 4: Indirizzi ----------

export function workerIndirizzi(message: string, draft?: ShipmentDraft): WorkerFieldResult<string> {
  const address = draft?.recipient?.addressLine1 || extractAddressLine1(message);
  return {
    present: !!address,
    value: address,
    missingLabel: 'indirizzo destinatario (via e numero civico)',
  };
}

// ---------- Worker 5: Telefoni ----------

export function workerTelefoni(
  message: string,
  draft?: ShipmentDraft
): WorkerFieldResult<{ senderPhone?: string; recipientPhone?: string }> {
  const senderPhone = draft?.sender?.phone;
  const recipientPhone = draft?.recipient?.phone;
  const fromText = extractPhones(message);
  const sPhone = senderPhone || fromText[0];
  const rPhone = recipientPhone || (fromText.length > 1 ? fromText[1] : fromText[0]);
  const bothPresent = !!(sPhone && rPhone);
  return {
    present: bothPresent,
    value: sPhone || rPhone ? { senderPhone: sPhone, recipientPhone: rPhone } : undefined,
    missingLabel: !bothPresent ? 'telefono mittente e telefono destinatario' : undefined,
  };
}

// ---------- Worker 6: Province ----------

export function workerProvince(message: string, draft?: ShipmentDraft): WorkerFieldResult<string> {
  const province = draft?.recipient?.province || extractProvince(message);
  return {
    present: !!(province && province.length === 2),
    value: province,
    missingLabel: 'provincia destinatario (2 lettere, es. MI, RM)',
  };
}

// ---------- Worker 7: Peso e misure ----------

export function workerPesoMisure(
  message: string,
  draft?: ShipmentDraft
): WorkerFieldResult<{
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}> {
  const weight = draft?.parcel?.weightKg || extractWeight(message);
  const dimMatch = message.match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)\s*(?:cm)?/i);
  const lengthCm = draft?.parcel?.lengthCm || (dimMatch ? parseInt(dimMatch[1], 10) : undefined);
  const widthCm = draft?.parcel?.widthCm || (dimMatch ? parseInt(dimMatch[2], 10) : undefined);
  const heightCm = draft?.parcel?.heightCm || (dimMatch ? parseInt(dimMatch[3], 10) : undefined);
  const weightPresent = !!(weight && weight > 0);
  return {
    present: weightPresent,
    value:
      weight || lengthCm || widthCm || heightCm
        ? { weightKg: weight, lengthCm, widthCm, heightCm }
        : undefined,
    missingLabel: 'peso del pacco in kg',
  };
}

// ---------- Esecuzione tutti i worker + merge in un unico draft ----------

/**
 * Esegue i 7 worker in sequenza, estrae da messaggio e draft esistente, e restituisce
 * il draft aggiornato e la lista di campi mancanti.
 */
export function runAllValidationWorkers(
  message: string,
  existingDraft?: ShipmentDraft
): { updatedDraft: ShipmentDraft; missingFields: string[] } {
  // Estrazione massiva da testo (recipient + parcel) e merge con draft
  const extracted = extractAddressDataFromText(message);
  let draft = mergeShipmentDraft(existingDraft, {
    recipient: extracted.recipient,
    parcel: extracted.parcel,
  });

  // Normalizza indirizzo se presente
  if (draft.recipient?.addressLine1) {
    draft = mergeShipmentDraft(draft, {
      recipient: {
        addressLine1: normalizeStreetForPostal(draft.recipient.addressLine1),
      },
    });
  }

  // Worker 1: nomi
  const w1 = workerNames(message, draft);
  if (w1.value?.senderName)
    draft = mergeShipmentDraft(draft, { sender: { ...draft.sender, name: w1.value.senderName } });
  if (w1.value?.recipientName)
    draft = mergeShipmentDraft(draft, {
      recipient: { ...draft.recipient, fullName: w1.value.recipientName },
    });

  // Worker 2–4 già in extracted; Worker 5: telefoni
  const w5 = workerTelefoni(message, draft);
  if (w5.value?.senderPhone)
    draft = mergeShipmentDraft(draft, { sender: { ...draft.sender, phone: w5.value.senderPhone } });
  if (w5.value?.recipientPhone)
    draft = mergeShipmentDraft(draft, {
      recipient: { ...draft.recipient, phone: w5.value.recipientPhone },
    });

  // Worker 7: peso/misure
  const w7 = workerPesoMisure(message, draft);
  if (w7.value?.weightKg)
    draft = mergeShipmentDraft(draft, { parcel: { ...draft.parcel, weightKg: w7.value.weightKg } });
  if (w7.value?.lengthCm != null || w7.value?.widthCm != null || w7.value?.heightCm != null)
    draft = mergeShipmentDraft(draft, {
      parcel: {
        ...draft.parcel,
        lengthCm: w7.value?.lengthCm ?? draft.parcel?.lengthCm,
        widthCm: w7.value?.widthCm ?? draft.parcel?.widthCm,
        heightCm: w7.value?.heightCm ?? draft.parcel?.heightCm,
      },
    });
  // Se solo mittente estratto da "da X", assicuriamo sender
  if (extractSenderName(message) && !draft.sender) {
    draft = mergeShipmentDraft(draft, { sender: { name: extractSenderName(message) } });
  }
  const missingFields = getMissingFromDraft(draft);
  draft.missingFields = missingFields;
  return { updatedDraft: draft, missingFields };
}
