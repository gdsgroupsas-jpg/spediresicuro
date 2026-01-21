/**
 * ShipmentDraft Schema (Sprint 2.3)
 *
 * Schema Zod per bozza spedizione con validazione indirizzi italiani.
 * Usato da Address Worker per normalizzare e validare input utente.
 *
 * ⚠️ NO PII nei log: mai loggare addressLine1, phone, fullName, etc.
 */

import { z } from 'zod';

// ==================== VALIDATORI ====================

/**
 * CAP italiano: esattamente 5 cifre
 */
const italianPostalCodeSchema = z
  .string()
  .regex(/^\d{5}$/, 'CAP deve essere di 5 cifre')
  .optional();

/**
 * Provincia italiana: esattamente 2 lettere uppercase
 */
const italianProvinceSchema = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Provincia deve essere 2 lettere (es. MI, RM)')
  .transform((v) => v.toUpperCase())
  .optional();

/**
 * Numero di telefono italiano (permissivo)
 */
const italianPhoneSchema = z
  .string()
  .regex(/^(\+39)?[\s]?[0-9]{6,12}$/, 'Numero telefono non valido')
  .optional();

// ==================== SCHEMA PRINCIPALE ====================

export const RecipientSchema = z.object({
  fullName: z.string().trim().optional(),
  phone: italianPhoneSchema,
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  province: italianProvinceSchema,
  postalCode: italianPostalCodeSchema,
  country: z.enum(['IT']).default('IT'),
});

export const SenderSchema = z.object({
  name: z.string().trim().optional(),
  phone: italianPhoneSchema,
  company: z.string().trim().optional(),
});

export const ParcelSchema = z.object({
  weightKg: z.number().positive().optional(),
  lengthCm: z.number().positive().optional(),
  widthCm: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
});

export const ShipmentDraftSchema = z.object({
  sender: SenderSchema.optional(),
  recipient: RecipientSchema.optional(),
  parcel: ParcelSchema.optional(),
  missingFields: z.array(z.string()).default([]),
});

// ==================== TIPI DERIVATI ====================

export type Recipient = z.infer<typeof RecipientSchema>;
export type Sender = z.infer<typeof SenderSchema>;
export type Parcel = z.infer<typeof ParcelSchema>;
export type ShipmentDraft = z.infer<typeof ShipmentDraftSchema>;

// ==================== CAMPI MINIMI PER PRICING ====================

/**
 * Campi minimi richiesti per il pricing
 */
export const PRICING_REQUIRED_FIELDS = [
  'recipient.postalCode',
  'recipient.province',
  'parcel.weightKg',
] as const;

/**
 * Campi minimi per una spedizione completa
 */
export const SHIPMENT_REQUIRED_FIELDS = [
  'recipient.fullName',
  'recipient.addressLine1',
  'recipient.city',
  'recipient.postalCode',
  'recipient.province',
  'parcel.weightKg',
] as const;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Calcola i campi mancanti per il pricing
 * @param draft - Bozza spedizione
 * @returns Lista campi mancanti (es. ['recipient.postalCode'])
 */
export function calculateMissingFieldsForPricing(draft?: ShipmentDraft): string[] {
  const missing: string[] = [];

  if (!draft?.recipient?.postalCode) {
    missing.push('recipient.postalCode');
  }
  if (!draft?.recipient?.province) {
    missing.push('recipient.province');
  }
  if (!draft?.parcel?.weightKg) {
    missing.push('parcel.weightKg');
  }

  return missing;
}

/**
 * Calcola i campi mancanti per una spedizione completa
 * @param draft - Bozza spedizione
 * @returns Lista campi mancanti
 */
export function calculateMissingFieldsForShipment(draft?: ShipmentDraft): string[] {
  const missing: string[] = [];

  if (!draft?.recipient?.fullName) {
    missing.push('recipient.fullName');
  }
  if (!draft?.recipient?.addressLine1) {
    missing.push('recipient.addressLine1');
  }
  if (!draft?.recipient?.city) {
    missing.push('recipient.city');
  }
  if (!draft?.recipient?.postalCode) {
    missing.push('recipient.postalCode');
  }
  if (!draft?.recipient?.province) {
    missing.push('recipient.province');
  }
  if (!draft?.parcel?.weightKg) {
    missing.push('parcel.weightKg');
  }

  return missing;
}

/**
 * Verifica se abbiamo abbastanza dati per il pricing
 */
export function hasEnoughDataForPricing(draft?: ShipmentDraft): boolean {
  return calculateMissingFieldsForPricing(draft).length === 0;
}

/**
 * Tipo per updates parziali (permette Partial di ogni sottooggetto)
 */
export interface ShipmentDraftUpdates {
  sender?: Partial<Sender>;
  recipient?: Partial<Recipient>;
  parcel?: Partial<Parcel>;
}

/**
 * Merge non distruttivo di due draft (nuovo sovrascrive solo campi presenti)
 */
export function mergeShipmentDraft(
  existing: ShipmentDraft | undefined,
  updates: ShipmentDraftUpdates
): ShipmentDraft {
  const merged: ShipmentDraft = {
    sender: {
      ...existing?.sender,
      ...updates.sender,
    },
    recipient: {
      ...existing?.recipient,
      ...updates.recipient,
      country: 'IT', // Default IT
    },
    parcel: {
      ...existing?.parcel,
      ...updates.parcel,
    },
    missingFields: [], // Ricalcolato dopo
  };

  // Ricalcola missing fields
  merged.missingFields = calculateMissingFieldsForPricing(merged);

  return merged;
}
