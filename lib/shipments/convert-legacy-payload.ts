/**
 * Legacy Payload Converter
 *
 * Converts legacy frontend payload format to standard format.
 * Used for backward compatibility with /dashboard/spedizioni/nuova form.
 */

export interface LegacyPayload {
  // Legacy sender fields
  mittenteNome?: string;
  mittenteAzienda?: string;
  mittenteIndirizzo?: string;
  mittenteIndirizzo2?: string;
  mittenteCitta?: string;
  mittenteProvincia?: string;
  mittenteCap?: string;
  mittenteCountry?: string;
  mittenteTelefono?: string;
  mittenteEmail?: string;

  // Legacy recipient fields
  destinatarioNome?: string;
  destinatarioAzienda?: string;
  destinatarioIndirizzo?: string;
  destinatarioIndirizzo2?: string;
  destinatarioCitta?: string;
  destinatarioProvincia?: string;
  destinatarioCap?: string;
  destinatarioCountry?: string;
  destinatarioTelefono?: string;
  destinatarioEmail?: string;

  // Legacy package fields
  peso?: string | number;
  lunghezza?: string | number;
  larghezza?: string | number;
  altezza?: string | number;

  // Legacy carrier/service fields
  corriere?: string;
  carrier?: string;
  provider?: string;
  note?: string;
  configId?: string;
  selectedContractId?: string;

  // COD
  contrassegnoAmount?: string | number;

  // VAT
  vat_mode?: string;
  vat_rate?: number;

  // Pricing
  base_price?: number;
  final_price?: number;
  priceListId?: string;

  // Pickup (ritiro a domicilio)
  pickup?: {
    pickup_from_address?: string; // "1" se attivo
    pickup_date?: string; // formato DD/MM/YYYY
    pickup_time?: string; // "AM" o "PM"
  };
}

export interface StandardPayload {
  sender: {
    name: string;
    company?: string;
    address: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone?: string;
    email: string;
  };
  recipient: {
    name: string;
    company?: string;
    address: string;
    address2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
  };
  packages: Array<{
    weight: number;
    length: number;
    width: number;
    height: number;
  }>;
  carrier: string;
  provider: string;
  notes?: string;
  configId?: string;
  contract_id?: string;
  cod?: { value: number };
  vat_mode?: string;
  vat_rate?: number;
  base_price?: number;
  final_price?: number;
  priceListId?: string;

  // Pickup (ritiro a domicilio)
  pickup?: {
    pickup_from_address?: string; // "1" se attivo
    pickup_date?: string; // formato DD/MM/YYYY
    pickup_time?: string; // "AM" o "PM"
  };
}

/**
 * Normalizes carrier names to match the enum values.
 * Maps various carrier name variations to standard codes.
 */
function normalizeCarrierName(carrier: string): string {
  const normalized = carrier.toUpperCase().trim();

  // Poste variations
  if (
    normalized.includes('POSTE') ||
    normalized.includes('POSTEDELIVERY') ||
    normalized.includes('POSTEITALIANE')
  ) {
    return 'POSTE';
  }

  // GLS variations
  if (normalized.includes('GLS')) {
    return 'GLS';
  }

  // BRT/Bartolini variations
  if (normalized.includes('BRT') || normalized.includes('BARTOLINI')) {
    return 'BRT';
  }

  // SDA variations
  if (normalized.includes('SDA')) {
    return 'SDA';
  }

  // UPS variations
  if (normalized.includes('UPS')) {
    return 'UPS';
  }

  // DHL variations
  if (normalized.includes('DHL')) {
    return 'DHL';
  }

  // TNT variations
  if (normalized.includes('TNT')) {
    return 'TNT';
  }

  // FedEx variations
  if (normalized.includes('FEDEX') || normalized.includes('FED')) {
    return 'FEDEX';
  }

  // Return as-is if no match (validation will catch invalid values)
  return normalized;
}

/**
 * Converts legacy payload format to standard format.
 *
 * @param body - The request body (could be legacy or standard format)
 * @returns Standard payload format
 */
export function convertLegacyPayload(body: LegacyPayload | StandardPayload): StandardPayload {
  // If already in new format (has sender, recipient, packages), return as-is
  if ('sender' in body && 'recipient' in body && 'packages' in body) {
    return body as StandardPayload;
  }

  const legacy = body as LegacyPayload;

  // Detect if it's legacy format (has mittenteNome or destinatarioNome)
  const isLegacy = legacy.mittenteNome || legacy.destinatarioNome;
  if (!isLegacy) {
    // Not legacy, return as-is (may fail validation later, but that's expected)
    return body as StandardPayload;
  }

  console.log('🔄 [LEGACY] Convertendo payload legacy in formato standard');

  // Convert legacy -> standard format
  const converted: StandardPayload = {
    sender: {
      name: legacy.mittenteNome || '',
      company: legacy.mittenteAzienda,
      address: legacy.mittenteIndirizzo || '',
      address2: legacy.mittenteIndirizzo2,
      city: legacy.mittenteCitta || '',
      province: legacy.mittenteProvincia || '',
      postalCode: legacy.mittenteCap || '',
      country: legacy.mittenteCountry || 'IT',
      phone: legacy.mittenteTelefono,
      email: legacy.mittenteEmail || 'noemail@spediresicuro.it',
    },
    recipient: {
      name: legacy.destinatarioNome || '',
      company: legacy.destinatarioAzienda,
      address: legacy.destinatarioIndirizzo || '',
      address2: legacy.destinatarioIndirizzo2,
      city: legacy.destinatarioCitta || '',
      province: legacy.destinatarioProvincia || '',
      postalCode: legacy.destinatarioCap || '',
      country: legacy.destinatarioCountry || 'IT',
      phone: legacy.destinatarioTelefono,
      // Only include email if it's a valid non-empty string
      email:
        legacy.destinatarioEmail && legacy.destinatarioEmail.trim()
          ? legacy.destinatarioEmail.trim()
          : undefined,
    },
    packages: [
      {
        weight: parseFloat(String(legacy.peso)) || 1,
        length: parseFloat(String(legacy.lunghezza)) || 10,
        width: parseFloat(String(legacy.larghezza)) || 10,
        height: parseFloat(String(legacy.altezza)) || 10,
      },
    ],
    carrier: normalizeCarrierName(legacy.corriere || legacy.carrier || ''),
    provider: legacy.provider || 'spediscionline',
    notes: legacy.note,
    configId: legacy.configId,
    contract_id: legacy.selectedContractId,
    vat_mode: legacy.vat_mode,
    vat_rate: legacy.vat_rate,
    base_price: legacy.base_price,
    final_price: legacy.final_price,
    priceListId: legacy.priceListId,
    // Pickup (passthrough)
    pickup: legacy.pickup,
  };

  // Add COD if present
  const codAmount = parseFloat(String(legacy.contrassegnoAmount));
  if (codAmount > 0) {
    converted.cod = { value: codAmount };
  }

  return converted;
}
